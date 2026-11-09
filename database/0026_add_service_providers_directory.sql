-- ============================================================================
-- Migration: 0026_add_service_providers_directory.sql
-- Purpose  : Bölüm 2.C — Sektörel Hizmet Sağlayıcılar Rehberi
--            (Kargo/Lojistik, Fotoğraf Stüdyosu, Ambalaj/Etiket, Modelist, İhracat Danışmanı)
-- ============================================================================

CREATE TABLE IF NOT EXISTS catalog.service_providers (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    slug VARCHAR(180) NOT NULL UNIQUE,
    company_name VARCHAR(200) NOT NULL,
    service_category VARCHAR(64) NOT NULL DEFAULT 'kargo_lojistik',
    short_description VARCHAR(300) NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    services_offered TEXT NOT NULL DEFAULT '',
    target_countries VARCHAR(255) NOT NULL DEFAULT '',
    city VARCHAR(100) NOT NULL DEFAULT 'İstanbul',
    district VARCHAR(100) NOT NULL DEFAULT 'Merter',
    address TEXT NOT NULL DEFAULT '',
    phone VARCHAR(64) NOT NULL DEFAULT '',
    whatsapp_phone VARCHAR(64) NOT NULL DEFAULT '',
    email VARCHAR(180) NOT NULL DEFAULT '',
    website VARCHAR(255) NOT NULL DEFAULT '',
    logo_url TEXT NOT NULL DEFAULT '',
    is_verified BOOLEAN NOT NULL DEFAULT true,
    is_sponsored BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    priority INT NOT NULL DEFAULT 10,
    view_count BIGINT NOT NULL DEFAULT 0,
    whatsapp_click_count BIGINT NOT NULL DEFAULT 0,
    translations JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_providers_category_active
    ON catalog.service_providers (service_category, is_active, is_sponsored DESC, priority ASC);


