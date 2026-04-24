package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend/services"

	"github.com/gin-gonic/gin"
)

func TestSessionReturnsCanonicalAccountContext(t *testing.T) {
	t.Setenv("AUTH_SECRET", "test-secret")

	token, err := services.IssueSessionJWTWithLogoutHandle("test-secret", "sub-1", "tester", "acct-1", "logout-handle-1", 3600)
	if err != nil {
		t.Fatalf("IssueSessionJWTWithLogoutHandle returned error: %v", err)
	}

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	request := httptest.NewRequest(http.MethodGet, "/auth/session", nil)
	request.Header.Set("Authorization", "Bearer "+token)
	context.Request = request

	handler := &AuthHandler{}
	handler.Session(context)

	if recorder.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", recorder.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if authenticated, _ := payload["authenticated"].(bool); !authenticated {
		t.Fatalf("expected authenticated true, got %#v", payload["authenticated"])
	}

	user, _ := payload["user"].(map[string]any)
	if user == nil {
		t.Fatalf("expected user object, got %#v", payload["user"])
	}
	if user["subject"] != "sub-1" {
		t.Fatalf("expected subject sub-1, got %#v", user["subject"])
	}
	if user["auth_subject"] != "acct-1" {
		t.Fatalf("expected auth_subject acct-1, got %#v", user["auth_subject"])
	}
	if user["account_id"] != "acct-1" {
		t.Fatalf("expected account_id acct-1, got %#v", user["account_id"])
	}
	if user["tenant_id"] != "acct-1" {
		t.Fatalf("expected tenant_id acct-1, got %#v", user["tenant_id"])
	}
	if user["display_name"] != "tester" {
		t.Fatalf("expected display_name tester, got %#v", user["display_name"])
	}
	if sessionVersion, _ := user["session_version"].(float64); sessionVersion != 1 {
		t.Fatalf("expected session_version 1, got %#v", user["session_version"])
	}
	if scopes, _ := user["scopes"].([]any); len(scopes) != 3 {
		t.Fatalf("expected 3 scopes, got %#v", user["scopes"])
	}
}
