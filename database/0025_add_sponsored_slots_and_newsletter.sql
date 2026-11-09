-- ============================================================================
-- Migration: 0025_add_sponsored_slots_and_newsletter.sql
-- Purpose  : Bölüm 6 — Sponsorlu Vitrin & Reklam Yönetimi (Sponsored Slots)
--            ve İzinli B2B E-Bülten (Newsletter Subscribers & Campaigns)
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog.sponsored_slots (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    placement VARCHAR(64) NOT NULL DEFAULT 'home_featured_suppliers',
    brand_id UUID REFERENCES catalog.brands(id) ON DELETE SET NULL,
    category_slug VARCHAR(150) NOT NULL DEFAULT '',
    title VARCHAR(255) NOT NULL,
    subtitle VARCHAR(255) NOT NULL DEFAULT '',
    badge_text VARCHAR(80) NOT NULL DEFAULT 'SPONSORLU ÜRETİCİ',
    image_url TEXT NOT NULL DEFAULT '',
    cta_text VARCHAR(100) NOT NULL DEFAULT 'Koleksiyonu İncele',
    target_url TEXT NOT NULL DEFAULT '',
    translations JSONB NOT NULL DEFAULT '{}'::jsonb,
    priority INT NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT true,
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    impression_count BIGINT NOT NULL DEFAULT 0,
    click_count BIGINT NOT NULL DEFAULT 0,
    fee_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sponsored_slots_placement_active
    ON catalog.sponsored_slots (placement, is_active, priority ASC);

CREATE TABLE IF NOT EXISTS catalog.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL DEFAULT '',
    company_name VARCHAR(200) NOT NULL DEFAULT '',
    country VARCHAR(100) NOT NULL DEFAULT '',
    preferred_lang VARCHAR(10) NOT NULL DEFAULT 'tr',
    interested_categories VARCHAR(255) NOT NULL DEFAULT '',
    kvkk_consent BOOLEAN NOT NULL DEFAULT true,
    commercial_consent BOOLEAN NOT NULL DEFAULT true,
    consent_ip VARCHAR(64) NOT NULL DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_active
    ON catalog.newsletter_subscribers (is_active, preferred_lang);

CREATE TABLE IF NOT EXISTS catalog.newsletter_campaigns (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    subject VARCHAR(255) NOT NULL,
    target_lang VARCHAR(10) NOT NULL DEFAULT 'all',
    content_summary TEXT NOT NULL DEFAULT '',
    sponsor_brand_id UUID REFERENCES catalog.brands(id) ON DELETE SET NULL,
    recipient_count INT NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'SENT',
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed initial Sponsored Slots from existing verified Merter manufacturers if empty
INSERT INTO catalog.sponsored_slots (
    placement,
    brand_id,
    category_slug,
    title,
    subtitle,
    badge_text,
    image_url,
    cta_text,
    target_url,
    translations,
    priority,
    is_active,
    fee_amount,
    currency,
    notes
)
SELECT
    'home_featured_suppliers',
    b.id,
    '',
    b.name,
    COALESCE(NULLIF(b.short_description, ''), 'Merter Doğrulanmış Toptan & İhracat Üreticisi — Doğrudan Fabrika Fiyatı'),
    'ÖNE ÇIKAN ÜRETİCİ',
    COALESCE(NULLIF(b.cover_image_url, ''), '/banners/collection_kadin.webp?v=2'),
    'Firma Vitrinini Aç',
    '/ureticiler/' || COALESCE(NULLIF(b.slug, ''), b.id::text),
    jsonb_build_object(
        'en', jsonb_build_object(
            'title', b.name,
            'subtitle', 'Verified Merter Wholesale & Export Manufacturer — Direct Factory Price',
            'badge_text', 'FEATURED MANUFACTURER',
            'cta_text', 'View Showroom'
        ),
        'ru', jsonb_build_object(
            'title', b.name,
            'subtitle', 'Проверенный производитель Мертер — Прямые фабричные цены',
            'badge_text', 'РЕКОМЕНДУЕМЫЙ ПРОИЗВОДИТЕЛЬ',
            'cta_text', 'Открыть витрину'
        ),
        'ar', jsonb_build_object(
            'title', b.name,
            'subtitle', 'مصنع جملة معتمد في مارتر — أسعار المصنع مباشرة',
            'badge_text', 'مصنع مميز',
            'cta_text', 'عرض صالة العرض'
        )
    ),
    10,
    true,
    2490.00,
    'TRY',
    'Varsayılan Öne Çıkan Üretici Sponsorluk Alanı'
FROM catalog.brands b
WHERE b.is_active = true
  AND NOT EXISTS (SELECT 1 FROM catalog.sponsored_slots LIMIT 1)
ORDER BY b.name ASC
LIMIT 3;

INSERT INTO catalog.sponsored_slots (
    placement,
    brand_id,
    category_slug,
    title,
    subtitle,
    badge_text,
    image_url,
    cta_text,
    target_url,
    translations,
    priority,
    is_active,
    fee_amount,
    currency,
    notes
)
SELECT
    'category_sponsor',
    b.id,
    'kadin-giyim',
    b.name || ' — Yeni Sezon Toptan Kadın Koleksiyonu',
    'Seri asortili paketler, Private Label & Fason üretim imkanı ve %0 komisyonla doğrudan üreticiden sipariş',
    'KATEGORİ SPONSORU',
    '/banners/hero_women_collection.webp?v=2',
    'Üretici Koleksiyonunu Gör',
    '/ureticiler/' || COALESCE(NULLIF(b.slug, ''), b.id::text),
    jsonb_build_object(
        'en', jsonb_build_object(
            'title', b.name || ' — New Season Wholesale Women Collection',
            'subtitle', 'Full size-run packs, Private Label & Contract manufacturing directly from the factory',
            'badge_text', 'CATEGORY SPONSOR',
            'cta_text', 'Explore Collection'
        ),
        'ru', jsonb_build_object(
            'title', b.name || ' — Новая оптовая женская коллекция',
            'subtitle', 'Серийные пакеты, производство Private Label и прямые поставки с фабрики',
            'badge_text', 'СПОНСОР КАТЕГОРИИ',
            'cta_text', 'Смотреть коллекцию'
        ),
        'ar', jsonb_build_object(
            'title', b.name || ' — تشكيلة الموسم الجديد للملابس النسائية بالجملة',
            'subtitle', 'باقات سيريه كاملة، تصنيع علامة خاصة وطلب مباشر من المصنع بدون عمولة',
            'badge_text', 'راعي القسم',
            'cta_text', 'استكشف التشكيلة'
        )
    ),
    5,
    true,
    1490.00,
    'TRY',
    'Kadın Giyim Kategori Sponsorluğu'
FROM catalog.brands b
WHERE b.is_active = true
  AND NOT EXISTS (SELECT 1 FROM catalog.sponsored_slots WHERE placement = 'category_sponsor')
ORDER BY b.name ASC
LIMIT 1;

