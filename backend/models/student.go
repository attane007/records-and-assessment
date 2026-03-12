package models

import "time"

// SignatureBlock stores one signature entry for a role.
type SignatureBlock struct {
	DataBase64   string    `json:"data_base64" bson:"data_base64"`
	Method       string    `json:"method" bson:"method"`         // draw | upload
	SignedVia    string    `json:"signed_via" bson:"signed_via"` // web | mobile | qr-mobile
	SignedAt     time.Time `json:"signed_at" bson:"signed_at"`
	DocumentHash string    `json:"document_hash,omitempty" bson:"document_hash,omitempty"` // SHA-256 of document state
}

// RequestSignatures stores signatures for each role in the workflow.
type RequestSignatures struct {
	Student   *SignatureBlock `json:"student,omitempty" bson:"student,omitempty"`
	Registrar *SignatureBlock `json:"registrar,omitempty" bson:"registrar,omitempty"`
	Director  *SignatureBlock `json:"director,omitempty" bson:"director,omitempty"`
}

// OfficialDecisionValue stores an official decision for one role.
type OfficialDecisionValue string

const (
	OfficialDecisionApprove OfficialDecisionValue = "approve"
	OfficialDecisionReject  OfficialDecisionValue = "reject"
)

// IsValidOfficialDecision reports whether a decision value is supported.
func IsValidOfficialDecision(value OfficialDecisionValue) bool {
	return value == OfficialDecisionApprove || value == OfficialDecisionReject
}

// OfficialDecision stores the selected decision with timestamp.
type OfficialDecision struct {
	Decision     OfficialDecisionValue `json:"decision" bson:"decision"`
	DecidedAt    time.Time             `json:"decided_at" bson:"decided_at"`
	DocumentHash string                `json:"document_hash,omitempty" bson:"document_hash,omitempty"` // SHA-256 of document state
}

// RequestDecisions stores official decisions for each role.
type RequestDecisions struct {
	Registrar *OfficialDecision `json:"registrar,omitempty" bson:"registrar,omitempty"`
	Director  *OfficialDecision `json:"director,omitempty" bson:"director,omitempty"`
}

// StudentData represents the payload expected from the frontend for ปพ.1
type StudentData struct {
	Name         string `json:"name" bson:"name" binding:"required"`
	Prefix       string `json:"prefix" bson:"prefix" binding:"required"`
	DocumentType string `json:"document_type" bson:"document_type" binding:"required"`
	IDCard       string `json:"id_card" bson:"id_card" binding:"required,idcard"`
	StudentID    string `json:"student_id" bson:"student_id"`
	DateOfBirth  string `json:"date_of_birth" bson:"date_of_birth" binding:"required"`
	Purpose      string `json:"purpose" bson:"purpose" binding:"required"`
	Status       string `json:"status" bson:"status"` // pending, completed, cancelled
	AccountID    string `json:"account_id" bson:"account_id" binding:"required"`

	// optional
	Class        string `json:"class" bson:"class"`
	Room         string `json:"room" bson:"room"`
	AcademicYear string `json:"academic_year" bson:"academic_year"`
	FatherName   string `json:"father_name" bson:"father_name"`
	MotherName   string `json:"mother_name" bson:"mother_name"`

	Signatures RequestSignatures `json:"signatures" bson:"signatures"`
	Decisions  RequestDecisions  `json:"decisions,omitempty" bson:"decisions,omitempty"`
}
