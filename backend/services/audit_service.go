package services

import (
	"context"
	"time"

	"backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// RecordAuditLog inserts an immutable audit log entry into the database.
func RecordAuditLog(ctx context.Context, coll *mongo.Collection, log models.AuditLog) error {
	if log.Timestamp.IsZero() {
		log.Timestamp = time.Now().UTC()
	}
	_, err := coll.InsertOne(ctx, log)
	return err
}

// GetAuditLogsByHash retrieves all audit logs associated with a specific document hash.
func GetAuditLogsByHash(ctx context.Context, coll *mongo.Collection, hash string) ([]models.AuditLog, error) {
	cursor, err := coll.Find(ctx, bson.M{"document_hash": hash})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var logs []models.AuditLog
	if err := cursor.All(ctx, &logs); err != nil {
		return nil, err
	}
	return logs, nil
}
