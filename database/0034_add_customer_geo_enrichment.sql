-- 0034_add_customer_geo_enrichment.sql
-- Adds geographic enrichment columns and customer reporting indexes to identity.users.

ALTER TABLE identity.users
	ADD COLUMN IF NOT EXISTS country_code VARCHAR(8),
	ADD COLUMN IF NOT EXISTS country_name VARCHAR(120),
	ADD COLUMN IF NOT EXISTS city VARCHAR(120),
	ADD COLUMN IF NOT EXISTS region_name VARCHAR(120),
	ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
	ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION,
	ADD COLUMN IF NOT EXISTS geo_source VARCHAR(40),
	ADD COLUMN IF NOT EXISTS geo_resolved_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_customer_created_at
	ON identity.users (created_at DESC)
	WHERE user_role = 'customer';

CREATE INDEX IF NOT EXISTS idx_users_customer_country
	ON identity.users (country_code)
	WHERE user_role = 'customer';

CREATE INDEX IF NOT EXISTS idx_users_customer_geo_unresolved
	ON identity.users (created_at DESC)
	WHERE user_role = 'customer' AND country_code IS NULL;
