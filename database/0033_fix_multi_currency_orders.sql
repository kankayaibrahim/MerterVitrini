-- Migration 0033: Multi-Currency Order Storage, Sub-Order Currency Integrity & Historical Backfill
-- Ensures catalog.orders, catalog.order_items, catalog.supplier_sub_order_items,
-- and catalog.payment_notifications preserve exact original currencies alongside
-- TCMB TRY equivalents and per-currency breakdown totals.

ALTER TABLE catalog.orders
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
    ADD COLUMN IF NOT EXISTS customer_currency VARCHAR(10) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_total_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS total_amount_try NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS currency_totals JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE catalog.order_items
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY';

ALTER TABLE catalog.supplier_sub_order_items
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY';

ALTER TABLE catalog.payment_notifications
    ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) DEFAULT 'PENDING',
    ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'TRY';

-- 1. Backfill order_items.currency from products.currency where order_items defaulted to TRY
UPDATE catalog.order_items oi
SET currency = CASE
    WHEN UPPER(TRIM(COALESCE(p.currency, 'TRY'))) IN ('TL', '') THEN 'TRY'
    ELSE UPPER(TRIM(p.currency))
END
FROM catalog.products p
WHERE oi.product_id = p.id
  AND UPPER(TRIM(COALESCE(oi.currency, 'TRY'))) IN ('TRY', 'TL', '')
  AND UPPER(TRIM(COALESCE(p.currency, 'TRY'))) NOT IN ('TRY', 'TL', '');

-- 2. Backfill supplier_sub_order_items.currency from products.currency
UPDATE catalog.supplier_sub_order_items soi
SET currency = CASE
    WHEN UPPER(TRIM(COALESCE(p.currency, 'TRY'))) IN ('TL', '') THEN 'TRY'
    ELSE UPPER(TRIM(p.currency))
END
FROM catalog.products p
WHERE soi.product_id = p.id
  AND UPPER(TRIM(COALESCE(soi.currency, 'TRY'))) IN ('TRY', 'TL', '')
  AND UPPER(TRIM(COALESCE(p.currency, 'TRY'))) NOT IN ('TRY', 'TL', '');

-- 3. Backfill single-currency supplier_sub_orders.currency when sub-order defaulted to TRY
WITH sub_curr AS (
    SELECT soi.sub_order_id,
           COUNT(DISTINCT CASE
               WHEN UPPER(TRIM(COALESCE(soi.currency, 'TRY'))) IN ('TL', '') THEN 'TRY'
               ELSE UPPER(TRIM(soi.currency))
           END) AS cnt,
           MIN(CASE
               WHEN UPPER(TRIM(COALESCE(soi.currency, 'TRY'))) IN ('TL', '') THEN 'TRY'
               ELSE UPPER(TRIM(soi.currency))
           END) AS curr
    FROM catalog.supplier_sub_order_items soi
    GROUP BY soi.sub_order_id
)
UPDATE catalog.supplier_sub_orders so
SET currency = LEFT(sc.curr, 3)
FROM sub_curr sc
WHERE so.id = sc.sub_order_id
  AND sc.cnt = 1
  AND sc.curr <> 'TRY'
  AND UPPER(COALESCE(so.currency, 'TRY')) = 'TRY';

-- 4. Keep matching supplier_ledger rows aligned with repaired supplier_sub_orders
UPDATE catalog.supplier_ledger sl
SET currency = so.currency
FROM catalog.supplier_sub_orders so
WHERE sl.sub_order_id = so.id
  AND UPPER(COALESCE(sl.currency, 'TRY')) = 'TRY'
  AND UPPER(COALESCE(so.currency, 'TRY')) <> 'TRY';

-- 5. Recompute currency_totals, total_amount_try, currency, total_amount, customer_currency, customer_total_amount
WITH latest_rates AS (
    SELECT DISTINCT ON (UPPER(TRIM(currency_code)))
           UPPER(TRIM(currency_code)) AS code,
           buying_rate::numeric AS rate
    FROM catalog.exchange_rates
    WHERE buying_rate > 0
    ORDER BY UPPER(TRIM(currency_code)), publication_date DESC, updated_at DESC
),
item_curr_sums AS (
    SELECT oi.order_id,
           CASE
               WHEN UPPER(TRIM(COALESCE(oi.currency, 'TRY'))) IN ('TL', '') THEN 'TRY'
               ELSE UPPER(TRIM(oi.currency))
           END AS curr,
           ROUND(SUM(oi.price_at_purchase * oi.quantity)::numeric, 2) AS curr_sum
    FROM catalog.order_items oi
    GROUP BY oi.order_id, 2
),
order_agg AS (
    SELECT ics.order_id,
           jsonb_object_agg(ics.curr, ics.curr_sum) AS currency_totals,
           COUNT(*)::int AS curr_count,
           MIN(ics.curr) AS single_curr,
           SUM(ics.curr_sum)::numeric(14,2) AS single_sum,
           ROUND(SUM(
               ics.curr_sum * CASE
                   WHEN ics.curr = 'TRY' THEN 1.0
                   WHEN lr.rate IS NOT NULL AND lr.rate > 0 THEN lr.rate
                   WHEN ics.curr = 'USD' THEN 44.0
                   WHEN ics.curr = 'EUR' THEN 48.0
                   WHEN ics.curr = 'GBP' THEN 56.0
                   WHEN ics.curr = 'RUB' THEN 0.48
                   ELSE 1.0
               END
           )::numeric, 2) AS calc_try
    FROM item_curr_sums ics
    LEFT JOIN latest_rates lr ON lr.code = ics.curr
    GROUP BY ics.order_id
)
UPDATE catalog.orders o
SET currency = CASE WHEN agg.curr_count = 1 THEN agg.single_curr ELSE 'TRY' END,
    total_amount = CASE WHEN agg.curr_count = 1 THEN agg.single_sum ELSE agg.calc_try END,
    total_amount_try = agg.calc_try,
    currency_totals = agg.currency_totals,
    customer_currency = CASE
        WHEN NULLIF(TRIM(COALESCE(o.customer_currency, '')), '') IS NOT NULL THEN
            CASE WHEN UPPER(TRIM(o.customer_currency)) = 'TL' THEN 'TRY' ELSE UPPER(TRIM(o.customer_currency)) END
        WHEN agg.curr_count = 1 THEN agg.single_curr
        ELSE 'TRY'
    END,
    customer_total_amount = CASE
        WHEN agg.curr_count = 1 AND (NULLIF(TRIM(COALESCE(o.customer_currency, '')), '') IS NULL OR UPPER(TRIM(o.customer_currency)) = agg.single_curr)
            THEN agg.single_sum
        ELSE agg.calc_try
    END
FROM order_agg agg
WHERE o.id = agg.order_id
  AND o.currency_totals = '{}'::jsonb;

-- 6. Backfill payment_notifications.currency from repaired orders
UPDATE catalog.payment_notifications pn
SET currency = o.currency
FROM catalog.orders o
WHERE pn.order_id = o.id
  AND UPPER(COALESCE(pn.currency, 'TRY')) = 'TRY'
  AND UPPER(COALESCE(o.currency, 'TRY')) <> 'TRY';
