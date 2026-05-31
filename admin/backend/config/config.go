package config

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
)

type Config struct {
	DBHost               string `json:"db_host"`
	DBPort               string `json:"db_port"`
	DBUser               string `json:"db_user"`
	DBPassword           string `json:"db_password"`
	DBName               string `json:"db_name"`
	JWTSecret            string `json:"jwt_secret"`
	ServerPort           string `json:"server_port"`
	DisableOTP           bool   `json:"disable_otp"`
	LogFormat            string `json:"log_format"`
	RedisURL             string `json:"redis_url"`
	KeycloakURL          string `json:"keycloak_url"`
	KeycloakRealm        string `json:"keycloak_realm"`
	KeycloakClientID     string `json:"keycloak_client_id"`
	KeycloakClientSecret string `json:"keycloak_client_secret"`
	KeycloakPublicKey    string `json:"keycloak_public_key"`
}

func LoadConfig() *Config {
	// Initialize default configuration
	cfg := &Config{
		DBHost:               "213.202.255.80",
		DBPort:               "5432",
		DBUser:               "postgres",
		DBPassword:           "DHMwK0Qzyox7",
		DBName:               "merterdevdb",
		JWTSecret:            "merter-vitrini-super-secret-key-change-in-prod",
		ServerPort:           "8085",
		DisableOTP:           true,
		LogFormat:            "text",
		RedisURL:             "",
		KeycloakURL:          "https://auth.mertervitrini.com.tr",
		KeycloakRealm:        "merter",
		KeycloakClientID:     "admin-client",
		KeycloakClientSecret: "KcAdminClientSecret02vMhY8",
		KeycloakPublicKey:    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuCdrk6NMm3+dvWzRdxxSyuCPXj4XCFzxsptRGXv1YFNzujnXlVIKsR9miSz8NHWonrRbOIHofcAXJu3r9X/VeR7deprxbOALJQDNwhPtLM8zxUyUU4mpqkBdfnPouDEPhWu3tBWZrWooAaZj/Ec2I4BZTv+2IaeZAaUeKgUHmxL8BLNtYMNxoI5xFHYI+vQ3XbCzHFAYQr8/NaXYkb+QAD58AB8wxMGYkQ3eeV/uRGVQ01CjmqfDbug4p+u1rrqPXUfhbp4LJIPJiOY5hIrnufmmpMYl6g+lV8JYmV0bws30Whi1PauD/INqYCWNCasaC/eagwoX8w0WIyPAo/YsLwIDAQAB",
	}

	// 1. Try to load from config.json located next to the running executable
	exePath, err := os.Executable()
	if err == nil {
		exeDir := filepath.Dir(exePath)
		configPath := filepath.Join(exeDir, "config.json")
		
		if file, err := os.Open(configPath); err == nil {
			defer file.Close()
			decoder := json.NewDecoder(file)
			if err := decoder.Decode(cfg); err != nil {
				log.Printf("[CONFIG WARNING] Failed to parse config.json: %v. Using defaults.", err)
			} else {
				log.Printf("[CONFIG] Successfully loaded settings from: %s", configPath)
			}
		} else {
			log.Printf("[CONFIG INFO] No config.json found at %s. Using default settings.", configPath)
		}
	}

	// 2. Allow environment variables overrides (highest precedence)
	if val, ok := os.LookupEnv("DB_HOST"); ok { cfg.DBHost = val }
	if val, ok := os.LookupEnv("DB_PORT"); ok { cfg.DBPort = val }
	if val, ok := os.LookupEnv("DB_USER"); ok { cfg.DBUser = val }
	if val, ok := os.LookupEnv("DB_PASSWORD"); ok { cfg.DBPassword = val }
	if val, ok := os.LookupEnv("DB_NAME"); ok { cfg.DBName = val }
	if val, ok := os.LookupEnv("JWT_SECRET"); ok { cfg.JWTSecret = val }
	if val, ok := os.LookupEnv("SERVER_PORT"); ok { cfg.ServerPort = val }
	if val, ok := os.LookupEnv("LOG_FORMAT"); ok { cfg.LogFormat = val }
	if val, ok := os.LookupEnv("REDIS_URL"); ok { cfg.RedisURL = val }
	if val, ok := os.LookupEnv("KEYCLOAK_URL"); ok { cfg.KeycloakURL = val }
	if val, ok := os.LookupEnv("KEYCLOAK_REALM"); ok { cfg.KeycloakRealm = val }
	if val, ok := os.LookupEnv("KEYCLOAK_CLIENT_ID"); ok { cfg.KeycloakClientID = val }
	if val, ok := os.LookupEnv("KEYCLOAK_CLIENT_SECRET"); ok { cfg.KeycloakClientSecret = val }
	if val, ok := os.LookupEnv("KEYCLOAK_PUBLIC_KEY"); ok { cfg.KeycloakPublicKey = val }
	
	if val, ok := os.LookupEnv("DISABLE_OTP"); ok {
		cfg.DisableOTP = (val == "true")
	}

	return cfg
}
