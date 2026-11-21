-- Migration 0039: Per-product IndexNow notification tracking & one-time backfill automation state

BEGIN;

CREATE SCHEMA IF NOT EXISTS catalog;

ALTER TABLE catalog.products
    ADD COLUMN IF NOT EXISTS indexnow_notified_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_products_indexnow_pending
    ON catalog.products (created_at DESC)
    WHERE is_active = true
      AND COALESCE(is_archived, false) = false
      AND indexnow_notified_at IS NULL;

CREATE TABLE IF NOT EXISTS catalog.indexnow_automation_state (
    singleton_guard BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton_guard = true),
    auto_enabled BOOLEAN NOT NULL DEFAULT true,
    initial_backfill_completed_at TIMESTAMPTZ NULL,
    initial_backfill_status VARCHAR(24) NOT NULL DEFAULT 'pending',
    initial_backfill_last_error TEXT NOT NULL DEFAULT '',
    last_sweep_at TIMESTAMPTZ NULL,
    last_sweep_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO catalog.indexnow_automation_state (singleton_guard, auto_enabled, initial_backfill_status)
VALUES (true, true, 'pending')
ON CONFLICT (singleton_guard) DO NOTHING;

COMMIT;
