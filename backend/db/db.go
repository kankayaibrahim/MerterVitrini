package db

import (
	"context"
	"fmt"
	"log"
	"net/url"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"mertervitrini/backend/config"
)

var Pool *pgxpool.Pool

func ConnectDB(cfg *config.Config) (*pgxpool.Pool, error) {
	escapedPassword := url.QueryEscape(cfg.DBPassword)
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		cfg.DBUser, escapedPassword, cfg.DBHost, cfg.DBPort, cfg.DBName)

	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("unable to parse connection string: %w", err)
	}

	poolConfig.MaxConns = 35
	poolConfig.MinConns = 5
	poolConfig.MaxConnLifetime = 30 * time.Minute
	poolConfig.MaxConnIdleTime = 15 * time.Minute

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("unable to create connection pool: %w", err)
	}

	err = pool.Ping(ctx)
	if err != nil {
		pool.Close()
		return nil, fmt.Errorf("unable to ping database: %w", err)
	}

	// Auto-provision application tables
	ddlQueries := []string{
		`CREATE TABLE IF NOT EXISTS catalog.store_inquiries (
			id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
			full_name VARCHAR(150) NOT NULL,
			company VARCHAR(150) NULL,
			phone VARCHAR(50) NOT NULL,
			email VARCHAR(150) NOT NULL,
			message TEXT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.store_inquiry_items (
			id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
			inquiry_id uuid NOT NULL REFERENCES catalog.store_inquiries(id) ON DELETE CASCADE,
			product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
			title VARCHAR(255) NOT NULL,
			custom_sku VARCHAR(100) NOT NULL,
			quantity INT NOT NULL,
			price NUMERIC NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.settings (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			address TEXT NOT NULL,
			phone VARCHAR(50) NOT NULL,
			whatsapp VARCHAR(50) NOT NULL,
			email VARCHAR(150) NOT NULL,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
			singleton_guard BOOLEAN DEFAULT true,
			show_single_price BOOLEAN NOT NULL DEFAULT true,
			CONSTRAINT settings_singleton_guard_key UNIQUE (singleton_guard)
		)`,
		`INSERT INTO catalog.settings (address, phone, whatsapp, email, singleton_guard, show_single_price)
		VALUES (
			'Merter Tekstil Merkezi, Güngören / İstanbul',
			'+90 (212) 555 01 23',
			'+90 (532) 555 01 23',
			'info@mertervitrini.com.tr',
			true,
			true
		) ON CONFLICT (singleton_guard) DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS identity.user_login_history (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			user_id VARCHAR(255) NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
			login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			ip_address VARCHAR(50),
			user_agent TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.carts (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			user_id VARCHAR(255) NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.cart_items (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			cart_id uuid NOT NULL REFERENCES catalog.carts(id) ON DELETE CASCADE,
			product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
			quantity INT NOT NULL CHECK (quantity > 0),
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.orders (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			order_number VARCHAR(30) UNIQUE NOT NULL, 
			user_id VARCHAR(255) NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
			total_amount DECIMAL(12, 2) NOT NULL,
			payment_method VARCHAR(30) DEFAULT 'BANK_TRANSFER', 
			order_status VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT', 
			billing_address TEXT NULL,
			delivery_address TEXT NULL,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE SEQUENCE IF NOT EXISTS catalog.order_number_seq START 1`,
		`ALTER TABLE catalog.orders ADD COLUMN IF NOT EXISTS billing_address TEXT NULL`,
		`ALTER TABLE catalog.orders ADD COLUMN IF NOT EXISTS delivery_address TEXT NULL`,
		`CREATE TABLE IF NOT EXISTS catalog.order_items (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			order_id uuid NOT NULL REFERENCES catalog.orders(id) ON DELETE CASCADE,
			product_id uuid,
			product_name VARCHAR(255) NOT NULL,
			product_sku VARCHAR(100),
			quantity INT NOT NULL,
			price_at_purchase DECIMAL(12, 2) NOT NULL,
			image_url_at_purchase TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.payment_notifications (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			order_id uuid NOT NULL REFERENCES catalog.orders(id) ON DELETE CASCADE,
			user_id VARCHAR(255) NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
			bank_name VARCHAR(100) NOT NULL,
			sender_name VARCHAR(150) NOT NULL,
			amount DECIMAL(12, 2) NOT NULL,
			notification_status VARCHAR(20) DEFAULT 'PENDING', 
			notes TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.refunds (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			order_id uuid NOT NULL REFERENCES catalog.orders(id) ON DELETE CASCADE,
			user_id VARCHAR(255) NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
			refund_type VARCHAR(20) NOT NULL, 
			refund_status VARCHAR(20) DEFAULT 'REQUESTED', 
			reason TEXT,
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.refund_items (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			refund_id uuid NOT NULL REFERENCES catalog.refunds(id) ON DELETE CASCADE,
			order_item_id uuid NOT NULL REFERENCES catalog.order_items(id) ON DELETE CASCADE,
			quantity INT NOT NULL, 
			created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		)`,
		`ALTER TABLE catalog.supplier_users ADD COLUMN IF NOT EXISTS job_title VARCHAR(100) NOT NULL DEFAULT 'Satış Temsilcisi'`,
		`ALTER TABLE catalog.supplier_users ADD COLUMN IF NOT EXISTS spoken_languages VARCHAR(100) NOT NULL DEFAULT 'TR'`,
		`ALTER TABLE catalog.supplier_users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false`,
		`CREATE TABLE IF NOT EXISTS catalog.chat_rooms (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
			supplier_user_id uuid NULL REFERENCES catalog.supplier_users(id) ON DELETE SET NULL,
			customer_id VARCHAR(255) NOT NULL,
			customer_name VARCHAR(150) NOT NULL DEFAULT 'Misafir Alıcı',
			customer_email VARCHAR(150) NULL,
			customer_phone VARCHAR(50) NULL,
			initial_product_id uuid NULL REFERENCES catalog.products(id) ON DELETE SET NULL,
			last_message_preview TEXT NOT NULL DEFAULT '',
			last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			unread_customer_count INT NOT NULL DEFAULT 0,
			unread_supplier_count INT NOT NULL DEFAULT 0,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`ALTER TABLE catalog.chat_rooms ADD COLUMN IF NOT EXISTS supplier_user_id uuid NULL REFERENCES catalog.supplier_users(id) ON DELETE SET NULL`,
		`ALTER TABLE catalog.chat_rooms DROP CONSTRAINT IF EXISTS uq_chat_rooms_brand_customer`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_rooms_brand_agent_customer ON catalog.chat_rooms (brand_id, COALESCE(supplier_user_id, '00000000-0000-0000-0000-000000000000'::uuid), customer_id)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_rooms_brand_id ON catalog.chat_rooms(brand_id, last_message_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_rooms_supplier_user_id ON catalog.chat_rooms(supplier_user_id, last_message_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_rooms_customer_id ON catalog.chat_rooms(customer_id, last_message_at DESC)`,
		`CREATE TABLE IF NOT EXISTS catalog.chat_messages (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			room_id uuid NOT NULL REFERENCES catalog.chat_rooms(id) ON DELETE CASCADE,
			sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'supplier', 'admin')),
			sender_id VARCHAR(255) NOT NULL,
			sender_name VARCHAR(150) NOT NULL,
			message_type VARCHAR(30) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'product_card', 'custom_offer')),
			content TEXT NOT NULL DEFAULT '',
			metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
			is_read BOOLEAN NOT NULL DEFAULT false,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON catalog.chat_messages(room_id, created_at ASC)`,
		`ALTER TABLE catalog.cart_items ADD COLUMN IF NOT EXISTS custom_unit_price DECIMAL(12, 2) NULL`,
		`ALTER TABLE catalog.cart_items ADD COLUMN IF NOT EXISTS offer_message_id uuid NULL`,
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
