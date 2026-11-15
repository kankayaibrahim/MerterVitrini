-- 0038_add_recaptcha_settings.sql
-- Adds configurable Google reCAPTCHA v3 protection fields to catalog.settings
-- so administrators can manage site/secret keys and toggle protection from /admin/settings/site.

ALTER TABLE catalog.settings
    ADD COLUMN IF NOT EXISTS recaptcha_enabled BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS recaptcha_site_key TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS recaptcha_secret_key TEXT NOT NULL DEFAULT '';
