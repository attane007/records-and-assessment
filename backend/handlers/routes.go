package handlers

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"backend/models"
	"backend/services"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// RegisterRoutes registers all HTTP routes on the provided gin Engine.
func RegisterRoutes(r *gin.Engine, mongoColl *mongo.Collection, officialsColl *mongo.Collection, adminColl *mongo.Collection) {
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
			log.Printf("request not found for id %s: %v", idStr, err)
			c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
			return
		}

		// Try to load official names from DB, fall back to dummy defaults
		registrarName, directorName, offErr := services.GetOfficialsFromDB(ctx, officialsColl)
		if offErr != nil || registrarName == "" || directorName == "" {
			// fallback to env/defaults
			registrarName, directorName = services.GetOfficials()
		}

		// Generate PDF via service (pass official names)
		pdfBytes, err := services.GeneratePDF(request, registrarName, directorName)
		if err != nil {
			log.Printf("pdf generation error for id %s: %v", idStr, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate PDF"})
			return
		}

		c.Header("Content-Type", "application/pdf")
		// Force file download instead of inline view
		c.Header("Content-Disposition", "attachment; filename=request-"+idStr+".pdf")
		if _, werr := c.Writer.Write(pdfBytes); werr != nil {
			log.Printf("failed to write PDF response for id %s: %v", idStr, werr)
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

	// GET /api/officials - get current officials data
	r.GET("/api/officials", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		registrarName, directorName, err := services.GetOfficialsFromDB(ctx, officialsColl)
		if err != nil || (registrarName == "" && directorName == "") {
			// Return default values if no data found
			registrarName, directorName = services.GetOfficials()
		}

		c.JSON(http.StatusOK, gin.H{
			"registrar_name": registrarName,
			"director_name":  directorName,
		})
	})

	// POST /api/officials - update officials data
	r.POST("/api/officials", func(c *gin.Context) {
		var payload models.Official
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid data format"})
			return
		}

		if payload.RegistrarName == "" || payload.DirectorName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "both registrar_name and director_name are required"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		err := services.SaveOfficialsToDB(ctx, officialsColl, payload.RegistrarName, payload.DirectorName)
		if err != nil {
			log.Printf("Error saving officials: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save officials data"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "officials data saved successfully"})
	})

	// Initialize admin service
	adminService := services.NewAdminService(adminColl)

	// POST /api/admin/verify - verify admin credentials for login
	r.POST("/api/admin/verify", func(c *gin.Context) {
		var credentials struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}

		if err := c.ShouldBindJSON(&credentials); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid data format"})
			return
		}

		if credentials.Username == "" || credentials.Password == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "username and password are required"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Verify credentials
		isValid, err := adminService.VerifyPassword(ctx, credentials.Username, credentials.Password)
		if err != nil {
			log.Printf("Error verifying credentials: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify credentials"})
			return
		}

		if !isValid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "credentials verified successfully"})
	})

	// POST /api/admin/change-password - change admin password
	r.POST("/api/admin/change-password", func(c *gin.Context) {
		var payload models.ChangePasswordRequest
		if err := c.ShouldBindJSON(&payload); err != nil {
			// try to translate validation errors into readable messages
			if errs, ok := err.(validator.ValidationErrors); ok {
				messages := utils.ParseValidationErrors(errs, payload)
				c.JSON(http.StatusBadRequest, gin.H{"errors": messages})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid data format"})
			return
		}

		// For now, we'll use the default admin username from environment
		// In the future, this could be extracted from session/token
		defaultUsername := "admin"
		if envUser := c.Request.Header.Get("X-Admin-User"); envUser != "" {
			defaultUsername = envUser
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Verify current password
		isValid, err := adminService.VerifyPassword(ctx, defaultUsername, payload.CurrentPassword)
		if err != nil {
			log.Printf("Error verifying password: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify current password"})
			return
		}

		if !isValid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "current password is incorrect"})
			return
		}

		// Update password
		err = adminService.UpdatePassword(ctx, defaultUsername, payload.NewPassword)
		if err != nil {
			log.Printf("Error updating password: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update password"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "password updated successfully"})
	})
}
