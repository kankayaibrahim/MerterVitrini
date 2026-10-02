package db

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
	"mertervitrini/backend/config"
)

var RedisClient *redis.Client

// ConnectRedis parses the RedisURL, establishes connection and pings the Redis server
func ConnectRedis(cfg *config.Config) (*redis.Client, error) {
	if cfg.RedisURL == "" {
		log.Println("[INFO] Redis URL is empty. Redis-based sync progress is disabled.")
		return nil, nil
	}

	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, err
	}

	client := redis.NewClient(opt)
	
	// Create context with short timeout to test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err = client.Ping(ctx).Result()
	if err != nil {
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
