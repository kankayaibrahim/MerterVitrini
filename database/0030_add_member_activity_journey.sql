-- Migration 0030: Add Member Journey Map & Activity Timeline Schema
-- Tracks every member's pre-registration & post-registration page views, read corporate/blog pages,
-- viewed products, supplier interactions, cart actions, inquiries, chats, and B2B orders.

CREATE SCHEMA IF NOT EXISTS analytics;

-- 1. Enhance analytics.page_views with member linkage, page title, and dwell duration
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS user_id VARCHAR(128);
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS page_title VARCHAR(300);
ALTER TABLE analytics.page_views ADD COLUMN IF NOT EXISTS duration_sec INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_analytics_pv_user_created
    ON analytics.page_views (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

-- 2. Link browser visitor_id (mv_vid) to identity.users.id so pre-signup browsing stitches to the member
CREATE TABLE IF NOT EXISTS analytics.user_visitor_links (
    user_id VARCHAR(128) NOT NULL,
    visitor_id VARCHAR(64) NOT NULL,
    first_linked_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, visitor_id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_uvl_visitor ON analytics.user_visitor_links (visitor_id);

-- 3. Unified Member Activity & Journey Timeline Ledger
CREATE TABLE IF NOT EXISTS analytics.member_events (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id VARCHAR(128),
    visitor_id VARCHAR(64),
    session_id VARCHAR(64),
    event_type VARCHAR(50) NOT NULL,
    event_category VARCHAR(32) NOT NULL DEFAULT 'navigation',
    title VARCHAR(300) NOT NULL,
    subtitle VARCHAR(500),
    url_path VARCHAR(500),
    entity_type VARCHAR(40),
    entity_id VARCHAR(128),
    image_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    duration_sec INT NOT NULL DEFAULT 0,
    device_type VARCHAR(20) DEFAULT 'desktop',
    browser VARCHAR(50),
    os VARCHAR(50),
    country_code VARCHAR(10),
    ip_address VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_member_events_user_created
    ON analytics.member_events (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_events_visitor_created
    ON analytics.member_events (visitor_id, created_at DESC)
    WHERE visitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_events_category_created
    ON analytics.member_events (event_category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_events_created_at
    ON analytics.member_events (created_at DESC);

