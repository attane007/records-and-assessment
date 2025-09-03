package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"backend/models"
	"backend/services"
	"backend/settings"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
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

	// CORS: allow all origins (no credentials)
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Max-Age", "86400")
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})

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

		id, err := services.SaveStudent(ctx, mongoColl, payload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save data"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "data saved", "id": id})
	})

	// GET /api/stats - return total count, counts by year and by month
	r.GET("/api/stats", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
		defer cancel()

		stats, err := services.GetStats(ctx, mongoColl)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to aggregate stats"})
			return
		}
		c.JSON(http.StatusOK, stats)
	})

	r.Run() // listen and serve on 0.0.0.0:8080
}

// validation helpers moved to backend/utils
