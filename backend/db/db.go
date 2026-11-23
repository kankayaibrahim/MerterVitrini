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
			show_prices_to_guests BOOLEAN NOT NULL DEFAULT false,
			CONSTRAINT settings_singleton_guard_key UNIQUE (singleton_guard)
		)`,
		`ALTER TABLE catalog.settings ADD COLUMN IF NOT EXISTS show_prices_to_guests BOOLEAN NOT NULL DEFAULT false`,
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
		`ALTER TABLE catalog.chat_messages DROP CONSTRAINT IF EXISTS chat_messages_message_type_check`,
		`ALTER TABLE catalog.chat_messages ADD CONSTRAINT chat_messages_message_type_check CHECK (message_type IN ('text', 'product_card', 'custom_offer', 'image'))`,
		`ALTER TABLE catalog.cart_items ADD COLUMN IF NOT EXISTS custom_unit_price DECIMAL(12, 2) NULL`,
		`ALTER TABLE catalog.cart_items ADD COLUMN IF NOT EXISTS offer_message_id uuid NULL`,
		`CREATE TABLE IF NOT EXISTS catalog.supplier_wallets (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE UNIQUE,
			currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
			pending_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
			available_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
			withdrawn_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
			commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
			iban VARCHAR(50) NULL,
			bank_name VARCHAR(100) NULL,
			bank_account_holder VARCHAR(255) NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.supplier_sub_orders (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			order_id uuid NOT NULL REFERENCES catalog.orders(id) ON DELETE CASCADE,
			brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE RESTRICT,
			sub_order_number VARCHAR(64) NOT NULL UNIQUE,
			gross_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
			commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
			commission_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
			net_payout_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
			currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
			status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
			tracking_company VARCHAR(100) NULL,
			tracking_number VARCHAR(128) NULL,
			notes TEXT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.supplier_sub_order_items (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			sub_order_id uuid NOT NULL REFERENCES catalog.supplier_sub_orders(id) ON DELETE CASCADE,
			product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE RESTRICT,
			product_name VARCHAR(255) NOT NULL,
			product_sku VARCHAR(100) NOT NULL,
			quantity INT NOT NULL DEFAULT 1,
			price_at_purchase NUMERIC(15,2) NOT NULL,
			total_price NUMERIC(15,2) NOT NULL,
			image_url VARCHAR(500) NULL,
			series_ratio VARCHAR(50) NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.supplier_ledger (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
			sub_order_id uuid NULL REFERENCES catalog.supplier_sub_orders(id) ON DELETE SET NULL,
			payout_request_id uuid NULL,
			transaction_type VARCHAR(32) NOT NULL,
			amount NUMERIC(15,2) NOT NULL,
			balance_after NUMERIC(15,2) NOT NULL,
			currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
			description TEXT NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS catalog.supplier_payout_requests (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
			amount NUMERIC(15,2) NOT NULL,
			currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
			status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
			iban VARCHAR(50) NOT NULL,
			bank_name VARCHAR(100) NULL,
			account_holder VARCHAR(255) NOT NULL,
			admin_notes TEXT NULL,
			processed_at TIMESTAMP WITH TIME ZONE NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS identity.mobile_devices (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			user_id VARCHAR(255) NOT NULL,
			user_role VARCHAR(30) NOT NULL CHECK (user_role IN ('customer', 'supplier')),
			fcm_token TEXT NOT NULL,
			platform VARCHAR(20) NOT NULL DEFAULT 'android',
			device_model VARCHAR(120) NULL,
			app_version VARCHAR(30) NULL,
			language_code VARCHAR(10) NOT NULL DEFAULT 'tr',
			is_active BOOLEAN NOT NULL DEFAULT true,
			last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT uq_mobile_devices_user_role_token UNIQUE (user_id, user_role, fcm_token)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_mobile_devices_user_lookup ON identity.mobile_devices (user_id, user_role) WHERE is_active = true`,
		`CREATE TABLE IF NOT EXISTS catalog.mobile_wishlist (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			user_id VARCHAR(255) NOT NULL,
			product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT uq_mobile_wishlist_user_product UNIQUE (user_id, product_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_mobile_wishlist_user_id ON catalog.mobile_wishlist (user_id, created_at DESC)`,
		`CREATE TABLE IF NOT EXISTS catalog.mobile_notifications (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('customer', 'supplier')),
			recipient_id VARCHAR(255) NOT NULL,
			title VARCHAR(200) NOT NULL,
			body TEXT NOT NULL DEFAULT '',
			notification_type VARCHAR(50) NOT NULL DEFAULT 'system',
			payload JSONB NOT NULL DEFAULT '{}'::jsonb,
			is_read BOOLEAN NOT NULL DEFAULT false,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_mobile_notifications_recipient ON catalog.mobile_notifications (recipient_type, recipient_id, created_at DESC)`,
		`CREATE TABLE IF NOT EXISTS identity.account_deletion_requests (
			id uuid DEFAULT uuidv7() PRIMARY KEY,
			user_id VARCHAR(255) NOT NULL,
			user_role VARCHAR(30) NOT NULL,
			email VARCHAR(150) NOT NULL,
			reason TEXT NULL,
			status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`ALTER TABLE catalog.brands
			ADD COLUMN IF NOT EXISTS company_type VARCHAR(50) NOT NULL DEFAULT 'uretici_toptanci',
			ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(50) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS landline_phone VARCHAR(50) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS public_email VARCHAR(150) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS city VARCHAR(100) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS district VARCHAR(100) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS location_address TEXT NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS export_countries TEXT NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS min_order_quantity INT NOT NULL DEFAULT 1,
			ADD COLUMN IF NOT EXISTS supports_private_label BOOLEAN NOT NULL DEFAULT false,
			ADD COLUMN IF NOT EXISTS supports_fason BOOLEAN NOT NULL DEFAULT false,
			ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT true,
			ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(200) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS iban VARCHAR(64) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS whatsapp_only_ordering BOOLEAN NOT NULL DEFAULT false,
			ADD COLUMN IF NOT EXISTS subdomain VARCHAR(63) NULL,
			ADD COLUMN IF NOT EXISTS subdomain_enabled BOOLEAN NOT NULL DEFAULT true`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_subdomain_lower
			ON catalog.brands (LOWER(subdomain))
			WHERE subdomain IS NOT NULL AND BTRIM(subdomain) <> ''`,
		`ALTER TABLE catalog.orders ALTER COLUMN user_id DROP NOT NULL`,
		`ALTER TABLE catalog.orders
			ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS customer_company VARCHAR(255) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(60) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS notes TEXT NULL`,
		`ALTER TABLE catalog.supplier_sub_orders ALTER COLUMN order_id DROP NOT NULL`,
		`ALTER TABLE catalog.supplier_sub_orders
			ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS customer_company VARCHAR(255) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(60) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS delivery_address TEXT NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS billing_address TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE catalog.supplier_wallets ALTER COLUMN commission_rate SET DEFAULT 0.00`,
		`ALTER TABLE catalog.supplier_sub_orders ALTER COLUMN commission_rate SET DEFAULT 0.00`,
		`CREATE TABLE IF NOT EXISTS catalog.subscription_plans (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			code VARCHAR(50) UNIQUE NOT NULL,
			name VARCHAR(150) NOT NULL,
			description TEXT NOT NULL DEFAULT '',
			monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			yearly_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
			tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
			max_products INT NOT NULL DEFAULT -1,
			features JSONB NOT NULL DEFAULT '[]'::jsonb,
			is_active BOOLEAN NOT NULL DEFAULT true,
			display_order INT NOT NULL DEFAULT 0,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`INSERT INTO catalog.subscription_plans (code, name, description, monthly_price, yearly_price, currency, tax_rate, max_products, features, display_order)
		VALUES
		('FREE', 'Ücretsiz Vitrin (Lansman Paketi)', 'Tüm Merter üreticileri ve toptancıları için sınırsız ürün yükleme ve doğrudan müşteri iletişimi.', 0.00, 0.00, 'TRY', 20.00, -1, '["Sınırsız Ürün Yükleme Hakkı", "Açık Firma Profili & Doğrulanmış Üretici Rozeti", "Doğrudan WhatsApp & Telefon İletişimi", "%0 Komisyon ile Doğrudan Sipariş Alma", "4 Dilde (TR/EN/RU/AR) Otomatik Çeviri"]'::jsonb, 1),
		('PRO', 'Profesyonel Vitrin', 'Kategorilerde öncelikli sıralama, gelişmiş ziyaretçi raporları ve çok dilli vitrin görünürlüğü.', 990.00, 9900.00, 'TRY', 20.00, -1, '["Sınırsız Ürün Yükleme Hakkı", "Gelişmiş Kategori Görünürlüğü & Öncelikli Sıralama", "Doğrudan WhatsApp & Sipariş Hattı", "Firma Ziyaretçi ve Ürün Görüntülenme Raporları", "Alıcı Taleplerine Doğrudan Erişim", "%0 Komisyon Fabrika Çıkış Satışı"]'::jsonb, 2),
		('PREMIUM', 'Premium & Sponsorlu Vitrin', 'Ana sayfada ve üst kategorilerde sponsorlu vitrin, maksimum ihracat görünürlüğü ve özel reklam alanı.', 2490.00, 24900.00, 'TRY', 20.00, -1, '["Sınırsız Ürün Yükleme Hakkı", "Ana Sayfada Öne Çıkan Üretici Vitrini", "Sponsorlu Kategori Üst Sıra Görünürlüğü", "Detaylı Ülke & Alıcı İletişim Analitiği", "Öncelikli Müşteri & Entegrasyon Desteği", "Özel Koleksiyon ve Bülten Tanıtımı"]'::jsonb, 3)
		ON CONFLICT (code) DO UPDATE SET max_products = -1, updated_at = NOW()`,
		`CREATE TABLE IF NOT EXISTS catalog.supplier_subscriptions (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			brand_id UUID NOT NULL UNIQUE REFERENCES catalog.brands(id) ON DELETE CASCADE,
			plan_id UUID NULL REFERENCES catalog.subscription_plans(id) ON DELETE SET NULL,
			plan_code VARCHAR(50) NOT NULL DEFAULT 'FREE',
			billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY',
			status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE',
			is_complimentary BOOLEAN NOT NULL DEFAULT true,
			agreed_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
			current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
			next_billing_date TIMESTAMPTZ NULL,
			auto_renew BOOLEAN NOT NULL DEFAULT true,
			total_paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
			total_invoiced_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
			outstanding_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
			billing_company_title VARCHAR(255) NOT NULL DEFAULT '',
			tax_office VARCHAR(150) NOT NULL DEFAULT '',
			tax_number VARCHAR(50) NOT NULL DEFAULT '',
			billing_address TEXT NOT NULL DEFAULT '',
			billing_email VARCHAR(255) NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`INSERT INTO catalog.supplier_subscriptions (
			brand_id, plan_id, plan_code, billing_cycle, status, is_complimentary, agreed_price, billing_company_title, billing_email, billing_address
		)
		SELECT
			b.id,
			(SELECT id FROM catalog.subscription_plans WHERE code = 'FREE' LIMIT 1),
			'FREE',
			'PROMO_FREE',
			'ACTIVE',
			true,
			0.00,
			b.brand_name,
			COALESCE(b.public_email, ''),
			COALESCE(b.location_address, '')
		FROM catalog.brands b
		ON CONFLICT (brand_id) DO NOTHING`,
		`CREATE TABLE IF NOT EXISTS catalog.supplier_invoices (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			invoice_number VARCHAR(50) UNIQUE NOT NULL,
			brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
			subscription_id UUID NULL REFERENCES catalog.supplier_subscriptions(id) ON DELETE SET NULL,
			invoice_type VARCHAR(40) NOT NULL DEFAULT 'SUBSCRIPTION',
			plan_code VARCHAR(50) NOT NULL DEFAULT 'PRO',
			period_label VARCHAR(120) NOT NULL DEFAULT '',
			subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
			tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
			status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
			billing_company_title VARCHAR(255) NOT NULL DEFAULT '',
			tax_office VARCHAR(150) NOT NULL DEFAULT '',
			tax_number VARCHAR(50) NOT NULL DEFAULT '',
			billing_address TEXT NOT NULL DEFAULT '',
			issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			due_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
			paid_at TIMESTAMPTZ NULL,
			pdf_url TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_supplier_invoices_brand_id ON catalog.supplier_invoices(brand_id, issue_date DESC)`,
		`CREATE TABLE IF NOT EXISTS catalog.supplier_subscription_payments (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			payment_number VARCHAR(50) UNIQUE NOT NULL,
			brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
			invoice_id UUID NULL REFERENCES catalog.supplier_invoices(id) ON DELETE SET NULL,
			plan_code VARCHAR(50) NOT NULL DEFAULT 'PRO',
			period_months INT NOT NULL DEFAULT 1,
			amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
			payment_method VARCHAR(40) NOT NULL DEFAULT 'BANK_TRANSFER',
			status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
			sender_name VARCHAR(255) NOT NULL DEFAULT '',
			bank_reference VARCHAR(150) NOT NULL DEFAULT '',
			receipt_url TEXT NOT NULL DEFAULT '',
			notes TEXT NOT NULL DEFAULT '',
			approved_by VARCHAR(150) NOT NULL DEFAULT '',
			paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_supplier_sub_payments_brand_id ON catalog.supplier_subscription_payments(brand_id, paid_at DESC)`,
		`CREATE TABLE IF NOT EXISTS catalog.supplier_accounting_ledger (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
			invoice_id UUID NULL REFERENCES catalog.supplier_invoices(id) ON DELETE SET NULL,
			payment_id UUID NULL REFERENCES catalog.supplier_subscription_payments(id) ON DELETE SET NULL,
			entry_type VARCHAR(40) NOT NULL,
			debit_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			running_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
			currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
			description TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_supplier_acc_ledger_brand_id ON catalog.supplier_accounting_ledger(brand_id, created_at DESC)`,
		`CREATE SCHEMA IF NOT EXISTS analytics`,
		`CREATE TABLE IF NOT EXISTS analytics.brand_events (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
			product_id UUID NULL REFERENCES catalog.products(id) ON DELETE SET NULL,
			event_type VARCHAR(50) NOT NULL,
			visitor_id VARCHAR(120) NOT NULL DEFAULT '',
			country_code VARCHAR(10) NOT NULL DEFAULT 'TR',
			language_code VARCHAR(10) NOT NULL DEFAULT 'tr',
			device_type VARCHAR(30) NOT NULL DEFAULT 'desktop',
			referrer_host VARCHAR(255) NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_brand_events_brand_created ON analytics.brand_events(brand_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_brand_events_brand_type ON analytics.brand_events(brand_id, event_type)`,
		`CREATE INDEX IF NOT EXISTS idx_brand_events_product ON analytics.brand_events(brand_id, product_id) WHERE product_id IS NOT NULL`,
		`CREATE TABLE IF NOT EXISTS analytics.whatsapp_clicks (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			brand_id UUID NULL REFERENCES catalog.brands(id) ON DELETE SET NULL,
			product_id UUID NULL REFERENCES catalog.products(id) ON DELETE SET NULL,
			user_id VARCHAR(128) NOT NULL DEFAULT '',
			visitor_id VARCHAR(128) NOT NULL DEFAULT '',
			target_phone VARCHAR(64) NOT NULL DEFAULT '',
			source_surface VARCHAR(64) NOT NULL DEFAULT '',
			page_path VARCHAR(500) NOT NULL DEFAULT '',
			country_code VARCHAR(10) NOT NULL DEFAULT 'TR',
			language_code VARCHAR(10) NOT NULL DEFAULT 'tr',
			device_type VARCHAR(30) NOT NULL DEFAULT 'desktop',
			ip_address VARCHAR(64) NOT NULL DEFAULT '',
			referrer_host VARCHAR(255) NOT NULL DEFAULT '',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_created_at ON analytics.whatsapp_clicks(created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_brand_created ON analytics.whatsapp_clicks(brand_id, created_at DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_user_id ON analytics.whatsapp_clicks(user_id) WHERE user_id <> ''`,
		`CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_visitor_id ON analytics.whatsapp_clicks(visitor_id) WHERE visitor_id <> ''`,
		`CREATE SEQUENCE IF NOT EXISTS catalog.buyer_rfq_seq START 1`,
		`CREATE TABLE IF NOT EXISTS catalog.buyer_rfqs (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			rfq_number VARCHAR(40) UNIQUE NOT NULL,
			title VARCHAR(255) NOT NULL,
			category_name VARCHAR(150) NOT NULL DEFAULT '',
			target_quantity INT NOT NULL DEFAULT 100,
			unit_type VARCHAR(30) NOT NULL DEFAULT 'ADET',
			target_price NUMERIC(12,2) NULL,
			currency VARCHAR(10) NOT NULL DEFAULT 'USD',
			production_type VARCHAR(50) NOT NULL DEFAULT 'hazir_toptan',
			description TEXT NOT NULL DEFAULT '',
			buyer_name VARCHAR(150) NOT NULL,
			buyer_company VARCHAR(150) NOT NULL DEFAULT '',
			buyer_country VARCHAR(80) NOT NULL DEFAULT 'Türkiye',
			buyer_phone VARCHAR(60) NOT NULL,
			buyer_whatsapp VARCHAR(60) NOT NULL DEFAULT '',
			buyer_email VARCHAR(150) NOT NULL DEFAULT '',
			status VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_buyer_rfqs_status_created ON catalog.buyer_rfqs(status, created_at DESC)`,
		`CREATE TABLE IF NOT EXISTS catalog.buyer_rfq_offers (
			id UUID PRIMARY KEY DEFAULT uuidv7(),
			rfq_id UUID NOT NULL REFERENCES catalog.buyer_rfqs(id) ON DELETE CASCADE,
			brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
			offered_unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
			currency VARCHAR(10) NOT NULL DEFAULT 'USD',
			min_order_quantity INT NOT NULL DEFAULT 1,
			delivery_days INT NOT NULL DEFAULT 7,
			notes TEXT NOT NULL DEFAULT '',
			supplier_phone VARCHAR(60) NOT NULL DEFAULT '',
			supplier_whatsapp VARCHAR(60) NOT NULL DEFAULT '',
			status VARCHAR(30) NOT NULL DEFAULT 'SENT',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			CONSTRAINT uq_rfq_brand_offer UNIQUE (rfq_id, brand_id)
		)`,
		`CREATE INDEX IF NOT EXISTS idx_buyer_rfq_offers_rfq_id ON catalog.buyer_rfq_offers(rfq_id, created_at DESC)`,
		`ALTER TABLE catalog.brands ADD COLUMN IF NOT EXISTS description_translations JSONB NOT NULL DEFAULT '{}'::jsonb`,
		`WITH ranked_carts AS (
			SELECT id, user_id,
			       FIRST_VALUE(id) OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC) AS canonical_id
			FROM catalog.carts
			WHERE user_id IS NOT NULL
		)
		UPDATE catalog.cart_items ci
		SET cart_id = rc.canonical_id
		FROM ranked_carts rc
		WHERE ci.cart_id = rc.id AND rc.id <> rc.canonical_id`,
		`DELETE FROM catalog.carts c
		USING (
			SELECT id,
			       ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC) AS rn
			FROM catalog.carts
			WHERE user_id IS NOT NULL
		) dup
		WHERE c.id = dup.id AND dup.rn > 1`,
		`WITH agg AS (
			SELECT cart_id, product_id, SUM(quantity) AS total_qty,
			       (ARRAY_AGG(id ORDER BY created_at DESC NULLS LAST, id DESC))[1] AS keep_id
			FROM catalog.cart_items
			GROUP BY cart_id, product_id
			HAVING COUNT(*) > 1
		)
		UPDATE catalog.cart_items ci
		SET quantity = agg.total_qty
		FROM agg
		WHERE ci.id = agg.keep_id`,
		`DELETE FROM catalog.cart_items ci
		USING (
			SELECT id,
			       ROW_NUMBER() OVER (PARTITION BY cart_id, product_id ORDER BY created_at DESC NULLS LAST, id DESC) AS rn
			FROM catalog.cart_items
		) dup
		WHERE ci.id = dup.id AND dup.rn > 1`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_carts_user_id_uq ON catalog.carts(user_id)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_cart_items_cart_product_uq ON catalog.cart_items(cart_id, product_id)`,
		`ALTER TABLE catalog.mobile_notifications ALTER COLUMN recipient_type SET DEFAULT 'customer'`,
		`ALTER TABLE catalog.mobile_notifications ALTER COLUMN recipient_id SET DEFAULT ''`,
		`ALTER TABLE catalog.mobile_notifications ADD COLUMN IF NOT EXISTS user_role VARCHAR(30) NOT NULL DEFAULT 'customer'`,
		`ALTER TABLE catalog.mobile_notifications ADD COLUMN IF NOT EXISTS user_id VARCHAR(255) NOT NULL DEFAULT ''`,
		`ALTER TABLE catalog.mobile_notifications ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
		`UPDATE catalog.mobile_notifications
		SET user_role = recipient_type,
		    user_id = recipient_id,
		    metadata = COALESCE(payload, '{}'::jsonb)
		WHERE user_id = '' AND recipient_id <> ''`,
		`CREATE INDEX IF NOT EXISTS idx_mobile_notifications_user_role ON catalog.mobile_notifications (user_role, user_id, created_at DESC)`,
		`ALTER TABLE identity.account_deletion_requests ADD COLUMN IF NOT EXISTS ip_address VARCHAR(64) NOT NULL DEFAULT ''`,
		`ALTER TABLE identity.account_deletion_requests ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ`,
		`ALTER TABLE identity.mobile_devices ALTER COLUMN fcm_token SET DEFAULT ''`,
		`ALTER TABLE identity.mobile_devices
			ADD COLUMN IF NOT EXISTS brand_id UUID NULL,
			ADD COLUMN IF NOT EXISTS device_token TEXT NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS locale VARCHAR(10) NOT NULL DEFAULT 'tr',
			ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP`,
		`UPDATE identity.mobile_devices SET device_token = fcm_token WHERE device_token = '' AND fcm_token <> ''`,
		`CREATE UNIQUE INDEX IF NOT EXISTS uq_mobile_devices_user_role_device_token ON identity.mobile_devices (user_id, user_role, device_token)`,
		`ALTER TABLE catalog.orders
			ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
			ADD COLUMN IF NOT EXISTS customer_currency VARCHAR(10) NOT NULL DEFAULT '',
			ADD COLUMN IF NOT EXISTS customer_total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
			ADD COLUMN IF NOT EXISTS total_amount_try NUMERIC(14,2) NOT NULL DEFAULT 0.00,
			ADD COLUMN IF NOT EXISTS currency_totals JSONB NOT NULL DEFAULT '{}'::jsonb`,
		`ALTER TABLE catalog.order_items ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY'`,
		`ALTER TABLE catalog.supplier_sub_order_items ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY'`,
		`ALTER TABLE catalog.payment_notifications
			ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) DEFAULT 'PENDING',
			ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY'`,
		`ALTER TABLE identity.users
			ADD COLUMN IF NOT EXISTS country_code VARCHAR(8),
			ADD COLUMN IF NOT EXISTS country_name VARCHAR(120),
			ADD COLUMN IF NOT EXISTS city VARCHAR(120),
			ADD COLUMN IF NOT EXISTS region_name VARCHAR(120),
			ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
			ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
			ADD COLUMN IF NOT EXISTS geo_source VARCHAR(40),
			ADD COLUMN IF NOT EXISTS geo_resolved_at TIMESTAMPTZ`,
		`CREATE INDEX IF NOT EXISTS idx_users_customer_created_at ON identity.users (created_at DESC) WHERE user_role = 'customer'`,
		`CREATE INDEX IF NOT EXISTS idx_users_customer_country ON identity.users (country_code) WHERE user_role = 'customer'`,
		`CREATE INDEX IF NOT EXISTS idx_users_customer_geo_unresolved ON identity.users (created_at DESC) WHERE user_role = 'customer' AND country_code IS NULL`,
		`ALTER TABLE catalog.settings ADD COLUMN IF NOT EXISTS recaptcha_enabled BOOLEAN NOT NULL DEFAULT true`,
		`ALTER TABLE catalog.settings ADD COLUMN IF NOT EXISTS recaptcha_site_key TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE catalog.settings ADD COLUMN IF NOT EXISTS recaptcha_secret_key TEXT NOT NULL DEFAULT ''`,
	}

	for _, ddl := range ddlQueries {
		_, err = pool.Exec(ctx, ddl)
		if err != nil {
			log.Printf("[DB WARNING] Failed to provision table/seed settings: %v", err)
		}
	}

	repairHistoricalOrderCurrencies(ctx, pool)

	Pool = pool
	return pool, nil
}

func repairHistoricalOrderCurrencies(ctx context.Context, pool *pgxpool.Pool) {
	if pool == nil {
		return
	}
	repairQueries := []string{
		`UPDATE catalog.order_items oi
		SET currency = CASE
			WHEN UPPER(TRIM(COALESCE(p.currency, 'TRY'))) IN ('TL', '') THEN 'TRY'
			ELSE UPPER(TRIM(p.currency))
		END
		FROM catalog.products p
		WHERE oi.product_id = p.id
		  AND UPPER(TRIM(COALESCE(oi.currency, 'TRY'))) IN ('TRY', 'TL', '')
		  AND UPPER(TRIM(COALESCE(p.currency, 'TRY'))) NOT IN ('TRY', 'TL', '')`,
		`UPDATE catalog.supplier_sub_order_items soi
		SET currency = CASE
			WHEN UPPER(TRIM(COALESCE(p.currency, 'TRY'))) IN ('TL', '') THEN 'TRY'
			ELSE UPPER(TRIM(p.currency))
		END
		FROM catalog.products p
		WHERE soi.product_id = p.id
		  AND UPPER(TRIM(COALESCE(soi.currency, 'TRY'))) IN ('TRY', 'TL', '')
		  AND UPPER(TRIM(COALESCE(p.currency, 'TRY'))) NOT IN ('TRY', 'TL', '')`,
		`WITH sub_curr AS (
			SELECT soi.sub_order_id,
			       COUNT(DISTINCT CASE
			           WHEN UPPER(TRIM(COALESCE(soi.currency, 'TRY'))) IN ('TL', '') THEN 'TRY'
			           ELSE UPPER(TRIM(soi.currency))
			       END) AS cnt,
			       MIN(CASE
			           WHEN UPPER(TRIM(COALESCE(soi.currency, 'TRY'))) IN ('TL', '') THEN 'TRY'
			           ELSE UPPER(TRIM(soi.currency))
			       END) AS curr
			FROM catalog.supplier_sub_order_items soi
			GROUP BY soi.sub_order_id
		)
		UPDATE catalog.supplier_sub_orders so
		SET currency = LEFT(sc.curr, 3)
		FROM sub_curr sc
		WHERE so.id = sc.sub_order_id
		  AND sc.cnt = 1
		  AND sc.curr <> 'TRY'
		  AND UPPER(COALESCE(so.currency, 'TRY')) = 'TRY'`,
		`UPDATE catalog.supplier_ledger sl
		SET currency = so.currency
		FROM catalog.supplier_sub_orders so
		WHERE sl.sub_order_id = so.id
		  AND UPPER(COALESCE(sl.currency, 'TRY')) = 'TRY'
		  AND UPPER(COALESCE(so.currency, 'TRY')) <> 'TRY'`,
		`WITH latest_rates AS (
			SELECT DISTINCT ON (UPPER(TRIM(currency_code)))
			       UPPER(TRIM(currency_code)) AS code,
			       buying_rate::numeric AS rate
			FROM catalog.exchange_rates
			WHERE buying_rate > 0
			ORDER BY UPPER(TRIM(currency_code)), publication_date DESC, updated_at DESC
		),
		item_curr_sums AS (
			SELECT oi.order_id,
			       CASE
			           WHEN UPPER(TRIM(COALESCE(oi.currency, 'TRY'))) IN ('TL', '') THEN 'TRY'
			           ELSE UPPER(TRIM(oi.currency))
			       END AS curr,
			       ROUND(SUM(oi.price_at_purchase * oi.quantity)::numeric, 2) AS curr_sum
			FROM catalog.order_items oi
			GROUP BY oi.order_id, 2
		),
		order_agg AS (
			SELECT ics.order_id,
			       jsonb_object_agg(ics.curr, ics.curr_sum) AS currency_totals,
			       COUNT(*)::int AS curr_count,
			       MIN(ics.curr) AS single_curr,
			       SUM(ics.curr_sum)::numeric(14,2) AS single_sum,
			       ROUND(SUM(
			           ics.curr_sum * CASE
			               WHEN ics.curr = 'TRY' THEN 1.0
			               WHEN lr.rate IS NOT NULL AND lr.rate > 0 THEN lr.rate
			               WHEN ics.curr = 'USD' THEN 44.0
			               WHEN ics.curr = 'EUR' THEN 48.0
			               WHEN ics.curr = 'GBP' THEN 56.0
			               WHEN ics.curr = 'RUB' THEN 0.48
			               ELSE 1.0
			           END
			       )::numeric, 2) AS calc_try
			FROM item_curr_sums ics
			LEFT JOIN latest_rates lr ON lr.code = ics.curr
			GROUP BY ics.order_id
		)
		UPDATE catalog.orders o
		SET currency = CASE WHEN agg.curr_count = 1 THEN agg.single_curr ELSE 'TRY' END,
		    total_amount = CASE WHEN agg.curr_count = 1 THEN agg.single_sum ELSE agg.calc_try END,
		    total_amount_try = agg.calc_try,
		    currency_totals = agg.currency_totals,
		    customer_currency = CASE
		        WHEN NULLIF(TRIM(COALESCE(o.customer_currency, '')), '') IS NOT NULL THEN
		            CASE WHEN UPPER(TRIM(o.customer_currency)) = 'TL' THEN 'TRY' ELSE UPPER(TRIM(o.customer_currency)) END
		        WHEN agg.curr_count = 1 THEN agg.single_curr
		        ELSE 'TRY'
		    END,
		    customer_total_amount = CASE
		        WHEN agg.curr_count = 1 AND (NULLIF(TRIM(COALESCE(o.customer_currency, '')), '') IS NULL OR UPPER(TRIM(o.customer_currency)) = agg.single_curr)
		            THEN agg.single_sum
		        ELSE agg.calc_try
		    END
		FROM order_agg agg
		WHERE o.id = agg.order_id
		  AND o.currency_totals = '{}'::jsonb`,
		`UPDATE catalog.payment_notifications pn
		SET currency = o.currency
		FROM catalog.orders o
		WHERE pn.order_id = o.id
		  AND UPPER(COALESCE(pn.currency, 'TRY')) = 'TRY'
		  AND UPPER(COALESCE(o.currency, 'TRY')) <> 'TRY'`,
	}

	for _, q := range repairQueries {
		if _, err := pool.Exec(ctx, q); err != nil {
			log.Printf("[DB WARNING] Failed to repair historical order currencies: %v", err)
		}
	}
}

func CloseDB() {
	if Pool != nil {
		Pool.Close()
	}
}
