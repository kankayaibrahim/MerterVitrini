-- Migration 0022: Add analytics.brand_events table for Supplier ROI & Visitor Analytics
-- Tracks profile views, product views, WhatsApp/Phone/Email/Website clicks, inquiries,
-- and live chat starts per supplier brand with country and language attribution.

CREATE SCHEMA IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.brand_events (
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
);

CREATE INDEX IF NOT EXISTS idx_brand_events_brand_created
    ON analytics.brand_events(brand_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_events_brand_type
    ON analytics.brand_events(brand_id, event_type);

CREATE INDEX IF NOT EXISTS idx_brand_events_product
    ON analytics.brand_events(brand_id, product_id)
    WHERE product_id IS NOT NULL;

