package models

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// LogoutHandle stores the OP-issued id_token server-side and links it to a session.
type LogoutHandle struct {
	ID             primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	AccountID      string             `bson:"account_id" json:"account_id"`
	SessionSubject string             `bson:"session_subject,omitempty" json:"session_subject,omitempty"`
	IDToken        string             `bson:"id_token" json:"-"`
	SID            string             `bson:"sid,omitempty" json:"sid,omitempty"`
	Issuer         string             `bson:"issuer,omitempty" json:"issuer,omitempty"`
	Audience       string             `bson:"audience,omitempty" json:"audience,omitempty"`
	ExpiresAt      time.Time          `bson:"expires_at" json:"expires_at"`
	RevokedAt      *time.Time         `bson:"revoked_at,omitempty" json:"revoked_at,omitempty"`
	CreatedAt      time.Time          `bson:"created_at" json:"created_at"`
	UpdatedAt      time.Time          `bson:"updated_at" json:"updated_at"`
}
