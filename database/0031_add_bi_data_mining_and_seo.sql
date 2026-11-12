-- Migration 0031: Enterprise BI / Data Mining Telemetry, Search Logs, Multi-Currency Orders & SEO Indexes
-- Extends analytics.page_views with geo, attribution, engagement (scroll/dwell), bot classification,
-- new-vs-returning visitor flag, and Core Web Vitals (LCP, CLS, INP, TTFB).
-- Creates analytics.search_logs for B2B wholesale search & zero-result demand mining.
-- Ensures catalog.orders tracks explicit order currency for accurate TRY GMV conversion.

BEGIN;

CREATE SCHEMA IF NOT EXISTS analytics;

-- 1. Extend analytics.page_views with BI, attribution, bot & Core Web Vitals columns
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS user_id VARCHAR(128);
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS page_title VARCHAR(300);
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS duration_sec INT NOT NULL DEFAULT 0;
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS city VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY';
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS utm_term VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS utm_content VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS click_id VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS scroll_depth_pct SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS bot_name VARCHAR(60) NOT NULL DEFAULT '';
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS is_new_visitor BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS lcp_ms INT NOT NULL DEFAULT 0;
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS cls_score NUMERIC(8,4) NOT NULL DEFAULT 0;
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS inp_ms INT NOT NULL DEFAULT 0;
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS ttfb_ms INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_analytics_pv_bot_created
    ON analytics.page_views (is_bot, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_pv_country_created
    ON analytics.page_views (country_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_pv_utm_src_camp
    ON analytics.page_views (utm_source, utm_campaign);

CREATE INDEX IF NOT EXISTS idx_analytics_pv_session_created
    ON analytics.page_views (session_id, created_at ASC);

-- 2. Create analytics.search_logs for B2B search & unmet demand mining
CREATE TABLE IF NOT EXISTS analytics.search_logs (
    id BIGSERIAL PRIMARY KEY,
    visitor_id VARCHAR(64) NOT NULL DEFAULT '',
    session_id VARCHAR(64) NOT NULL DEFAULT '',
    user_id VARCHAR(128),
    query_text VARCHAR(250) NOT NULL,
    normalized_query VARCHAR(250) NOT NULL,
    language_code VARCHAR(10) NOT NULL DEFAULT 'tr',
    country_code VARCHAR(10) NOT NULL DEFAULT '',
    category_slug VARCHAR(160) NOT NULL DEFAULT '',
    results_count INT NOT NULL DEFAULT 0,
    has_filters BOOLEAN NOT NULL DEFAULT FALSE,
    clicked_product_id VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_search_logs_created_at
    ON analytics.search_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_logs_norm_query
    ON analytics.search_logs (normalized_query);

CREATE INDEX IF NOT EXISTS idx_search_logs_results_created
    ON analytics.search_logs (results_count, created_at DESC);

-- 3. Ensure catalog.orders carries currency for multi-currency GMV reporting
ALTER TABLE catalog.orders
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY';

UPDATE catalog.orders o
SET currency = sub.dominant_currency
FROM (
    SELECT oi.order_id, UPPER(MAX(p.currency)) AS dominant_currency
    FROM catalog.order_items oi
    JOIN catalog.products p ON p.id = oi.product_id
    WHERE p.currency IS NOT NULL AND UPPER(p.currency) NOT IN ('TRY', 'TL', '')
    GROUP BY oi.order_id
    HAVING COUNT(DISTINCT UPPER(p.currency)) = 1
) sub
WHERE o.id = sub.order_id
  AND UPPER(COALESCE(o.currency, 'TRY')) IN ('TRY', 'TL', '');

-- 4. Helpful lookup index on catalog.product_ai_content(product_id) if table exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'catalog' AND table_name = 'product_ai_content'
    ) THEN
        CREATE INDEX IF NOT EXISTS idx_product_ai_content_product_id
            ON catalog.product_ai_content (product_id, updated_at DESC);
    END IF;
END $$;

COMMIT;
