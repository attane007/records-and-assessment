package models

// Official holds names/titles for school officials used in generated PDFs.
type Official struct {
	RegistrarName string `bson:"registrar_name" json:"registrar_name"`
	DirectorName  string `bson:"director_name" json:"director_name"`
}
