package handlers

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

const (
	authClaimsContextKey    = "auth.claims"
	authAccountIDContextKey = "auth.account_id"
	authUsernameContextKey  = "auth.username"
	defaultJWKSCahceTTL     = 30 * time.Minute
)

type Claims map[string]any

type oidcDiscoveryDocument struct {
	Issuer  string `json:"issuer"`
	JWKSURI string `json:"jwks_uri"`
}

type jwtHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
	Kid string `json:"kid"`
}

type jwksDocument struct {
	Keys []jsonWebKey `json:"keys"`
}

type jsonWebKey struct {
	Kty string `json:"kty"`
	Use string `json:"use"`
	Kid string `json:"kid"`
	Alg string `json:"alg"`
	N   string `json:"n"`
	E   string `json:"e"`
	Crv string `json:"crv"`
	X   string `json:"x"`
	Y   string `json:"y"`
}

type AuthVerifier struct {
	issuer       string
	audiences    []string
	jwksURI      string
	validMethods map[string]struct{}
	client       *http.Client
	cacheTTL     time.Duration

	mu              sync.RWMutex
	publicKeys      map[string]crypto.PublicKey
	keysRefreshedAt time.Time
}

func discoverOIDCConfig() (issuer string, jwksURI string, err error) {
	discoveryURL := strings.TrimSpace(os.Getenv("OIDC_DISCOVERY_URL"))
	if discoveryURL == "" {
		baseURL := strings.TrimSpace(os.Getenv("OIDC_BASE_URL"))
		if baseURL != "" {
			discoveryURL = strings.TrimRight(baseURL, "/") + "/.well-known/openid-configuration"
		}
	}
	if discoveryURL == "" {
		return "", "", fmt.Errorf("missing discovery url")
	}

	client := &http.Client{Timeout: 6 * time.Second}
	resp, err := client.Get(discoveryURL)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", "", fmt.Errorf("discovery returned status %d", resp.StatusCode)
	}

	var doc oidcDiscoveryDocument
	if err := json.NewDecoder(resp.Body).Decode(&doc); err != nil {
		return "", "", err
	}

	return strings.TrimSpace(doc.Issuer), strings.TrimSpace(doc.JWKSURI), nil
}

func parseAllowedJWTMethods() map[string]struct{} {
	raw := strings.TrimSpace(os.Getenv("OIDC_ALLOWED_ALGS"))
	allowed := map[string]struct{}{}

	if raw == "" {
		for _, method := range []string{"RS256", "RS384", "RS512", "ES256", "ES384", "ES512"} {
			allowed[method] = struct{}{}
		}
		return allowed
	}

	for _, part := range strings.Split(raw, ",") {
		method := strings.TrimSpace(part)
		if method != "" {
			allowed[method] = struct{}{}
		}
	}

	if len(allowed) == 0 {
		for _, method := range []string{"RS256", "RS384", "RS512", "ES256", "ES384", "ES512"} {
			allowed[method] = struct{}{}
		}
	}

	return allowed
}

func parseAllowedAudiences() []string {
	raw := strings.TrimSpace(os.Getenv("OIDC_AUDIENCE"))
	if raw == "" {
		raw = strings.TrimSpace(os.Getenv("OIDC_CLIENT_ID"))
	}

	if raw == "" {
		return nil
	}

	allowed := make([]string, 0)
	seen := map[string]struct{}{}
	for _, part := range strings.Split(raw, ",") {
		audience := strings.TrimSpace(part)
		if audience == "" {
			continue
		}
		if _, exists := seen[audience]; exists {
			continue
		}
		seen[audience] = struct{}{}
		allowed = append(allowed, audience)
	}

	return allowed
}

func NewAuthVerifierFromEnv() (*AuthVerifier, error) {
	issuer := strings.TrimSpace(os.Getenv("OIDC_ISSUER"))
	audiences := parseAllowedAudiences()
	jwksURI := strings.TrimSpace(os.Getenv("OIDC_JWKS_URI"))

	if issuer == "" || jwksURI == "" {
		discoveredIssuer, discoveredJWKSURI, err := discoverOIDCConfig()
		if err != nil {
			return nil, fmt.Errorf("oidc discovery failed: %w", err)
		}
		if issuer == "" {
			issuer = discoveredIssuer
		}
		if jwksURI == "" {
			jwksURI = discoveredJWKSURI
		}
	}

	if issuer == "" {
		return nil, fmt.Errorf("missing OIDC_ISSUER")
	}
	if len(audiences) == 0 {
		return nil, fmt.Errorf("missing OIDC_AUDIENCE (or OIDC_CLIENT_ID fallback)")
	}
	if jwksURI == "" {
		return nil, fmt.Errorf("missing OIDC_JWKS_URI")
	}

	return &AuthVerifier{
		issuer:       issuer,
		audiences:    audiences,
		jwksURI:      jwksURI,
		validMethods: parseAllowedJWTMethods(),
		client:       &http.Client{Timeout: 8 * time.Second},
		cacheTTL:     defaultJWKSCahceTTL,
		publicKeys:   map[string]crypto.PublicKey{},
	}, nil
}

func decodeBase64URL(value string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(value)
}

func bigIntFromBase64URL(value string) (*big.Int, error) {
	decoded, err := decodeBase64URL(value)
	if err != nil {
		return nil, err
	}
	return new(big.Int).SetBytes(decoded), nil
}

func parseJWTParts(rawToken string) (jwtHeader, Claims, []byte, []byte, error) {
	parts := strings.Split(rawToken, ".")
	if len(parts) != 3 {
		return jwtHeader{}, nil, nil, nil, fmt.Errorf("invalid token format")
	}

	headerBytes, err := decodeBase64URL(parts[0])
	if err != nil {
		return jwtHeader{}, nil, nil, nil, fmt.Errorf("invalid header encoding: %w", err)
	}
	claimsBytes, err := decodeBase64URL(parts[1])
	if err != nil {
		return jwtHeader{}, nil, nil, nil, fmt.Errorf("invalid claims encoding: %w", err)
	}
	signature, err := decodeBase64URL(parts[2])
	if err != nil {
		return jwtHeader{}, nil, nil, nil, fmt.Errorf("invalid signature encoding: %w", err)
	}

	var header jwtHeader
	if err := json.Unmarshal(headerBytes, &header); err != nil {
		return jwtHeader{}, nil, nil, nil, fmt.Errorf("invalid header json: %w", err)
	}
	var claims Claims
	if err := json.Unmarshal(claimsBytes, &claims); err != nil {
		return jwtHeader{}, nil, nil, nil, fmt.Errorf("invalid claims json: %w", err)
	}

	return header, claims, []byte(parts[0] + "." + parts[1]), signature, nil
}

func rsaPublicKeyFromJWK(jwk jsonWebKey) (*rsa.PublicKey, error) {
	n, err := bigIntFromBase64URL(jwk.N)
	if err != nil {
		return nil, err
	}
	e, err := bigIntFromBase64URL(jwk.E)
	if err != nil {
		return nil, err
	}
	return &rsa.PublicKey{N: n, E: int(e.Int64())}, nil
}

func ecCurveFromName(name string) (elliptic.Curve, error) {
	switch name {
	case "P-256":
		return elliptic.P256(), nil
	case "P-384":
		return elliptic.P384(), nil
	case "P-521":
		return elliptic.P521(), nil
	default:
		return nil, fmt.Errorf("unsupported curve: %s", name)
	}
}

func ecdsaPublicKeyFromJWK(jwk jsonWebKey) (*ecdsa.PublicKey, error) {
	curve, err := ecCurveFromName(jwk.Crv)
	if err != nil {
		return nil, err
	}
	x, err := bigIntFromBase64URL(jwk.X)
	if err != nil {
		return nil, err
	}
	y, err := bigIntFromBase64URL(jwk.Y)
	if err != nil {
		return nil, err
	}
	return &ecdsa.PublicKey{Curve: curve, X: x, Y: y}, nil
}

func publicKeyFromJWK(jwk jsonWebKey) (crypto.PublicKey, error) {
	switch jwk.Kty {
	case "RSA":
		return rsaPublicKeyFromJWK(jwk)
	case "EC":
		return ecdsaPublicKeyFromJWK(jwk)
	default:
		return nil, fmt.Errorf("unsupported key type: %s", jwk.Kty)
	}
}

func hashPayloadForAlg(alg string, payload []byte) (crypto.Hash, []byte, error) {
	switch alg {
	case "RS256", "ES256":
		sum := sha256.Sum256(payload)
		return crypto.SHA256, sum[:], nil
	case "RS384", "ES384":
		sum := sha512.Sum384(payload)
		return crypto.SHA384, sum[:], nil
	case "RS512", "ES512":
		sum := sha512.Sum512(payload)
		return crypto.SHA512, sum[:], nil
	default:
		return 0, nil, fmt.Errorf("unsupported signing algorithm: %s", alg)
	}
}

func verifyRSASignature(publicKey *rsa.PublicKey, alg string, payload, signature []byte) error {
	hash, digest, err := hashPayloadForAlg(alg, payload)
	if err != nil {
		return err
	}
	return rsa.VerifyPKCS1v15(publicKey, hash, digest, signature)
}

func verifyECDSASignature(publicKey *ecdsa.PublicKey, alg string, payload, signature []byte) error {
	_, digest, err := hashPayloadForAlg(alg, payload)
	if err != nil {
		return err
	}
	if len(signature)%2 != 0 {
		return fmt.Errorf("invalid ecdsa signature length")
	}
	half := len(signature) / 2
	r := new(big.Int).SetBytes(signature[:half])
	s := new(big.Int).SetBytes(signature[half:])
	if !ecdsa.Verify(publicKey, digest, r, s) {
		return fmt.Errorf("ecdsa signature verification failed")
	}
	return nil
}

func verifySignature(publicKey crypto.PublicKey, alg string, payload, signature []byte) error {
	switch key := publicKey.(type) {
	case *rsa.PublicKey:
		return verifyRSASignature(key, alg, payload, signature)
	case *ecdsa.PublicKey:
		return verifyECDSASignature(key, alg, payload, signature)
	default:
		return fmt.Errorf("unsupported public key type")
	}
}

func (v *AuthVerifier) refreshJWKS(ctx context.Context) error {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, v.jwksURI, nil)
	if err != nil {
		return err
	}
	response, err := v.client.Do(request)
	if err != nil {
		return err
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("jwks returned status %d", response.StatusCode)
	}

	var document jwksDocument
	if err := json.NewDecoder(response.Body).Decode(&document); err != nil {
		return err
	}

	keys := make(map[string]crypto.PublicKey, len(document.Keys))
	for _, jwk := range document.Keys {
		if strings.TrimSpace(jwk.Kid) == "" {
			continue
		}
		publicKey, err := publicKeyFromJWK(jwk)
		if err != nil {
			log.Printf("skip jwk kid=%s: %v", jwk.Kid, err)
			continue
		}
		keys[jwk.Kid] = publicKey
	}
	if len(keys) == 0 {
		return fmt.Errorf("jwks did not provide usable keys")
	}

	v.mu.Lock()
	v.publicKeys = keys
	v.keysRefreshedAt = time.Now()
	v.mu.Unlock()
	return nil
}

func (v *AuthVerifier) ensureJWKS(kid string) error {
	v.mu.RLock()
	keysFresh := time.Since(v.keysRefreshedAt) < v.cacheTTL
	_, keyExists := v.publicKeys[kid]
	v.mu.RUnlock()

	if keysFresh && (kid == "" || keyExists) {
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	return v.refreshJWKS(ctx)
}

func (v *AuthVerifier) publicKeyForToken(header jwtHeader) (crypto.PublicKey, error) {
	if err := v.ensureJWKS(header.Kid); err != nil {
		return nil, err
	}

	v.mu.RLock()
	defer v.mu.RUnlock()
	if header.Kid != "" {
		publicKey, exists := v.publicKeys[header.Kid]
		if !exists {
			return nil, fmt.Errorf("unknown key id")
		}
		return publicKey, nil
	}

	for _, publicKey := range v.publicKeys {
		return publicKey, nil
	}
	return nil, fmt.Errorf("no public keys loaded")
}

func numberClaimAsInt64(claims Claims, key string) (int64, bool) {
	value, exists := claims[key]
	if !exists {
		return 0, false
	}
	switch typed := value.(type) {
	case float64:
		return int64(typed), true
	case int64:
		return typed, true
	case json.Number:
		parsed, err := typed.Int64()
		if err != nil {
			return 0, false
		}
		return parsed, true
	default:
		return 0, false
	}
}

func claimString(claims Claims, keys ...string) string {
	for _, key := range keys {
		value, exists := claims[key]
		if !exists {
			continue
		}
		if asString, ok := value.(string); ok {
			trimmed := strings.TrimSpace(asString)
			if trimmed != "" {
				return trimmed
			}
		}
	}
	return ""
}

func claimMatchesAny(value string, allowed []string) bool {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return false
	}

	for _, item := range allowed {
		if trimmed == item {
			return true
		}
	}

	return false
}

func claimAudienceContainsAny(claims Claims, audiences []string) bool {
	value, exists := claims["aud"]
	if !exists {
		return false
	}
	switch typed := value.(type) {
	case string:
		return claimMatchesAny(typed, audiences)
	case []any:
		for _, item := range typed {
			if asString, ok := item.(string); ok && claimMatchesAny(asString, audiences) {
				return true
			}
		}
	}
	return false
}

func (v *AuthVerifier) validateClaims(claims Claims) error {
	now := time.Now().Unix()
	const leeway = int64(30)

	issuer := claimString(claims, "iss")
	if issuer == "" || issuer != v.issuer {
		return fmt.Errorf("invalid issuer")
	}
	if !claimAudienceContainsAny(claims, v.audiences) {
		azpOrClientID := claimString(claims, "azp", "client_id")
		if !claimMatchesAny(azpOrClientID, v.audiences) {
			return fmt.Errorf("invalid audience")
		}
	}
	if exp, ok := numberClaimAsInt64(claims, "exp"); !ok || now > exp+leeway {
		return fmt.Errorf("token expired")
	}
	if nbf, ok := numberClaimAsInt64(claims, "nbf"); ok && now+leeway < nbf {
		return fmt.Errorf("token not yet valid")
	}
	return nil
}

func (v *AuthVerifier) VerifyAccessToken(rawToken string) (Claims, error) {
	if v == nil {
		return nil, fmt.Errorf("auth verifier not initialized")
	}

	header, claims, signingInput, signature, err := parseJWTParts(rawToken)
	if err != nil {
		return nil, err
	}
	if _, ok := v.validMethods[header.Alg]; !ok {
		return nil, fmt.Errorf("disallowed token algorithm")
	}

	publicKey, err := v.publicKeyForToken(header)
	if err != nil {
		return nil, err
	}
	if err := verifySignature(publicKey, header.Alg, signingInput, signature); err != nil {
		return nil, err
	}
	if err := v.validateClaims(claims); err != nil {
		return nil, err
	}

	return claims, nil
}

func extractBearerToken(authorizationHeader string) string {
	parts := strings.Fields(strings.TrimSpace(authorizationHeader))
	if len(parts) != 2 {
		return ""
	}
	if !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func accountIDFromClaims(claims Claims) string {
	return claimString(claims, "account_id", "accountId", "tenant_id", "tenantId", "sub")
}

func usernameFromClaims(claims Claims) string {
	return claimString(claims, "preferred_username", "username", "name", "email", "sub")
}

func accountIDFromContext(c *gin.Context) string {
	value, exists := c.Get(authAccountIDContextKey)
	if !exists {
		return ""
	}
	asString, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(asString)
}

func usernameFromContext(c *gin.Context) string {
	value, exists := c.Get(authUsernameContextKey)
	if !exists {
		return ""
	}
	asString, ok := value.(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(asString)
}

func RequireBearerAuth(verifier *AuthVerifier) gin.HandlerFunc {
	return func(c *gin.Context) {
		if verifier == nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "auth verifier is not configured"})
			c.Abort()
			return
		}

		bearerToken := extractBearerToken(c.GetHeader("Authorization"))
		if bearerToken == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			c.Abort()
			return
		}

		claims, err := verifier.VerifyAccessToken(bearerToken)
		if err != nil {
			log.Printf("auth verification failed: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}

		accountID := accountIDFromClaims(claims)
		if accountID == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "token missing account scope"})
			c.Abort()
			return
		}

		c.Set(authClaimsContextKey, claims)
		c.Set(authAccountIDContextKey, accountID)
		c.Set(authUsernameContextKey, usernameFromClaims(claims))
		c.Next()
	}
}
