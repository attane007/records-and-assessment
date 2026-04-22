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
}
