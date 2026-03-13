package handlers

import (
	"log"
	"net/http"
	"strings"

	"backend/services"

	"github.com/gin-gonic/gin"
)

const (
	authClaimsContextKey    = "auth.claims"
	authAccountIDContextKey = "auth.account_id"
	authUsernameContextKey  = "auth.username"
)

type Claims map[string]any

func extractBearerToken(h string) string {
	parts := strings.Fields(strings.TrimSpace(h))
	if len(parts) != 2 { return "" }
	if !strings.EqualFold(parts[0], "Bearer") { return "" }
	return strings.TrimSpace(parts[1])
}

func accountIDFromContext(c *gin.Context) string {
	v, ok := c.Get(authAccountIDContextKey)
	if !ok { return "" }
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func usernameFromContext(c *gin.Context) string {
	v, ok := c.Get(authUsernameContextKey)
	if !ok { return "" }
	s, _ := v.(string)
	return strings.TrimSpace(s)
}

func RequireSessionAuth(authSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		bearerToken := extractBearerToken(c.GetHeader("Authorization"))
		if bearerToken == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing bearer token"})
			c.Abort()
			return
		}
		claims, err := services.VerifySessionJWT(authSecret, bearerToken)
		if err != nil {
			log.Printf("session auth failed: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			c.Abort()
			return
		}
		accountID := strings.TrimSpace(claims.AccountID)
		if accountID == "" {
			c.JSON(http.StatusForbidden, gin.H{"error": "token missing account scope"})
			c.Abort()
			return
		}
		c.Set(authClaimsContextKey, Claims{
			"sub":       claims.Sub,
			"accountId": claims.AccountID,
			"username":  claims.Username,
			"exp":       claims.Exp,
		})
		c.Set(authAccountIDContextKey, accountID)
		c.Set(authUsernameContextKey, strings.TrimSpace(claims.Username))
		c.Next()
	}
}
