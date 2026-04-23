package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

type authRateLimitEntry struct {
	windowStart time.Time
	count       int
}

type authRateLimiter struct {
	mu         sync.Mutex
	entries    map[string]authRateLimitEntry
	maxRequest int
	window     time.Duration
}

func newAuthRateLimitMiddleware(maxRequests int, window time.Duration) gin.HandlerFunc {
	if maxRequests <= 0 || window <= 0 {
		return func(c *gin.Context) {
			c.Next()
		}
	}

	limiter := &authRateLimiter{
		entries:    make(map[string]authRateLimitEntry),
		maxRequest: maxRequests,
		window:     window,
	}

	return func(c *gin.Context) {
		if limiter.allow(c) {
			c.Next()
			return
		}

		c.Header("X-RateLimit-Limit", strconv.Itoa(maxRequests))
		c.Header("Retry-After", strconv.Itoa(int(window.Seconds())))
		c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{"error": "rate_limited"})
	}
}

func (limiter *authRateLimiter) allow(c *gin.Context) bool {
	if limiter == nil || c == nil {
		return true
	}

	identifier := strings.TrimSpace(c.ClientIP()) + ":" + strings.TrimSpace(c.Request.URL.Path)
	now := time.Now().UTC()

	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	for key, entry := range limiter.entries {
		if now.Sub(entry.windowStart) > limiter.window {
			delete(limiter.entries, key)
		}
	}

	entry, found := limiter.entries[identifier]
	if !found || now.Sub(entry.windowStart) > limiter.window {
		limiter.entries[identifier] = authRateLimitEntry{windowStart: now, count: 1}
		return true
	}

	if entry.count >= limiter.maxRequest {
		return false
	}

	entry.count++
	limiter.entries[identifier] = entry
	return true
}
