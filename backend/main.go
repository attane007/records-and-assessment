package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"backend/models"
	"backend/settings"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

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
	cfg := settings.LoadConfig()
	client := initMongo(cfg.MongoURI)
	// use database from DB_NAME and collection `students`
	mongoColl = client.Database(cfg.DBName).Collection("students")
	// register custom validator for idcard (13 digits)
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		utils.RegisterIDCardValidation(v)
	}

	r := gin.Default()

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "Hello from Go backend with Gin!"})
	})

	// POST /api/submit - accepts student data from the frontend and saves to MongoDB
	r.POST("/api/submit", func(c *gin.Context) {
		var payload models.StudentData
		if err := c.ShouldBindJSON(&payload); err != nil {
			// try to translate validation errors into readable messages
			if errs, ok := err.(validator.ValidationErrors); ok {
				messages := utils.ParseValidationErrors(errs, payload)
				c.JSON(http.StatusBadRequest, gin.H{"errors": messages})
				return
			}
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

// validation helpers moved to backend/utils
