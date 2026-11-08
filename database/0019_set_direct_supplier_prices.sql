-- Migration 0019: Remove +20% platform markup and set product prices to exact supplier prices (buying_price)
-- Aligns existing catalog products with PROFIT_RATE = 0.0 (Direct Supplier Price standard)

BEGIN;

UPDATE catalog.products
SET price = buying_price,
    discounted_price = CASE
        WHEN discounted_price IS NOT NULL THEN buying_price
        ELSE NULL
    END,
    updated_at = CURRENT_TIMESTAMP
WHERE buying_price > 0
  AND price != buying_price;

ALTER TABLE IF EXISTS catalog.b2b_api_keys
    ALTER COLUMN margin_rate SET DEFAULT 1.00;

COMMIT;

REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products;

