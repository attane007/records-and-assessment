package services

import (
	"context"
	"time"

	"backend/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// SaveStudent inserts a student document and returns the inserted ID.
func SaveStudent(ctx context.Context, coll *mongo.Collection, payload models.StudentData) (interface{}, error) {
	res, err := coll.InsertOne(ctx, bson.M{
		"prefix":        payload.Prefix,
		"document_type": payload.DocumentType,
		"name":          payload.Name,
		"id_card":       payload.IDCard,
		"student_id":    payload.StudentID,
		"class":         payload.Class,
		"room":          payload.Room,
		"academic_year": payload.AcademicYear,
		"date_of_birth": payload.DateOfBirth,
		"father_name":   payload.FatherName,
		"mother_name":   payload.MotherName,
		"purpose":       payload.Purpose,
		"status":        "pending", // Default status is pending
		"created_at":    time.Now(),
	})
	if err != nil {
		return nil, err
	}
	return res.InsertedID, nil
}

type YearItem struct {
	Year  int32 `json:"year"`
	Count int32 `json:"count"`
}

type MonthItem struct {
	Year  int32 `json:"year"`
	Month int32 `json:"month"`
	Count int32 `json:"count"`
}

type StatsResult struct {
	Total   int64       `json:"total"`
	ByYear  []YearItem  `json:"by_year"`
	ByMonth []MonthItem `json:"by_month"`
}

// GetStats computes total, yearly and monthly counts from the collection.
func GetStats(ctx context.Context, coll *mongo.Collection) (StatsResult, error) {
	var out StatsResult

	total, err := coll.CountDocuments(ctx, bson.D{})
	if err != nil {
		return out, err
	}
	out.Total = total

	// aggregation by year
	type yearAgg struct {
		ID    int32 `bson:"_id"`
		Count int32 `bson:"count"`
	}
	yearPipe := mongo.Pipeline{
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: bson.D{{Key: "$year", Value: "$created_at"}}},
			{Key: "count", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
		bson.D{{Key: "$sort", Value: bson.D{{Key: "_id", Value: 1}}}},
	}
	yearCur, err := coll.Aggregate(ctx, yearPipe)
	if err != nil {
		return out, err
	}
	var yearRes []yearAgg
	if err := yearCur.All(ctx, &yearRes); err != nil {
		return out, err
	}
	out.ByYear = make([]YearItem, 0, len(yearRes))
	for _, it := range yearRes {
		out.ByYear = append(out.ByYear, YearItem{Year: it.ID, Count: it.Count})
	}

	// aggregation by month (year + month)
	type monthAgg struct {
		ID struct {
			Y int32 `bson:"y"`
			M int32 `bson:"m"`
		} `bson:"_id"`
		Count int32 `bson:"count"`
	}
	monthPipe := mongo.Pipeline{
		bson.D{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: bson.D{
				{Key: "y", Value: bson.D{{Key: "$year", Value: "$created_at"}}},
				{Key: "m", Value: bson.D{{Key: "$month", Value: "$created_at"}}},
			}},
			{Key: "count", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
		bson.D{{Key: "$sort", Value: bson.D{{Key: "_id.y", Value: 1}, {Key: "_id.m", Value: 1}}}},
	}
	monthCur, err := coll.Aggregate(ctx, monthPipe)
	if err != nil {
		return out, err
	}
	var monthRes []monthAgg
	if err := monthCur.All(ctx, &monthRes); err != nil {
		return out, err
	}
	out.ByMonth = make([]MonthItem, 0, len(monthRes))
	for _, it := range monthRes {
		out.ByMonth = append(out.ByMonth, MonthItem{Year: it.ID.Y, Month: it.ID.M, Count: it.Count})
	}

	return out, nil
}

// RequestRecord represents a student request/application document with metadata
type RequestRecord struct {
	ID           interface{} `json:"id" bson:"_id"`
	Prefix       string      `json:"prefix" bson:"prefix"`
	Name         string      `json:"name" bson:"name"`
	DocumentType string      `json:"document_type" bson:"document_type"`
	IDCard       string      `json:"id_card" bson:"id_card"`
	StudentID    string      `json:"student_id" bson:"student_id"`
	DateOfBirth  string      `json:"date_of_birth" bson:"date_of_birth"`
	Class        string      `json:"class" bson:"class"`
	Room         string      `json:"room" bson:"room"`
	AcademicYear string      `json:"academic_year" bson:"academic_year"`
	FatherName   string      `json:"father_name" bson:"father_name"`
	MotherName   string      `json:"mother_name" bson:"mother_name"`
	Purpose      string      `json:"purpose" bson:"purpose"`
	Status       string      `json:"status" bson:"status"` // pending, completed, cancelled
	CreatedAt    time.Time   `json:"created_at" bson:"created_at"`
}

// GetRequests retrieves all student requests with pagination
func GetRequests(ctx context.Context, coll *mongo.Collection, page, limit int) ([]RequestRecord, int64, error) {
	// Calculate skip value for pagination
	skip := (page - 1) * limit

	// Get total count
	total, err := coll.CountDocuments(ctx, bson.D{})
	if err != nil {
		return nil, 0, err
	}

	// Get paginated results, sorted by created_at descending (newest first)
	pipeline := mongo.Pipeline{
		bson.D{{Key: "$sort", Value: bson.D{{Key: "created_at", Value: -1}}}},
		bson.D{{Key: "$skip", Value: skip}},
		bson.D{{Key: "$limit", Value: limit}},
	}

	cursor, err := coll.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, 0, err
	}
	defer cursor.Close(ctx)

	var requests []RequestRecord
	if err := cursor.All(ctx, &requests); err != nil {
		return nil, 0, err
	}

	return requests, total, nil
}

// GetRequestByID retrieves a single request by its ID
func GetRequestByID(ctx context.Context, coll *mongo.Collection, id interface{}) (*RequestRecord, error) {
	var request RequestRecord

	filter := bson.M{"_id": id}
	err := coll.FindOne(ctx, filter).Decode(&request)
	if err != nil {
		return nil, err
	}

	return &request, nil
}

// UpdateRequestStatus updates the status of a request
func UpdateRequestStatus(ctx context.Context, coll *mongo.Collection, id interface{}, status string) error {
	filter := bson.M{"_id": id}
	update := bson.M{
		"$set": bson.M{
			"status":     status,
			"updated_at": time.Now(),
		},
	}

	_, err := coll.UpdateOne(ctx, filter, update)
	return err
}
