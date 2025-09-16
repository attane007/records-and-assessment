package services

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"backend/models"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/gmail/v1"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"
)

// SendSubmissionNotification sends an email using a service account with domain-wide delegation.
// Environment variables expected:
// - GMAIL_SERVICE_ACCOUNT_JSON : path to JSON file or raw JSON content of the service account key
// - GMAIL_DELEGATE_EMAIL       : the user email to impersonate (must be in same Workspace and DWD enabled)
// - NOTIFY_TO                  : recipient email address
func SendSubmissionNotification(ctx context.Context, payload models.StudentData, insertedID interface{}) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	credsEnv := os.Getenv("GMAIL_SERVICE_ACCOUNT_JSON")
	delegate := os.Getenv("GMAIL_DELEGATE_EMAIL")
	notifyTo := os.Getenv("NOTIFY_TO")

	if credsEnv == "" || delegate == "" || notifyTo == "" {
		return fmt.Errorf("GMAIL_SERVICE_ACCOUNT_JSON, GMAIL_DELEGATE_EMAIL and NOTIFY_TO must be set")
	}

	var credsJSON []byte
	if fi, err := os.Stat(credsEnv); err == nil && !fi.IsDir() {
		b, err := os.ReadFile(filepath.Clean(credsEnv))
		if err != nil {
			return fmt.Errorf("failed to read service account file: %w", err)
		}
		credsJSON = b
	} else {
		credsJSON = []byte(credsEnv)
	}

	jwtConfig, err := google.JWTConfigFromJSON(credsJSON, gmail.GmailSendScope)
	if err != nil {
		return fmt.Errorf("failed to parse service account credentials: %w", err)
	}
	jwtConfig.Subject = delegate

	client := jwtConfig.Client(ctx)

	srv, err := gmail.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return fmt.Errorf("failed to create gmail service: %w", err)
	}

	subject := "New submission received"
	body := fmt.Sprintf("A new request was submitted.\n\nID: %v\nName: %s %s\nDocument: %s\nStudent ID: %s\nPurpose: %s\nSubmitted at: %s\n",
		insertedID, payload.Prefix, payload.Name, payload.DocumentType, payload.StudentID, payload.Purpose, time.Now().Format(time.RFC1123))

	raw := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		delegate, notifyTo, subject, body)

	encoded := base64.URLEncoding.EncodeToString([]byte(raw))
	encoded = strings.TrimRight(encoded, "=")

	msg := &gmail.Message{Raw: encoded}

	_, err = srv.Users.Messages.Send("me", msg).Do()
	if err != nil {
		if gerr, ok := err.(*googleapi.Error); ok {
			return fmt.Errorf("gmail api error: %d %s", gerr.Code, gerr.Message)
		}
		return fmt.Errorf("failed to send gmail message: %w", err)
	}

	return nil
}
