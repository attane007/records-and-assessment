package handlers

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"backend/models"
	"backend/services"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/go-playground/validator/v10"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

const maxSignatureDataLength = 450000

type signatureUpdatePayload struct {
	DataBase64 string `json:"data_base64" binding:"required"`
	Method     string `json:"method" binding:"required,oneof=draw upload"`
	SignedVia  string `json:"signed_via"`
}

type officialSignatureUpdatePayload struct {
	DataBase64 string `json:"data_base64" binding:"required"`
	Method     string `json:"method" binding:"required,oneof=draw upload"`
	SignedVia  string `json:"signed_via"`
	Decision   string `json:"decision" binding:"required,oneof=approve reject"`
}

type signSessionCompletePayload struct {
	DataBase64 string `json:"data_base64" binding:"required"`
	Method     string `json:"method" binding:"required,oneof=draw upload"`
	SignedVia  string `json:"signed_via"`
	Decision   string `json:"decision"`
}

type publicSubmitPayload struct {
	Name         string `json:"name" binding:"required"`
	Prefix       string `json:"prefix" binding:"required"`
	DocumentType string `json:"document_type" binding:"required"`
	IDCard       string `json:"id_card" binding:"required,idcard"`
	StudentID    string `json:"student_id"`
	DateOfBirth  string `json:"date_of_birth" binding:"required"`
	Purpose      string `json:"purpose" binding:"required"`
	Class        string `json:"class"`
	Room         string `json:"room"`
	AcademicYear string `json:"academic_year"`
	FatherName   string `json:"father_name"`
	MotherName   string `json:"mother_name"`
}

func decodeAndValidateDataURL(input string) error {
	trimmed := strings.TrimSpace(input)
	if trimmed == "" {
		return fmt.Errorf("signature data is required")
	}
	if len(trimmed) > maxSignatureDataLength {
		return fmt.Errorf("signature payload is too large")
	}

	encoded := trimmed
	if strings.HasPrefix(trimmed, "data:") {
		comma := strings.Index(trimmed, ",")
		if comma < 0 {
			return fmt.Errorf("invalid data url")
		}
		header := strings.ToLower(trimmed[:comma])
		if !strings.Contains(header, ";base64") {
			return fmt.Errorf("signature must be base64 encoded")
		}
		if !strings.Contains(header, "image/png") && !strings.Contains(header, "image/jpeg") && !strings.Contains(header, "image/webp") {
			return fmt.Errorf("unsupported signature image format")
		}
		encoded = trimmed[comma+1:]
	}

	if _, err := base64.StdEncoding.DecodeString(encoded); err != nil {
		if _, rawErr := base64.RawStdEncoding.DecodeString(encoded); rawErr != nil {
			return fmt.Errorf("invalid base64 data")
		}
	}
	return nil
}

func toSignatureBlock(payload signatureUpdatePayload) (models.SignatureBlock, error) {
	if err := decodeAndValidateDataURL(payload.DataBase64); err != nil {
		return models.SignatureBlock{}, err
	}

	signedVia := strings.TrimSpace(payload.SignedVia)
	if signedVia == "" {
		signedVia = "web"
	}
	if signedVia != "web" && signedVia != "mobile" && signedVia != "qr-mobile" {
		return models.SignatureBlock{}, fmt.Errorf("invalid signed_via")
	}

	return models.SignatureBlock{
		DataBase64: payload.DataBase64,
		Method:     payload.Method,
		SignedVia:  signedVia,
		SignedAt:   time.Now(),
	}, nil
}

func toOfficialDecision(value string) (models.OfficialDecisionValue, error) {
	decision := models.OfficialDecisionValue(strings.TrimSpace(value))
	if !models.IsValidOfficialDecision(decision) {
		return "", fmt.Errorf("invalid official decision")
	}
	return decision, nil
}

func buildPublicBaseURL(c *gin.Context) string {
	if configured := strings.TrimSpace(os.Getenv("SIGN_PUBLIC_BASE_URL")); configured != "" {
		return strings.TrimRight(configured, "/")
	}

	proto := c.GetHeader("X-Forwarded-Proto")
	if proto == "" {
		if c.Request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}
	host := c.GetHeader("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}
	if host == "" {
		host = "localhost:3000"
	}
	return fmt.Sprintf("%s://%s", proto, host)
}

func mapSignLinkError(err error) (int, string) {
	switch {
	case errors.Is(err, services.ErrSignLinkNotFound):
		return http.StatusNotFound, "sign link not found"
	case errors.Is(err, services.ErrSignLinkExpired):
		return http.StatusGone, "sign link expired"
	case errors.Is(err, services.ErrSignLinkUsed):
		return http.StatusConflict, "sign link already used"
	case errors.Is(err, services.ErrSignLinkRevoked):
		return http.StatusForbidden, "sign link revoked"
	default:
		return http.StatusInternalServerError, "sign link error"
	}
}

func mapFormLinkError(err error) (int, string) {
	switch {
	case errors.Is(err, services.ErrFormLinkNotFound):
		return http.StatusNotFound, "form link not found"
	case errors.Is(err, services.ErrFormLinkRevoked):
		return http.StatusForbidden, "form link revoked"
	default:
		return http.StatusInternalServerError, "form link error"
	}
}

func hasStudentSignature(record *services.RequestRecord) bool {
	if record == nil || record.Signatures.Student == nil {
		return false
	}
	return strings.TrimSpace(record.Signatures.Student.DataBase64) != ""
}

func notifyAdminSubmissionAsync(record *services.RequestRecord) {
	if record == nil {
		return
	}

	snapshot := *record
	go func(req services.RequestRecord) {
		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()
		if err := services.SendSubmissionNotificationByRequest(ctx, &req); err != nil {
			log.Printf("email notification error for id %v: %v", req.ID, err)
		}
	}(snapshot)
}

func notifyOfficialsSigningLinksAsync(requestID primitive.ObjectID, signLinksColl *mongo.Collection, officialsColl *mongo.Collection, publicBaseURL string, accountID string) {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()

		results, err := services.CreateAndSendOfficialSignLinks(ctx, signLinksColl, officialsColl, requestID, publicBaseURL, 7, accountID)
		if err != nil {
			log.Printf("official sign link dispatch failed for request %s: %v", requestID.Hex(), err)
			return
		}

		for _, result := range results {
			if result.EmailSent {
				continue
			}
			if strings.TrimSpace(result.Warning) != "" {
				log.Printf("official sign link warning for request %s role %s: %s", requestID.Hex(), result.Role, result.Warning)
			}
		}
	}()
}

// RegisterRoutes registers all HTTP routes on the provided gin Engine.
func RegisterRoutes(r *gin.Engine, mongoColl *mongo.Collection, officialsColl *mongo.Collection, adminColl *mongo.Collection, signLinksColl *mongo.Collection, signSessionsColl *mongo.Collection, formLinksColl *mongo.Collection, auditColl *mongo.Collection) {
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

	authVerifier, authInitErr := NewAuthVerifierFromEnv()
	if authInitErr != nil {
		log.Printf("OIDC auth verifier initialization failed: %v", authInitErr)
	}
	requireAuth := RequireBearerAuth(authVerifier)

	r.GET("/api/form-links/current", requireAuth, func(c *gin.Context) {
		accountID := accountIDFromContext(c)
		if accountID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing account id"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		record, rawToken, err := services.GetOrCreateActiveFormLink(ctx, formLinksColl, accountID)
		if err != nil {
			status, msg := mapFormLinkError(err)
			c.JSON(status, gin.H{"error": msg})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"token":      rawToken,
			"revoked":    record.Revoked,
			"created_at": record.CreatedAt,
			"updated_at": record.UpdatedAt,
			"form_url":   fmt.Sprintf("%s/form/%s", buildPublicBaseURL(c), rawToken),
		})
	})

	r.GET("/api/share/qrcode", func(c *gin.Context) {
		url := c.Query("url")
		if url == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing url parameter"})
			return
		}

		png, err := utils.GenerateQRCode(url)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate qr code"})
			return
		}

		c.Data(http.StatusOK, "image/png", png)
	})

	r.POST("/api/form-links/rotate", requireAuth, func(c *gin.Context) {
		accountID := accountIDFromContext(c)
		if accountID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing account id"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		record, rawToken, err := services.RotateFormLink(ctx, formLinksColl, accountID)
		if err != nil {
			status, msg := mapFormLinkError(err)
			c.JSON(status, gin.H{"error": msg})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message":    "form link rotated",
			"token":      rawToken,
			"revoked":    record.Revoked,
			"created_at": record.CreatedAt,
			"updated_at": record.UpdatedAt,
			"form_url":   fmt.Sprintf("%s/form/%s", buildPublicBaseURL(c), rawToken),
		})
	})

	// POST /api/submit - deprecated (legacy account_id based flow)
	r.POST("/api/submit", func(c *gin.Context) {
		c.JSON(http.StatusGone, gin.H{"error": "endpoint deprecated, use /api/form-links/:token/submit"})
	})

	// POST /api/form-links/:token/submit - public student request submit through opaque token
	r.POST("/api/form-links/:token/submit", func(c *gin.Context) {
		rawToken := strings.TrimSpace(c.Param("token"))
		if rawToken == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing form token"})
			return
		}

		var payload publicSubmitPayload
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

		formLink, err := services.GetFormLinkByRawToken(ctx, formLinksColl, rawToken)
		if err != nil {
			status, msg := mapFormLinkError(err)
			c.JSON(status, gin.H{"error": msg})
			return
		}

		studentPayload := models.StudentData{
			Name:         payload.Name,
			Prefix:       payload.Prefix,
			DocumentType: payload.DocumentType,
			IDCard:       payload.IDCard,
			StudentID:    payload.StudentID,
			DateOfBirth:  payload.DateOfBirth,
			Purpose:      payload.Purpose,
			AccountID:    formLink.AccountID,
			Class:        payload.Class,
			Room:         payload.Room,
			AcademicYear: payload.AcademicYear,
			FatherName:   payload.FatherName,
			MotherName:   payload.MotherName,
		}

		id, err := services.SaveStudent(ctx, mongoColl, studentPayload)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save data"})
			return
		}

		if err := services.TouchFormLinkUsed(ctx, formLinksColl, formLink.ID); err != nil {
			log.Printf("failed to update form link last used timestamp: %v", err)
		}

		c.JSON(http.StatusOK, gin.H{"message": "data saved", "id": id})
	})

	// GET /api/stats - return total count, counts by year and by month
	r.GET("/api/stats", requireAuth, func(c *gin.Context) {
		accountID := accountIDFromContext(c)
		if accountID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing account id"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
		defer cancel()

		stats, err := services.GetStats(ctx, mongoColl, accountID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to aggregate stats"})
			return
		}
		c.JSON(http.StatusOK, stats)
	})

	// PUT /api/requests/:id/signature/student - submit requester signature
	r.PUT("/api/requests/:id/signature/student", func(c *gin.Context) {
		idStr := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request ID"})
			return
		}

		var payload signatureUpdatePayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature payload"})
			return
		}

		sig, err := toSignatureBlock(payload)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		var rawRequest models.StudentData
		if err := mongoColl.FindOne(ctx, bson.M{"_id": objectID}).Decode(&rawRequest); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
			return
		}

		accountID := strings.TrimSpace(rawRequest.AccountID)
		if accountID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "missing account id"})
			return
		}

		requestBefore, err := services.GetRequestByID(ctx, mongoColl, objectID, accountID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
			return
		}
		hadStudentSignature := hasStudentSignature(requestBefore)

		if err := services.UpsertSignature(ctx, mongoColl, auditColl, objectID, models.SignRoleStudent, sig, c.ClientIP(), c.GetHeader("User-Agent"), accountID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save signature"})
			return
		}

		if !hadStudentSignature {
			notifyAdminSubmissionAsync(requestBefore)
			notifyOfficialsSigningLinksAsync(objectID, signLinksColl, officialsColl, buildPublicBaseURL(c), accountID)
		}

		c.JSON(http.StatusOK, gin.H{"message": "student signature saved"})
	})

	// POST /api/requests/:id/sign-links - create official sign link from admin workflow
	r.POST("/api/requests/:id/sign-links", requireAuth, func(c *gin.Context) {
		accountID := accountIDFromContext(c)
		if accountID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing account id"})
			return
		}

		idStr := c.Param("id")
		objectID, err := primitive.ObjectIDFromHex(idStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request ID"})
			return
		}

		var payload struct {
			Role           string `json:"role" binding:"required,oneof=registrar director"`
			Channel        string `json:"channel" binding:"required,oneof=email copy"`
			RecipientEmail string `json:"recipient_email"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sign link payload"})
			return
		}

		role := models.SignRole(payload.Role)
		recipientEmail := strings.TrimSpace(payload.RecipientEmail)

		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()

		if payload.Channel == "email" && recipientEmail == "" {
			registrarEmail, directorEmail, _ := services.GetOfficialEmailsFromDB(ctx, officialsColl, accountID)
			if role == models.SignRoleRegistrar {
				recipientEmail = strings.TrimSpace(registrarEmail)
			} else {
				recipientEmail = strings.TrimSpace(directorEmail)
			}
			if recipientEmail == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "recipient email is required for email channel"})
				return
			}
		}

		record, rawToken, err := services.CreateSignLink(ctx, signLinksColl, objectID, role, payload.Channel, recipientEmail, 7)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create sign link"})
			return
		}

		signURL := fmt.Sprintf("%s/sign/%s", buildPublicBaseURL(c), rawToken)
		emailSent := false
		var warning string
		if payload.Channel == "email" {
			err = services.SendOfficialSignLink(ctx, payload.Role, recipientEmail, signURL, objectID.Hex())
			if err != nil {
				warning = err.Error()
			} else {
				emailSent = true
				_ = services.TouchSignLinkSent(ctx, signLinksColl, record.ID)
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"message":         "sign link created",
			"sign_url":        signURL,
			"token":           rawToken,
			"role":            role,
			"channel":         payload.Channel,
			"recipient_email": recipientEmail,
			"expires_at":      record.ExpiresAt,
			"email_sent":      emailSent,
			"warning":         warning,
		})
	})

	// GET /api/sign-links/:token - verify token and return signing metadata
	r.GET("/api/sign-links/:token", func(c *gin.Context) {
		rawToken := c.Param("token")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		record, err := services.GetSignLinkByRawToken(ctx, signLinksColl, rawToken)
		if err != nil {
			status, msg := mapSignLinkError(err)
			c.JSON(status, gin.H{"error": msg})
			return
		}

		validationErr := services.ValidateSignLink(record)
		active := validationErr == nil

		// For sign-links verifying, we must fetch the request.
		// Since we don't have accountID here, and GetRequestByID requires it,
		// we should fetch the request without it here, or use the sign link's relation.
		// Let's create a GetRequestByIDWithoutAccountID or use a direct query.
		var request models.StudentData // We'll just read it directly since it's a public read context
		err = mongoColl.FindOne(ctx, bson.M{"_id": record.RequestID}).Decode(&request)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
			return
		}

		response := gin.H{
			"role":       record.Role,
			"request_id": record.RequestID.Hex(),
			"expires_at": record.ExpiresAt,
			"used_at":    record.UsedAt,
			"revoked":    record.Revoked,
			"active":     active,
			"request": gin.H{
				"id":            record.RequestID.Hex(),
				"prefix":        request.Prefix,
				"name":          request.Name,
				"id_card":       request.IDCard,
				"date_of_birth": request.DateOfBirth,
				"document_type": request.DocumentType,
				"purpose":       request.Purpose,
			},
		}
		if validationErr != nil {
			_, msg := mapSignLinkError(validationErr)
			response["status_message"] = msg
		}

		c.JSON(http.StatusOK, response)
	})

	// POST /api/sign-links/:token/sign - submit official signature via tokenized link
	r.POST("/api/sign-links/:token/sign", func(c *gin.Context) {
		rawToken := c.Param("token")

		var payload officialSignatureUpdatePayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature payload"})
			return
		}

		sig, err := toSignatureBlock(signatureUpdatePayload{
			DataBase64: payload.DataBase64,
			Method:     payload.Method,
			SignedVia:  payload.SignedVia,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		decision, err := toOfficialDecision(payload.Decision)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
		defer cancel()

		record, err := services.GetSignLinkByRawToken(ctx, signLinksColl, rawToken)
		if err != nil {
			status, msg := mapSignLinkError(err)
			c.JSON(status, gin.H{"error": msg})
			return
		}

		if err := services.ValidateSignLink(record); err != nil {
			status, msg := mapSignLinkError(err)
			c.JSON(status, gin.H{"error": msg})
			return
		}

		if record.Role != models.SignRoleRegistrar && record.Role != models.SignRoleDirector {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sign link role"})
			return
		}

		var req models.StudentData
		if err := mongoColl.FindOne(ctx, bson.M{"_id": record.RequestID}).Decode(&req); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
			return
		}

		if err := services.UpsertOfficialDecisionAndSignature(ctx, mongoColl, auditColl, record.RequestID, record.Role, sig, decision, c.ClientIP(), c.GetHeader("User-Agent"), req.AccountID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save signature"})
			return
		}
		if _, err := services.RecomputeStatusFromOfficialDecisions(ctx, mongoColl, record.RequestID, req.AccountID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update request status"})
			return
		}
		if err := services.MarkSignLinkUsed(ctx, signLinksColl, record.ID); err != nil {
			log.Printf("failed to mark sign link used: %v", err)
		}

		c.JSON(http.StatusOK, gin.H{"message": "signature saved"})
	})

	// POST /api/sign-sessions - create a QR handoff session
	r.POST("/api/sign-sessions", func(c *gin.Context) {
		var payload struct {
			RequestID string `json:"request_id"`
			Role      string `json:"role"`
			Token     string `json:"token"`
			Decision  string `json:"decision"`
		}
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sign session payload"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 6*time.Second)
		defer cancel()

		var requestID primitive.ObjectID
		var role models.SignRole
		var signLinkID *primitive.ObjectID
		decision := models.OfficialDecisionValue("")
		var err error

		if strings.TrimSpace(payload.Token) != "" {
			record, err := services.GetSignLinkByRawToken(ctx, signLinksColl, payload.Token)
			if err != nil {
				status, msg := mapSignLinkError(err)
				c.JSON(status, gin.H{"error": msg})
				return
			}
			if err := services.ValidateSignLink(record); err != nil {
				status, msg := mapSignLinkError(err)
				c.JSON(status, gin.H{"error": msg})
				return
			}
			requestID = record.RequestID
			role = record.Role
			signLinkID = &record.ID
			if role == models.SignRoleRegistrar || role == models.SignRoleDirector {
				decision, err = toOfficialDecision(payload.Decision)
				if err != nil {
					c.JSON(http.StatusBadRequest, gin.H{"error": "decision is required for official QR signing"})
					return
				}
			}
		} else {
			if strings.TrimSpace(payload.RequestID) == "" || strings.TrimSpace(payload.Role) == "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": "request_id and role are required"})
				return
			}
			objID, err := primitive.ObjectIDFromHex(payload.RequestID)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request_id"})
				return
			}
			if payload.Role != string(models.SignRoleStudent) {
				c.JSON(http.StatusBadRequest, gin.H{"error": "direct session creation is allowed for student role only"})
				return
			}
			requestID = objID
			role = models.SignRoleStudent
		}

		var session *models.SignSession
		if decision != "" {
			session, err = services.CreateDecisionSignSession(ctx, signSessionsColl, requestID, role, decision, signLinkID, 10*time.Minute)
		} else {
			session, err = services.CreateSignSession(ctx, signSessionsColl, requestID, role, signLinkID, 10*time.Minute)
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create sign session"})
			return
		}

		mobileURL := fmt.Sprintf("%s/sign/mobile?sessionId=%s", buildPublicBaseURL(c), session.ID)
		c.JSON(http.StatusOK, gin.H{
			"session_id": session.ID,
			"status":     session.Status,
			"expires_at": session.ExpiresAt,
			"mobile_url": mobileURL,
			"request_id": session.RequestID.Hex(),
			"role":       session.Role,
		})
	})

	// GET /api/sign-sessions/:id/status - poll status for desktop QR flow
	r.GET("/api/sign-sessions/:id/status", func(c *gin.Context) {
		sessionID := c.Param("id")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		session, err := services.GetSignSessionByID(ctx, signSessionsColl, sessionID)
		if err != nil {
			if errors.Is(err, services.ErrSignSessionNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "sign session not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read sign session"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"session_id":   session.ID,
			"status":       session.Status,
			"expires_at":   session.ExpiresAt,
			"completed_at": session.CompletedAt,
			"request_id":   session.RequestID.Hex(),
			"role":         session.Role,
		})
	})

	// POST /api/sign-sessions/:id/complete - mobile client completes signature for one session
	r.POST("/api/sign-sessions/:id/complete", func(c *gin.Context) {
		sessionID := c.Param("id")

		var payload signSessionCompletePayload
		if err := c.ShouldBindJSON(&payload); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid signature payload"})
			return
		}

		sig, err := toSignatureBlock(signatureUpdatePayload{
			DataBase64: payload.DataBase64,
			Method:     payload.Method,
			SignedVia:  payload.SignedVia,
		})
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		sig.SignedVia = "qr-mobile"

		ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
		defer cancel()

		session, err := services.GetSignSessionByID(ctx, signSessionsColl, sessionID)
		if err != nil {
			if errors.Is(err, services.ErrSignSessionNotFound) {
				c.JSON(http.StatusNotFound, gin.H{"error": "sign session not found"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read sign session"})
			return
		}

		if session.Status == "completed" {
			c.JSON(http.StatusConflict, gin.H{"error": "session already completed"})
			return
		}
		if session.Status == "expired" || time.Now().After(session.ExpiresAt) {
			c.JSON(http.StatusGone, gin.H{"error": "sign session expired"})
			return
		}

		var requestBefore *services.RequestRecord
		hadStudentSignature := false
		var accountID string

		// To use GetRequestByID we need accountID. But for session complete, we only have sessionID.
		// So we query the request directly without accountID, or use the signLink.
		// Actually, let's just fetch the raw request to get its account_id.
		var rawRequest models.StudentData
		if err := mongoColl.FindOne(ctx, bson.M{"_id": session.RequestID}).Decode(&rawRequest); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
			return
		}
		accountID = rawRequest.AccountID

		if session.Role == models.SignRoleStudent {
			requestBefore, err = services.GetRequestByID(ctx, mongoColl, session.RequestID, accountID)
			if err != nil {
				c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
				return
			}
			hadStudentSignature = hasStudentSignature(requestBefore)
		}

		if session.Role == models.SignRoleRegistrar || session.Role == models.SignRoleDirector {
			decisionInput := strings.TrimSpace(payload.Decision)
			if decisionInput == "" {
				decisionInput = string(session.Decision)
			}
			decision, decisionErr := toOfficialDecision(decisionInput)
			if decisionErr != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": "decision is required for official signing"})
				return
			}

			if err := services.UpsertOfficialDecisionAndSignature(ctx, mongoColl, auditColl, session.RequestID, session.Role, sig, decision, c.ClientIP(), c.GetHeader("User-Agent"), accountID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save signature"})
				return
			}
			if _, err := services.RecomputeStatusFromOfficialDecisions(ctx, mongoColl, session.RequestID, accountID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update request status"})
				return
			}
		} else {
			if err := services.UpsertSignature(ctx, mongoColl, auditColl, session.RequestID, session.Role, sig, c.ClientIP(), c.GetHeader("User-Agent"), accountID); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save signature"})
				return
			}
		}
		if session.SignLinkID != nil {
			if err := services.MarkSignLinkUsed(ctx, signLinksColl, *session.SignLinkID); err != nil {
				log.Printf("failed to mark sign link used from session: %v", err)
			}
		}
		if err := services.CompleteSignSession(ctx, signSessionsColl, session.ID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete sign session"})
			return
		}

		if session.Role == models.SignRoleStudent && !hadStudentSignature {
			notifyAdminSubmissionAsync(requestBefore)
			notifyOfficialsSigningLinksAsync(session.RequestID, signLinksColl, officialsColl, buildPublicBaseURL(c), accountID)
		}

		c.JSON(http.StatusOK, gin.H{"message": "signature saved", "session_id": session.ID})
	})

	// GET /api/requests - return paginated list of student requests
	r.GET("/api/requests", requireAuth, func(c *gin.Context) {
		accountID := accountIDFromContext(c)
		if accountID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing account id"})
			return
		}

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

		requests, total, err := services.GetRequests(ctx, mongoColl, page, limit, accountID)
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
	r.GET("/api/pdf/:id", requireAuth, func(c *gin.Context) {
		accountID := accountIDFromContext(c)
		if accountID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing account id"})
			return
		}

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
		request, err := services.GetRequestByID(ctx, mongoColl, objectID, accountID)
		if err != nil {
			log.Printf("request not found for id %s: %v", idStr, err)
			c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
			return
		}

		// Try to load official names from DB, fall back to dummy defaults
		registrarName, directorName, offErr := services.GetOfficialsFromDB(ctx, officialsColl, accountID)
		if offErr != nil || registrarName == "" || directorName == "" {
			// fallback to env/defaults
			registrarName, directorName = services.GetOfficials()
		}

		// Generate PDF via service (pass official names and base URL for verification QR)
		pdfBytes, err := services.GeneratePDF(request, registrarName, directorName, buildPublicBaseURL(c))
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
	r.PUT("/api/requests/:id/status", requireAuth, func(c *gin.Context) {
		accountID := accountIDFromContext(c)
		if accountID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing account id"})
			return
		}

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

		err = services.UpdateRequestStatus(ctx, mongoColl, objectID, payload.Status, accountID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update status"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "status updated successfully"})
	})

	// GET /api/officials - get current officials data
	r.GET("/api/officials", requireAuth, func(c *gin.Context) {
		accountID := accountIDFromContext(c)
		if accountID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing account id"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		registrarName, directorName, err := services.GetOfficialsFromDB(ctx, officialsColl, accountID)
		registrarEmail, directorEmail, _ := services.GetOfficialEmailsFromDB(ctx, officialsColl, accountID)
		if err != nil || (registrarName == "" && directorName == "") {
			// Return default values if no data found
			registrarName, directorName = services.GetOfficials()
		}

		c.JSON(http.StatusOK, gin.H{
			"registrar_name":  registrarName,
			"director_name":   directorName,
			"registrar_email": registrarEmail,
			"director_email":  directorEmail,
		})
	})

	// POST /api/officials - update officials data
	r.POST("/api/officials", requireAuth, func(c *gin.Context) {
		accountID := accountIDFromContext(c)
		if accountID == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing account id"})
			return
		}

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

		err := services.SaveOfficialsToDB(ctx, officialsColl, accountID, payload.RegistrarName, payload.DirectorName, payload.RegistrarEmail, payload.DirectorEmail)
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
	r.POST("/api/admin/change-password", requireAuth, func(c *gin.Context) {
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

		// Use username from verified token claims if present.
		defaultUsername := "admin"
		if claimUser := usernameFromContext(c); claimUser != "" {
			defaultUsername = claimUser
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

	// GET /api/verify - Verification endpoint for QR codes and manual hash checking
	r.GET("/api/verify", func(c *gin.Context) {
		hash := c.Query("hash")
		if hash == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "hash is required"})
			return
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		logs, err := services.GetAuditLogsByHash(ctx, auditColl, hash)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to search audit logs"})
			return
		}

		if len(logs) == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "no audit records found for this hash"})
			return
		}

		var requestInfo gin.H
		// Get audit log's associated request. We can fetch it directly to bypass account_id since this is public verification page
		var publicRequest models.StudentData
		err = mongoColl.FindOne(ctx, bson.M{"_id": logs[0].RequestID}).Decode(&publicRequest)
		if err == nil {
			requestInfo = gin.H{
				"prefix":        publicRequest.Prefix,
				"name":          publicRequest.Name,
				"document_type": publicRequest.DocumentType,
				"purpose":       publicRequest.Purpose,
				"created_at":    logs[0].Timestamp, // Using audit log timestamp since basic model might not have create_at if not projected
			}
		}

		c.JSON(http.StatusOK, gin.H{
			"hash":    hash,
			"logs":    logs,
			"request": requestInfo,
		})
	})
}
