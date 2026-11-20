-- ============================================================================
-- Migration 0019: Hourly Nginx Bot Crawl Rollups & Arrival Keyword Tracking
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.bot_crawl_hourly (
    bucket_hour TIMESTAMPTZ NOT NULL,
    bot_name VARCHAR(60) NOT NULL,
    bot_category VARCHAR(32) NOT NULL,
    path VARCHAR(500) NOT NULL,
    status_class VARCHAR(8) NOT NULL DEFAULT '2xx',
    hits BIGINT NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (bucket_hour, bot_name, path, status_class)
);

CREATE INDEX IF NOT EXISTS idx_bot_crawl_hourly_bucket
    ON analytics.bot_crawl_hourly (bucket_hour DESC);

CREATE INDEX IF NOT EXISTS idx_bot_crawl_hourly_cat_bucket
    ON analytics.bot_crawl_hourly (bot_category, bucket_hour DESC);

CREATE TABLE IF NOT EXISTS analytics.log_ingest_cursors (
    source_key VARCHAR(120) PRIMARY KEY,
    file_inode BIGINT NOT NULL DEFAULT 0,
    byte_offset BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE analytics.page_views
    ADD COLUMN IF NOT EXISTS referrer_keyword VARCHAR(200) NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_analytics_pv_keywords_created
    ON analytics.page_views (created_at DESC)
    WHERE COALESCE(utm_term, '') <> '' OR COALESCE(referrer_keyword, '') <> '';
