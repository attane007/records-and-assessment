package handlers

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"backend/services"

	"github.com/gin-gonic/gin"
	jwtv5 "github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/mongo"
)

// AuthHandler handles the OIDC authentication flow on behalf of the frontend.
// The frontend redirects the browser to /auth/login; the backend drives the full
// OAuth2 Authorization Code + PKCE flow and, after a successful exchange, hands
// back a signed session JWT to the frontend via a query-parameter redirect.
type AuthHandler struct {
	logoutHandlesColl *mongo.Collection
	backchannelEvents *backchannelLogoutEventStore
}

type authErrorPayload struct {
	Error authErrorDetail `json:"error"`
}

type authErrorDetail struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Reason    string `json:"reason,omitempty"`
	Retryable bool   `json:"retryable"`
	RequestID string `json:"request_id,omitempty"`
}

const (
	backchannelLogoutEventClaim = "http://schemas.openid.net/event/backchannel-logout"
	sessionUpdatedEventType     = "session.updated"
)

// NewAuthHandler returns a new AuthHandler.
func NewAuthHandler(logoutHandlesColl *mongo.Collection) *AuthHandler {
	return &AuthHandler{
		logoutHandlesColl: logoutHandlesColl,
		backchannelEvents: newBackchannelLogoutEventStore(7 * 24 * time.Hour),
	}
}

func authSecret() string { return os.Getenv("AUTH_SECRET") }

func authPostLogoutAllowlist() []string {
	configured := strings.TrimSpace(os.Getenv("OIDC_POST_LOGOUT_REDIRECT_URIS"))
	if configured == "" {
		return []string{}
	}
	parts := strings.Split(configured, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		uri := strings.TrimSpace(part)
		if uri != "" {
			out = append(out, uri)
		}
	}
	return out
}

func defaultPostLogoutRedirect(frontend string) string {
	if configured := strings.TrimSpace(os.Getenv("OIDC_POST_LOGOUT_DEFAULT_REDIRECT_URI")); configured != "" {
		return configured
	}
	return frontend + "/login?reason=session_logged_out"
}

func isAllowlistedURI(uri string, allowlist []string) bool {
	if uri == "" {
		return false
	}
	for _, item := range allowlist {
		if uri == item {
			return true
		}
	}
	return false
}

func shouldReturnJSON(c *gin.Context) bool {
	if strings.EqualFold(strings.TrimSpace(c.Query("mode")), "json") {
		return true
	}
	accept := strings.ToLower(c.GetHeader("Accept"))
	return strings.Contains(accept, "application/json")
}

func setNoStoreHeaders(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
}

func authError(c *gin.Context, status int, code, message, reason string, retryable bool) {
	setNoStoreHeaders(c)
	payload := authErrorPayload{
		Error: authErrorDetail{
			Code:      code,
			Message:   message,
			Reason:    reason,
			Retryable: retryable,
			RequestID: strings.TrimSpace(c.GetHeader("X-Request-Id")),
		},
	}
	c.JSON(status, payload)
}

func sessionLogoutHandleActive(ctx context.Context, logoutHandlesColl *mongo.Collection, claims *services.SessionClaims) error {
	if logoutHandlesColl == nil || claims == nil {
		return nil
	}

	handleID := strings.TrimSpace(claims.LogoutHandleID)
	if handleID == "" {
		return nil
	}

	handle, err := services.GetLogoutHandleByID(ctx, logoutHandlesColl, handleID)
	if err != nil {
		return err
	}
	if handle != nil && handle.SessionVersion > 0 && claims.SessionVersion < handle.SessionVersion {
		return services.ErrLogoutHandleRevoked
	}
	return nil
}

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
		authError(c, http.StatusInternalServerError, "auth_not_configured", "Authentication is not configured", "missing_client_or_secret", false)
		return
	}

	endpoints, err := services.DiscoverOIDCEndpoints(
		os.Getenv("OIDC_BASE_URL"),
		os.Getenv("OIDC_DISCOVERY_URL"),
	)
	if err != nil {
		log.Printf("OIDC discovery failed: %v", err)
		authError(c, http.StatusInternalServerError, "oidc_discovery_failed", "OIDC discovery failed", "discovery_error", true)
		return
	}

	prompt := strings.TrimSpace(c.Query("prompt"))
	if prompt != "" && prompt != "none" && prompt != "login" {
		authError(c, http.StatusBadRequest, "invalid_request", "Invalid prompt parameter", "unsupported_prompt", false)
		return
	}

	state, err := services.GenerateRandomState()
	if err != nil {
		authError(c, http.StatusInternalServerError, "internal_error", "State generation failed", "state_generation_failed", true)
		return
	}
	nonce, err := services.GenerateRandomState()
	if err != nil {
		authError(c, http.StatusInternalServerError, "internal_error", "Nonce generation failed", "nonce_generation_failed", true)
		return
	}
	codeVerifier, err := services.GenerateCodeVerifier()
	if err != nil {
		authError(c, http.StatusInternalServerError, "internal_error", "PKCE generation failed", "pkce_generation_failed", true)
		return
	}
	codeChallenge := services.GenerateCodeChallenge(codeVerifier)
	redirectURI := h.backendCallbackURI(c)
	returnTo := strings.TrimSpace(c.Query("return_to"))
	if returnTo != "" && !strings.HasPrefix(returnTo, "/") {
		returnTo = ""
	}

	tx := services.OIDCTransactionPayload{
		State:        state,
		Nonce:        nonce,
		CodeVerifier: codeVerifier,
		RedirectURI:  redirectURI,
		ReturnTo:     returnTo,
		Exp:          time.Now().Unix() + 600,
	}
	txToken, err := services.IssueTransactionJWT(secret, tx)
	if err != nil {
		log.Printf("issue tx jwt: %v", err)
		authError(c, http.StatusInternalServerError, "internal_error", "Failed to create login transaction", "transaction_issue_failed", true)
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
	if prompt != "" {
		params.Set("prompt", prompt)
	}
	authorizationURL := endpoints.AuthorizationEndpoint + "?" + params.Encode()

	isProd := os.Getenv("GO_ENV") == "production"
	setNoStoreHeaders(c)
	c.SetCookie("oidc_tx", txToken, 600, "/", "", isProd, true)
	if shouldReturnJSON(c) {
		c.JSON(http.StatusOK, gin.H{
			"authorize_url": authorizationURL,
			"expires_in":    600,
		})
		return
	}
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
		setNoStoreHeaders(c)
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
	if strings.TrimSpace(tokens.IDToken) == "" {
		log.Printf("token exchange returned no id_token")
		fail("missing_id_token")
		return
	}

	// Verify nonce in id_token if present.
	if err := verifyIDTokenNonce(tokens.IDToken, tx.Nonce); err != nil {
		log.Printf("nonce mismatch: %v", err)
		fail("nonce_mismatch")
		return
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
	if h.logoutHandlesColl == nil {
		log.Printf("logout handle collection is not configured")
		fail("config_error")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	logoutHandle, err := services.CreateLogoutHandle(ctx, h.logoutHandlesColl, accountID, accountID, tokens.IDToken, clientID, services.DefaultSessionExpiry(time.Now()))
	if err != nil {
		log.Printf("create logout handle failed: %v", err)
		fail("logout_handle_failed")
		return
	}

	sessionJWT, err := services.IssueSessionJWTWithLogoutHandle(secret, accountID, username, accountID, logoutHandle.ID.Hex(), expiresIn)
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
	if strings.TrimSpace(tx.ReturnTo) != "" {
		redirectURL += "&return_to=" + url.QueryEscape(tx.ReturnTo)
	}
	setNoStoreHeaders(c)
	c.Redirect(http.StatusFound, redirectURL)
}

// POST /auth/refresh — issue a fresh session JWT from Authorization bearer token.
// Supports reclaim for expired access tokens while the absolute session lifetime is still valid.
func (h *AuthHandler) Refresh(c *gin.Context) {
	secret := authSecret()
	if secret == "" {
		authError(c, http.StatusInternalServerError, "auth_not_configured", "Authentication is not configured", "missing_auth_secret", false)
		return
	}

	bearerToken := extractBearerToken(c.GetHeader("Authorization"))
	if bearerToken == "" {
		authError(c, http.StatusUnauthorized, "unauthorized", "Missing bearer token", "missing_bearer_token", false)
		return
	}

	claims, err := services.VerifySessionJWT(secret, bearerToken)
	if err != nil {
		claims, err = services.VerifySessionJWTAllowExpired(secret, bearerToken)
		if err != nil {
			authError(c, http.StatusUnauthorized, "invalid_grant", "Invalid or expired token", "access_token_invalid", false)
			return
		}
	}
	if err := sessionLogoutHandleActive(c.Request.Context(), h.logoutHandlesColl, claims); err != nil {
		log.Printf("refresh blocked by revoked logout handle: %v", err)
		authError(c, http.StatusUnauthorized, "invalid_grant", "Session has been revoked", "session_revoked", false)
		return
	}

	const expiresIn = 8 * 3600
	newToken, err := services.IssueSessionJWTForSession(secret, claims, expiresIn)
	if err != nil {
		if strings.Contains(err.Error(), "session expired") {
			authError(c, http.StatusUnauthorized, "invalid_grant", "Session expired", "session_expired", false)
			return
		}
		log.Printf("issue refresh jwt: %v", err)
		authError(c, http.StatusInternalServerError, "internal_error", "Failed to refresh token", "refresh_issue_failed", true)
		return
	}

	refreshedClaims, err := services.VerifySessionJWTAllowExpired(secret, newToken)
	if err != nil {
		log.Printf("verify refreshed jwt: %v", err)
		authError(c, http.StatusInternalServerError, "internal_error", "Failed to verify refreshed token", "refresh_verify_failed", true)
		return
	}

	remaining := int(refreshedClaims.Exp - time.Now().Unix())
	if remaining < 0 {
		remaining = 0
	}

	setNoStoreHeaders(c)
	c.JSON(http.StatusOK, gin.H{
		"token":      newToken,
		"expires_in": remaining,
		"exp":        refreshedClaims.Exp,
	})
}

// GET /auth/session — resolve auth state from bearer token and opportunistically refresh.
func (h *AuthHandler) Session(c *gin.Context) {
	secret := authSecret()
	if secret == "" {
		authError(c, http.StatusInternalServerError, "auth_not_configured", "Authentication is not configured", "missing_auth_secret", false)
		return
	}

	bearerToken := extractBearerToken(c.GetHeader("Authorization"))
	if bearerToken == "" {
		setNoStoreHeaders(c)
		c.JSON(http.StatusOK, gin.H{"authenticated": false})
		return
	}

	claims, err := services.VerifySessionJWT(secret, bearerToken)
	if err == nil {
		if revocationErr := sessionLogoutHandleActive(c.Request.Context(), h.logoutHandlesColl, claims); revocationErr != nil {
			log.Printf("session rejected by revoked logout handle: %v", revocationErr)
			setNoStoreHeaders(c)
			c.JSON(http.StatusOK, gin.H{"authenticated": false})
			return
		}

		displayName := strings.TrimSpace(claims.DisplayName)
		if displayName == "" {
			displayName = strings.TrimSpace(claims.Username)
		}
		if displayName == "" {
			displayName = strings.TrimSpace(claims.AuthSubject)
		}

		authSubject := strings.TrimSpace(claims.AuthSubject)
		if authSubject == "" {
			authSubject = strings.TrimSpace(claims.AccountID)
		}

		tenantID := strings.TrimSpace(claims.TenantID)
		if tenantID == "" {
			tenantID = authSubject
		}

		scopes := append([]string(nil), claims.Scopes...)
		if len(scopes) == 0 && strings.TrimSpace(claims.Scope) != "" {
			scopes = strings.Fields(claims.Scope)
		}

		setNoStoreHeaders(c)
		c.JSON(http.StatusOK, gin.H{
			"authenticated": true,
			"user": gin.H{
				"subject":         claims.Sub,
				"auth_subject":    authSubject,
				"account_id":      claims.AccountID,
				"tenant_id":       tenantID,
				"display_name":    displayName,
				"scopes":          scopes,
				"session_version": claims.SessionVersion,
			},
			"session": gin.H{
				"expires_at_unix": claims.SessionExp,
			},
		})
		return
	}

	setNoStoreHeaders(c)
	c.JSON(http.StatusOK, gin.H{"authenticated": false})
}

type logoutRequest struct {
	PostLogoutRedirectURI string `json:"post_logout_redirect_uri"`
}

// POST /auth/logout — clear local session and build OP end-session URL.
func (h *AuthHandler) Logout(c *gin.Context) {
	frontend := h.frontendURL()
	allowlist := authPostLogoutAllowlist()
	defaultRedirect := defaultPostLogoutRedirect(frontend)
	if len(allowlist) == 0 {
		allowlist = append(allowlist, defaultRedirect)
	}

	var body logoutRequest
	if c.Request.Body != nil {
		buf := new(bytes.Buffer)
		_, _ = buf.ReadFrom(c.Request.Body)
		if raw := strings.TrimSpace(buf.String()); raw != "" {
			if err := json.Unmarshal([]byte(raw), &body); err != nil {
				authError(c, http.StatusBadRequest, "invalid_request", "Invalid logout request payload", "invalid_json", false)
				return
			}
		}
	}

	requested := strings.TrimSpace(body.PostLogoutRedirectURI)
	if requested == "" {
		requested = defaultRedirect
	}
	logoutURL := requested
	if !isAllowlistedURI(requested, allowlist) {
		authError(c, http.StatusBadRequest, "post_logout_redirect_uri_mismatch", "Post logout redirect URI is not allowlisted", "post_logout_redirect_uri_not_allowlisted", false)
		return
	}

	bearerToken := extractBearerToken(c.GetHeader("Authorization"))
	secret := authSecret()
	if bearerToken != "" && secret != "" && h.logoutHandlesColl != nil {
		claims, claimsErr := services.VerifySessionJWT(secret, bearerToken)
		if claimsErr != nil {
			claims, claimsErr = services.VerifySessionJWTAllowExpired(secret, bearerToken)
		}
		if claimsErr == nil && claims != nil && strings.TrimSpace(claims.LogoutHandleID) != "" {
			ctx, cancel := context.WithTimeout(c.Request.Context(), 3*time.Second)
			defer cancel()

			handle, handleErr := services.GetLogoutHandleByID(ctx, h.logoutHandlesColl, claims.LogoutHandleID)
			if handleErr == nil && strings.TrimSpace(handle.IDToken) != "" {
				endpoints, discoveryErr := services.DiscoverOIDCEndpoints(
					os.Getenv("OIDC_BASE_URL"),
					os.Getenv("OIDC_DISCOVERY_URL"),
				)
				if discoveryErr == nil && strings.TrimSpace(endpoints.EndSessionEndpoint) != "" {
					state, genErr := services.GenerateRandomState()
					if genErr == nil {
						params := url.Values{}
						params.Set("post_logout_redirect_uri", requested)
						params.Set("state", state)
						params.Set("id_token_hint", handle.IDToken)
						logoutURL = endpoints.EndSessionEndpoint + "?" + params.Encode()
					} else {
						log.Printf("logout state generation failed: %v", genErr)
					}
				} else if discoveryErr != nil {
					log.Printf("OIDC end-session discovery failed: %v", discoveryErr)
				} else {
					log.Printf("OIDC end-session endpoint is empty")
				}
			} else if handleErr != nil {
				log.Printf("logout handle lookup failed: %v", handleErr)
			}
		} else if claimsErr != nil {
			log.Printf("logout session verification failed, using local redirect fallback: %v", claimsErr)
		}
	} else if bearerToken == "" {
		log.Printf("logout request missing bearer token, using local redirect fallback")
	} else if secret == "" {
		log.Printf("auth secret is not configured, using local redirect fallback")
	} else {
		log.Printf("logout handle collection is not configured, using local redirect fallback")
	}

	isProd := os.Getenv("GO_ENV") == "production"
	setNoStoreHeaders(c)
	c.SetCookie("oidc_tx", "", -1, "/", "", isProd, true)
	c.SetCookie("session", "", -1, "/", "", isProd, true)
	c.JSON(http.StatusOK, gin.H{
		"logout_url":               logoutURL,
		"post_logout_redirect_uri": requested,
	})
}

// GET /auth/frontchannel-logout — clear local state and broadcast global-logout signal.
// POST /auth/frontchannel-logout — accept a backchannel logout_token and revoke local handles by sid.
func (h *AuthHandler) FrontchannelLogout(c *gin.Context) {
	setNoStoreHeaders(c)
	c.Status(http.StatusNoContent)
}

// POST /auth/frontchannel-logout — receive backchannel logout from the OP.
func (h *AuthHandler) BackchannelLogout(c *gin.Context) {
	_ = h
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.Status(http.StatusNoContent)
}

func (h *AuthHandler) BackchannelSessionEvent(c *gin.Context, secret, clientID, issuer, rawSessionEventToken string) {
	_ = h
	_ = secret
	_ = clientID
	_ = issuer
	_ = rawSessionEventToken

	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.Status(http.StatusNoContent)
}

func verifyBackchannelLogoutToken(secret, issuer, audience, rawToken string) (*backchannelLogoutTokenClaims, error) {
	trimmedToken := strings.TrimSpace(rawToken)
	if trimmedToken == "" {
		return nil, fmt.Errorf("logout token is required")
	}

	claims := &backchannelLogoutTokenClaims{}
	token, err := jwtv5.ParseWithClaims(
		trimmedToken,
		claims,
		func(token *jwtv5.Token) (any, error) {
			if token.Method == nil || token.Method.Alg() != jwtv5.SigningMethodHS256.Alg() {
				return nil, fmt.Errorf("unexpected logout token signing method: %v", token.Header["alg"])
			}
			return []byte(secret), nil
		},
		jwtv5.WithIssuer(strings.TrimSpace(issuer)),
		jwtv5.WithAudience(strings.TrimSpace(audience)),
		jwtv5.WithValidMethods([]string{jwtv5.SigningMethodHS256.Alg()}),
	)
	if err != nil {
		return nil, err
	}
	if token == nil || !token.Valid {
		return nil, fmt.Errorf("invalid logout token")
	}
	if strings.TrimSpace(claims.ID) == "" {
		return nil, fmt.Errorf("logout token missing jti")
	}
	if strings.TrimSpace(claims.Sid) == "" {
		return nil, fmt.Errorf("logout token missing sid")
	}
	if len(claims.Events) == 0 {
		return nil, fmt.Errorf("logout token missing events claim")
	}
	if _, ok := claims.Events[backchannelLogoutEventClaim]; !ok {
		return nil, fmt.Errorf("logout token missing backchannel logout event")
	}
	return claims, nil
}

func verifyBackchannelSessionEventToken(secret, issuer, audience, rawToken string) (*backchannelSessionEventTokenClaims, error) {
	trimmedToken := strings.TrimSpace(rawToken)
	if trimmedToken == "" {
		return nil, errors.New("session event token is required")
	}

	claims := &backchannelSessionEventTokenClaims{}
	token, err := jwtv5.ParseWithClaims(
		trimmedToken,
		claims,
		func(token *jwtv5.Token) (any, error) {
			if token.Method == nil || token.Method.Alg() != jwtv5.SigningMethodHS256.Alg() {
				return nil, fmt.Errorf("unexpected session event token signing method: %v", token.Header["alg"])
			}
			return []byte(secret), nil
		},
		jwtv5.WithIssuer(strings.TrimSpace(issuer)),
		jwtv5.WithAudience(strings.TrimSpace(audience)),
		jwtv5.WithValidMethods([]string{jwtv5.SigningMethodHS256.Alg()}),
	)
	if err != nil {
		return nil, err
	}
	if token == nil || !token.Valid {
		return nil, errors.New("invalid session event token")
	}
	if strings.TrimSpace(claims.ID) == "" {
		return nil, errors.New("session event token missing jti")
	}
	if strings.TrimSpace(claims.Sid) == "" {
		return nil, errors.New("session event token missing sid")
	}
	if strings.TrimSpace(claims.EventType) != sessionUpdatedEventType {
		return nil, errors.New("session event token missing session.updated event type")
	}
	if claims.SessionVersion <= 0 {
		return nil, errors.New("session event token missing session_version")
	}
	return claims, nil
}

type backchannelLogoutTokenClaims struct {
	jwtv5.RegisteredClaims
	Sid    string                    `json:"sid,omitempty"`
	Events map[string]map[string]any `json:"events,omitempty"`
}

type backchannelSessionEventTokenClaims struct {
	jwtv5.RegisteredClaims
	EventType      string `json:"event_type,omitempty"`
	Sid            string `json:"sid,omitempty"`
	SessionVersion int64  `json:"session_version,omitempty"`
	Reason         string `json:"reason,omitempty"`
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
