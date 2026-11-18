-- WhatsApp direct supplier/product click attribution & admin reporting
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.whatsapp_clicks (
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
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_created_at
	ON analytics.whatsapp_clicks(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_brand_created
	ON analytics.whatsapp_clicks(brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_user_id
	ON analytics.whatsapp_clicks(user_id)
	WHERE user_id <> '';

CREATE INDEX IF NOT EXISTS idx_whatsapp_clicks_visitor_id
	ON analytics.whatsapp_clicks(visitor_id)
	WHERE visitor_id <> '';

UPDATE catalog.brands
SET whatsapp_phone = '+90 530 887 37 96',
    updated_at = CURRENT_TIMESTAMP
WHERE id = '019e620f-2ca6-774c-9450-6c69015045a4' OR slug = 'jane-s-toptan-tekstil';
