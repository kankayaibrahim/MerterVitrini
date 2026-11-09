-- 0021_supplier_subscriptions_accounting_billing.sql
-- Tedarikçi Abonelik Paketleri (Sınırsız Ürün Kotası), Muhasebe Cari Ekstre, Ödeme/Tahsilat ve Faturalandırma Tabloları

BEGIN;

-- 1. Üyelik ve Vitrin Paketleri Tablosu (Ürün Sınırı Yok: max_products = -1)
CREATE TABLE IF NOT EXISTS catalog.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    monthly_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    yearly_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    max_products INT NOT NULL DEFAULT -1, -- -1 = Sınırsız Ürün Yükleme
    features JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO catalog.subscription_plans (code, name, description, monthly_price, yearly_price, currency, tax_rate, max_products, features, display_order)
VALUES
(
    'FREE',
    'Ücretsiz Vitrin (Lansman Paketi)',
    'Tüm Merter üreticileri ve toptancıları için sınırsız ürün yükleme ve doğrudan müşteri iletişimi.',
    0.00,
    0.00,
    'TRY',
    20.00,
    -1,
    '["Sınırsız Ürün Yükleme Hakkı", "Açık Firma Profili & Doğrulanmış Üretici Rozeti", "Doğrudan WhatsApp & Telefon İletişimi", "%0 Komisyon ile Doğrudan Sipariş Alma", "4 Dilde (TR/EN/RU/AR) Otomatik Çeviri"]'::jsonb,
    1
),
(
    'PRO',
    'Profesyonel Vitrin',
    'Kategorilerde öncelikli sıralama, gelişmiş ziyaretçi raporları ve çok dilli vitrin görünürlüğü.',
    990.00,
    9900.00,
    'TRY',
    20.00,
    -1,
    '["Sınırsız Ürün Yükleme Hakkı", "Gelişmiş Kategori Görünürlüğü & Öncelikli Sıralama", "Doğrudan WhatsApp & Sipariş Hattı", "Firma Ziyaretçi ve Ürün Görüntülenme Raporları", "Alıcı Taleplerine Doğrudan Erişim", "%0 Komisyon Fabrika Çıkış Satışı"]'::jsonb,
    2
),
(
    'PREMIUM',
    'Premium & Sponsorlu Vitrin',
    'Ana sayfada ve üst kategorilerde sponsorlu vitrin, maksimum ihracat görünürlüğü ve özel reklam alanı.',
    2490.00,
    24900.00,
    'TRY',
    20.00,
    -1,
    '["Sınırsız Ürün Yükleme Hakkı", "Ana Sayfada Öne Çıkan Üretici Vitrini", "Sponsorlu Kategori Üst Sıra Görünürlüğü", "Detaylı Ülke & Alıcı İletişim Analitiği", "Öncelikli Müşteri & Entegrasyon Desteği", "Özel Koleksiyon ve Bülten Tanıtımı"]'::jsonb,
    3
)
ON CONFLICT (code) DO UPDATE SET
    max_products = -1,
    updated_at = NOW();

-- 2. Tedarikçi Aktif Abonelik, Cari Bakiye ve Fatura Bilgileri Tablosu
CREATE TABLE IF NOT EXISTS catalog.supplier_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    brand_id UUID NOT NULL UNIQUE REFERENCES catalog.brands(id) ON DELETE CASCADE,
    plan_id UUID NULL REFERENCES catalog.subscription_plans(id) ON DELETE SET NULL,
    plan_code VARCHAR(50) NOT NULL DEFAULT 'FREE',
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'MONTHLY', -- MONTHLY, YEARLY, PROMO_FREE
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAST_DUE, CANCELLED
    is_complimentary BOOLEAN NOT NULL DEFAULT true, -- Şimdilik ücretsiz / muafiyet durumu
    agreed_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '1 year'),
    next_billing_date TIMESTAMPTZ NULL,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    total_paid_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    total_invoiced_amount NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    outstanding_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    billing_company_title VARCHAR(255) NOT NULL DEFAULT '',
    tax_office VARCHAR(150) NOT NULL DEFAULT '',
    tax_number VARCHAR(50) NOT NULL DEFAULT '',
    billing_address TEXT NOT NULL DEFAULT '',
    billing_email VARCHAR(255) NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mevcut tüm firmalar için varsayılan ücretsiz (Sınırsız ürünlü) abonelik kaydı oluştur
INSERT INTO catalog.supplier_subscriptions (
    brand_id, plan_id, plan_code, billing_cycle, status, is_complimentary, agreed_price, billing_company_title, billing_email, billing_address
)
SELECT
    b.id,
    (SELECT id FROM catalog.subscription_plans WHERE code = 'FREE' LIMIT 1),
    'FREE',
    'PROMO_FREE',
    'ACTIVE',
    true,
    0.00,
    b.brand_name,
    COALESCE(b.public_email, ''),
    COALESCE(b.location_address, '')
FROM catalog.brands b
ON CONFLICT (brand_id) DO NOTHING;

-- 3. Tedarikçi Faturalandırma Tablosu (Aylık Abonelik, Sponsorlu Reklam, Ek Hizmet Faturaları)
CREATE TABLE IF NOT EXISTS catalog.supplier_invoices (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
    subscription_id UUID NULL REFERENCES catalog.supplier_subscriptions(id) ON DELETE SET NULL,
    invoice_type VARCHAR(40) NOT NULL DEFAULT 'SUBSCRIPTION', -- SUBSCRIPTION, SPONSORED_AD, EXTRA_SERVICE
    plan_code VARCHAR(50) NOT NULL DEFAULT 'PRO',
    period_label VARCHAR(120) NOT NULL DEFAULT '',
    subtotal_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    tax_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00,
    tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- DRAFT, PENDING, PAID, PARTIALLY_PAID, COMPLIMENTARY, CANCELLED
    billing_company_title VARCHAR(255) NOT NULL DEFAULT '',
    tax_office VARCHAR(150) NOT NULL DEFAULT '',
    tax_number VARCHAR(50) NOT NULL DEFAULT '',
    billing_address TEXT NOT NULL DEFAULT '',
    issue_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_date TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
    paid_at TIMESTAMPTZ NULL,
    pdf_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_brand_id ON catalog.supplier_invoices(brand_id, issue_date DESC);

-- 4. Tedarikçi Ödeme / Tahsilat Tablosu (Tedarikçinin Merter Vitrini'ne Yaptığı Aylık Ödemeler)
CREATE TABLE IF NOT EXISTS catalog.supplier_subscription_payments (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    payment_number VARCHAR(50) UNIQUE NOT NULL,
    brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
    invoice_id UUID NULL REFERENCES catalog.supplier_invoices(id) ON DELETE SET NULL,
    plan_code VARCHAR(50) NOT NULL DEFAULT 'PRO',
    period_months INT NOT NULL DEFAULT 1,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
    payment_method VARCHAR(40) NOT NULL DEFAULT 'BANK_TRANSFER', -- BANK_TRANSFER, CREDIT_CARD, CASH, PROMO_WAIVER
    status VARCHAR(30) NOT NULL DEFAULT 'COMPLETED', -- PENDING_APPROVAL, COMPLETED, REJECTED, REFUNDED
    sender_name VARCHAR(255) NOT NULL DEFAULT '',
    bank_reference VARCHAR(150) NOT NULL DEFAULT '',
    receipt_url TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    approved_by VARCHAR(150) NOT NULL DEFAULT '',
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_sub_payments_brand_id ON catalog.supplier_subscription_payments(brand_id, paid_at DESC);

-- 5. Tedarikçi Muhasebe Cari Hesap Defteri (Borç / Alacak / Bakiye Ekstresi)
CREATE TABLE IF NOT EXISTS catalog.supplier_accounting_ledger (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
    invoice_id UUID NULL REFERENCES catalog.supplier_invoices(id) ON DELETE SET NULL,
    payment_id UUID NULL REFERENCES catalog.supplier_subscription_payments(id) ON DELETE SET NULL,
    entry_type VARCHAR(40) NOT NULL, -- INVOICE_DEBIT, PAYMENT_CREDIT, PROMO_CREDIT, ADJUSTMENT
    debit_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    credit_amount NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    running_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'TRY',
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_acc_ledger_brand_id ON catalog.supplier_accounting_ledger(brand_id, created_at DESC);

COMMIT;

