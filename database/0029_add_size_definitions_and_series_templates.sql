-- =========================================================================
-- 0029_add_size_definitions_and_series_templates.sql
-- Merter Vitrini B2B E-Ticaret Platformu
-- Standart Beden Tanım Tablosu, Hazır Toptan Seri Şablonları ve Tahmini Seri Stoğu
-- =========================================================================

CREATE TABLE IF NOT EXISTS catalog.size_definitions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    code VARCHAR(32) NOT NULL,
    label VARCHAR(64) NOT NULL,
    size_group VARCHAR(32) NOT NULL DEFAULT 'letter',
    sort_order INT NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_size_definitions_group_code UNIQUE (size_group, code)
);

CREATE INDEX IF NOT EXISTS idx_size_definitions_active_order
    ON catalog.size_definitions (is_active, size_group, sort_order);

CREATE TABLE IF NOT EXISTS catalog.series_templates (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    template_key VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    category_hint VARCHAR(80) NOT NULL DEFAULT 'Genel',
    sizes TEXT[] NOT NULL,
    series_ratio VARCHAR(50) NOT NULL DEFAULT '1-1-1-1',
    units_per_series INT NOT NULL DEFAULT 4,
    sort_order INT NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_series_templates_active_order
    ON catalog.series_templates (is_active, sort_order);

ALTER TABLE catalog.products
    ADD COLUMN IF NOT EXISTS series_stock INT NOT NULL DEFAULT 100;

COMMENT ON TABLE catalog.size_definitions IS 'Tedarikçilerin serbest metin yazmadan yalnızca seçerek kullanabileceği standart B2B beden tanımları';
COMMENT ON TABLE catalog.series_templates IS 'Merter toptan tekstil hazır seri/asorti paket şablonları';
COMMENT ON COLUMN catalog.products.series_stock IS 'Tedarikçinin elindeki tahmini hazır seri paket sayısı (varsayılan: 100 seri)';

-- 1. Standart Beden Tanımları (Seed)
INSERT INTO catalog.size_definitions (code, label, size_group, sort_order) VALUES
    -- Harf Bedenler (letter)
    ('XS', 'XS', 'letter', 10),
    ('S', 'S', 'letter', 20),
    ('M', 'M', 'letter', 30),
    ('L', 'L', 'letter', 40),
    ('XL', 'XL', 'letter', 50),
    ('2XL', '2XL', 'letter', 60),
    ('3XL', '3XL', 'letter', 70),
    ('4XL', '4XL', 'letter', 80),
    ('5XL', '5XL', 'letter', 90),
    -- İkili / Esnek Triko Bedenler (combo)
    ('S-M', 'S-M', 'combo', 110),
    ('M-L', 'M-L', 'combo', 120),
    ('L-XL', 'L-XL', 'combo', 130),
    ('2XL-3XL', '2XL-3XL', 'combo', 140),
    ('4XL-5XL', '4XL-5XL', 'combo', 150),
    -- Sayısal Giyim Bedenleri (numeric_eu)
    ('34', '34', 'numeric_eu', 210),
    ('36', '36', 'numeric_eu', 220),
    ('38', '38', 'numeric_eu', 230),
    ('40', '40', 'numeric_eu', 240),
    ('42', '42', 'numeric_eu', 250),
    ('44', '44', 'numeric_eu', 260),
    ('46', '46', 'numeric_eu', 270),
    ('48', '48', 'numeric_eu', 280),
    ('50', '50', 'numeric_eu', 290),
    ('52', '52', 'numeric_eu', 300),
    ('54', '54', 'numeric_eu', 310),
    -- Kot / Pantolon Bedenleri (jeans)
    ('26', '26', 'jeans', 410),
    ('27', '27', 'jeans', 420),
    ('28', '28', 'jeans', 430),
    ('29', '29', 'jeans', 440),
    ('30', '30', 'jeans', 450),
    ('31', '31', 'jeans', 460),
    ('32', '32', 'jeans', 470),
    ('33', '33', 'jeans', 480),
    ('34', '34', 'jeans', 490),
    ('36', '36', 'jeans', 500),
    ('38', '38', 'jeans', 510),
    -- Çocuk Yaş Grupları (kids)
    ('2-3 YAŞ', '2-3 Yaş', 'kids', 610),
    ('3-4 YAŞ', '3-4 Yaş', 'kids', 620),
    ('4-5 YAŞ', '4-5 Yaş', 'kids', 630),
    ('5-6 YAŞ', '5-6 Yaş', 'kids', 640),
    ('7-8 YAŞ', '7-8 Yaş', 'kids', 650),
    ('9-10 YAŞ', '9-10 Yaş', 'kids', 660),
    ('11-12 YAŞ', '11-12 Yaş', 'kids', 670),
    ('13-14 YAŞ', '13-14 Yaş', 'kids', 680),
    -- Ayakkabı Bedenleri (shoes)
    ('36', '36', 'shoes', 710),
    ('37', '37', 'shoes', 720),
    ('38', '38', 'shoes', 730),
    ('39', '39', 'shoes', 740),
    ('40', '40', 'shoes', 750),
    ('41', '41', 'shoes', 760),
    ('42', '42', 'shoes', 770),
    ('43', '43', 'shoes', 780),
    ('44', '44', 'shoes', 790),
    -- Standart Tek Beden (standard)
    ('STD', 'Standart (Tek Beden)', 'standard', 900)
ON CONFLICT (size_group, code) DO NOTHING;

-- 2. Hazır Toptan Seri Şablonları (Seed)
INSERT INTO catalog.series_templates (template_key, name, category_hint, sizes, series_ratio, units_per_series, sort_order) VALUES
    ('s_m_l_xl_4', 'S - M - L - XL (4''lü Seri)', 'Üst Giyim / Elbise', ARRAY['S','M','L','XL'], '1-1-1-1', 4, 10),
    ('s_m_l_3', 'S - M - L (3''lü Seri)', 'Üst Giyim / Takım', ARRAY['S','M','L'], '1-1-1', 3, 20),
    ('s_m_l_xl_6_assort', 'S - M - L - XL (6''lı Asorti 1-2-2-1)', 'Toptan Hızlı Seri', ARRAY['S','M','L','XL'], '1-2-2-1', 6, 30),
    ('s_m_l_6_double', 'S - M - L (6''lı Çift Seri 2-2-2)', 'Triko / Sweatshirt', ARRAY['S','M','L'], '2-2-2', 6, 40),
    ('m_l_xl_2xl_4', 'M - L - XL - 2XL (4''lü Seri)', 'Rahat Kalıp / Erkek', ARRAY['M','L','XL','2XL'], '1-1-1-1', 4, 50),
    ('sm_lxl_4', 'S-M / L-XL (4''lü Esnek Seri)', 'Triko / İkili Kalıp', ARRAY['S-M','L-XL'], '2-2', 4, 60),
    ('sm_lxl_2xl3xl_6', 'S-M / L-XL / 2XL-3XL (6''lı Seri)', 'Elbise / Takım', ARRAY['S-M','L-XL','2XL-3XL'], '2-2-2', 6, 70),
    ('eu_36_42_4', '36 - 38 - 40 - 42 (4''lü Kadın Seri)', 'Abiye / Elbise / Ceket', ARRAY['36','38','40','42'], '1-1-1-1', 4, 80),
    ('eu_36_44_5', '36 - 38 - 40 - 42 - 44 (5''li Seri)', 'Kadın Giyim', ARRAY['36','38','40','42','44'], '1-1-1-1-1', 5, 90),
    ('plus_42_48_4', '42 - 44 - 46 - 48 (4''lü Büyük Beden)', 'Büyük Beden', ARRAY['42','44','46','48'], '1-1-1-1', 4, 100),
    ('jeans_28_36_5', '28 - 30 - 32 - 34 - 36 (5''li Jean Seri)', 'Kot / Pantolon', ARRAY['28','30','32','34','36'], '1-1-1-1-1', 5, 110),
    ('std_single_1', 'Standart Tek Beden (STD)', 'Şal / Aksesuar / Oversize', ARRAY['STD'], '1', 1, 120)
ON CONFLICT (template_key) DO NOTHING;

