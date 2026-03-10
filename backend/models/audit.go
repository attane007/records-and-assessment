package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// AuditLog represents an immutable record of a signature-related action.
// Compliant with ETDA and ETA Section 9 standards for traceability.
type AuditLog struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RequestID    primitive.ObjectID `bson:"request_id" json:"request_id"`
	Role         SignRole           `bson:"role" json:"role"`
	Action       string             `bson:"action" json:"action"`               // e.g., "sign", "approve", "reject"
	DocumentHash string             `bson:"document_hash" json:"document_hash"` // SHA-256 of document state at time of action
	IPAddress    string             `bson:"ip_address" json:"ip_address"`
	UserAgent    string             `bson:"user_agent" json:"user_agent"`
	Timestamp    time.Time          `bson:"timestamp" json:"timestamp"`
}
