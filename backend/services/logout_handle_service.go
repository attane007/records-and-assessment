package services

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var (
	ErrLogoutHandleNotFound = errors.New("logout handle not found")
	ErrLogoutHandleRevoked  = errors.New("logout handle revoked")
	ErrLogoutHandleExpired  = errors.New("logout handle expired")
)

type idTokenMetadata struct {
	Issuer   string
	Audience string
	SID      string
	Exp      int64
}

func decodeIDTokenClaims(rawToken string) (map[string]any, error) {
	parts := strings.SplitN(strings.TrimSpace(rawToken), ".", 3)
	if len(parts) != 3 {
		return nil, fmt.Errorf("invalid id_token format")
	}
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("decode id_token payload: %w", err)
	}
	var claims map[string]any
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("parse id_token payload: %w", err)
	}
	return claims, nil
}

func stringClaim(value any) string {
	if value == nil {
		return ""
	}
	if s, ok := value.(string); ok {
		return strings.TrimSpace(s)
	}
	return strings.TrimSpace(fmt.Sprintf("%v", value))
}

func firstAudienceString(claim any) (string, error) {
	switch value := claim.(type) {
	case string:
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return "", fmt.Errorf("missing aud claim")
		}
		return trimmed, nil
	case []any:
		for _, item := range value {
			itemValue, ok := item.(string)
			if !ok {
				continue
			}
			trimmed := strings.TrimSpace(itemValue)
			if trimmed != "" {
				return trimmed, nil
			}
		}
	}
	return "", fmt.Errorf("missing aud claim")
}

func audienceMatchesExpected(claim any, expected string) bool {
	expected = strings.TrimSpace(expected)
	if expected == "" {
		return false
	}
	switch value := claim.(type) {
	case string:
		return strings.TrimSpace(value) == expected
	case []any:
		for _, item := range value {
			itemValue, ok := item.(string)
			if !ok {
				continue
			}
			if strings.TrimSpace(itemValue) == expected {
				return true
			}
		}
	}
	return false
}

func parseIDTokenMetadata(rawToken string) (*idTokenMetadata, error) {
	claims, err := decodeIDTokenClaims(rawToken)
	if err != nil {
		return nil, err
	}

	audience, err := firstAudienceString(claims["aud"])
	if err != nil {
		return nil, err
	}

	meta := &idTokenMetadata{
		Issuer:   stringClaim(claims["iss"]),
		Audience: audience,
		SID:      stringClaim(claims["sid"]),
	}

	if expValue, ok := claims["exp"]; ok {
		switch value := expValue.(type) {
		case float64:
			meta.Exp = int64(value)
		case float32:
			meta.Exp = int64(value)
		case int64:
			meta.Exp = value
		case int:
			meta.Exp = int64(value)
		case json.Number:
			if parsed, parseErr := value.Int64(); parseErr == nil {
				meta.Exp = parsed
			}
		case string:
			if parsed, parseErr := strconv.ParseInt(strings.TrimSpace(value), 10, 64); parseErr == nil {
				meta.Exp = parsed
			}
		}
	}

	return meta, nil
}

func parseLogoutHandleObjectID(handleID string) (primitive.ObjectID, error) {
	trimmed := strings.TrimSpace(handleID)
	if trimmed == "" {
		return primitive.NilObjectID, ErrLogoutHandleNotFound
	}
	objectID, err := primitive.ObjectIDFromHex(trimmed)
	if err != nil {
		return primitive.NilObjectID, ErrLogoutHandleNotFound
	}
	return objectID, nil
}

func CreateLogoutHandle(ctx context.Context, coll *mongo.Collection, accountID, sessionSubject, idToken, expectedClientID string, fallbackExpiry time.Time) (*models.LogoutHandle, error) {
	if coll == nil {
		return nil, fmt.Errorf("logout handle collection is not configured")
	}

	accountID = strings.TrimSpace(accountID)
	sessionSubject = strings.TrimSpace(sessionSubject)
	idToken = strings.TrimSpace(idToken)
	expectedClientID = strings.TrimSpace(expectedClientID)
	if accountID == "" {
		return nil, fmt.Errorf("account id is required")
	}
	if idToken == "" {
		return nil, fmt.Errorf("id_token is required")
	}

	claims, err := decodeIDTokenClaims(idToken)
	if err != nil {
		return nil, err
	}
	if expectedClientID != "" && !audienceMatchesExpected(claims["aud"], expectedClientID) {
		return nil, fmt.Errorf("id_token audience mismatch")
	}

	meta, err := parseIDTokenMetadata(idToken)
	if err != nil {
		return nil, err
	}
	if expectedClientID != "" {
		meta.Audience = expectedClientID
	}

	now := time.Now()
	expiresAt := fallbackExpiry
	if expiresAt.IsZero() || expiresAt.Before(now) {
		expiresAt = now.Add(time.Duration(defaultSessionMaxAgeSeconds) * time.Second)
	}
	if meta.Exp > 0 {
		parsedExpiry := time.Unix(meta.Exp, 0)
		if parsedExpiry.After(now) && parsedExpiry.Before(expiresAt) {
			expiresAt = parsedExpiry
		}
	}

	record := models.LogoutHandle{
		AccountID:      accountID,
		SessionSubject: sessionSubject,
		IDToken:        idToken,
		SID:            meta.SID,
		Issuer:         meta.Issuer,
		Audience:       meta.Audience,
		ExpiresAt:      expiresAt,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	result, err := coll.InsertOne(ctx, record)
	if err != nil {
		return nil, err
	}
	if objectID, ok := result.InsertedID.(primitive.ObjectID); ok {
		record.ID = objectID
	}

	return &record, nil
}

func GetLogoutHandleByID(ctx context.Context, coll *mongo.Collection, handleID string) (*models.LogoutHandle, error) {
	if coll == nil {
		return nil, fmt.Errorf("logout handle collection is not configured")
	}
	objectID, err := parseLogoutHandleObjectID(handleID)
	if err != nil {
		return nil, err
	}

	var record models.LogoutHandle
	if err := coll.FindOne(ctx, bson.M{"_id": objectID}).Decode(&record); err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrLogoutHandleNotFound
		}
		return nil, err
	}
	if record.RevokedAt != nil {
		return nil, ErrLogoutHandleRevoked
	}
	if !record.ExpiresAt.IsZero() && time.Now().After(record.ExpiresAt) {
		return nil, ErrLogoutHandleExpired
	}
	return &record, nil
}

func RevokeLogoutHandleByID(ctx context.Context, coll *mongo.Collection, handleID string) error {
	if coll == nil {
		return fmt.Errorf("logout handle collection is not configured")
	}
	objectID, err := parseLogoutHandleObjectID(handleID)
	if err != nil {
		return err
	}

	now := time.Now()
	result, err := coll.UpdateOne(
		ctx,
		bson.M{"_id": objectID},
		bson.M{"$set": bson.M{"revoked_at": now, "updated_at": now}},
	)
	if err != nil {
		return err
	}
	if result.MatchedCount == 0 {
		return ErrLogoutHandleNotFound
	}
	return nil
}
