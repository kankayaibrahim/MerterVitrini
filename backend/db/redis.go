package db

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"mertervitrini/backend/config"
)

var RedisClient *redis.Client

func buildRedisOptions(cfg *config.Config) (*redis.Options, error) {
	if cfg == nil {
		return nil, nil
	}
	redisURL := strings.TrimSpace(cfg.RedisURL)
	if redisURL == "" {
		return nil, nil
	}

	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, err
	}

	if caPath := strings.TrimSpace(cfg.RedisTLSCACert); caPath != "" {
		pemBytes, readErr := os.ReadFile(caPath)
		if readErr != nil {
			return nil, fmt.Errorf("read redis TLS CA cert %q: %w", caPath, readErr)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pemBytes) {
			return nil, fmt.Errorf("parse redis TLS CA cert %q: no valid certificates found", caPath)
		}
		if opt.TLSConfig == nil {
			opt.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS12}
		} else {
			opt.TLSConfig = opt.TLSConfig.Clone()
			if opt.TLSConfig.MinVersion == 0 {
				opt.TLSConfig.MinVersion = tls.VersionTLS12
			}
		}
		opt.TLSConfig.RootCAs = pool
	}

	return opt, nil
}

// ConnectRedis parses the RedisURL, establishes connection and pings the Redis server.
func ConnectRedis(cfg *config.Config) (*redis.Client, error) {
	opt, err := buildRedisOptions(cfg)
	if err != nil {
		return nil, err
	}
	if opt == nil {
		log.Println("[INFO] Redis URL is empty. Redis-based sync progress is disabled.")
		return nil, nil
	}

	client := redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if _, err = client.Ping(ctx).Result(); err != nil {
		client.Close()
		return nil, err
	}

	RedisClient = client
	log.Println("[+] Redis connection and ping verified successfully!")
	return client, nil
}

// CloseRedis gracefully shuts down the Redis connection
func CloseRedis() {
	if RedisClient != nil {
		RedisClient.Close()
		log.Println("[INFO] Redis connection closed.")
	}
}
