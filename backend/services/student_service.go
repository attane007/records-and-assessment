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
		"class":         payload.Class,
		"room":          payload.Room,
		"academic_year": payload.AcademicYear,
		"date_of_birth": payload.DateOfBirth,
		"father_name":   payload.FatherName,
		"mother_name":   payload.MotherName,
		"purpose":       payload.Purpose,
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
