-- =============================================================================
-- Migration 0020: Tedarikçi Açık Vitrin Profili, Doğrudan İletişim & Sıfır Komisyonlu Doğrudan Sipariş Yönlendirme
-- =============================================================================

BEGIN;

-- 1. catalog.brands tablosuna Tedarikçi Self-Servis Açık Vitrin, İletişim, Üretim Kapasitesi ve Doğrudan Tahsilat (IBAN) alanları eklenmesi
ALTER TABLE catalog.brands
    ADD COLUMN IF NOT EXISTS company_type VARCHAR(50) NOT NULL DEFAULT 'uretici_toptanci',
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(50) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS public_email VARCHAR(150) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS location_address TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS export_countries TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS min_order_quantity INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS supports_private_label BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS supports_fason BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS bank_account_holder VARCHAR(200) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS iban VARCHAR(64) NOT NULL DEFAULT '';

-- Mevcut phone bilgisi varsa ve whatsapp_phone boşsa otomatik kopyala
UPDATE catalog.brands
SET whatsapp_phone = phone
WHERE (whatsapp_phone IS NULL OR whatsapp_phone = '') AND phone IS NOT NULL AND phone <> '';

-- 2. catalog.orders tablosuna misafir / doğrudan B2B alıcı iletişim alanları eklenmesi ve user_id zorunluluğunun esnetilmesi
ALTER TABLE catalog.orders ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE catalog.orders
    ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_company VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(60) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS notes TEXT NULL;

-- Mevcut siparişlerde identity.users tablosundan müşteri bilgilerini doldur
UPDATE catalog.orders o
SET
    customer_name = TRIM(COALESCE(u.first_name, '') || ' ' || COALESCE(u.last_name, '')),
    customer_phone = COALESCE(u.phone, ''),
    customer_email = COALESCE(u.email, '')
FROM identity.users u
WHERE o.user_id = u.id
  AND o.customer_name = '';

-- 3. catalog.supplier_sub_orders tablosuna alıcı (müşteri) doğrudan iletişim ve teslimat alanları eklenmesi
ALTER TABLE catalog.supplier_sub_orders ALTER COLUMN order_id DROP NOT NULL;
ALTER TABLE catalog.supplier_sub_orders
    ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_company VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(60) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS delivery_address TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS billing_address TEXT NOT NULL DEFAULT '';

-- Mevcut alt siparişlerde üst siparişten (catalog.orders) müşteri bilgilerini doldur
UPDATE catalog.supplier_sub_orders sso
SET
    customer_name = COALESCE(o.customer_name, ''),
    customer_company = COALESCE(o.customer_company, ''),
    customer_phone = COALESCE(o.customer_phone, ''),
    customer_email = COALESCE(o.customer_email, ''),
    delivery_address = COALESCE(o.delivery_address::text, ''),
    billing_address = COALESCE(o.billing_address::text, '')
FROM catalog.orders o
WHERE sso.order_id = o.id
  AND sso.customer_name = '';

-- 4. Doğrudan Tedarikçi Modeli gereği komisyon oranlarını %0.00 olarak güncelle
ALTER TABLE catalog.supplier_wallets ALTER COLUMN commission_rate SET DEFAULT 0.00;
ALTER TABLE catalog.supplier_sub_orders ALTER COLUMN commission_rate SET DEFAULT 0.00;

UPDATE catalog.supplier_wallets SET commission_rate = 0.00 WHERE commission_rate <> 0.00;

COMMIT;
