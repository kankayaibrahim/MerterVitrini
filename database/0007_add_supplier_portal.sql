-- Migration 0007: Supplier Portal & Supplier User Management

CREATE TABLE IF NOT EXISTS catalog.supplier_users (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_users_brand_id ON catalog.supplier_users(brand_id);
CREATE INDEX IF NOT EXISTS idx_supplier_users_email ON catalog.supplier_users(email);

COMMENT ON TABLE catalog.supplier_users IS 'Tedarikçilerin kendi ürünlerini yönetmek için kullandığı yetkili kullanıcı hesapları';

-- Gelişmiş Custom SKU Tetikleyicisi: Manuel tedarikçi girişlerinde brand alias_code kullanılır
CREATE OR REPLACE FUNCTION catalog.trig_product_custom_sku()
RETURNS TRIGGER AS $$
DECLARE
    v_alias VARCHAR(50);
BEGIN
    IF NEW.feed_id IS NOT NULL THEN
        SELECT alias_code INTO v_alias FROM integration.xml_feeds WHERE id = NEW.feed_id;
    END IF;
    
    IF (v_alias IS NULL OR v_alias = '') AND NEW.brand_id IS NOT NULL THEN
        SELECT alias_code INTO v_alias FROM catalog.brands WHERE id = NEW.brand_id;
    END IF;

    NEW.custom_sku := upper(coalesce(v_alias, 'PROD') || '-' || NEW.slug_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
