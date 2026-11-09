-- ============================================================================
-- Migration: 0027_add_product_archiving.sql
-- Purpose  : Bölüm 5.F — Eski Koleksiyon Arşivleme (is_archived & archived_at)
-- ============================================================================

ALTER TABLE catalog.products
    ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_products_brand_archived_active
    ON catalog.products (brand_id, is_archived, is_active);

