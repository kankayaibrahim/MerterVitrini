-- Migration 0044: Parametric Exception & HTTP 5xx Burst Email Alerting System
-- Registers the 'system_exception_alert' channel in identity.notification_settings
-- and stores admin-configurable panic/5xx burst/cooldown/ignore parameters in identity.exception_alert_config.

CREATE SCHEMA IF NOT EXISTS identity;

INSERT INTO identity.notification_settings (
    event_key, title, description, enabled, to_emails, cc_emails, schedule_hour, schedule_minute
)
VALUES (
    'system_exception_alert',
    'Kritik Sistem Hatası & Yoğun 5xx Alarmı',
    'Sunucu panic çökmelerinde anında, yoğun HTTP 500 veya kritik hata patlamalarında parametrik eşik ve bekleme süresiyle yönetici ekibe teknik exception maili gönderir.',
    true,
    ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'],
    ARRAY[]::TEXT[],
    21,
    0
)
ON CONFLICT (event_key) DO NOTHING;

CREATE TABLE IF NOT EXISTS identity.exception_alert_config (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    alert_on_panic      BOOLEAN NOT NULL DEFAULT true,
    alert_on_http_5xx   BOOLEAN NOT NULL DEFAULT true,
    alert_on_error_logs BOOLEAN NOT NULL DEFAULT true,
    burst_threshold     INTEGER NOT NULL DEFAULT 5,
    window_minutes      INTEGER NOT NULL DEFAULT 5,
    cooldown_minutes    INTEGER NOT NULL DEFAULT 15,
    max_emails_per_hour INTEGER NOT NULL DEFAULT 6,
    ignored_patterns    JSONB NOT NULL DEFAULT '["Failed to find Server Action", "context canceled", "broken pipe", "connection reset by peer"]'::jsonb,
    updated_by          VARCHAR(150) NULL,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO identity.exception_alert_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
