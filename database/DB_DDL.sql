-- =========================================================================
-- MERTER VİTRİNİ MASTER DATABASE DDL SCHEMA
-- =========================================================================
-- To recreate the database from scratch, you can run:
-- DROP DATABASE IF EXISTS merterdevdb;
-- CREATE DATABASE merterdevdb ENCODING='UTF-8';

-- 1. Şemaların Sıfırlanması ve Yeniden Oluşturulması (Drop & Recreate)
DROP SCHEMA IF EXISTS identity CASCADE;
DROP SCHEMA IF EXISTS catalog CASCADE;
DROP SCHEMA IF EXISTS integration CASCADE;
DROP SCHEMA IF EXISTS extensions CASCADE;

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS catalog;
CREATE SCHEMA IF NOT EXISTS integration;

-- Uzantıların (Extensions) Kurulması
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS ltree SCHEMA extensions;


-- =========================================================================
-- 2. IDENTITY ŞEMASI (Kullanıcı, Rol, Kimlik Doğrulama)
-- =========================================================================

-- identity.users represents synced user profiles from Keycloak OIDC Provider
CREATE TABLE identity.users (
    id VARCHAR(255) PRIMARY KEY, 
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE, 
    phone VARCHAR(50) NULL,
    user_role VARCHAR(50) NOT NULL DEFAULT 'editor',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    block_reason VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    preferred_lang VARCHAR(10) NULL,
    preferred_currency VARCHAR(10) NULL,
    billing_address TEXT NULL,
    delivery_address TEXT NULL,
    tax_no_tckn VARCHAR(50) NULL,
    instagram_username VARCHAR(100) NULL,
    registration_ip VARCHAR(50) NULL
);

CREATE INDEX idx_users_email ON identity.users(email);

COMMENT ON TABLE identity.users IS 'Keycloak üzerinde kimlik doğrulaması yapılan tüm yöneticiler, bayiler ve personel bilgilerini tutan senkronize kullanıcı tablosu';
COMMENT ON COLUMN identity.users.id IS 'Keycloak OIDC tarafından üretilen kullanıcı ID değeri (örn. f:58ba9c54...)';
COMMENT ON COLUMN identity.users.first_name IS 'Kullanıcının adı';
COMMENT ON COLUMN identity.users.last_name IS 'Kullanıcının soyadı';
COMMENT ON COLUMN identity.users.email IS 'Kullanıcının benzersiz e-posta adresi';
COMMENT ON COLUMN identity.users.phone IS 'Kullanıcının telefon numarası';
COMMENT ON COLUMN identity.users.user_role IS 'Kullanıcının sistemdeki yetki rolü (super_admin, admin, editor, sales_manager, warehouse vb.)';
COMMENT ON COLUMN identity.users.is_active IS 'Kullanıcının aktiflik durumu';
COMMENT ON COLUMN identity.users.is_blocked IS 'Hesabın engellenip engellenmediği';
COMMENT ON COLUMN identity.users.block_reason IS 'Varsa hesap engelleme nedeni';



-- =========================================================================
-- 3. CATALOG ŞEMASI YARDIMCI BİLEŞENLERİ & SIRALAMA SEQUENCELERİ
-- =========================================================================

-- Türkçe karakter duyarlı SEO uyumlu slug üreten fonksiyon
CREATE OR REPLACE FUNCTION catalog.fn_slugify(p_text text)
RETURNS text AS $$
DECLARE
    v_slug text;
END;
$$ LANGUAGE plpgsql;

-- Trigger'ın doğru derlenmesi için fn_slugify gövdesini tanımlayalım
CREATE OR REPLACE FUNCTION catalog.fn_slugify(p_text text)
RETURNS text AS $$
DECLARE
    v_slug text;
BEGIN
    v_slug := lower(p_text);
    v_slug := translate(v_slug, 'ıışşğğüüööccçc', 'iissgguuoocccc');
    v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
    v_slug := regexp_replace(v_slug, '^-|-$', '', 'g');
    RETURN v_slug;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Base36 sequences ve fonksiyonları (Migration V2)
CREATE SEQUENCE IF NOT EXISTS catalog.products_slug_id_seq START WITH 100000;

CREATE OR REPLACE FUNCTION catalog.to_base36(val bigint) RETURNS text AS $$
DECLARE
  chars text := '0123456789abcdefghijklmnopqrstuvwxyz';
  result text := '';
  remainder int;
BEGIN
  IF val = 0 THEN RETURN '0'; END IF;
  WHILE val > 0 LOOP
    remainder := val % 36;
    result := substr(chars, remainder + 1, 1) || result;
    val := val / 36;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- =========================================================================
-- 4. INTEGRATION ŞEMASI & XML YÖNETİMİ
-- =========================================================================

-- Toptancılar tablosu
CREATE TABLE catalog.brands (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    brand_name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(150) NOT NULL UNIQUE,
    alias_code VARCHAR(50) UNIQUE NULL, -- (Migration V2)
    is_active BOOLEAN NOT NULL DEFAULT true, -- (Migration V2)
    website VARCHAR(255) NULL, -- (Migration V3)
    phone VARCHAR(50) NULL, -- (Migration V3)
    addresses JSONB NULL, -- (Migration V3)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION catalog.trig_brand_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := catalog.fn_slugify(NEW.brand_name);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_brand_slug_before
    BEFORE INSERT OR UPDATE OF brand_name
    ON catalog.brands
    FOR EACH ROW
    EXECUTE FUNCTION catalog.trig_brand_slug();

-- XML Feeds tablosu
CREATE TABLE integration.xml_feeds (
    id VARCHAR(50) PRIMARY KEY,
    feed_name VARCHAR(100) NOT NULL,
    alias_code VARCHAR(50) NOT NULL UNIQUE, 
    feed_url VARCHAR(255) NULL,
    brand_id uuid REFERENCES catalog.brands(id) ON DELETE CASCADE, -- (Migration V2)
    is_active BOOLEAN NOT NULL DEFAULT true,
    mapping_config JSONB NULL, -- (Migration V4)
    category_mapping JSONB NULL, -- (Migration V4)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sync runs tablosu
CREATE TABLE integration.sync_runs (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    feed_id VARCHAR(50) NOT NULL REFERENCES integration.xml_feeds(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running', 
    summary JSONB NULL
);


-- =========================================================================
-- 5. CATALOG MASTER ŞEMASI (Kategoriler, Renkler, Kumaşlar, Ürünler)
-- =========================================================================

-- Kategori tablosu
CREATE TABLE catalog.categories (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    parent_id uuid NULL REFERENCES catalog.categories(id) ON DELETE SET NULL, 
    title VARCHAR(100) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    node_path extensions.ltree NOT NULL, 
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_categories_node_path_gist ON catalog.categories USING gist (node_path);
CREATE INDEX idx_categories_parent_id ON catalog.categories(parent_id);

CREATE OR REPLACE FUNCTION catalog.trig_calculate_category_path()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_path text;
    v_clean_id text;
BEGIN
    v_clean_id := replace(NEW.id::text, '-', '');
    IF NEW.parent_id IS NULL THEN
        NEW.node_path := v_clean_id::extensions.ltree;
    ELSE
        SELECT node_path::text INTO v_parent_path 
        FROM catalog.categories 
        WHERE id = NEW.parent_id;
        NEW.node_path := (v_parent_path || '.' || v_clean_id)::extensions.ltree;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig01_calculate_path
    BEFORE INSERT OR UPDATE OF parent_id, id
    ON catalog.categories
    FOR EACH ROW
    EXECUTE FUNCTION catalog.trig_calculate_category_path();

CREATE OR REPLACE FUNCTION catalog.trig_update_category_children_path()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.node_path IS DISTINCT FROM NEW.node_path) THEN
        UPDATE catalog.categories
        SET node_path = NEW.node_path || extensions.subpath(node_path, extensions.nlevel(OLD.node_path))
        WHERE node_path <@ OLD.node_path AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig02_update_children_path
    AFTER UPDATE OF node_path
    ON catalog.categories
    FOR EACH ROW
    EXECUTE FUNCTION catalog.trig_update_category_children_path();

-- Kategori çok dilli çeviri tablosu (Migration V2)
CREATE TABLE catalog.category_translations (
    category_id uuid NOT NULL REFERENCES catalog.categories(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL, 
    title VARCHAR(100) NOT NULL,
    seo_description TEXT NULL,
    PRIMARY KEY (category_id, language_code)
);

CREATE INDEX idx_category_translations_lang ON catalog.category_translations(language_code);

-- Colors master tabloları (Migration V6)
CREATE TABLE catalog.colors (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    color_name VARCHAR(100) NOT NULL UNIQUE, 
    color_code VARCHAR(7) NULL,         
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE catalog.color_translations (
    color_id uuid NOT NULL REFERENCES catalog.colors(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL, 
    color_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (color_id, language_code)
);

CREATE INDEX idx_color_translations_lang ON catalog.color_translations(language_code);

-- Fabrics master tabloları (Migration V7)
CREATE TABLE catalog.fabrics (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    fabric_name VARCHAR(100) NOT NULL UNIQUE, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE catalog.fabric_translations (
    fabric_id uuid NOT NULL REFERENCES catalog.fabrics(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL, 
    fabric_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (fabric_id, language_code)
);

CREATE INDEX idx_fabric_translations_lang ON catalog.fabric_translations(language_code);


-- Ürünler (Products) Tablosu
CREATE TABLE catalog.products (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    feed_id VARCHAR(50) REFERENCES integration.xml_feeds(id) ON DELETE SET NULL,
    source_product_id VARCHAR(100) NOT NULL, 
    source_product_group_id VARCHAR(100) NULL, 
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    slug_id VARCHAR(8) UNIQUE DEFAULT catalog.to_base36(nextval('catalog.products_slug_id_seq')), -- (Migration V2)
    custom_sku VARCHAR(100) NOT NULL UNIQUE, 
    short_description TEXT NULL, 
    description TEXT NULL,       
    brand_id uuid REFERENCES catalog.brands(id) ON DELETE SET NULL,
    category_id uuid REFERENCES catalog.categories(id) ON DELETE SET NULL,
    color_id uuid REFERENCES catalog.colors(id) ON DELETE SET NULL, -- (Migration V9)
    fabric_id uuid REFERENCES catalog.fabrics(id) ON DELETE SET NULL, -- (Migration V9)
    gender VARCHAR(20) NULL,     
    season VARCHAR(50) NULL,     
    desi_volume NUMERIC(10, 2) DEFAULT 0, 
    shipping_weight_kg NUMERIC(10, 3) DEFAULT 0, 
    packing_ratio VARCHAR(100) NULL, 
    series_ratio VARCHAR(100) NULL,  
    minimum_order_quantity INT DEFAULT 1, 
    buying_price NUMERIC(15, 4) NOT NULL DEFAULT 0.00, 
    price NUMERIC(15, 4) NOT NULL DEFAULT 0.00, 
    single_price NUMERIC(15, 4) NULL, 
    discounted_price NUMERIC(15, 4) NULL, 
    currency VARCHAR(10) DEFAULT 'TRY', 
    tax_rate NUMERIC(5, 2) DEFAULT 10.00, 
    stock INT NOT NULL DEFAULT 0, 
    sku VARCHAR(100) NULL, 
    barcode VARCHAR(100) NULL, 
    source_url VARCHAR(512) NULL, 
    is_active BOOLEAN NOT NULL DEFAULT true, 
    last_sync_run_id uuid REFERENCES integration.sync_runs(id) ON DELETE SET NULL, 
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meta_attributes JSONB NULL,      
    
    CONSTRAINT uq_product_source UNIQUE (feed_id, source_product_id)
);

CREATE INDEX idx_products_lookup ON catalog.products(feed_id, source_product_id);
CREATE INDEX idx_products_brand_id ON catalog.products(brand_id);
CREATE INDEX idx_products_category_id ON catalog.products(category_id);
CREATE INDEX idx_products_color_id ON catalog.products(color_id); -- (Migration V9)
CREATE INDEX idx_products_fabric_id ON catalog.products(fabric_id); -- (Migration V9)
CREATE INDEX idx_products_custom_sku ON catalog.products(custom_sku);
CREATE INDEX idx_products_meta_gin ON catalog.products USING gin(meta_attributes);
CREATE UNIQUE INDEX idx_products_slug ON catalog.products(slug);
CREATE INDEX idx_products_slug_id ON catalog.products(slug_id);
CREATE INDEX idx_products_id_text ON catalog.products((id::text));
CREATE INDEX idx_products_active_created_at ON catalog.products(created_at);

CREATE OR REPLACE FUNCTION catalog.trig_product_slug()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.slug_id IS NULL OR NEW.slug_id = '' THEN
        NEW.slug_id := catalog.to_base36(nextval('catalog.products_slug_id_seq'));
    END IF;
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := catalog.fn_slugify(NEW.title);
    END IF;
    IF NOT (NEW.slug LIKE '%' || NEW.slug_id) THEN
        NEW.slug := NEW.slug || '-' || NEW.slug_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_product_slug_before
    BEFORE INSERT OR UPDATE OF title
    ON catalog.products
    FOR EACH ROW
    EXECUTE FUNCTION catalog.trig_product_slug();

CREATE OR REPLACE FUNCTION catalog.trig_product_custom_sku()
RETURNS TRIGGER AS $$
DECLARE
    v_alias VARCHAR(50);
BEGIN
    SELECT alias_code INTO v_alias FROM integration.xml_feeds WHERE id = NEW.feed_id;
    NEW.custom_sku := upper(coalesce(v_alias, 'PROD') || '-' || NEW.slug_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_product_custom_sku_before
    BEFORE INSERT OR UPDATE OF feed_id, source_product_id, custom_sku
    ON catalog.products
    FOR EACH ROW
    EXECUTE FUNCTION catalog.trig_product_custom_sku();

-- Ürün çok dilli çeviri tablosu (Migration V2)
CREATE TABLE catalog.product_translations (
    product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL, 
    title VARCHAR(255) NOT NULL,
    short_description TEXT NULL,
    description TEXT NULL,
    PRIMARY KEY (product_id, language_code)
);

CREATE INDEX idx_product_translations_lang ON catalog.product_translations(language_code);

-- Product Variants (Ürün Varyantları - Renk/Beden Kırılımı)
CREATE TABLE catalog.product_variants (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    variant_size VARCHAR(50) NOT NULL,
    barcode VARCHAR(100) NULL,
    stock INT NOT NULL DEFAULT 0,
    is_single BOOLEAN NOT NULL DEFAULT false,
    source_variant_id VARCHAR(100) NOT NULL,
    custom_sku VARCHAR(100) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_sync_run_id uuid REFERENCES integration.sync_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_variant_source UNIQUE (product_id, source_variant_id)
);

CREATE INDEX idx_variants_lookup ON catalog.product_variants(product_id, source_variant_id);
CREATE INDEX idx_variants_custom_sku ON catalog.product_variants(custom_sku);
CREATE INDEX idx_variants_barcode ON catalog.product_variants(barcode);

CREATE OR REPLACE FUNCTION catalog.trig_variant_custom_sku()
RETURNS TRIGGER AS $$
DECLARE
    v_prod_sku VARCHAR(100);
    v_suffix VARCHAR(50);
BEGIN
    SELECT custom_sku INTO v_prod_sku FROM catalog.products WHERE id = NEW.product_id;
    
    IF NEW.custom_sku IS NULL OR NEW.custom_sku = '' THEN
        IF NEW.variant_size IS NOT NULL AND NEW.variant_size != '' THEN
            v_suffix := catalog.fn_slugify(NEW.variant_size);
        ELSE
            v_suffix := regexp_replace(NEW.source_variant_id, '[^a-zA-Z0-9]+', '', 'g');
        END IF;
        
        IF NEW.is_single THEN
            v_suffix := v_suffix || '-single';
        END IF;
        
        NEW.custom_sku := upper(coalesce(v_prod_sku, 'VAR') || '-' || v_suffix);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trig_variant_custom_sku_before
    BEFORE INSERT OR UPDATE OF product_id, variant_size, custom_sku
    ON catalog.product_variants
    FOR EACH ROW
    EXECUTE FUNCTION catalog.trig_variant_custom_sku();

-- Product Images (Ürün Görselleri)
CREATE TABLE catalog.product_images (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    image_url VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 0,
    is_cover BOOLEAN DEFAULT false,
    original_size_bytes BIGINT NULL, -- (Migration V8)
    optimized_size_bytes BIGINT NULL, -- (Migration V8)
    is_optimized BOOLEAN NOT NULL DEFAULT false, -- (Migration V8)
    optimized_at TIMESTAMP WITH TIME ZONE NULL, -- (Migration V8)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_product_images_product_id ON catalog.product_images(product_id);

-- Ürün özellikleri tabloları (Migration V5)
CREATE TABLE catalog.attributes (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    attribute_name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE catalog.attribute_translations (
    attribute_id uuid NOT NULL REFERENCES catalog.attributes(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    attribute_name VARCHAR(100) NOT NULL,
    PRIMARY KEY (attribute_id, language_code)
);

CREATE TABLE catalog.attribute_values (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    attribute_id uuid NOT NULL REFERENCES catalog.attributes(id) ON DELETE CASCADE,
    attribute_value VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_attribute_id_value UNIQUE (attribute_id, attribute_value)
);

CREATE TABLE catalog.attribute_value_translations (
    attribute_value_id uuid NOT NULL REFERENCES catalog.attribute_values(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    attribute_value VARCHAR(255) NOT NULL,
    PRIMARY KEY (attribute_value_id, language_code)
);

CREATE TABLE catalog.product_attributes_map (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    attribute_value_id uuid NOT NULL REFERENCES catalog.attribute_values(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_product_attribute_value UNIQUE (product_id, attribute_value_id)
);

CREATE INDEX idx_pam_product_id ON catalog.product_attributes_map(product_id);


-- =========================================================================
-- 5b. COĞRAFİ VE ÜLKE TANIMLARI TABLOLARI
-- =========================================================================

CREATE TABLE catalog.country_groups (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    localized_names JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE catalog.countries (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    phone_code INT,
    localized_names JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE catalog.country_states (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    country_id uuid REFERENCES catalog.countries(id) ON DELETE CASCADE NOT NULL,
    code VARCHAR(50) NOT NULL,
    state_name VARCHAR(150) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE catalog.country_group_memberships (
    country_id uuid REFERENCES catalog.countries(id) ON DELETE CASCADE,
    group_id uuid REFERENCES catalog.country_groups(id) ON DELETE CASCADE,
    PRIMARY KEY (country_id, group_id)
);

CREATE TABLE catalog.currencies (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    currency_code VARCHAR(10) UNIQUE NOT NULL,
    symbol VARCHAR(10) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE catalog.languages (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    flag VARCHAR(10) NOT NULL,
    category_prefix VARCHAR(10) NOT NULL,
    text_direction VARCHAR(10) NOT NULL DEFAULT 'ltr',
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);


-- =========================================================================
-- 5c. HUKUKİ SÖZLEŞMELER VE VERSİYONLAMA TABLOLARI
-- =========================================================================

CREATE TYPE catalog.policy_type AS ENUM ('cancellation_and_return', 'terms_of_service', 'privacy_policy');

CREATE TABLE catalog.legal_policies (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    policy_type catalog.policy_type NOT NULL,
    policy_version INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    created_by uuid REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_policy_type_version UNIQUE (policy_type, policy_version)
);

CREATE INDEX idx_legal_policies_lookup ON catalog.legal_policies(policy_type, is_active);


-- =========================================================================
-- 5d. DİNAMİK STATİK SAYFALAR (CMS) TABLOLARI
-- =========================================================================

CREATE TABLE catalog.pages (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    slug VARCHAR(150) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE catalog.page_translations (
    page_id uuid REFERENCES catalog.pages(id) ON DELETE CASCADE NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    meta_title VARCHAR(255) NULL,
    meta_description TEXT NULL,
    PRIMARY KEY (page_id, language_code)
);

CREATE INDEX idx_pages_is_active ON catalog.pages(is_active);


-- =========================================================================
-- 5e. GÜNCEL DÖVİZ KURLARI (EXCHANGE RATES) TABLOSU
-- =========================================================================

CREATE TABLE catalog.exchange_rates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    currency_code VARCHAR(10) NOT NULL,
    buying_rate NUMERIC NOT NULL,
    selling_rate NUMERIC NOT NULL,
    publication_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX unique_currency_date ON catalog.exchange_rates (currency_code, publication_date);
CREATE INDEX idx_exchange_rates_currency_date ON catalog.exchange_rates (currency_code, publication_date DESC);


-- =========================================================================
-- 5f. AI ÜRÜN İÇERİĞİ VE SEO ÖNBELLEĞİ (PRODUCT AI CONTENT) TABLOSU
-- =========================================================================

CREATE TABLE catalog.product_ai_content (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id uuid REFERENCES catalog.products(id) ON DELETE CASCADE,
    ai_engine VARCHAR(100) NOT NULL,
    content_hash VARCHAR(255) NOT NULL,
    original_title VARCHAR(255) NULL,
    original_description TEXT NULL,
    original_fabric VARCHAR(255) NULL,
    original_gender VARCHAR(255) NULL,
    seo_title VARCHAR(255) NULL,
    seo_description TEXT NULL,
    meta_title VARCHAR(255) NULL,
    meta_description TEXT NULL,
    tags JSONB NULL,
    highlights JSONB NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE UNIQUE INDEX unique_content_ai ON catalog.product_ai_content (content_hash, ai_engine);


-- =========================================================================
-- 5g. SİSTEM AYARLARI (SETTINGS) TABLOSU
-- =========================================================================

CREATE TABLE catalog.settings (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    address TEXT NOT NULL,
    phone VARCHAR(50) NOT NULL,
    whatsapp VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    singleton_guard BOOLEAN DEFAULT true,
    show_single_price BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT settings_singleton_guard_key UNIQUE (singleton_guard)
);


-- =========================================================================
-- 5h. B2B SEPET VE TALEP FORMLARI (STORE INQUIRIES & ITEMS) TABLOLARI
-- =========================================================================

CREATE TABLE catalog.store_inquiries (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    company VARCHAR(150) NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(150) NOT NULL,
    message TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE catalog.store_inquiry_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    inquiry_id uuid NOT NULL REFERENCES catalog.store_inquiries(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    custom_sku VARCHAR(100) NOT NULL,
    quantity INT NOT NULL,
    price NUMERIC NOT NULL
);



-- =========================================================================
-- 5i. ÇOK DİLLİ BLOG TABLOLARI
-- =========================================================================

CREATE TABLE catalog.blog_posts (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    slug VARCHAR(150) NOT NULL UNIQUE,
    cover_image VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE catalog.blog_post_translations (
    post_id uuid REFERENCES catalog.blog_posts(id) ON DELETE CASCADE NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NULL,
    content TEXT NOT NULL,
    meta_title VARCHAR(255) NULL,
    meta_description TEXT NULL,
    PRIMARY KEY (post_id, language_code)
);

CREATE INDEX idx_blog_post_translations_lang ON catalog.blog_post_translations(language_code);
CREATE INDEX idx_blog_posts_is_active ON catalog.blog_posts(is_active);



-- =========================================================================
-- 6. DATA SEEDING (Toptancı ve XML Bağlantısı Kayıtları)
-- =========================================================================

-- Toptancılar gerçek adları ve ön yüz maske kodları (Alias) ile kuruluyor
INSERT INTO catalog.brands (id, brand_name, slug, alias_code, is_active) VALUES
('019e620f-2ca6-774c-9450-6c69015045a1', 'Lustrin Toptan Tekstil', 'lustrin-toptan-tekstil', 'MIMOZA', true),
('019e620f-2ca6-774c-9450-6c69015045a2', 'Etika Fashion Toptan', 'etika-fashion-toptan', 'FLORA', true),
('019e620f-2ca6-774c-9450-6c69015045a3', 'Black Fashion Toptan Tekstil', 'black-fashion-toptan-tekstil', 'NOIR', true),
('019e620f-2ca6-774c-9450-6c69015045a4', 'Jane''s Toptan Tekstil', 'janes-toptan-tekstil', 'EDUSA', true)
ON CONFLICT (id) DO UPDATE SET brand_name = EXCLUDED.brand_name, alias_code = EXCLUDED.alias_code;

-- XML feeds default konfigürasyonları ekleniyor
INSERT INTO integration.xml_feeds (id, feed_name, alias_code, feed_url, is_active, brand_id, mapping_config, category_mapping) VALUES
('lustrin', 'Lustrin Toptan Tekstil', 'MIMOZA', NULL, true, '019e620f-2ca6-774c-9450-6c69015045a1', NULL, NULL),
('etika', 'Etika Fashion Toptan', 'FLORA', NULL, true, '019e620f-2ca6-774c-9450-6c69015045a2', NULL, NULL),
('blackfashion', 'Black Fashion Toptan Tekstil', 'NOIR', NULL, true, '019e620f-2ca6-774c-9450-6c69015045a3', NULL, NULL),
('janes', 'elbise', 'EDUSA', 'https://janestoptan.net/production/xml/janestoptanxmltr', true, '019e620f-2ca6-774c-9450-6c69015045a4', '{"parser_type": "python_script", "python_script": "parsers/janes.py"}', NULL)
ON CONFLICT (id) DO UPDATE SET 
    feed_name = EXCLUDED.feed_name, 
    alias_code = EXCLUDED.alias_code, 
    feed_url = EXCLUDED.feed_url, 
    brand_id = EXCLUDED.brand_id,
    mapping_config = COALESCE(EXCLUDED.mapping_config, integration.xml_feeds.mapping_config);


-- =========================================================================
-- 7. MATERIALIZED VIEWS (Storefront Product Listing Optimization)
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