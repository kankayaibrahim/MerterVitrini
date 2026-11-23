-- =========================================================================
-- Migration 0047: Instagram-Style Supplier Stories (24h Ephemeral + Paid Tier Gating)
--                 & Customer Favorite Suppliers (Opt-In New Product Notifications)
-- PostgreSQL 18+ Native uuidv7() | Idempotent DDL
-- =========================================================================

-- 1. Global Story Monetization & Quota Settings (Singleton)
CREATE TABLE IF NOT EXISTS catalog.story_settings (
    singleton_guard BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton_guard = true),
    is_paid_mode BOOLEAN NOT NULL DEFAULT false,
    paid_daily_limit INTEGER NOT NULL DEFAULT 8 CHECK (paid_daily_limit >= 1 AND paid_daily_limit <= 50),
    free_daily_limit INTEGER NOT NULL DEFAULT 8 CHECK (free_daily_limit >= 0 AND free_daily_limit <= 50),
    story_ttl_hours INTEGER NOT NULL DEFAULT 24 CHECK (story_ttl_hours >= 1 AND story_ttl_hours <= 168),
    monthly_addon_price_try NUMERIC(12,2) NOT NULL DEFAULT 990.00 CHECK (monthly_addon_price_try >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog.story_settings (
    singleton_guard,
    is_paid_mode,
    paid_daily_limit,
    free_daily_limit,
    story_ttl_hours,
    monthly_addon_price_try
)
VALUES (true, false, 8, 8, 24, 990.00)
ON CONFLICT (singleton_guard) DO NOTHING;

-- 2. Per-Supplier Subscription Story Overrides (Paid Add-On / Custom Limit)
ALTER TABLE catalog.supplier_subscriptions
    ADD COLUMN IF NOT EXISTS story_entitlement_override BOOLEAN NULL,
    ADD COLUMN IF NOT EXISTS story_daily_limit_override INTEGER NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_supplier_subscriptions_story_daily_limit'
          AND conrelid = 'catalog.supplier_subscriptions'::regclass
    ) THEN
        ALTER TABLE catalog.supplier_subscriptions
            ADD CONSTRAINT chk_supplier_subscriptions_story_daily_limit
            CHECK (
                story_daily_limit_override IS NULL
                OR (story_daily_limit_override >= 1 AND story_daily_limit_override <= 50)
            );
    END IF;
END $$;

-- 3. Supplier Stories (Instagram-style 24h Ephemeral Visual Cards)
CREATE TABLE IF NOT EXISTS catalog.supplier_stories (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
    created_by_role VARCHAR(20) NOT NULL DEFAULT 'supplier' CHECK (created_by_role IN ('supplier', 'admin')),
    created_by_user_id VARCHAR(255) NULL,
    media_url TEXT NOT NULL,
    media_type VARCHAR(20) NOT NULL DEFAULT 'image' CHECK (media_type IN ('image')),
    caption TEXT NOT NULL DEFAULT '',
    cta_label VARCHAR(80) NOT NULL DEFAULT '',
    cta_url TEXT NOT NULL DEFAULT '',
    linked_product_id UUID NULL REFERENCES catalog.products(id) ON DELETE SET NULL,
    bg_color VARCHAR(32) NOT NULL DEFAULT '#111111',
    is_active BOOLEAN NOT NULL DEFAULT true,
    view_count INTEGER NOT NULL DEFAULT 0,
    click_count INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_supplier_stories_active_expires
    ON catalog.supplier_stories (expires_at DESC, created_at DESC)
    WHERE is_active = true AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_stories_brand_window
    ON catalog.supplier_stories (brand_id, created_at DESC);

-- 4. Customer Favorite Suppliers & Per-Supplier New-Product Notification Opt-In
-- NOTE: identity.users(id) is VARCHAR(255) (Keycloak OIDC compatible).
CREATE TABLE IF NOT EXISTS catalog.customer_favorite_suppliers (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id VARCHAR(255) NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
    notify_new_products BOOLEAN NOT NULL DEFAULT true,
    notify_via_email BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_favorite_suppliers_user_brand UNIQUE (user_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_fav_suppliers_user
    ON catalog.customer_favorite_suppliers (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_fav_suppliers_brand_notify
    ON catalog.customer_favorite_suppliers (brand_id)
    WHERE notify_new_products = true;
