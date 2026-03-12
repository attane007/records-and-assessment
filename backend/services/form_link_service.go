package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var (
	ErrFormLinkNotFound = errors.New("form link not found")
	ErrFormLinkRevoked  = errors.New("form link revoked")
)

const fallbackFormLinkSecret = "dev-form-link-secret-change-me"

func formLinkSecret() string {
	secret := strings.TrimSpace(os.Getenv("FORM_LINK_SECRET"))
	if secret == "" {
		secret = strings.TrimSpace(os.Getenv("JWT_SECRET"))
	}
	if secret == "" {
		secret = fallbackFormLinkSecret
	}
	return secret
}

func buildFormLinkToken(accountID string, version int64) (string, error) {
	account := strings.TrimSpace(accountID)
	if account == "" {
		return "", fmt.Errorf("account id is required")
	}
	if version <= 0 {
		return "", fmt.Errorf("invalid token version")
	}

	mac := hmac.New(sha256.New, []byte(formLinkSecret()))
	if _, err := mac.Write([]byte(fmt.Sprintf("%s:%d", account, version))); err != nil {
		return "", err
	}
	// 24 bytes => 192-bit URL-safe opaque token.
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil)[:24]), nil
}

func nextTokenVersion(prev int64) int64 {
	next := time.Now().UnixNano()
	if next <= prev {
		next = prev + 1
	}
	if next <= 0 {
		next = 1
	}
	return next
}

func createFormLink(ctx context.Context, coll *mongo.Collection, accountID string) (*models.FormLink, string, error) {
	now := time.Now()
	version := nextTokenVersion(0)
	rawToken, err := buildFormLinkToken(accountID, version)
	if err != nil {
		return nil, "", err
	}

	record := models.FormLink{
		AccountID:    strings.TrimSpace(accountID),
		TokenVersion: version,
		TokenHash:    tokenHash(rawToken),
		Revoked:      false,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	res, err := coll.InsertOne(ctx, record)
	if err != nil {
		return nil, "", err
	}
	if oid, ok := res.InsertedID.(primitive.ObjectID); ok {
		record.ID = oid
	}

	return &record, rawToken, nil
}

// GetOrCreateActiveFormLink returns the active reusable public form link for an account.
func GetOrCreateActiveFormLink(ctx context.Context, coll *mongo.Collection, accountID string) (*models.FormLink, string, error) {
	account := strings.TrimSpace(accountID)
	if account == "" {
		return nil, "", fmt.Errorf("account id is required")
	}

	var record models.FormLink
	err := coll.FindOne(ctx, bson.M{"account_id": account}).Decode(&record)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return createFormLink(ctx, coll, account)
		}
		return nil, "", err
	}

	if record.TokenVersion <= 0 {
		record.TokenVersion = nextTokenVersion(0)
	}

	rawToken, err := buildFormLinkToken(account, record.TokenVersion)
	if err != nil {
		return nil, "", err
	}
	expectedHash := tokenHash(rawToken)
	now := time.Now()

	shouldSync := record.TokenHash != expectedHash || record.Revoked
	if shouldSync {
		_, err = coll.UpdateOne(
			ctx,
			bson.M{"_id": record.ID},
			bson.M{"$set": bson.M{
				"token_hash":    expectedHash,
				"token_version": record.TokenVersion,
				"revoked":       false,
				"updated_at":    now,
			}},
		)
		if err != nil {
			return nil, "", err
		}
		record.TokenHash = expectedHash
		record.Revoked = false
		record.UpdatedAt = now
	}

	return &record, rawToken, nil
}

// RotateFormLink regenerates the account's form link token and revokes prior token value.
func RotateFormLink(ctx context.Context, coll *mongo.Collection, accountID string) (*models.FormLink, string, error) {
	account := strings.TrimSpace(accountID)
	if account == "" {
		return nil, "", fmt.Errorf("account id is required")
	}

	var record models.FormLink
	err := coll.FindOne(ctx, bson.M{"account_id": account}).Decode(&record)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return createFormLink(ctx, coll, account)
		}
		return nil, "", err
	}

	newVersion := nextTokenVersion(record.TokenVersion)
	rawToken, err := buildFormLinkToken(account, newVersion)
	if err != nil {
		return nil, "", err
	}

	now := time.Now()
	newHash := tokenHash(rawToken)
	_, err = coll.UpdateOne(
		ctx,
		bson.M{"_id": record.ID},
		bson.M{"$set": bson.M{
			"token_version": newVersion,
			"token_hash":    newHash,
			"revoked":       false,
			"updated_at":    now,
		}},
	)
	if err != nil {
		return nil, "", err
	}

	record.TokenVersion = newVersion
	record.TokenHash = newHash
	record.Revoked = false
	record.UpdatedAt = now
	return &record, rawToken, nil
}

// RevokeFormLink invalidates the active token for an account.
func RevokeFormLink(ctx context.Context, coll *mongo.Collection, accountID string) error {
	account := strings.TrimSpace(accountID)
	if account == "" {
		return fmt.Errorf("account id is required")
	}

	res, err := coll.UpdateOne(
		ctx,
		bson.M{"account_id": account},
		bson.M{"$set": bson.M{"revoked": true, "updated_at": time.Now()}},
	)
	if err != nil {
		return err
	}
	if res.MatchedCount == 0 {
		return ErrFormLinkNotFound
	}
	return nil
}

// GetFormLinkByRawToken resolves account scope from an opaque token.
func GetFormLinkByRawToken(ctx context.Context, coll *mongo.Collection, rawToken string) (*models.FormLink, error) {
	token := strings.TrimSpace(rawToken)
	if token == "" {
		return nil, ErrFormLinkNotFound
	}

	var record models.FormLink
	err := coll.FindOne(ctx, bson.M{"token_hash": tokenHash(token)}).Decode(&record)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrFormLinkNotFound
		}
		return nil, err
	}

	if record.Revoked {
		return nil, ErrFormLinkRevoked
	}

	expectedToken, err := buildFormLinkToken(record.AccountID, record.TokenVersion)
	if err != nil {
		return nil, err
	}
	if subtle.ConstantTimeCompare([]byte(token), []byte(expectedToken)) != 1 {
		return nil, ErrFormLinkNotFound
	}

	return &record, nil
}

func TouchFormLinkUsed(ctx context.Context, coll *mongo.Collection, id primitive.ObjectID) error {
	now := time.Now()
	_, err := coll.UpdateOne(
		ctx,
		bson.M{"_id": id},
		bson.M{"$set": bson.M{"last_used_at": now, "updated_at": now}},
	)
	return err
}
