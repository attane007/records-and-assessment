package services

import (
	"context"

	"backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// GetOfficials returns default dummy names. Do NOT read from .env here.
// The caller should attempt a DB lookup first via GetOfficialsFromDB and
// fall back to this function if DB has no record.
func GetOfficials() (registrar string, director string) {
	registrar = "นายทะเบียน (ยังไม่ได้กำหนด)"
	director = "ผู้อำนวยการ (ยังไม่ได้กำหนด)"
	return
}

// GetOfficialEmailsFromDB reads optional official email fields.
func GetOfficialEmailsFromDB(ctx context.Context, coll *mongo.Collection, accountID string) (registrarEmail string, directorEmail string, err error) {
	if coll == nil {
		return "", "", nil
	}
	var doc models.Official
	filter := bson.M{"account_id": accountID}
	err = coll.FindOne(ctx, filter).Decode(&doc)
	if err != nil {
		return "", "", nil
	}
	return doc.RegistrarEmail, doc.DirectorEmail, nil
}

// GetSchoolInfoFromDB reads optional school metadata fields.
func GetSchoolInfoFromDB(ctx context.Context, coll *mongo.Collection, accountID string) (schoolName string, schoolAddress string, err error) {
	if coll == nil {
		return "", "", nil
	}
	var doc models.Official
	filter := bson.M{"account_id": accountID}
	err = coll.FindOne(ctx, filter).Decode(&doc)
	if err != nil {
		return "", "", nil
	}
	return doc.SchoolName, doc.SchoolAddress, nil
}

// GetOfficialsFromDB tries to load officials from the provided collection.
// It uses accountID to scope the lookup.
// If the collection is nil or the document is not found, it returns empty strings and a nil error
// so callers can decide to use GetOfficials() as fallback.
func GetOfficialsFromDB(ctx context.Context, coll *mongo.Collection, accountID string) (registrar string, director string, err error) {
	if coll == nil {
		return "", "", nil
	}
	var doc models.Official
	filter := bson.M{"account_id": accountID}
	err = coll.FindOne(ctx, filter).Decode(&doc)
	if err != nil {
		// return empty on not found / error so caller can fallback to dummy
		return "", "", nil
	}
	return doc.RegistrarName, doc.DirectorName, nil
}

// SaveOfficialsToDB saves or updates the officials data in the database.
// It uses upsert to create the document if it doesn't exist or update if it does.
func SaveOfficialsToDB(ctx context.Context, coll *mongo.Collection, accountID, registrarName, directorName, registrarEmail, directorEmail, schoolName, schoolAddress string) error {
	if coll == nil {
		return nil // No collection to save to
	}

	filter := bson.M{"account_id": accountID}
	update := bson.M{
		"$set": bson.M{
			"account_id":      accountID,
			"registrar_name":  registrarName,
			"director_name":   directorName,
			"registrar_email": registrarEmail,
			"director_email":  directorEmail,
			"school_name":     schoolName,
			"school_address":  schoolAddress,
		},
	}

	_, err := coll.UpdateOne(ctx, filter, update, options.Update().SetUpsert(true))

	return err
}
