package config

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	DBHost                   string `json:"db_host"`
	DBPort                   string `json:"db_port"`
	DBUser                   string `json:"db_user"`
	DBPassword               string `json:"db_password"`
	DBName                   string `json:"db_name"`
	JWTSecret                string `json:"jwt_secret"`
	ServerPort               string `json:"server_port"`
	DisableOTP               bool   `json:"disable_otp"`
	LogFormat                string `json:"log_format"`
	RedisURL                 string `json:"redis_url"`
	KeycloakURL              string `json:"keycloak_url"`
	KeycloakRealm            string `json:"keycloak_realm"`
	KeycloakClientID         string `json:"keycloak_client_id"`
	KeycloakClientSecret     string `json:"keycloak_client_secret"`
	KeycloakPublicKey        string `json:"keycloak_public_key"`
	ReCaptchaSecret          string `json:"recaptcha_secret"`
	ReCaptchaSiteKey         string `json:"recaptcha_site_key"`
	GoogleReCaptchaSecretKey string `json:"google_recaptcha_secret_key,omitempty"`
	GoogleReCaptchaSiteKey   string `json:"google_recaptcha_site_key,omitempty"`
	SMTPHost                 string `json:"smtp_host"`
	SMTPPort                 string `json:"smtp_port"`
	SMTPFrom                 string `json:"smtp_from"`
	AdminEmail               string `json:"admin_email"`
}

// EffectiveReCaptchaSecret returns the configured Google reCAPTCHA secret key, if any.
func (c *Config) EffectiveReCaptchaSecret() string {
	if c == nil {
		return ""
	}
	if v := strings.TrimSpace(c.ReCaptchaSecret); v != "" {
		return v
	}
	return strings.TrimSpace(c.GoogleReCaptchaSecretKey)
}

// PublicReCaptchaSiteKey returns ONLY the public Google reCAPTCHA site key (never the secret key).
func (c *Config) PublicReCaptchaSiteKey() string {
	if c == nil {
		return ""
	}
	if v := strings.TrimSpace(c.ReCaptchaSiteKey); v != "" {
		return v
	}
	return strings.TrimSpace(c.GoogleReCaptchaSiteKey)
}

// HasReCaptchaPair reports whether both the public site key and private secret key are configured.
func (c *Config) HasReCaptchaPair() bool {
	return c != nil && c.EffectiveReCaptchaSecret() != "" && c.PublicReCaptchaSiteKey() != ""
}

func defaultConfiguration() *Config {
	return &Config{
		DBHost:               "213.202.255.80",
		DBPort:               "5432",
		DBUser:               "postgres",
		DBPassword:           "DHMwK0Qzyox7",
		DBName:               "merterdevdb",
		JWTSecret:            "merter-vitrini-super-secret-key-change-in-prod",
		ServerPort:           "8080", // Unified API port
		DisableOTP:           true,
		LogFormat:            "text",
		RedisURL:             "",
		KeycloakURL:          "https://auth.mertervitrini.com.tr",
		KeycloakRealm:        "merter",
		KeycloakClientID:     "admin-client",
		KeycloakClientSecret: "KcAdminClientSecret02vMhY8",
		KeycloakPublicKey:    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuCdrk6NMm3+dvWzRdxxSyuCPXj4XCFzxsptRGXv1YFNzujnXlVIKsR9miSz8NHWonrRbOIHofcAXJu3r9X/VeR7deprxbOALJQDNwhPtLM8zxUyUU4mpqkBdfnPouDEPhWu3tBWZrWooAaZj/Ec2I4BZTv+2IaeZAaUeKgUHmxL8BLNtYMNxoI5xFHYI+vQ3XbCzHFAYQr8/NaXYkb+QAD58AB8wxMGYkQ3eeV/uRGVQ01CjmqfDbug4p+u1rrqPXUfhbp4LJIPJiOY5hIrnufmmpMYl6g+lV8JYmV0bws30Whi1PauD/INqYCWNCasaC/eagwoX8w0WIyPAo/YsLwIDAQAB",
		ReCaptchaSecret:      "",
		ReCaptchaSiteKey:     "",
		SMTPHost:             "127.0.0.1",
		SMTPPort:             "25",
		SMTPFrom:             "destek@mertervitrini.com.tr",
		AdminEmail:           "kankayaibrahim@gmail.com",
	}
}

func loadJSONConfig(cfg *Config) {
	exePath, err := os.Executable()
	if err != nil {
		return
	}
	configPath := filepath.Join(filepath.Dir(exePath), "config.json")
	file, err := os.Open(configPath)
	if err != nil {
		log.Printf("[CONFIG INFO] No config.json found at %s. Using default settings.", configPath)
		return
	}
	defer file.Close()

	if err := json.NewDecoder(file).Decode(cfg); err != nil {
		log.Printf("[CONFIG WARNING] Failed to parse config.json: %v. Using defaults.", err)
		return
	}
	log.Printf("[CONFIG] Successfully loaded settings from: %s", configPath)
}

func setIfPresent(target *string, envKey string) {
	if val, ok := os.LookupEnv(envKey); ok {
		*target = val
	}
}

func applyEnvOverrides(cfg *Config) {
	setIfPresent(&cfg.DBHost, "DB_HOST")
	setIfPresent(&cfg.DBPort, "DB_PORT")
	setIfPresent(&cfg.DBUser, "DB_USER")
	setIfPresent(&cfg.DBPassword, "DB_PASSWORD")
	setIfPresent(&cfg.DBName, "DB_NAME")
	setIfPresent(&cfg.JWTSecret, "JWT_SECRET")
	setIfPresent(&cfg.ServerPort, "SERVER_PORT")
	setIfPresent(&cfg.LogFormat, "LOG_FORMAT")
	setIfPresent(&cfg.RedisURL, "REDIS_URL")
	setIfPresent(&cfg.KeycloakURL, "KEYCLOAK_URL")
	setIfPresent(&cfg.KeycloakRealm, "KEYCLOAK_REALM")
	setIfPresent(&cfg.KeycloakClientID, "KEYCLOAK_CLIENT_ID")
	setIfPresent(&cfg.KeycloakClientSecret, "KEYCLOAK_CLIENT_SECRET")
	setIfPresent(&cfg.KeycloakPublicKey, "KEYCLOAK_PUBLIC_KEY")
	setIfPresent(&cfg.ReCaptchaSecret, "RECAPTCHA_SECRET")
	setIfPresent(&cfg.GoogleReCaptchaSecretKey, "GOOGLE_RECAPTCHA_SECRET_KEY")
	setIfPresent(&cfg.ReCaptchaSiteKey, "RECAPTCHA_SITE_KEY")
	setIfPresent(&cfg.GoogleReCaptchaSiteKey, "GOOGLE_RECAPTCHA_SITE_KEY")
	setIfPresent(&cfg.SMTPHost, "SMTP_HOST")
	setIfPresent(&cfg.SMTPPort, "SMTP_PORT")
	setIfPresent(&cfg.SMTPFrom, "SMTP_FROM")
	setIfPresent(&cfg.AdminEmail, "ADMIN_EMAIL")

	if val, ok := os.LookupEnv("DISABLE_OTP"); ok {
		cfg.DisableOTP = (val == "true")
	}
}

func normalizeReCaptchaConfig(cfg *Config) {
	if cfg == nil {
		return
	}
	cfg.ReCaptchaSecret = cfg.EffectiveReCaptchaSecret()
	cfg.ReCaptchaSiteKey = cfg.PublicReCaptchaSiteKey()
}

func LoadConfig() *Config {
	cfg := defaultConfiguration()
	loadJSONConfig(cfg)
	applyEnvOverrides(cfg)
	normalizeReCaptchaConfig(cfg)
	return cfg
}
