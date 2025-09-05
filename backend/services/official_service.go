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

// GetOfficialsFromDB tries to load officials from the provided collection.
// It expects a document like: { _id: "school_officials", registrar_name: "..", director_name: ".." }
// If the collection is nil or the document is not found, it returns empty strings and a nil error
// so callers can decide to use GetOfficials() as fallback.
func GetOfficialsFromDB(ctx context.Context, coll *mongo.Collection) (registrar string, director string, err error) {
	if coll == nil {
		return "", "", nil
	}
	var doc models.Official
	filter := bson.M{"_id": "school_officials"}
	err = coll.FindOne(ctx, filter).Decode(&doc)
	if err != nil {
		// return empty on not found / error so caller can fallback to dummy
		return "", "", nil
	}
	return doc.RegistrarName, doc.DirectorName, nil
}

// SaveOfficialsToDB saves or updates the officials data in the database.
// It uses upsert to create the document if it doesn't exist or update if it does.
func SaveOfficialsToDB(ctx context.Context, coll *mongo.Collection, registrarName, directorName string) error {
	if coll == nil {
		return nil // No collection to save to
	}

	filter := bson.M{"_id": "school_officials"}
	update := bson.M{
		"$set": bson.M{
			"registrar_name": registrarName,
			"director_name":  directorName,
		},
	}

	_, err := coll.UpdateOne(ctx, filter, update, options.Update().SetUpsert(true))

	return err
}
