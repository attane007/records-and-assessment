package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// SignRole identifies the signer role for a signature action.
type SignRole string

const (
	SignRoleStudent   SignRole = "student"
	SignRoleRegistrar SignRole = "registrar"
	SignRoleDirector  SignRole = "director"
	SignRoleAdmin     SignRole = "admin"
)

// SignLink stores one official signing link entry.
type SignLink struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	RequestID      primitive.ObjectID `bson:"request_id" json:"request_id"`
	Role           SignRole           `bson:"role" json:"role"`
	TokenHash      string             `bson:"token_hash" json:"-"`
	ExpiresAt      time.Time          `bson:"expires_at" json:"expires_at"`
	UsedAt         *time.Time         `bson:"used_at,omitempty" json:"used_at,omitempty"`
	Revoked        bool               `bson:"revoked" json:"revoked"`
	Channel        string             `bson:"channel" json:"channel"`
	RecipientEmail string             `bson:"recipient_email,omitempty" json:"recipient_email,omitempty"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
	LastSentAt     *time.Time         `bson:"last_sent_at,omitempty" json:"last_sent_at,omitempty"`
}

// SignSession tracks desktop QR handoff status.
type SignSession struct {
	ID          string                `bson:"_id" json:"id"`
	RequestID   primitive.ObjectID    `bson:"request_id" json:"request_id"`
	Role        SignRole              `bson:"role" json:"role"`
	Decision    OfficialDecisionValue `bson:"decision,omitempty" json:"decision,omitempty"`
	SignLinkID  *primitive.ObjectID   `bson:"sign_link_id,omitempty" json:"sign_link_id,omitempty"`
	Status      string                `bson:"status" json:"status"` // pending | completed | expired
	ExpiresAt   time.Time             `bson:"expires_at" json:"expires_at"`
	CreatedAt   time.Time             `bson:"created_at" json:"created_at"`
	CompletedAt *time.Time            `bson:"completed_at,omitempty" json:"completed_at,omitempty"`
}
