package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// FormLink stores one reusable public form link per account.
// Raw tokens are never stored; only token hash + derivation version.
type FormLink struct {
	ID           primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	AccountID    string             `bson:"account_id" json:"account_id"`
	TokenVersion int64              `bson:"token_version" json:"token_version"`
	TokenHash    string             `bson:"token_hash" json:"-"`
	Revoked      bool               `bson:"revoked" json:"revoked"`
	CreatedAt    time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt    time.Time          `bson:"updated_at" json:"updated_at"`
	LastUsedAt   *time.Time         `bson:"last_used_at,omitempty" json:"last_used_at,omitempty"`
}
