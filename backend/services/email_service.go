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

func loadDelegatedGmailService(ctx context.Context) (*gmail.Service, string, error) {
	credsEnv := os.Getenv("GMAIL_SERVICE_ACCOUNT_JSON")
	delegate := os.Getenv("GMAIL_DELEGATE_EMAIL")
	if credsEnv == "" || delegate == "" {
		return nil, "", fmt.Errorf("GMAIL_SERVICE_ACCOUNT_JSON and GMAIL_DELEGATE_EMAIL must be set")
	}

	var credsJSON []byte
	if fi, err := os.Stat(credsEnv); err == nil && !fi.IsDir() {
		b, err := os.ReadFile(filepath.Clean(credsEnv))
		if err != nil {
			return nil, "", fmt.Errorf("failed to read service account file: %w", err)
		}
		credsJSON = b
	} else {
		credsJSON = []byte(credsEnv)
	}

	jwtConfig, err := google.JWTConfigFromJSON(credsJSON, gmail.GmailSendScope)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse service account credentials: %w", err)
	}
	jwtConfig.Subject = delegate

	ts := jwtConfig.TokenSource(ctx)
	token, tokErr := ts.Token()
	if tokErr != nil {
		return nil, "", fmt.Errorf("failed to retrieve access token for delegate '%s': %w", delegate, tokErr)
	}
	if token == nil || token.AccessToken == "" {
		return nil, "", fmt.Errorf("retrieved invalid access token for delegate '%s'", delegate)
	}

	client := jwtConfig.Client(ctx)
	srv, err := gmail.NewService(ctx, option.WithHTTPClient(client))
	if err != nil {
		return nil, "", fmt.Errorf("failed to create gmail service: %w", err)
	}
	return srv, delegate, nil
}

func sendRawEmail(_ context.Context, srv *gmail.Service, from, to, subject, body string) error {
	encodedSubject := mime.BEncoding.Encode("utf-8", subject)
	raw := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, to, encodedSubject, body)

	encoded := base64.URLEncoding.EncodeToString([]byte(raw))
	encoded = strings.TrimRight(encoded, "=")

	msg := &gmail.Message{Raw: encoded}
	_, err := srv.Users.Messages.Send("me", msg).Do()
	if err != nil {
		if gerr, ok := err.(*googleapi.Error); ok {
			return fmt.Errorf("gmail api error: %d %s", gerr.Code, gerr.Message)
		}
		return fmt.Errorf("failed to send gmail message: %w", err)
	}
	return nil
}

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

	notifyTo := os.Getenv("NOTIFY_TO")

	if notifyTo == "" {
		return fmt.Errorf("NOTIFY_TO must be set")
	}

	srv, delegate, err := loadDelegatedGmailService(ctx)
	if err != nil {
		return err
	}

	// Compose subject and body in Thai (UTF-8)
	subject := "ได้รับรายการใหม่จากการยื่นเอกสาร"
	body := fmt.Sprintf("มีคำร้องใหม่ที่ถูกยื่นเข้ามา\n\nID: %v\nชื่อ: %s %s\nเอกสาร: %s\nรหัสนักศึกษา: %s\nวัตถุประสงค์: %s\nเวลาที่ยื่น: %s\n",
		insertedID, payload.Prefix, payload.Name, payload.DocumentType, payload.StudentID, payload.Purpose, time.Now().Format(time.RFC1123))
	return sendRawEmail(ctx, srv, delegate, notifyTo, subject, body)
}

// SendSubmissionNotificationByRequest sends a notification email to the form owner.
// The recipient is request.AccountID, which equals the owner's OIDC email in this system.
// If AccountID is not a valid email address, the function returns an error and no email is sent.
func SendSubmissionNotificationByRequest(ctx context.Context, request *RequestRecord) error {
	if request == nil {
		return fmt.Errorf("request is required")
	}

	notifyTo := strings.TrimSpace(request.AccountID)
	if !strings.Contains(notifyTo, "@") {
		return fmt.Errorf("owner email not available for account: %q", request.AccountID)
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	srv, delegate, err := loadDelegatedGmailService(ctx)
	if err != nil {
		return err
	}

	subject := "ได้รับรายการใหม่จากการยื่นเอกสาร"
	body := fmt.Sprintf("มีคำร้องใหม่ที่ถูกยื่นเข้ามา\n\nID: %v\nชื่อ: %s %s\nเอกสาร: %s\nรหัสนักศึกษา: %s\nวัตถุประสงค์: %s\nเวลาที่ยื่น: %s\n",
		request.ID, request.Prefix, request.Name, request.DocumentType, request.StudentID, request.Purpose, time.Now().Format(time.RFC1123))
	return sendRawEmail(ctx, srv, delegate, notifyTo, subject, body)
}

// SendOfficialSignLink sends a signing URL to one official recipient.
func SendOfficialSignLink(ctx context.Context, role, toEmail, signURL string, requestID interface{}) error {
	if strings.TrimSpace(toEmail) == "" {
		return fmt.Errorf("recipient email is required")
	}

	srv, delegate, err := loadDelegatedGmailService(ctx)
	if err != nil {
		return err
	}

	subject := "ลิงก์ลงนามเอกสารคำร้อง"
	body := fmt.Sprintf("เรียนเจ้าหน้าที่ (%s)\n\nกรุณาลงนามคำร้องเลขที่: %v\nลิงก์ลงนาม: %s\n\nลิงก์นี้จะหมดอายุภายใน 7 วัน\n", role, requestID, signURL)
	return sendRawEmail(ctx, srv, delegate, toEmail, subject, body)
}
