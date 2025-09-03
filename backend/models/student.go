package models

// StudentData represents the payload expected from the frontend for ปพ.1
type StudentData struct {
	// required
	Name string `json:"name" bson:"name" binding:"required"`
	// optional prefix (คำนำหน้า)
	Prefix      string `json:"prefix" bson:"prefix"`
	IDCard      string `json:"id_card" bson:"id_card" binding:"required,idcard"`
	DateOfBirth string `json:"date_of_birth" bson:"date_of_birth" binding:"required"`
	Purpose     string `json:"purpose" bson:"purpose" binding:"required"`

	// optional
	Class        string `json:"class" bson:"class"`
	Room         string `json:"room" bson:"room"`
	AcademicYear string `json:"academic_year" bson:"academic_year"`
	FatherName   string `json:"father_name" bson:"father_name"`
	MotherName   string `json:"mother_name" bson:"mother_name"`
}
