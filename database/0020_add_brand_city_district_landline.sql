-- ============================================================================
-- Migration 0020: Add city, district, and landline_phone to catalog.brands
-- ============================================================================

ALTER TABLE catalog.brands
    ADD COLUMN IF NOT EXISTS city VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS district VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS landline_phone VARCHAR(50) NOT NULL DEFAULT '';
