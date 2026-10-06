-- Migration 0013: Create Analytics and Visitor Tracking Schema
CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.page_views (
    id BIGSERIAL PRIMARY KEY,
    visitor_id VARCHAR(64) NOT NULL,
    session_id VARCHAR(64),
    url TEXT NOT NULL,
    path VARCHAR(500) NOT NULL,
    referrer TEXT,
    referrer_host VARCHAR(255),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    device_type VARCHAR(20) DEFAULT 'desktop',
    browser VARCHAR(50),
    os VARCHAR(50),
    language VARCHAR(10) DEFAULT 'tr',
    screen_width INT DEFAULT 0,
    screen_height INT DEFAULT 0,
    ip_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_pv_created_at ON analytics.page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_pv_visitor_created ON analytics.page_views (visitor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_pv_path ON analytics.page_views (path);
CREATE INDEX IF NOT EXISTS idx_analytics_pv_referrer_host ON analytics.page_views (referrer_host);
CREATE INDEX IF NOT EXISTS idx_analytics_pv_lang ON analytics.page_views (language);
