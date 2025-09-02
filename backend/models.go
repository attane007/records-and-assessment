package main

// StudentData represents the payload expected from the frontend for ปพ.1
type StudentData struct {
	Name         string `json:"name" bson:"name" binding:"required"`
	IDCard       string `json:"id_card" bson:"id_card" binding:"required"`
	Class        string `json:"class" bson:"class" binding:"required"`
	Room         string `json:"room" bson:"room" binding:"required"`
	AcademicYear string `json:"academic_year" bson:"academic_year" binding:"required"`
	DateOfBirth  string `json:"date_of_birth" bson:"date_of_birth" binding:"required"`
	FatherName   string `json:"father_name" bson:"father_name" binding:"required"`
	MotherName   string `json:"mother_name" bson:"mother_name" binding:"required"`
	Purpose      string `json:"purpose" bson:"purpose" binding:"required"`
}
