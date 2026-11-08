-- =========================================================================
-- Migration 0017: Merter Vitrini Mobile App (Customer + Supplier) Core Schema
-- PostgreSQL 18+ Native uuidv7() | Devices, Notifications, Wishlist, Chat Images & Play Store Data Safety
-- =========================================================================

-- 1. Mobil Push Cihaz Kayıtları (FCM / APNs)
CREATE TABLE IF NOT EXISTS identity.mobile_devices (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_role VARCHAR(30) NOT NULL CHECK (user_role IN ('customer', 'supplier')),
    fcm_token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL DEFAULT 'android',
    device_model VARCHAR(120) NULL,
    app_version VARCHAR(30) NULL,
    language_code VARCHAR(10) NOT NULL DEFAULT 'tr',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_mobile_devices_user_role_token UNIQUE (user_id, user_role, fcm_token)
);

CREATE INDEX IF NOT EXISTS idx_mobile_devices_user_lookup
    ON identity.mobile_devices (user_id, user_role)
    WHERE is_active = true;

-- 2. Mobil Senkronize Favoriler / İstek Listesi (Wishlist)
CREATE TABLE IF NOT EXISTS catalog.mobile_wishlist (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_mobile_wishlist_user_product UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_mobile_wishlist_user_id
    ON catalog.mobile_wishlist (user_id, created_at DESC);

-- 3. Uygulama İçi Bildirim Merkezi (Müşteri & Tedarikçi)
CREATE TABLE IF NOT EXISTS catalog.mobile_notifications (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('customer', 'supplier')),
    recipient_id VARCHAR(255) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    notification_type VARCHAR(50) NOT NULL DEFAULT 'system',
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mobile_notifications_recipient
    ON catalog.mobile_notifications (recipient_type, recipient_id, created_at DESC);

-- 4. B2B Canlı Sohbette Kamera / Görsel Mesaj Desteği ('image')
ALTER TABLE catalog.chat_messages
    DROP CONSTRAINT IF EXISTS chat_messages_message_type_check;

ALTER TABLE catalog.chat_messages
    ADD CONSTRAINT chat_messages_message_type_check
    CHECK (message_type IN ('text', 'product_card', 'custom_offer', 'image'));

-- 5. Google Play Store Veri Güvenliği & Hesap Silme Denetim Kaydı
CREATE TABLE IF NOT EXISTS identity.account_deletion_requests (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    user_role VARCHAR(30) NOT NULL,
    email VARCHAR(150) NOT NULL,
    reason TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

