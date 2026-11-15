-- Migration 0035: Persistent IndexNow Submission & Audit Logs
-- Tracks automated XML sync, supplier portal/mobile/excel publish, blog, CMS page, bulk, and manual IndexNow submissions.

BEGIN;

CREATE SCHEMA IF NOT EXISTS catalog;

CREATE TABLE IF NOT EXISTS catalog.indexnow_logs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    trigger_source VARCHAR(40) NOT NULL DEFAULT 'manual',
    source_label VARCHAR(240) NOT NULL DEFAULT '',
    feed_id UUID NULL,
    sync_run_id UUID NULL,
    host VARCHAR(120) NOT NULL DEFAULT 'mertervitrini.com.tr',
    product_count INT NOT NULL DEFAULT 0,
    url_count INT NOT NULL DEFAULT 0,
    sample_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    http_status INT NOT NULL DEFAULT 0,
    response_message TEXT NOT NULL DEFAULT '',
    duration_ms INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_indexnow_logs_created_at
    ON catalog.indexnow_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_indexnow_logs_source_created
    ON catalog.indexnow_logs (trigger_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_indexnow_logs_status_created
    ON catalog.indexnow_logs (status, created_at DESC);

COMMIT;
