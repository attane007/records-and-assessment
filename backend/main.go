package main

import (
	"context"
	"log"
	"os"
	"time"

	"backend/handlers"
	"backend/services"
	"backend/settings"
	"backend/utils"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"github.com/go-playground/validator/v10"
	"go.mongodb.org/mongo-driver/bson"
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
	// use a dedicated collection for school officials (registrar/director)
	mongoCollOfficials := client.Database(cfg.DBName).Collection("officials")
	// use a dedicated collection for admin users
	mongoCollAdmin := client.Database(cfg.DBName).Collection("admins")
	// collections for signing flow
	mongoCollSignLinks := client.Database(cfg.DBName).Collection("sign_links")
	mongoCollSignSessions := client.Database(cfg.DBName).Collection("sign_sessions")
	// collection for reusable public form links
	mongoCollFormLinks := client.Database(cfg.DBName).Collection("form_links")
	// collection for audit logs
	mongoCollAudit := client.Database(cfg.DBName).Collection("audit_logs")

	// Initialize admin service and create default admin if not exists
	adminService := services.NewAdminService(mongoCollAdmin)
	defaultUsername := os.Getenv("ADMIN_USER")
	if defaultUsername == "" {
		defaultUsername = "admin"
	}
	defaultPassword := os.Getenv("ADMIN_PASS")
	if defaultPassword == "" {
		defaultPassword = "admin123"
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_, indexErr := mongoCollFormLinks.Indexes().CreateMany(ctx, []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "account_id", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
		{
			Keys:    bson.D{{Key: "token_hash", Value: 1}},
			Options: options.Index().SetUnique(true),
		},
	})
	if indexErr != nil {
		log.Printf("Warning: failed to ensure form_links indexes: %v", indexErr)
	}

	if err := adminService.InitializeDefaultAdmin(ctx, defaultUsername, defaultPassword); err != nil {
		log.Printf("Warning: failed to initialize default admin: %v", err)
	}

	// register custom validator for idcard (13 digits)
	if v, ok := binding.Validator.Engine().(*validator.Validate); ok {
		utils.RegisterIDCardValidation(v)
	}

	r := gin.Default()
	if err := r.SetTrustedProxies(cfg.TrustedProxies); err != nil {
		log.Printf("Warning: failed to set trusted proxies: %v", err)
	}

	// Register routes from handlers package (keeps main.go minimal)
	// pass both the students collection and the officials collection
	handlers.RegisterRoutes(r, mongoColl, mongoCollOfficials, mongoCollAdmin, mongoCollSignLinks, mongoCollSignSessions, mongoCollFormLinks, mongoCollAudit)

	r.Run() // listen and serve on 0.0.0.0:8080
}
