-- 0024_add_supplier_translations_support.sql
-- Adds multi-language description translations (TR / EN / RU / AR) support for supplier brand profiles.

ALTER TABLE catalog.brands
ADD COLUMN IF NOT EXISTS description_translations JSONB NOT NULL DEFAULT '{}'::jsonb;

