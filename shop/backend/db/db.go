package db

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"mertervitrini/shop/backend/config"
)

var Pool *pgxpool.Pool

func ConnectDB(cfg *config.Config) (*pgxpool.Pool, error) {
	escapedPassword := url.QueryEscape(cfg.DBPassword)
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		cfg.DBUser, escapedPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)

	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("unable to parse connection string: %w", err)
	}

	config.MaxConns = 35 // Storefront needs slightly more max connections for active shopping traffic
	config.MinConns = 5
	config.MaxConnLifetime = 30 * time.Minute
	config.MaxConnIdleTime = 15 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	err = pool.Ping(ctx)
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}

	// Self-provision B2B Inquiries tables
	ddlQueries := []string{
		`CREATE TABLE IF NOT EXISTS catalog.store_inquiries (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			full_name VARCHAR(100) NOT NULL,
			company VARCHAR(100) NULL,
			phone VARCHAR(50) NOT NULL,
			email VARCHAR(100) NOT NULL,
			message TEXT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.store_inquiry_items (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			inquiry_id UUID NOT NULL REFERENCES catalog.store_inquiries(id) ON DELETE CASCADE,
			product_id UUID NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
			title VARCHAR(255) NOT NULL,
			custom_sku VARCHAR(100) NOT NULL,
			quantity INT NOT NULL,
			price NUMERIC(12,2) NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.settings (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			address TEXT NOT NULL,
			phone VARCHAR(50) NOT NULL,
			whatsapp VARCHAR(50) NOT NULL,
			email VARCHAR(100) NOT NULL,
			show_single_price BOOLEAN DEFAULT TRUE NOT NULL,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			singleton_guard BOOLEAN DEFAULT TRUE UNIQUE CHECK (singleton_guard = TRUE)
		)`,
		`INSERT INTO catalog.settings (address, phone, whatsapp, email) VALUES (
			'AKEVLER MAH. 1076 SOK. REGNUM ASTRUM TOWER 8A C2 NO:204 ESENYURT / İSTANBUL / TÜRKİYE',
			'+90 533 703 08 83',
			'+90 533 703 08 83',
			'info@toptanmoda.net'
		) ON CONFLICT (singleton_guard) DO UPDATE SET
			address = EXCLUDED.address,
			phone = EXCLUDED.phone,
			whatsapp = EXCLUDED.whatsapp,
			email = EXCLUDED.email`,
	}

	for _, ddl := range ddlQueries {
		_, err = pool.Exec(ctx, ddl)
		if err != nil {
			log.Printf("[DB WARNING] Failed to provision table/seed settings: %v", err)
		}
	}

	Pool = pool
	return pool, nil
}

func CloseDB() {
	if Pool != nil {
		Pool.Close()
	}
}
