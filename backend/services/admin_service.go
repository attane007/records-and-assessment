package services

import (
	"backend/models"
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"golang.org/x/crypto/bcrypt"
)

// AdminService handles admin-related operations
type AdminService struct {
	collection *mongo.Collection
}

// NewAdminService creates a new AdminService
func NewAdminService(collection *mongo.Collection) *AdminService {
	return &AdminService{collection: collection}
}

// GetAdmin retrieves admin by username
func (s *AdminService) GetAdmin(ctx context.Context, username string) (*models.Admin, error) {
	var admin models.Admin
	err := s.collection.FindOne(ctx, bson.M{"username": username}).Decode(&admin)
	if err != nil {
		return nil, err
	}
	return &admin, nil
}

// UpdatePassword updates admin password
func (s *AdminService) UpdatePassword(ctx context.Context, username, newPassword string) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	filter := bson.M{"username": username}
	update := bson.M{"$set": bson.M{"password": string(hashedPassword)}}

	_, err = s.collection.UpdateOne(ctx, filter, update)
	return err
}

// VerifyPassword verifies if the provided password matches the stored password
func (s *AdminService) VerifyPassword(ctx context.Context, username, password string) (bool, error) {
	admin, err := s.GetAdmin(ctx, username)
	if err != nil {
		return false, err
	}

	err = bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte(password))
	return err == nil, nil
}

// InitializeDefaultAdmin creates default admin if not exists
func (s *AdminService) InitializeDefaultAdmin(ctx context.Context, username, password string) error {
	// Check if admin already exists
	_, err := s.GetAdmin(ctx, username)
	if err == nil {
		// Admin already exists
		return nil
	}

	if err != mongo.ErrNoDocuments {
		// Some other error occurred
		return err
	}

	// Create default admin
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	admin := models.Admin{
		Username: username,
		Password: string(hashedPassword),
	}

	_, err = s.collection.InsertOne(ctx, admin)
	return err
}
