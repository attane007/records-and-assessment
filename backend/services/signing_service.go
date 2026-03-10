package services

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"time"

	"backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

var (
	ErrSignLinkNotFound    = errors.New("sign link not found")
	ErrSignLinkExpired     = errors.New("sign link expired")
	ErrSignLinkUsed        = errors.New("sign link already used")
	ErrSignLinkRevoked     = errors.New("sign link revoked")
	ErrSignSessionNotFound = errors.New("sign session not found")
	ErrSignSessionExpired  = errors.New("sign session expired")
)

func generateRandomToken(byteLen int) (string, error) {
	buf := make([]byte, byteLen)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func tokenHash(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

func CreateSignLink(ctx context.Context, coll *mongo.Collection, requestID primitive.ObjectID, role models.SignRole, channel, recipientEmail string, expiryDays int) (*models.SignLink, string, error) {
	rawToken, err := generateRandomToken(24)
	if err != nil {
		return nil, "", err
	}

	now := time.Now()
	record := models.SignLink{
		RequestID:      requestID,
		Role:           role,
		TokenHash:      tokenHash(rawToken),
		ExpiresAt:      now.AddDate(0, 0, expiryDays),
		Revoked:        false,
		Channel:        channel,
		RecipientEmail: recipientEmail,
		CreatedAt:      now,
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

func GetSignLinkByRawToken(ctx context.Context, coll *mongo.Collection, rawToken string) (*models.SignLink, error) {
	var record models.SignLink
	err := coll.FindOne(ctx, bson.M{"token_hash": tokenHash(rawToken)}).Decode(&record)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrSignLinkNotFound
		}
		return nil, err
	}
	return &record, nil
}

func ValidateSignLink(record *models.SignLink) error {
	if record == nil {
		return ErrSignLinkNotFound
	}
	if record.Revoked {
		return ErrSignLinkRevoked
	}
	if record.UsedAt != nil {
		return ErrSignLinkUsed
	}
	if time.Now().After(record.ExpiresAt) {
		return ErrSignLinkExpired
	}
	return nil
}

func MarkSignLinkUsed(ctx context.Context, coll *mongo.Collection, id primitive.ObjectID) error {
	now := time.Now()
	_, err := coll.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"used_at": now, "updated_at": now}})
	return err
}

func TouchSignLinkSent(ctx context.Context, coll *mongo.Collection, id primitive.ObjectID) error {
	now := time.Now()
	_, err := coll.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"last_sent_at": now, "updated_at": now}})
	return err
}

func CreateSignSession(ctx context.Context, coll *mongo.Collection, requestID primitive.ObjectID, role models.SignRole, signLinkID *primitive.ObjectID, ttl time.Duration) (*models.SignSession, error) {
	sessionID, err := generateRandomToken(18)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	record := models.SignSession{
		ID:         sessionID,
		RequestID:  requestID,
		Role:       role,
		SignLinkID: signLinkID,
		Status:     "pending",
		ExpiresAt:  now.Add(ttl),
		CreatedAt:  now,
	}

	if _, err := coll.InsertOne(ctx, record); err != nil {
		return nil, err
	}
	return &record, nil
}

func GetSignSessionByID(ctx context.Context, coll *mongo.Collection, id string) (*models.SignSession, error) {
	var record models.SignSession
	err := coll.FindOne(ctx, bson.M{"_id": id}).Decode(&record)
	if err != nil {
		if errors.Is(err, mongo.ErrNoDocuments) {
			return nil, ErrSignSessionNotFound
		}
		return nil, err
	}

	if record.Status == "pending" && time.Now().After(record.ExpiresAt) {
		_, _ = coll.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"status": "expired"}})
		record.Status = "expired"
	}
	return &record, nil
}

func CompleteSignSession(ctx context.Context, coll *mongo.Collection, id string) error {
	now := time.Now()
	_, err := coll.UpdateOne(ctx, bson.M{"_id": id}, bson.M{"$set": bson.M{"status": "completed", "completed_at": now}})
	return err
}
