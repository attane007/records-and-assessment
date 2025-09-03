package main

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"backend/models"
	"backend/services"
	"backend/settings"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"github.com/jung-kurt/gofpdf"
	"go.mongodb.org/mongo-driver/bson/primitive"
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

	// GET /api/requests - return paginated list of student requests
	r.GET("/api/requests", func(c *gin.Context) {
		// Parse pagination parameters
		pageStr := c.DefaultQuery("page", "1")
		limitStr := c.DefaultQuery("limit", "20")

		page, err := strconv.Atoi(pageStr)
		if err != nil || page < 1 {
			page = 1
		}

		limit, err := strconv.Atoi(limitStr)
		if err != nil || limit < 1 || limit > 100 {
			limit = 20
		}

		ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
		defer cancel()

		requests, total, err := services.GetRequests(ctx, mongoColl, page, limit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch requests"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"requests": requests,
			"total":    total,
			"page":     page,
			"limit":    limit,
			"pages":    (total + int64(limit) - 1) / int64(limit), // Calculate total pages
		})
	})

	// GET /api/pdf/:id - generate PDF for a specific request
	r.GET("/api/pdf/:id", func(c *gin.Context) {
		idStr := c.Param("id")

		// Convert string ID to ObjectID
		objectID, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request ID"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Get the specific request
		request, err := services.GetRequestByID(ctx, mongoColl, objectID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
			return
		}

		// Generate PDF
		pdf := gofpdf.New("P", "mm", "A4", "")
		pdf.AddPage()

		// Add Thai font support (using built-in helvetica for now)
		pdf.SetFont("Arial", "B", 16)

		// Header
		pdf.Cell(190, 10, "Ministry of Education")
		pdf.Ln(8)
		pdf.SetFont("Arial", "", 14)
		pdf.Cell(190, 8, "Request for Academic Records (Por Por 1)")
		pdf.Ln(12)

		// Student Information
		pdf.SetFont("Arial", "B", 12)
		pdf.Cell(50, 8, "Student Information")
		pdf.Ln(10)

		pdf.SetFont("Arial", "", 10)
		pdf.Cell(40, 6, "Name: ")
		pdf.Cell(100, 6, request.Prefix+" "+request.Name)
		pdf.Ln(6)

		pdf.Cell(40, 6, "ID Card: ")
		pdf.Cell(100, 6, request.IDCard)
		pdf.Ln(6)

		pdf.Cell(40, 6, "Date of Birth: ")
		pdf.Cell(100, 6, request.DateOfBirth)
		pdf.Ln(6)

		if request.Class != "" && request.Room != "" {
			pdf.Cell(40, 6, "Class/Room: ")
			pdf.Cell(100, 6, request.Class+"/"+request.Room)
			pdf.Ln(6)
		}

		if request.AcademicYear != "" {
			pdf.Cell(40, 6, "Academic Year: ")
			pdf.Cell(100, 6, request.AcademicYear)
			pdf.Ln(6)
		}

		if request.FatherName != "" {
			pdf.Cell(40, 6, "Father's Name: ")
			pdf.Cell(100, 6, request.FatherName)
			pdf.Ln(6)
		}

		if request.MotherName != "" {
			pdf.Cell(40, 6, "Mother's Name: ")
			pdf.Cell(100, 6, request.MotherName)
			pdf.Ln(6)
		}

		pdf.Ln(8)

		// Request Details
		pdf.SetFont("Arial", "B", 12)
		pdf.Cell(50, 8, "Request Details")
		pdf.Ln(10)

		pdf.SetFont("Arial", "", 10)
		pdf.Cell(40, 6, "Document Type: ")
		pdf.Cell(100, 6, request.DocumentType)
		pdf.Ln(6)

		pdf.Cell(40, 6, "Purpose: ")
		pdf.MultiCell(150, 6, request.Purpose, "", "", false)
		pdf.Ln(8)

		// Date
		pdf.Cell(40, 6, "Request Date: ")
		pdf.Cell(100, 6, request.CreatedAt.Format("2006-01-02 15:04:05"))
		pdf.Ln(15)

		// Signature area
		pdf.SetFont("Arial", "", 10)
		pdf.Cell(95, 6, "Applicant Signature: _________________")
		pdf.Cell(95, 6, "Date: _________________")
		pdf.Ln(15)

		pdf.Cell(95, 6, "Officer Signature: _________________")
		pdf.Cell(95, 6, "Date: _________________")

		// Output PDF
		c.Header("Content-Type", "application/pdf")
		c.Header("Content-Disposition", "attachment; filename=request-"+idStr+".pdf")

		err = pdf.Output(c.Writer)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate PDF"})
			return
		}
	})

	// PUT /api/requests/:id/status - update request status
	r.PUT("/api/requests/:id/status", func(c *gin.Context) {
		idStr := c.Param("id")

		// Convert string ID to ObjectID
		objectID, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request ID"})
			return
		}

		var payload struct {
			Status string `json:"status" binding:"required,oneof=pending completed cancelled"`
		}

		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status value"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err = services.UpdateRequestStatus(ctx, mongoColl, objectID, payload.Status)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update status"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "status updated successfully"})
	})

	r.Run() // listen and serve on 0.0.0.0:8080
}

// validation helpers moved to backend/utils
