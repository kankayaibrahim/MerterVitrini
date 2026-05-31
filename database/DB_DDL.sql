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

-- Rol Yönetimi İçin Enum Tipi
CREATE TYPE identity.user_role AS ENUM ('super_admin', 'admin', 'editor', 'sales_manager', 'warehouse');
COMMENT ON TYPE identity.user_role IS 'Sistemdeki kullanıcı rolleri ve yetkilendirme seviyeleri';

CREATE TYPE identity.otp_purpose AS ENUM ('login_verification', 'password_reset', 'critical_action');
COMMENT ON TYPE identity.otp_purpose IS 'Tek kullanımlık şifrelerin (OTP) oluşturulma amaçları';

CREATE DOMAIN identity.email_address AS VARCHAR(150)
CHECK (
    VALUE ~* '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$'
);
COMMENT ON DOMAIN identity.email_address IS 'RFC 5322 standartlarına uygun e-posta formatı doğrulama domaini';

CREATE TABLE identity.users (
    id uuid DEFAULT uuidv7() PRIMARY KEY, 
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email identity.email_address NOT NULL UNIQUE, 
    password_hash VARCHAR(255) NOT NULL,
    user_role identity.user_role NOT NULL DEFAULT 'editor',
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    block_reason VARCHAR(255) NULL,
    last_login_at TIMESTAMP WITH TIME ZONE NULL,
    last_login_ip VARCHAR(45) NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON identity.users(email);

COMMENT ON TABLE identity.users IS 'Sistemdeki tüm yöneticiler, editörler ve diğer personel bilgilerini tutan ana kullanıcılar tablosu';
COMMENT ON COLUMN identity.users.id IS 'Kullanıcının benzersiz kimliği (UUIDv7 formatında, zamana göre sıralı)';
COMMENT ON COLUMN identity.users.first_name IS 'Kullanıcının adı';
COMMENT ON COLUMN identity.users.last_name IS 'Kullanıcının soyadı';
COMMENT ON COLUMN identity.users.email IS 'Kullanıcının doğrulanmış benzersiz e-posta adresi';
COMMENT ON COLUMN identity.users.password_hash IS 'Kullanıcının bcrypt ile hashlenmiş şifre verisi';
COMMENT ON COLUMN identity.users.role IS 'Kullanıcının sistemdeki yetki rolü';
COMMENT ON COLUMN identity.users.is_active IS 'Kullanıcının aktiflik durumu (aktif/pasif)';
COMMENT ON COLUMN identity.users.is_blocked IS 'Kullanıcının hesabının engellenip engellenmediği durumu';
COMMENT ON COLUMN identity.users.failed_login_attempts IS 'Üst üste yapılan başarısız giriş denemesi sayısı';
COMMENT ON COLUMN identity.users.block_reason IS 'Hesap engellendiyse gerekçesi';
COMMENT ON COLUMN identity.users.last_login_at IS 'Son başarılı giriş yapılan zaman damgası';
COMMENT ON COLUMN identity.users.last_login_ip IS 'Son başarılı giriş yapılan IP adresi';

CREATE OR REPLACE PROCEDURE identity.sp_create_user(
    p_first_name VARCHAR(50),
    p_last_name VARCHAR(50),
    p_email identity.email_address,
    p_plain_password VARCHAR(100),
    p_role identity.user_role DEFAULT 'editor'
)
LANGUAGE plpgsql
AS $$
DECLARE
    hashed_password VARCHAR(255);
BEGIN
    hashed_password := extensions.crypt(p_plain_password, extensions.gen_salt('bf', 10));

    INSERT INTO identity.users (
        id, first_name, last_name, email, password_hash, user_role, is_active, is_blocked, failed_login_attempts
    ) VALUES (
        uuidv7(), p_first_name, p_last_name, p_email, hashed_password, p_role, true, false, 0
    );
END;
$$;

CALL identity.sp_create_user(
    '__SYSTEM__', 
    'ADMIN', 
    'system@toptantekstil.com', 
    'Admin123!*', 
    'super_admin'
);

CREATE TABLE identity.user_otps (
    id uuid DEFAULT uuidv7() PRIMARY KEY, 
    user_id uuid NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    otp_code VARCHAR(6) NOT NULL,
    purpose identity.otp_purpose NOT NULL DEFAULT 'login_verification',
    is_used BOOLEAN NOT NULL DEFAULT false,
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    used_at TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX idx_user_otps_lookup ON identity.user_otps(user_id, otp_code) WHERE is_used = false;
CREATE INDEX idx_user_otps_expiry ON identity.user_otps(expires_at) WHERE is_used = false;

COMMENT ON TABLE identity.user_otps IS 'Kullanıcıların giriş ve şifre sıfırlama gibi işlemleri için tek kullanımlık şifre (OTP) kayıtları';

CREATE OR REPLACE FUNCTION identity.fn_generate_otp(
    p_user_id uuid,
    p_purpose identity.otp_purpose DEFAULT 'login_verification'
)
RETURNS VARCHAR(6) 
LANGUAGE plpgsql
AS $$
DECLARE
    v_generated_code VARCHAR(6);
    v_random_value INT;
BEGIN
    UPDATE identity.user_otps
    SET is_used = true, used_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id AND is_used = false AND purpose = p_purpose;

    v_random_value := abs(('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::int);
    v_generated_code := ((v_random_value % 900000) + 100000)::VARCHAR(6);

    INSERT INTO identity.user_otps (
        id, user_id, otp_code, purpose, is_used, attempt_count, max_attempts, expires_at
    ) VALUES (
        uuidv7(), p_user_id, v_generated_code, p_purpose, false, 0, 3, CURRENT_TIMESTAMP + INTERVAL '3 minutes'
    );

    RETURN v_generated_code;
END;
$$;

CREATE OR REPLACE FUNCTION identity.fn_verify_otp(
    p_user_id uuid,
    p_otp_code VARCHAR(6),
    p_purpose identity.otp_purpose DEFAULT 'login_verification'
)
RETURNS BOOLEAN 
LANGUAGE plpgsql
AS $$
DECLARE
    v_otp_id uuid;
    v_attempt_count INT;
    v_max_attempts INT;
    v_correct_code VARCHAR(6);
BEGIN
    SELECT id, otp_code, attempt_count, max_attempts
    INTO v_otp_id, v_correct_code, v_attempt_count, v_max_attempts
    FROM identity.user_otps
    WHERE user_id = p_user_id 
      AND purpose = p_purpose 
      AND is_used = false 
      AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_otp_id IS NULL THEN
        RETURN false;
    END IF;

    IF v_correct_code = p_otp_code THEN
        UPDATE identity.user_otps
        SET is_used = true, used_at = CURRENT_TIMESTAMP
        WHERE id = v_otp_id;
        RETURN true;
    ELSE
        v_attempt_count := v_attempt_count + 1;
        IF v_attempt_count >= v_max_attempts THEN
            UPDATE identity.user_otps
            SET attempt_count = v_attempt_count, is_used = true, used_at = CURRENT_TIMESTAMP
            WHERE id = v_otp_id;
        ELSE
            UPDATE identity.user_otps
            SET attempt_count = v_attempt_count
            WHERE id = v_otp_id;
        END IF;
        RETURN false;
    END IF;
END;
$$;


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
    kumas_fabric VARCHAR(100) NULL, 
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
    color VARCHAR(50) NULL, 
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

CREATE TABLE identity.policy_acceptances (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    user_id uuid NOT NULL,
    policy_id uuid REFERENCES catalog.legal_policies(id) ON DELETE CASCADE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    user_agent VARCHAR(255) NOT NULL
);

CREATE INDEX idx_legal_policies_lookup ON catalog.legal_policies(policy_type, is_active);
CREATE INDEX idx_policy_acceptances_user ON identity.policy_acceptances(user_id, policy_id);



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