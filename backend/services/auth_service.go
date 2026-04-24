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
	"os"
	"strings"
	"sync"
	"time"
)

const (
	defaultAccessTokenTTLSeconds = 8 * 3600
	defaultSessionMaxAgeSeconds  = 7 * 24 * 3600
)

var defaultSessionScopes = []string{"openid", "profile", "email"}

// DefaultSessionExpiry returns the default absolute session expiry.
func DefaultSessionExpiry(now time.Time) time.Time {
	if now.IsZero() {
		now = time.Now()
	}
	return now.Add(time.Duration(defaultSessionMaxAgeSeconds) * time.Second)
}

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
	EndSessionEndpoint    string
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
	EndSessionEndpoint    string `json:"end_session_endpoint"`
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
	endSessionEP := doc.EndSessionEndpoint

	if authEP == "" && base != "" {
		authEP = base + "/auth/oauth/authorize"
	}
	if tokenEP == "" && base != "" {
		tokenEP = base + "/auth/oauth/token"
	}
	if userinfoEP == "" && base != "" {
		userinfoEP = base + "/auth/profile"
	}
	if endSessionEP == "" && base != "" {
		endSessionEP = base + "/auth/oauth/end-session"
	}

	if authEP == "" || tokenEP == "" || userinfoEP == "" {
		return nil, fmt.Errorf("OIDC discovery document missing required endpoints")
	}

	ep := &OIDCEndpoints{
		AuthorizationEndpoint: authEP,
		TokenEndpoint:         tokenEP,
		UserinfoEndpoint:      userinfoEP,
		EndSessionEndpoint:    endSessionEP,
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

// sessionJWTPayload keeps the session token shape stable for the frontend callback
// route and refresh flow.
type sessionJWTPayload struct {
	Sub            string   `json:"sub"`
	Username       string   `json:"username"`
	AccountID      string   `json:"accountId"`
	AuthSubject    string   `json:"authSubject,omitempty"`
	TenantID       string   `json:"tenantId,omitempty"`
	DisplayName    string   `json:"displayName,omitempty"`
	Scope          string   `json:"scope,omitempty"`
	Scopes         []string `json:"scopes,omitempty"`
	SessionVersion int64    `json:"sessionVersion"`
	Exp            int64    `json:"exp"`
	Iat            int64    `json:"iat,omitempty"`
	SessionExp     int64    `json:"sessionExp,omitempty"`
	LogoutHandleID string   `json:"logoutHandleId,omitempty"`
}

// OIDCTransactionPayload is signed and stored in the oidc_tx cookie during the auth flow.
type OIDCTransactionPayload struct {
	State        string `json:"state"`
	Nonce        string `json:"nonce"`
	CodeVerifier string `json:"codeVerifier"`
	RedirectURI  string `json:"redirectUri"`
	ReturnTo     string `json:"returnTo,omitempty"`
	Exp          int64  `json:"exp"`
}

// SessionClaims holds the verified claims from a session JWT.
type SessionClaims struct {
	Sub            string
	Username       string
	AccountID      string
	AuthSubject    string
	TenantID       string
	DisplayName    string
	Scope          string
	Scopes         []string
	SessionVersion int64
	Exp            int64
	Iat            int64
	SessionExp     int64
	LogoutHandleID string
}

type sessionContext struct {
	Subject     string
	Username    string
	AccountID   string
	AuthSubject string
	TenantID    string
	DisplayName string
	Scope       string
	Scopes      []string
}

func normalizeSessionExp(exp, sessionExp int64) int64 {
	if sessionExp > 0 {
		return sessionExp
	}
	return exp
}

func canonicalSessionScopes(scopes []string) []string {
	source := scopes
	if len(source) == 0 {
		source = defaultSessionScopes
	}

	result := make([]string, 0, len(source))
	seen := make(map[string]struct{}, len(source))
	for _, scope := range source {
		normalized := strings.TrimSpace(scope)
		if normalized == "" {
			continue
		}
		if _, exists := seen[normalized]; exists {
			continue
		}
		seen[normalized] = struct{}{}
		result = append(result, normalized)
	}

	if len(result) == 0 {
		return append([]string(nil), defaultSessionScopes...)
	}

	return result
}

func canonicalSessionContextFromClaims(claims *SessionClaims) sessionContext {
	if claims == nil {
		return sessionContext{}
	}

	scopes := append([]string(nil), claims.Scopes...)
	if len(scopes) == 0 && strings.TrimSpace(claims.Scope) != "" {
		scopes = strings.Fields(claims.Scope)
	}

	ctx := sessionContext{
		Subject:     strings.TrimSpace(claims.Sub),
		Username:    strings.TrimSpace(claims.Username),
		AccountID:   strings.TrimSpace(claims.AccountID),
		AuthSubject: strings.TrimSpace(claims.AuthSubject),
		TenantID:    strings.TrimSpace(claims.TenantID),
		DisplayName: strings.TrimSpace(claims.DisplayName),
		Scope:       strings.TrimSpace(claims.Scope),
		Scopes:      canonicalSessionScopes(scopes),
	}

	if ctx.Subject == "" {
		ctx.Subject = ctx.AccountID
	}
	if ctx.Username == "" {
		ctx.Username = ctx.DisplayName
	}
	if ctx.Username == "" {
		ctx.Username = ctx.AuthSubject
	}
	if ctx.AccountID == "" {
		ctx.AccountID = ctx.AuthSubject
	}
	if ctx.AuthSubject == "" {
		ctx.AuthSubject = ctx.AccountID
	}
	if ctx.TenantID == "" {
		ctx.TenantID = ctx.AuthSubject
	}
	if ctx.DisplayName == "" {
		ctx.DisplayName = ctx.Username
	}
	if ctx.DisplayName == "" {
		ctx.DisplayName = ctx.AuthSubject
	}
	if ctx.Scope == "" && len(ctx.Scopes) > 0 {
		ctx.Scope = strings.Join(ctx.Scopes, " ")
	}

	return ctx
}

func canonicalSessionContextFromLogin(subject, username, accountID string) sessionContext {
	ctx := sessionContext{
		Subject:     strings.TrimSpace(subject),
		Username:    strings.TrimSpace(username),
		AccountID:   strings.TrimSpace(accountID),
		AuthSubject: strings.TrimSpace(accountID),
		TenantID:    strings.TrimSpace(accountID),
		DisplayName: strings.TrimSpace(username),
		Scopes:      canonicalSessionScopes(nil),
	}

	if ctx.Subject == "" {
		ctx.Subject = ctx.AccountID
	}
	if ctx.Username == "" {
		ctx.Username = ctx.DisplayName
	}
	if ctx.Username == "" {
		ctx.Username = ctx.AuthSubject
	}
	if ctx.AccountID == "" {
		ctx.AccountID = ctx.Subject
	}
	if ctx.AuthSubject == "" {
		ctx.AuthSubject = ctx.AccountID
	}
	if ctx.TenantID == "" {
		ctx.TenantID = ctx.AuthSubject
	}
	if ctx.DisplayName == "" {
		ctx.DisplayName = ctx.Username
	}
	if ctx.DisplayName == "" {
		ctx.DisplayName = ctx.AuthSubject
	}
	ctx.Scope = strings.Join(ctx.Scopes, " ")

	return ctx
}

func issueSessionJWT(
	authSecret string,
	ctx sessionContext,
	issuedAt int64,
	sessionExp int64,
	logoutHandleID string,
	sessionVersion int64,
	expiresIn int,
) (string, error) {
	ctx = canonicalSessionContextFromClaims(&SessionClaims{
		Sub:         ctx.Subject,
		Username:    ctx.Username,
		AccountID:   ctx.AccountID,
		AuthSubject: ctx.AuthSubject,
		TenantID:    ctx.TenantID,
		DisplayName: ctx.DisplayName,
		Scope:       ctx.Scope,
		Scopes:      ctx.Scopes,
	})

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
	scopes := canonicalSessionScopes(ctx.Scopes)
	payload := sessionJWTPayload{
		Sub:            ctx.Subject,
		Username:       ctx.Username,
		AccountID:      ctx.AccountID,
		AuthSubject:    ctx.AuthSubject,
		TenantID:       ctx.TenantID,
		DisplayName:    ctx.DisplayName,
		Scope:          strings.Join(scopes, " "),
		Scopes:         scopes,
		SessionVersion: sessionVersion,
		Exp:            accessExp,
		Iat:            issuedAt,
		SessionExp:     sessionExp,
		LogoutHandleID: strings.TrimSpace(logoutHandleID),
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

func uniqueNonEmpty(values ...string) []string {
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}

	return result
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
	provided, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return "", fmt.Errorf("invalid signature encoding")
	}
	for _, candidateSecret := range uniqueNonEmpty(authSecret, os.Getenv("AUTH_SECRET_PREVIOUS")) {
		expected := computeHMAC(signingInput, candidateSecret)
		if hmac.Equal(expected, provided) {
			return parts[1], nil
		}
	}
	return "", fmt.Errorf("invalid signature")
}

// IssueSessionJWT creates an HMAC-SHA256 signed session JWT.
func IssueSessionJWT(authSecret, sub, username, accountID string, expiresIn int) (string, error) {
	now := time.Now().Unix()
	sessionExp := now + defaultSessionMaxAgeSeconds
	return issueSessionJWT(authSecret, canonicalSessionContextFromLogin(sub, username, accountID), now, sessionExp, "", 1, expiresIn)
}

// IssueSessionJWTWithLogoutHandle creates an HMAC-SHA256 signed session JWT and preserves
// the opaque logout handle reference needed for RP-initiated logout.
func IssueSessionJWTWithLogoutHandle(authSecret, sub, username, accountID, logoutHandleID string, expiresIn int) (string, error) {
	now := time.Now().Unix()
	sessionExp := now + defaultSessionMaxAgeSeconds
	return issueSessionJWT(authSecret, canonicalSessionContextFromLogin(sub, username, accountID), now, sessionExp, logoutHandleID, 1, expiresIn)
}

// IssueSessionJWTForSession creates a new access token while keeping the original
// session lifetime bounds from existing claims.
func IssueSessionJWTForSession(authSecret string, claims *SessionClaims, expiresIn int) (string, error) {
	if claims == nil {
		return "", fmt.Errorf("missing session claims")
	}
	nextSessionVersion := claims.SessionVersion + 1
	if nextSessionVersion <= 0 {
		nextSessionVersion = 1
	}

	now := time.Now().Unix()
	sessionExp := normalizeSessionExp(claims.Exp, claims.SessionExp)
	if sessionExp <= now {
		return "", fmt.Errorf("session expired")
	}
	return issueSessionJWT(authSecret, canonicalSessionContextFromClaims(claims), now, sessionExp, claims.LogoutHandleID, nextSessionVersion, expiresIn)
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
	scopes := append([]string(nil), payload.Scopes...)
	if len(scopes) == 0 && strings.TrimSpace(payload.Scope) != "" {
		scopes = strings.Fields(payload.Scope)
	}
	claims := &SessionClaims{
		Sub:            strings.TrimSpace(payload.Sub),
		Username:       strings.TrimSpace(payload.Username),
		AccountID:      strings.TrimSpace(payload.AccountID),
		AuthSubject:    strings.TrimSpace(payload.AuthSubject),
		TenantID:       strings.TrimSpace(payload.TenantID),
		DisplayName:    strings.TrimSpace(payload.DisplayName),
		Scope:          strings.TrimSpace(payload.Scope),
		Scopes:         canonicalSessionScopes(scopes),
		SessionVersion: payload.SessionVersion,
		Exp:            payload.Exp,
		Iat:            payload.Iat,
		SessionExp:     normalizeSessionExp(payload.Exp, payload.SessionExp),
		LogoutHandleID: strings.TrimSpace(payload.LogoutHandleID),
	}
	if claims.AuthSubject == "" {
		claims.AuthSubject = claims.AccountID
	}
	if claims.TenantID == "" {
		claims.TenantID = claims.AuthSubject
	}
	if claims.DisplayName == "" {
		claims.DisplayName = claims.Username
	}
	if claims.DisplayName == "" {
		claims.DisplayName = claims.AuthSubject
	}
	if claims.Scope == "" && len(claims.Scopes) > 0 {
		claims.Scope = strings.Join(claims.Scopes, " ")
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
