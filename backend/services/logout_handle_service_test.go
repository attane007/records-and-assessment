package services

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"testing"
)

func buildUnsignedJWTForTest(payload map[string]any) string {
	headerJSON, _ := json.Marshal(map[string]any{"alg": "none", "typ": "JWT"})
	payloadJSON, _ := json.Marshal(payload)
	return fmt.Sprintf("%s.%s.signature", base64.RawURLEncoding.EncodeToString(headerJSON), base64.RawURLEncoding.EncodeToString(payloadJSON))
}

func TestDecodeIDTokenClaims(t *testing.T) {
	token := buildUnsignedJWTForTest(map[string]any{
		"iss": "https://auth.example.com",
		"aud": "record-client",
		"sid": "sid-123",
		"exp": 1710000000,
	})

	claims, err := decodeIDTokenClaims(token)
	if err != nil {
		t.Fatalf("decodeIDTokenClaims returned error: %v", err)
	}

	if got := claims["iss"]; got != "https://auth.example.com" {
		t.Fatalf("iss mismatch: got %v", got)
	}
	if got := claims["aud"]; got != "record-client" {
		t.Fatalf("aud mismatch: got %v", got)
	}
	if got := claims["sid"]; got != "sid-123" {
		t.Fatalf("sid mismatch: got %v", got)
	}
}

func TestIssueSessionJWTWithLogoutHandlePreservesHandleID(t *testing.T) {
	const handleID = "507f1f77bcf86cd799439011"
	token, err := IssueSessionJWTWithLogoutHandle("secret", "sub-1", "tester", "acct-1", handleID, 3600)
	if err != nil {
		t.Fatalf("IssueSessionJWTWithLogoutHandle returned error: %v", err)
	}

	claims, err := VerifySessionJWTAllowExpired("secret", token)
	if err != nil {
		t.Fatalf("VerifySessionJWTAllowExpired returned error: %v", err)
	}
	if claims.LogoutHandleID != handleID {
		t.Fatalf("LogoutHandleID mismatch: got %q want %q", claims.LogoutHandleID, handleID)
	}
	if claims.SessionVersion != 1 {
		t.Fatalf("SessionVersion mismatch: got %d want %d", claims.SessionVersion, 1)
	}
	if claims.AuthSubject != "acct-1" {
		t.Fatalf("AuthSubject mismatch: got %q want %q", claims.AuthSubject, "acct-1")
	}
	if claims.TenantID != "acct-1" {
		t.Fatalf("TenantID mismatch: got %q want %q", claims.TenantID, "acct-1")
	}
	if claims.DisplayName != "tester" {
		t.Fatalf("DisplayName mismatch: got %q want %q", claims.DisplayName, "tester")
	}
	if len(claims.Scopes) != 3 {
		t.Fatalf("Scopes mismatch: got %#v", claims.Scopes)
	}
	if claims.Scope != "openid profile email" {
		t.Fatalf("Scope mismatch: got %q", claims.Scope)
	}
}

func TestVerifySessionJWTAllowExpiredAcceptsPreviousSecret(t *testing.T) {
	t.Setenv("AUTH_SECRET_PREVIOUS", "current-secret")
	token, err := IssueSessionJWT("current-secret", "sub-1", "tester", "acct-1", 3600)
	if err != nil {
		t.Fatalf("IssueSessionJWT returned error: %v", err)
	}

	claims, err := VerifySessionJWTAllowExpired("wrong-secret", token)
	if err != nil {
		t.Fatalf("VerifySessionJWTAllowExpired returned error: %v", err)
	}
	if claims.AuthSubject != "acct-1" {
		t.Fatalf("AuthSubject mismatch: got %q want %q", claims.AuthSubject, "acct-1")
	}
	if claims.DisplayName != "tester" {
		t.Fatalf("DisplayName mismatch: got %q want %q", claims.DisplayName, "tester")
	}
}

func TestIssueSessionJWTForSessionIncrementsSessionVersion(t *testing.T) {
	originalToken, err := IssueSessionJWT("secret", "sub-1", "tester", "acct-1", 3600)
	if err != nil {
		t.Fatalf("IssueSessionJWT returned error: %v", err)
	}

	originalClaims, err := VerifySessionJWTAllowExpired("secret", originalToken)
	if err != nil {
		t.Fatalf("VerifySessionJWTAllowExpired returned error: %v", err)
	}

	refreshedToken, err := IssueSessionJWTForSession("secret", originalClaims, 3600)
	if err != nil {
		t.Fatalf("IssueSessionJWTForSession returned error: %v", err)
	}

	refreshedClaims, err := VerifySessionJWTAllowExpired("secret", refreshedToken)
	if err != nil {
		t.Fatalf("VerifySessionJWTAllowExpired returned error: %v", err)
	}

	if refreshedClaims.SessionVersion != originalClaims.SessionVersion+1 {
		t.Fatalf("SessionVersion mismatch: got %d want %d", refreshedClaims.SessionVersion, originalClaims.SessionVersion+1)
	}
	if refreshedClaims.AuthSubject != originalClaims.AuthSubject {
		t.Fatalf("AuthSubject mismatch: got %q want %q", refreshedClaims.AuthSubject, originalClaims.AuthSubject)
	}
	if refreshedClaims.DisplayName != originalClaims.DisplayName {
		t.Fatalf("DisplayName mismatch: got %q want %q", refreshedClaims.DisplayName, originalClaims.DisplayName)
	}
	if len(refreshedClaims.Scopes) != len(originalClaims.Scopes) {
		t.Fatalf("Scopes length mismatch: got %d want %d", len(refreshedClaims.Scopes), len(originalClaims.Scopes))
	}
}
