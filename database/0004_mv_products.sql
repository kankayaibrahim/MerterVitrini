-- =========================================================================
-- CREATE MATERIALIZED VIEW FOR STOREFRONT PRODUCT LISTING OPTIMIZATION
-- =========================================================================

-- 1. Create the Materialized View
CREATE MATERIALIZED VIEW catalog.mv_products AS
SELECT p.id, p.feed_id, p.source_product_id, p.source_product_group_id, p.title, p.slug, p.slug_id, p.custom_sku, 
       p.short_description, p.description, p.brand_id, p.category_id, 
       p.gender, p.season, COALESCE(fab.fabric_name, 'Polyester') as kumas_fabric, p.desi_volume, p.shipping_weight_kg, 
       p.packing_ratio, p.series_ratio, p.minimum_order_quantity, 
       p.price, p.discounted_price, p.single_price, p.buying_price, p.currency, p.tax_rate, COALESCE(col.color_name, 'Standart') as color, p.stock, p.sku, p.barcode,
       p.is_active, 
       p.created_at, p.updated_at, COALESCE(NULLIF(b.alias_code, ''), b.brand_name) as brand_name, c.title as category_title, c.node_path,
       COALESCE(
           (SELECT json_agg(json_build_object('id', img.id, 'product_id', img.product_id, 'image_url', img.image_url, 'sort_order', img.sort_order, 'is_cover', img.is_cover) ORDER BY img.sort_order ASC)
            FROM catalog.product_images img
            WHERE img.product_id = p.id), '[]'::json
       ) as images_json,
       COALESCE(
           (SELECT json_object_agg(t.language_code, json_build_object('title', t.title, 'short_description', t.short_description, 'description', t.description))
            FROM catalog.product_translations t
            WHERE t.product_id = p.id), '{}'::json
       ) as translations_json
FROM catalog.products p
INNER JOIN catalog.brands b ON p.brand_id = b.id AND b.is_active = true
LEFT JOIN catalog.categories c ON p.category_id = c.id
LEFT JOIN catalog.colors col ON p.color_id = col.id
LEFT JOIN catalog.fabrics fab ON p.fabric_id = fab.id
WHERE p.is_active = true;

-- 2. Create Unique Index to allow CONCURRENT REFRESH
CREATE UNIQUE INDEX idx_mv_products_id ON catalog.mv_products (id);

-- 3. Create Additional Indexes for filtering and ordering performance
CREATE INDEX idx_mv_products_brand_id ON catalog.mv_products (brand_id);
CREATE INDEX idx_mv_products_category_id ON catalog.mv_products (category_id);
CREATE INDEX idx_mv_products_slug ON catalog.mv_products (slug);
CREATE INDEX idx_mv_products_slug_id ON catalog.mv_products (slug_id);
CREATE INDEX idx_mv_products_created_at ON catalog.mv_products (created_at DESC);
CREATE INDEX idx_mv_products_node_path_gist ON catalog.mv_products USING gist (node_path);
