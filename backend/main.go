package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

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

var mongoColl *mongo.Collection

func initMongo(uri string) *mongo.Client {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	clientOpts := options.Client().ApplyURI(uri)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Fatalf("mongo connect error: %v", err)
	}
	// verify connection
	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("mongo ping error: %v", err)
	}
	return client
}

func main() {
	// MongoDB connection URI - read from MONGO_URI env or use default
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}
	// Read DB name from env (DB_NAME) or default to "records"
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "records"
	}

	client := initMongo(mongoURI)
	// use database from DB_NAME and collection `students`
	mongoColl = client.Database(dbName).Collection("students")

	r := gin.Default()

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Hello from Go backend with Gin!"})
	})

	// POST /api/submit - accepts student data from the frontend and saves to MongoDB
	r.POST("/api/submit", func(c *gin.Context) {
		var payload StudentData
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// insert document
		res, err := mongoColl.InsertOne(ctx, bson.M{
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
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save data"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "data saved", "id": res.InsertedID})
	})

	r.Run() // listen and serve on 0.0.0.0:8080
}
