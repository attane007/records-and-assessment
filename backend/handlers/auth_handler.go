package handlers

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"backend/services"

	"github.com/gin-gonic/gin"
)

// AuthHandler handles the OIDC authentication flow on behalf of the frontend.
// The frontend redirects the browser to /auth/login; the backend drives the full
// OAuth2 Authorization Code + PKCE flow and, after a successful exchange, hands
// back a signed session JWT to the frontend via a query-parameter redirect.
type AuthHandler struct{}

// NewAuthHandler returns a new AuthHandler.
func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

func authSecret() string { return os.Getenv("AUTH_SECRET") }

func (h *AuthHandler) frontendURL() string {
	u := strings.TrimRight(os.Getenv("FRONTEND_URL"), "/")
	if u == "" {
		u = "http://localhost:3000"
	}
	return u
}

// backendCallbackURI derives the redirect_uri for the OIDC flow.
// Prefers the BACKEND_PUBLIC_URL env var; falls back to the incoming request host.
func (h *AuthHandler) backendCallbackURI(c *gin.Context) string {
	base := strings.TrimRight(os.Getenv("BACKEND_PUBLIC_URL"), "/")
	if base == "" {
		proto := "http"
		if c.Request.TLS != nil {
			proto = "https"
		}
		if fwdProto := c.GetHeader("X-Forwarded-Proto"); fwdProto != "" {
			proto = fwdProto
		}
		host := c.GetHeader("X-Forwarded-Host")
		if host == "" {
			host = c.Request.Host
		}
		if host == "" {
			host = "localhost:8080"
		}
		base = fmt.Sprintf("%s://%s", proto, host)
	}
	return base + "/auth/callback"
}

// GET /auth/login — initiate OIDC authorization code + PKCE flow.
func (h *AuthHandler) Login(c *gin.Context) {
	clientID := os.Getenv("OIDC_CLIENT_ID")
	secret := authSecret()
	if clientID == "" || secret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "auth not configured"})
		return
	}

	endpoints, err := services.DiscoverOIDCEndpoints(
		os.Getenv("OIDC_BASE_URL"),
		os.Getenv("OIDC_DISCOVERY_URL"),
	)
	if err != nil {
		log.Printf("OIDC discovery failed: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "OIDC discovery failed"})
		return
	}

	state, err := services.GenerateRandomState()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "state generation failed"})
		return
	}
	nonce, err := services.GenerateRandomState()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "nonce generation failed"})
		return
	}
	codeVerifier, err := services.GenerateCodeVerifier()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "pkce generation failed"})
		return
	}
	codeChallenge := services.GenerateCodeChallenge(codeVerifier)
	redirectURI := h.backendCallbackURI(c)

	tx := services.OIDCTransactionPayload{
		State:        state,
		Nonce:        nonce,
		CodeVerifier: codeVerifier,
		RedirectURI:  redirectURI,
		Exp:          time.Now().Unix() + 600,
	}
	txToken, err := services.IssueTransactionJWT(secret, tx)
	if err != nil {
		log.Printf("issue tx jwt: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	params := url.Values{
		"client_id":             {clientID},
		"response_type":         {"code"},
		"redirect_uri":          {redirectURI},
		"scope":                 {"openid profile email"},
		"state":                 {state},
		"nonce":                 {nonce},
		"code_challenge":        {codeChallenge},
		"code_challenge_method": {"S256"},
	}
	authorizationURL := endpoints.AuthorizationEndpoint + "?" + params.Encode()

	isProd := os.Getenv("GO_ENV") == "production"
	c.SetCookie("oidc_tx", txToken, 600, "/", "", isProd, true)
	c.Redirect(http.StatusFound, authorizationURL)
}

// GET /auth/callback — receive authorization code, exchange for tokens, issue session JWT,
// then redirect browser to {FRONTEND_URL}/api/auth/callback?token=<sessionJWT>.
func (h *AuthHandler) Callback(c *gin.Context) {
	clientID := os.Getenv("OIDC_CLIENT_ID")
	clientSecret := os.Getenv("OIDC_CLIENT_SECRET")
	secret := authSecret()
	frontend := h.frontendURL()

	if clientID == "" || secret == "" {
		c.Redirect(http.StatusFound, frontend+"/login?error=config_error")
		return
	}

	fail := func(reason string) {
		isProd := os.Getenv("GO_ENV") == "production"
		c.SetCookie("oidc_tx", "", -1, "/", "", isProd, true)
		c.Redirect(http.StatusFound, frontend+"/login?error="+url.QueryEscape(reason))
	}

	if errParam := c.Query("error"); errParam != "" {
		fail("auth_failed")
		return
	}

	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		fail("missing_params")
		return
	}

	txToken, err := c.Cookie("oidc_tx")
	if err != nil || txToken == "" {
		fail("missing_state")
		return
	}

	tx, err := services.VerifyTransactionJWT(secret, txToken)
	if err != nil {
		log.Printf("oidc tx verify failed: %v", err)
		fail("invalid_state")
		return
	}

	if tx.State != state {
		fail("state_mismatch")
		return
	}

	endpoints, err := services.DiscoverOIDCEndpoints(
		os.Getenv("OIDC_BASE_URL"),
		os.Getenv("OIDC_DISCOVERY_URL"),
	)
	if err != nil {
		log.Printf("OIDC discovery failed in callback: %v", err)
		fail("config_error")
		return
	}

	tokens, err := services.ExchangeCodeForTokens(clientID, clientSecret, code, tx.CodeVerifier, tx.RedirectURI, endpoints.TokenEndpoint)
	if err != nil {
		log.Printf("token exchange failed: %v", err)
		fail("token_exchange_failed")
		return
	}

	// Verify nonce in id_token if present.
	if tokens.IDToken != "" {
		if err := verifyIDTokenNonce(tokens.IDToken, tx.Nonce); err != nil {
			log.Printf("nonce mismatch: %v", err)
			fail("nonce_mismatch")
			return
		}
	}

	profile, err := services.FetchUserInfo(tokens.AccessToken, endpoints.UserinfoEndpoint)
	if err != nil {
		log.Printf("userinfo fetch failed: %v", err)
		fail("profile_fetch_failed")
		return
	}

	// Some providers nest profile fields under a "user" key.
	if nested, ok := profile["user"].(map[string]any); ok {
		profile = nested
	}

	accountID := stringFromMap(profile, "id", "sub", "account_id", "accountId", "email")
	username := stringFromMap(profile, "username", "name", "preferred_username", "email")
	if username == "" {
		username = accountID
	}
	if accountID == "" {
		log.Printf("no recognizable ID in OIDC profile: %v", profile)
		fail("invalid_profile")
		return
	}

	expiresIn := tokens.ExpiresIn
	if expiresIn <= 0 {
		expiresIn = 8 * 3600
	}

	sessionJWT, err := services.IssueSessionJWT(secret, accountID, username, accountID, expiresIn)
	if err != nil {
		log.Printf("issue session jwt: %v", err)
		fail("internal_error")
		return
	}

	// Clear transaction cookie.
	isProd := os.Getenv("GO_ENV") == "production"
	c.SetCookie("oidc_tx", "", -1, "/", "", isProd, true)

	// Hand off session JWT to frontend via query parameter.
	redirectURL := frontend + "/api/auth/callback?token=" + url.QueryEscape(sessionJWT)
	c.Redirect(http.StatusFound, redirectURL)
}

// POST /auth/refresh — issue a fresh session JWT for a still-valid token (sliding session).
func (h *AuthHandler) Refresh(c *gin.Context) {
	secret := authSecret()
	if secret == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "auth not configured"})
		return
	}

	bearerToken := extractBearerToken(c.GetHeader("Authorization"))
	if bearerToken == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
		return
	}

	claims, err := services.VerifySessionJWT(secret, bearerToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
		return
	}

	const expiresIn = 8 * 3600
	newToken, err := services.IssueSessionJWT(secret, claims.Sub, claims.Username, claims.AccountID, expiresIn)
	if err != nil {
		log.Printf("issue refresh jwt: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":      newToken,
		"expires_in": expiresIn,
	})
}

// ─── Private helpers ───────────────────────────────────────────────────────────

// stringFromMap returns the first non-empty string value found under the given keys.
func stringFromMap(m map[string]any, keys ...string) string {
	for _, key := range keys {
		v, ok := m[key]
		if !ok {
			continue
		}
		if s, ok := v.(string); ok && strings.TrimSpace(s) != "" {
			return strings.TrimSpace(s)
		}
	}
	return ""
}

// verifyIDTokenNonce decodes the id_token payload (without signature verification)
// and checks that the nonce claim matches the expected value.
func verifyIDTokenNonce(idToken, expectedNonce string) error {
	parts := strings.SplitN(idToken, ".", 3)
	if len(parts) != 3 {
		return fmt.Errorf("invalid id_token format")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return fmt.Errorf("decode id_token payload: %w", err)
	}
	var claims map[string]any
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return fmt.Errorf("parse id_token payload: %w", err)
	}
	nonce, _ := claims["nonce"].(string)
	if nonce != expectedNonce {
		return fmt.Errorf("nonce mismatch")
	}
	return nil
}
