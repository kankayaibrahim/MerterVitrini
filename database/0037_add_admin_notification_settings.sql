-- Migration 0037: Admin Email Notification Settings (To / CC / Enabled / Daily Digest)
-- and Product Deactivation / Deletion Lifecycle Tracking for Daily Digest Reporting.

CREATE TABLE IF NOT EXISTS identity.notification_settings (
    event_key VARCHAR(50) PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    enabled BOOLEAN NOT NULL DEFAULT true,
    to_emails TEXT[] NOT NULL DEFAULT ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'],
    cc_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    schedule_hour SMALLINT NOT NULL DEFAULT 21,
    schedule_minute SMALLINT NOT NULL DEFAULT 0,
    last_sent_date VARCHAR(10) NULL,
    updated_by VARCHAR(150) NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO identity.notification_settings (
    event_key, title, description, enabled, to_emails, cc_emails, schedule_hour, schedule_minute
)
VALUES
    (
        'new_customer',
        'Yeni Müşteri Kaydı Bildirimi',
        'Vitrin veya mobil uygulama üzerinden yeni B2B müşteri kaydı oluştuğunda To/CC listelerine anında e-posta gönderir.',
        true,
        ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'],
        ARRAY[]::TEXT[],
        21,
        0
    ),
    (
        'new_order',
        'Yeni Sipariş & Doğrudan Talep Bildirimi',
        'Müşteri sepetinden sipariş onaylandığında veya doğrudan toptan teklif/sipariş talebi oluşturulduğunda bildirim gönderir.',
        true,
        ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'],
        ARRAY[]::TEXT[],
        21,
        0
    ),
    (
        'daily_digest',
        'Günlük B2B Operasyon Özet Raporu',
        'Belirlenen saatte (İstanbul saati) o gün kaydolan üyeler, siparişler, eklenen/kapatılan/arşivlenen/silinen ürünler hakkında özet rapor gönderir.',
        true,
        ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'],
        ARRAY[]::TEXT[],
        21,
        0
    ),
    (
        'supplier_onboarding',
        'Tedarikçi & Hizmet Sağlayıcı Başvuru Bildirimi',
        'Yeni tedarikçi hesabı açıldığında, tedarikçi başvurusu veya hizmet sağlayıcı başvurusu doğrulandığında yönetici ekibe mail gönderir.',
        true,
        ARRAY['kankayaibrahim@gmail.com', 'carnavaltedarik@gmail.com'],
        ARRAY[]::TEXT[],
        21,
        0
    )
ON CONFLICT (event_key) DO NOTHING;

UPDATE identity.notification_settings
SET title = 'Yeni Müşteri Kaydı Bildirimi'
WHERE event_key = 'new_customer' AND title = 'Yeni Müşteri / Bayi Kaydı Bildirimi';

CREATE TABLE IF NOT EXISTS identity.notification_logs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    event_key VARCHAR(50) NOT NULL,
    subject VARCHAR(300) NOT NULL,
    to_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    cc_emails TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    status VARCHAR(20) NOT NULL,
    error_message TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_created_at ON identity.notification_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_event_key ON identity.notification_logs (event_key, created_at DESC);

ALTER TABLE catalog.products
    ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_products_created_at ON catalog.products (created_at);
CREATE INDEX IF NOT EXISTS idx_products_deactivated_at ON catalog.products (deactivated_at) WHERE deactivated_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON catalog.products (deleted_at) WHERE deleted_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS catalog.product_deletion_logs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    product_id UUID NULL,
    brand_id UUID NULL,
    sku VARCHAR(120) NOT NULL DEFAULT '',
    title VARCHAR(300) NOT NULL DEFAULT '',
    deletion_mode VARCHAR(20) NOT NULL DEFAULT 'hard',
    actor_type VARCHAR(30) NOT NULL DEFAULT 'supplier',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_deletion_logs_created_at ON catalog.product_deletion_logs (created_at DESC);
