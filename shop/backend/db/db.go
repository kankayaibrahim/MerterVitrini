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
		`ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS registration_ip VARCHAR(50) NULL`,
		`CREATE TABLE IF NOT EXISTS identity.user_login_history (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id VARCHAR(255) REFERENCES identity.users(id) ON DELETE CASCADE NOT NULL,
			login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
			ip_address VARCHAR(50) NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_user_login_history_user_id ON identity.user_login_history(user_id)`,
		`ALTER TABLE catalog.products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE NULL`,
		`DROP MATERIALIZED VIEW IF EXISTS catalog.mv_products CASCADE`,
		`CREATE MATERIALIZED VIEW catalog.mv_products AS
		SELECT p.id, p.feed_id, p.source_product_id, p.source_product_group_id, p.title, p.slug, p.slug_id, p.custom_sku, 
		       p.short_description, p.description, p.brand_id, p.category_id, 
		       p.gender, p.season, COALESCE(fab.fabric_name, 'Polyester') as kumas_fabric, p.desi_volume, p.shipping_weight_kg, 
		       p.packing_ratio, p.series_ratio, p.minimum_order_quantity, 
		       p.price, p.discounted_price, p.single_price, p.buying_price, p.currency, p.tax_rate, COALESCE(col.color_name, 'Standart') as color, p.stock, p.sku, p.barcode,
		       p.is_active, 
		       p.created_at, p.updated_at, COALESCE(NULLIF(b.alias_code, ''), b.brand_name) as brand_name, c.title as category_title, c.node_path,
		       COALESCE(
		           (SELECT json_agg(json_build_object('id', img.id, 'product_id', img.product_id, 'image_url', img.image_url, 'sort_order', img.sort_order, 'is_cover', img.is_cover) ORDER BY img.sort_order ASC)
		            FROM catalog.product_images img
		            WHERE img.product_id = p.id), '[]'::json
		       ) as images_json,
		       COALESCE(
		           (SELECT json_object_agg(t.language_code, json_build_object('title', t.title, 'short_description', t.short_description, 'description', t.description))
		            FROM catalog.product_translations t
		            WHERE t.product_id = p.id), '{}'::json
		       ) as translations_json
		FROM catalog.products p
		INNER JOIN catalog.brands b ON p.brand_id = b.id AND b.is_active = true
		LEFT JOIN catalog.categories c ON p.category_id = c.id
		LEFT JOIN catalog.colors col ON p.color_id = col.id
		LEFT JOIN catalog.fabrics fab ON p.fabric_id = fab.id
		WHERE p.is_active = true AND p.deleted_at IS NULL`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_products_id ON catalog.mv_products (id)`,
		`CREATE INDEX IF NOT EXISTS idx_mv_products_brand_id ON catalog.mv_products (brand_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mv_products_category_id ON catalog.mv_products (category_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mv_products_slug ON catalog.mv_products (slug)`,
		`CREATE INDEX IF NOT EXISTS idx_mv_products_slug_id ON catalog.mv_products (slug_id)`,
		`CREATE INDEX IF NOT EXISTS idx_mv_products_created_at ON catalog.mv_products (created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_mv_products_node_path_gist ON catalog.mv_products USING gist (node_path)`,
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
