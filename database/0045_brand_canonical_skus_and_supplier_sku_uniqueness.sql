-- Migration 0045: Canonical Brand SKUs (JANES, ETIKA, LUSTRIN, BLACK_FASHION) & Per-Supplier Product Code Uniqueness
-- Safe & Idempotent: retires legacy EDUSA/FLORA/MIMOZA SKU prefixes using live brand alias_code,
-- prioritizes catalog.brands.alias_code in SKU trigger, and enforces per-supplier SKU uniqueness on manual/Excel products.

BEGIN;

-- 1. Ensure xml_feeds.alias_code mirrors the canonical brand alias_code
UPDATE integration.xml_feeds xf
SET alias_code = UPPER(BTRIM(b.alias_code)),
    updated_at = CURRENT_TIMESTAMP
FROM catalog.brands b
WHERE xf.brand_id = b.id
  AND b.alias_code IS NOT NULL
  AND BTRIM(b.alias_code) <> ''
  AND COALESCE(xf.alias_code, '') <> UPPER(BTRIM(b.alias_code));

-- 2. Prioritize catalog.brands.alias_code over integration.xml_feeds.alias_code in trig_product_custom_sku
CREATE OR REPLACE FUNCTION catalog.trig_product_custom_sku()
RETURNS TRIGGER AS $$
DECLARE
    v_alias VARCHAR(50);
BEGIN
    IF NEW.slug_id IS NULL OR NEW.slug_id = '' THEN
        NEW.slug_id := catalog.to_base36(nextval('catalog.products_slug_id_seq'));
    END IF;

    IF NEW.brand_id IS NOT NULL THEN
        SELECT NULLIF(BTRIM(alias_code), '') INTO v_alias
        FROM catalog.brands
        WHERE id = NEW.brand_id;
    END IF;

    IF (v_alias IS NULL OR v_alias = '') AND NEW.feed_id IS NOT NULL THEN
        SELECT NULLIF(BTRIM(alias_code), '') INTO v_alias
        FROM integration.xml_feeds
        WHERE id = NEW.feed_id;
    END IF;

    NEW.custom_sku := upper(coalesce(v_alias, 'PROD') || '-' || NEW.slug_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_product_custom_sku_before ON catalog.products;
CREATE TRIGGER trig_product_custom_sku_before
    BEFORE INSERT OR UPDATE OF brand_id, feed_id, source_product_id, custom_sku
    ON catalog.products
    FOR EACH ROW
    EXECUTE FUNCTION catalog.trig_product_custom_sku();

-- 3. Backfill all existing products to their canonical brand alias prefix + slug_id
UPDATE catalog.products p
SET custom_sku = UPPER(BTRIM(b.alias_code) || '-' || p.slug_id),
    updated_at = CURRENT_TIMESTAMP
FROM catalog.brands b
WHERE p.brand_id = b.id
  AND b.alias_code IS NOT NULL
  AND BTRIM(b.alias_code) <> ''
  AND p.slug_id IS NOT NULL
  AND BTRIM(p.slug_id) <> ''
  AND p.custom_sku <> UPPER(BTRIM(b.alias_code) || '-' || p.slug_id);

-- 4. Update all product_variants custom_sku prefixes cleanly
UPDATE catalog.product_variants v
SET custom_sku = p.custom_sku || SUBSTRING(
    v.custom_sku
    FROM POSITION('-' || UPPER(p.slug_id) IN UPPER(v.custom_sku)) + LENGTH('-' || UPPER(p.slug_id))
)
FROM catalog.products p
WHERE v.product_id = p.id
  AND p.slug_id IS NOT NULL
  AND BTRIM(p.slug_id) <> ''
  AND POSITION('-' || UPPER(p.slug_id) IN UPPER(v.custom_sku)) > 0
  AND UPPER(SUBSTRING(v.custom_sku FROM 1 FOR POSITION('-' || UPPER(p.slug_id) IN UPPER(v.custom_sku)) + LENGTH(p.slug_id))) <> UPPER(p.custom_sku);

-- Fallback regeneration for any non-matching legacy variant prefixes
UPDATE catalog.product_variants v
SET custom_sku = ''
FROM catalog.products p
WHERE v.product_id = p.id
  AND v.custom_sku ~* '^(EDUSA|FLORA|MIMOZA)-'
  AND UPPER(v.custom_sku) NOT LIKE UPPER(p.custom_sku) || '-%';

-- 5. Strip legacy fake 'FL-' prefix from Etika's supplier model SKU column
UPDATE catalog.products
SET sku = SUBSTRING(sku FROM 4),
    updated_at = CURRENT_TIMESTAMP
WHERE feed_id = 'etika'
  AND sku LIKE 'FL-%'
  AND LENGTH(sku) > 3;

-- 6. Sync historical inquiry/order line SKUs referencing migrated products
UPDATE catalog.store_inquiry_items sii
SET custom_sku = p.custom_sku
FROM catalog.products p
WHERE sii.product_id = p.id
  AND sii.custom_sku ~* '^(EDUSA|FLORA|MIMOZA)-'
  AND sii.custom_sku <> p.custom_sku;

UPDATE catalog.order_items oi
SET product_sku = p.custom_sku
FROM catalog.products p
WHERE oi.product_id = p.id
  AND oi.product_sku ~* '^(EDUSA|FLORA|MIMOZA)-'
  AND oi.product_sku <> p.custom_sku;

UPDATE catalog.supplier_sub_order_items soi
SET product_sku = p.custom_sku
FROM catalog.products p
WHERE soi.product_id = p.id
  AND soi.product_sku ~* '^(EDUSA|FLORA|MIMOZA)-'
  AND soi.product_sku <> p.custom_sku;

-- 7. Per-supplier unique index for manual / Excel product codes (SKU)
-- XML feeds remain isolated via uq_product_source(feed_id, source_product_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_brand_manual_supplier_sku
ON catalog.products (brand_id, UPPER(BTRIM(sku)))
WHERE feed_id IS NULL
  AND brand_id IS NOT NULL
  AND sku IS NOT NULL
  AND BTRIM(sku) <> ''
  AND COALESCE(is_archived, false) = false;

CREATE INDEX IF NOT EXISTS idx_products_brand_supplier_sku_lookup
ON catalog.products (brand_id, UPPER(BTRIM(sku)))
WHERE brand_id IS NOT NULL AND sku IS NOT NULL AND BTRIM(sku) <> '';

COMMIT;

-- Refresh storefront materialized view concurrently outside transaction
REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products;
