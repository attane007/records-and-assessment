package services

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

const (
	defaultAccessTokenTTLSeconds = 8 * 3600
	defaultSessionMaxAgeSeconds  = 7 * 24 * 3600
)

// ─── PKCE Helpers ──────────────────────────────────────────────────────────────

func randomBase64URL(n int) (string, error) {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate random bytes: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// GenerateCodeVerifier creates a PKCE code verifier (64 random bytes → base64url).
func GenerateCodeVerifier() (string, error) {
	return randomBase64URL(64)
}

// GenerateCodeChallenge creates a PKCE S256 code challenge from a verifier.
func GenerateCodeChallenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// GenerateRandomState creates a random state/nonce value.
func GenerateRandomState() (string, error) {
	return randomBase64URL(32)
}

// ─── OIDC Discovery ────────────────────────────────────────────────────────────

// OIDCEndpoints holds discovered OIDC endpoint URLs.
type OIDCEndpoints struct {
	AuthorizationEndpoint string
	TokenEndpoint         string
	UserinfoEndpoint      string
}

var (
	oidcEndpointsCache    *OIDCEndpoints
	oidcEndpointsMu       sync.RWMutex
	oidcEndpointsCachedAt time.Time
	oidcEndpointsCacheTTL = 5 * time.Minute
)

type oidcDiscoveryDoc struct {
	AuthorizationEndpoint string `json:"authorization_endpoint"`
	TokenEndpoint         string `json:"token_endpoint"`
	UserinfoEndpoint      string `json:"userinfo_endpoint"`
}

// DiscoverOIDCEndpoints fetches (and caches) OIDC endpoint URLs.
func DiscoverOIDCEndpoints(baseURL, discoveryURL string) (*OIDCEndpoints, error) {
	oidcEndpointsMu.RLock()
	if oidcEndpointsCache != nil && time.Since(oidcEndpointsCachedAt) < oidcEndpointsCacheTTL {
		ep := *oidcEndpointsCache
		oidcEndpointsMu.RUnlock()
		return &ep, nil
	}
	oidcEndpointsMu.RUnlock()

	if discoveryURL == "" && baseURL != "" {
		discoveryURL = strings.TrimRight(baseURL, "/") + "/.well-known/openid-configuration"
	}
	if discoveryURL == "" {
		return nil, fmt.Errorf("missing OIDC discovery URL (set OIDC_DISCOVERY_URL or OIDC_BASE_URL)")
	}

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Get(discoveryURL)
	if err != nil {
		return nil, fmt.Errorf("discovery request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("discovery returned status %d", resp.StatusCode)
	}

	var doc oidcDiscoveryDoc
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return nil, fmt.Errorf("decode discovery document: %w", err)
	}

	base := strings.TrimRight(baseURL, "/")
	authEP := doc.AuthorizationEndpoint
	tokenEP := doc.TokenEndpoint
	userinfoEP := doc.UserinfoEndpoint

	if authEP == "" && base != "" {
		authEP = base + "/auth/oauth/authorize"
	}
	if tokenEP == "" && base != "" {
		tokenEP = base + "/auth/oauth/token"
	}
	if userinfoEP == "" && base != "" {
		userinfoEP = base + "/auth/profile"
	}

	if authEP == "" || tokenEP == "" || userinfoEP == "" {
		return nil, fmt.Errorf("OIDC discovery document missing required endpoints")
	}

	ep := &OIDCEndpoints{
		AuthorizationEndpoint: authEP,
		TokenEndpoint:         tokenEP,
		UserinfoEndpoint:      userinfoEP,
	}
	oidcEndpointsMu.Lock()
	oidcEndpointsCache = ep
	oidcEndpointsCachedAt = time.Now()
	oidcEndpointsMu.Unlock()
	return ep, nil
}

// ─── Token Exchange ────────────────────────────────────────────────────────────

// OIDCTokenResponse holds the OAuth2 token endpoint response.
type OIDCTokenResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
}

// ExchangeCodeForTokens performs the OAuth2 PKCE authorization code exchange.
func ExchangeCodeForTokens(clientID, clientSecret, code, codeVerifier, redirectURI, tokenEndpoint string) (*OIDCTokenResponse, error) {
	body := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"code_verifier": {codeVerifier},
	}
	if clientSecret == "" {
		body.Set("client_id", clientID)
	}

	req, err := http.NewRequest(http.MethodPost, tokenEndpoint, strings.NewReader(body.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if clientSecret != "" {
		creds := base64.StdEncoding.EncodeToString([]byte(clientID + ":" + clientSecret))
		req.Header.Set("Authorization", "Basic "+creds)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("token endpoint returned status %d", resp.StatusCode)
	}

	var tokenResp OIDCTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, fmt.Errorf("decode token response: %w", err)
	}
	return &tokenResp, nil
}

// FetchUserInfo retrieves the user profile from the userinfo endpoint.
func FetchUserInfo(accessToken, userinfoEndpoint string) (map[string]any, error) {
	req, err := http.NewRequest(http.MethodGet, userinfoEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("userinfo returned status %d", resp.StatusCode)
	}

	var profile map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&profile); err != nil {
		return nil, fmt.Errorf("decode userinfo: %w", err)
	}
	return profile, nil
}

// ─── Session JWT (HMAC-SHA256, compatible with frontend lib/session.ts) ────────
//
// Token format: base64url(header).base64url(payload).base64url(sig)
// Header:  {"alg":"HS256","typ":"JWT"}
// Signature: HMAC-SHA256(headerB64 + "." + payloadB64, []byte(authSecret))

// jwtSessionHeader is marshaled in alphabetical key order (matches TypeScript output).
type jwtSessionHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
}

// sessionJWTPayload — field order matches the TypeScript SessionPayload insertion order
// so the JSON encoding is byte-for-byte identical to what frontend's createSessionToken emits.
type sessionJWTPayload struct {
	Sub        string `json:"sub"`
	Username   string `json:"username"`
	AccountID  string `json:"accountId"`
	Exp        int64  `json:"exp"`
	Iat        int64  `json:"iat,omitempty"`
	SessionExp int64  `json:"sessionExp,omitempty"`
}

// OIDCTransactionPayload is signed and stored in the oidc_tx cookie during the auth flow.
type OIDCTransactionPayload struct {
	State        string `json:"state"`
	Nonce        string `json:"nonce"`
	CodeVerifier string `json:"codeVerifier"`
	RedirectURI  string `json:"redirectUri"`
	Exp          int64  `json:"exp"`
}

// SessionClaims holds the verified claims from a session JWT.
type SessionClaims struct {
	Sub        string
	Username   string
	AccountID  string
	Exp        int64
	Iat        int64
	SessionExp int64
}

func normalizeSessionExp(exp, sessionExp int64) int64 {
	if sessionExp > 0 {
		return sessionExp
	}
	return exp
}

func issueSessionJWT(
	authSecret, sub, username, accountID string,
	issuedAt int64,
	sessionExp int64,
	expiresIn int,
) (string, error) {
	if expiresIn <= 0 {
		expiresIn = defaultAccessTokenTTLSeconds
	}
	if issuedAt <= 0 {
		issuedAt = time.Now().Unix()
	}
	if sessionExp <= 0 {
		sessionExp = issuedAt + defaultSessionMaxAgeSeconds
	}

	accessExp := issuedAt + int64(expiresIn)
	if accessExp > sessionExp {
		accessExp = sessionExp
	}
	if accessExp <= issuedAt {
		return "", fmt.Errorf("session expired")
	}

	header := jwtSessionHeader{Alg: "HS256", Typ: "JWT"}
	payload := sessionJWTPayload{
		Sub:        sub,
		Username:   username,
		AccountID:  accountID,
		Exp:        accessExp,
		Iat:        issuedAt,
		SessionExp: sessionExp,
	}
	return buildJWT(header, payload, authSecret)
}

func marshalBase64URL(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func computeHMAC(signingInput, authSecret string) []byte {
	mac := hmac.New(sha256.New, []byte(authSecret))
	mac.Write([]byte(signingInput))
	return mac.Sum(nil)
}

func buildJWT(header, payload any, authSecret string) (string, error) {
	headerB64, err := marshalBase64URL(header)
	if err != nil {
		return "", err
	}
	payloadB64, err := marshalBase64URL(payload)
	if err != nil {
		return "", err
	}
	signingInput := headerB64 + "." + payloadB64
	sig := base64.RawURLEncoding.EncodeToString(computeHMAC(signingInput, authSecret))
	return signingInput + "." + sig, nil
}

func verifyHMACJWT(authSecret, rawToken string) (string, error) {
	parts := strings.SplitN(rawToken, ".", 3)
	if len(parts) != 3 {
		return "", fmt.Errorf("invalid token format")
	}
	signingInput := parts[0] + "." + parts[1]
	expected := computeHMAC(signingInput, authSecret)
	provided, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return "", fmt.Errorf("invalid signature encoding")
	}
	if !hmac.Equal(expected, provided) {
		return "", fmt.Errorf("invalid signature")
	}
	return parts[1], nil
}

// IssueSessionJWT creates an HMAC-SHA256 signed session JWT.
func IssueSessionJWT(authSecret, sub, username, accountID string, expiresIn int) (string, error) {
	now := time.Now().Unix()
	sessionExp := now + defaultSessionMaxAgeSeconds
	return issueSessionJWT(authSecret, sub, username, accountID, now, sessionExp, expiresIn)
}

// IssueSessionJWTForSession creates a new access token while keeping the original
// session lifetime bounds from existing claims.
func IssueSessionJWTForSession(authSecret string, claims *SessionClaims, expiresIn int) (string, error) {
	if claims == nil {
		return "", fmt.Errorf("missing session claims")
	}
	now := time.Now().Unix()
	sessionExp := normalizeSessionExp(claims.Exp, claims.SessionExp)
	if sessionExp <= now {
		return "", fmt.Errorf("session expired")
	}
	return issueSessionJWT(authSecret, claims.Sub, claims.Username, claims.AccountID, now, sessionExp, expiresIn)
}

// IssueTransactionJWT creates an HMAC-SHA256 signed OIDC transaction JWT.
func IssueTransactionJWT(authSecret string, tx OIDCTransactionPayload) (string, error) {
	header := jwtSessionHeader{Alg: "HS256", Typ: "JWT"}
	return buildJWT(header, tx, authSecret)
}

// VerifySessionJWT validates the HMAC signature and expiry, returning parsed claims.
func VerifySessionJWT(authSecret, rawToken string) (*SessionClaims, error) {
	claims, err := VerifySessionJWTAllowExpired(authSecret, rawToken)
	if err != nil {
		return nil, err
	}
	if time.Now().Unix() > claims.Exp {
		return nil, fmt.Errorf("token expired")
	}
	return claims, nil
}

// VerifySessionJWTAllowExpired validates the HMAC signature and parses claims
// without enforcing access-token expiry. It still enforces absolute session expiry.
func VerifySessionJWTAllowExpired(authSecret, rawToken string) (*SessionClaims, error) {
	payloadB64, err := verifyHMACJWT(authSecret, rawToken)
	if err != nil {
		return nil, err
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, fmt.Errorf("invalid payload encoding")
	}
	var payload sessionJWTPayload
	if err := json.Unmarshal(payloadBytes, &payload); err != nil {
		return nil, fmt.Errorf("invalid payload json")
	}
	claims := &SessionClaims{
		Sub:        payload.Sub,
		Username:   payload.Username,
		AccountID:  payload.AccountID,
		Exp:        payload.Exp,
		Iat:        payload.Iat,
		SessionExp: normalizeSessionExp(payload.Exp, payload.SessionExp),
	}
	if claims.SessionExp > 0 && time.Now().Unix() > claims.SessionExp {
		return nil, fmt.Errorf("session expired")
	}
	return claims, nil
}

// VerifyTransactionJWT validates the OIDC transaction cookie JWT.
func VerifyTransactionJWT(authSecret, rawToken string) (*OIDCTransactionPayload, error) {
	payloadB64, err := verifyHMACJWT(authSecret, rawToken)
	if err != nil {
		return nil, err
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, fmt.Errorf("invalid payload encoding")
	}
	var tx OIDCTransactionPayload
	if err := json.Unmarshal(payloadBytes, &tx); err != nil {
		return nil, fmt.Errorf("invalid payload json")
	}
	if time.Now().Unix() > tx.Exp {
		return nil, fmt.Errorf("transaction expired")
	}
	return &tx, nil
}
