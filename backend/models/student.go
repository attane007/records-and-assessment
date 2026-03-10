package models

import "time"

// SignatureBlock stores one signature entry for a role.
type SignatureBlock struct {
	DataBase64 string    `json:"data_base64" bson:"data_base64"`
	Method     string    `json:"method" bson:"method"`         // draw | upload
	SignedVia  string    `json:"signed_via" bson:"signed_via"` // web | mobile | qr-mobile
	SignedAt   time.Time `json:"signed_at" bson:"signed_at"`
}

// RequestSignatures stores signatures for each role in the workflow.
type RequestSignatures struct {
	Student   *SignatureBlock `json:"student,omitempty" bson:"student,omitempty"`
	Registrar *SignatureBlock `json:"registrar,omitempty" bson:"registrar,omitempty"`
	Director  *SignatureBlock `json:"director,omitempty" bson:"director,omitempty"`
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

	// optional
	Class        string `json:"class" bson:"class"`
	Room         string `json:"room" bson:"room"`
	AcademicYear string `json:"academic_year" bson:"academic_year"`
	FatherName   string `json:"father_name" bson:"father_name"`
	MotherName   string `json:"mother_name" bson:"mother_name"`

	Signatures RequestSignatures `json:"signatures" bson:"signatures"`
}
