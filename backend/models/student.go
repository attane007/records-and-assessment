package models

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
}
