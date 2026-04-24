package handlers

import (
	"testing"
	"time"

	jwtv5 "github.com/golang-jwt/jwt/v5"
)

func TestVerifyBackchannelSessionEventToken(t *testing.T) {
	secret := "session-secret"
	audience := "record-client"
	issuer := "https://auth.example.com"

	claims := jwtv5.MapClaims{
		"iss":             issuer,
		"aud":             audience,
		"iat":             time.Now().Unix(),
		"exp":             time.Now().Add(time.Minute).Unix(),
		"jti":             "session-event-1",
		"sid":             "sid-123",
		"session_version": 2,
		"event_type":      sessionUpdatedEventType,
	}
	token := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	parsed, err := verifyBackchannelSessionEventToken(secret, issuer, audience, signed)
	if err != nil {
		t.Fatalf("verifyBackchannelSessionEventToken returned error: %v", err)
	}

	if parsed.ID != "session-event-1" {
		t.Fatalf("unexpected jti: %s", parsed.ID)
	}
	if parsed.Sid != "sid-123" {
		t.Fatalf("unexpected sid: %s", parsed.Sid)
	}
	if parsed.SessionVersion != 2 {
		t.Fatalf("unexpected session version: %d", parsed.SessionVersion)
	}
	if parsed.EventType != sessionUpdatedEventType {
		t.Fatalf("unexpected event type: %s", parsed.EventType)
	}
}

func TestVerifyBackchannelSessionEventTokenRejectsWrongEventType(t *testing.T) {
	secret := "session-secret"
	audience := "record-client"
	issuer := "https://auth.example.com"

	claims := jwtv5.MapClaims{
		"iss":             issuer,
		"aud":             audience,
		"iat":             time.Now().Unix(),
		"exp":             time.Now().Add(time.Minute).Unix(),
		"jti":             "session-event-2",
		"sid":             "sid-123",
		"session_version": 2,
		"event_type":      "session.revoked",
	}
	token := jwtv5.NewWithClaims(jwtv5.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}

	if _, err := verifyBackchannelSessionEventToken(secret, issuer, audience, signed); err == nil {
		t.Fatal("expected error for unsupported event type")
	}
}
