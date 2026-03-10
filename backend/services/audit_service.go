package services

import (
	"context"
	"fmt"
	"log"
	"time"

	"backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// RecordAuditLog inserts an immutable audit log entry into the database.
func RecordAuditLog(ctx context.Context, coll *mongo.Collection, logEntry models.AuditLog) error {
	if coll == nil {
		log.Printf("[AUDIT] Error: audit collection is nil")
		return fmt.Errorf("audit collection is nil")
	}
	if logEntry.Timestamp.IsZero() {
		logEntry.Timestamp = time.Now().UTC()
	}
	log.Printf("[AUDIT] Recording event: Action=%s, Role=%s, Hash=%s", logEntry.Action, logEntry.Role, logEntry.DocumentHash)
	_, err := coll.InsertOne(ctx, logEntry)
	if err != nil {
		log.Printf("[AUDIT] Insert Error: %v", err)
	}
	return err
}

// GetAuditLogsByHash retrieves all audit logs associated with a specific document hash.
func GetAuditLogsByHash(ctx context.Context, coll *mongo.Collection, hash string) ([]models.AuditLog, error) {
	if coll == nil {
		return nil, fmt.Errorf("audit collection is nil")
	}
	log.Printf("[AUDIT] Searching for hash: %s", hash)
	cursor, err := coll.Find(ctx, bson.M{"document_hash": hash})
	if err != nil {
		log.Printf("[AUDIT] Search Error: %v", err)
		return nil, err
	}
	defer cursor.Close(ctx)

	var logs []models.AuditLog
	if err := cursor.All(ctx, &logs); err != nil {
		return nil, err
	}
	log.Printf("[AUDIT] Found %d logs for hash", len(logs))
	return logs, nil
}
