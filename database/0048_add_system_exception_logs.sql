-- =========================================================================
-- Migration 0048: System Health, Exception Stacktraces & Log Watermarks
-- PostgreSQL 18+ Native uuidv7() | Idempotent DDL
-- =========================================================================

-- 1. Persistent Exception, Panic, HTTP 5xx & Severe Error Logs
CREATE TABLE IF NOT EXISTS identity.system_exception_logs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    severity VARCHAR(20) NOT NULL DEFAULT 'error',
    source VARCHAR(120) NOT NULL DEFAULT 'backend',
    message TEXT NOT NULL,
    stack_trace TEXT NOT NULL DEFAULT '',
    fingerprint VARCHAR(64) NOT NULL,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_exception_logs_last_seen
    ON identity.system_exception_logs (last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_exception_logs_open_fp
    ON identity.system_exception_logs (fingerprint)
    WHERE is_resolved = false;

CREATE INDEX IF NOT EXISTS idx_system_exception_logs_severity
    ON identity.system_exception_logs (severity, is_resolved, last_seen_at DESC);

-- 2. Stream/Journal Log Clear Watermarks (for non-file journalctl streams)
CREATE TABLE IF NOT EXISTS identity.system_log_watermarks (
    source VARCHAR(64) PRIMARY KEY,
    cleared_after TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cleared_by VARCHAR(150) NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
