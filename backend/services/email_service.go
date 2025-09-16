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

	"mime"

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

	// Prefetch an access token to get clearer errors early (e.g. unauthorized_client)
	ts := jwtConfig.TokenSource(ctx)

	// Try to fetch a token explicitly so we can return a helpful error if the
	// service account isn't authorized for domain-wide delegation or the client
	// isn't granted the gmail.send scope.
	// Note: Token() returns (*oauth2.Token, error) from golang.org/x/oauth2.
	token, tokErr := ts.Token()
	if tokErr != nil {
		return fmt.Errorf("failed to retrieve access token for delegate '%s': %w", delegate, tokErr)
	}
	if token == nil || token.AccessToken == "" {
		return fmt.Errorf("retrieved invalid access token for delegate '%s'", delegate)
	}

	client := jwtConfig.Client(ctx)

	srv, err := gmail.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return fmt.Errorf("failed to create gmail service: %w", err)
	}

	// Compose subject and body in Thai (UTF-8)
	subject := "ได้รับรายการใหม่จากการยื่นเอกสาร"
	body := fmt.Sprintf("มีคำร้องใหม่ที่ถูกยื่นเข้ามา\n\nID: %v\nชื่อ: %s %s\nเอกสาร: %s\nรหัสนักศึกษา: %s\nวัตถุประสงค์: %s\nเวลาที่ยื่น: %s\n",
		insertedID, payload.Prefix, payload.Name, payload.DocumentType, payload.StudentID, payload.Purpose, time.Now().Format(time.RFC1123))

	// Encode Subject header using RFC 2047 B encoding for UTF-8
	encodedSubject := mime.BEncoding.Encode("utf-8", subject)

	raw := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		delegate, notifyTo, encodedSubject, body)

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
