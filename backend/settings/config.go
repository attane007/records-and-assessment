package settings

import (
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds application configuration loaded from environment or .env
type Config struct {
	MongoURI string
	DBName   string
	GOEnv          string
	TrustedProxies []string
}

// OIDCClientID, OIDCClientSecret, FrontendURL, and AuthSecret are used by the
// backend OIDC auth handler. They are exposed on Config for convenience but the
// handlers also read them directly from os.Getenv.
// (fields added here for documentation; RegisterRoutes reads env vars directly)

// LoadConfig loads .env (without overwriting existing env vars)
// and returns the effective config values.
func LoadConfig() Config {
	goEnv := os.Getenv("GO_ENV")
	if goEnv == "" {
		goEnv = "development"
	}

	// Always attempt to load .env, but do not overwrite existing environment variables.
	if envMap, err := godotenv.Read(); err == nil {
		for k, v := range envMap {
			if os.Getenv(k) == "" {
				os.Setenv(k, v)
			}
		}
		log.Println(".env loaded (without overwriting existing env vars)")
	} else {
		log.Println("no .env file loaded")
	}

	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}
	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "records"
	}

	trustedProxiesStr := os.Getenv("TRUSTED_PROXIES")
	var trustedProxies []string
	if trustedProxiesStr != "" {
		for _, s := range strings.Split(trustedProxiesStr, ",") {
			trimmed := strings.TrimSpace(s)
			if trimmed != "" {
				trustedProxies = append(trustedProxies, trimmed)
			}
		}
	} else {
		// Default to trusting common private ranges if none specified
		// 127.0.0.1/32, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
		trustedProxies = []string{"127.0.0.1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"}
	}

	return Config{MongoURI: mongoURI, DBName: dbName, GOEnv: goEnv, TrustedProxies: trustedProxies}
}
