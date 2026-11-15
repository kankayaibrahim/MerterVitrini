-- =========================================================================
-- Migration 0010: B2B Multi-Vendor Marketplace Core Engine
-- (Sub-Orders, Supplier Wallets, Commission Ledger, Payouts, Outbound Feeds)
-- =========================================================================

-- 1. Satıcı Cüzdanları ve Komisyon Tablosu
CREATE TABLE IF NOT EXISTS catalog.supplier_wallets (
    id uuid DEFAULT extensions.uuidv7() PRIMARY KEY,
    brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE UNIQUE,
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    pending_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    available_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    withdrawn_balance NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    iban VARCHAR(50) NULL,
    bank_name VARCHAR(100) NULL,
    bank_account_holder VARCHAR(255) NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_wallets_brand_id ON catalog.supplier_wallets(brand_id);

COMMENT ON TABLE catalog.supplier_wallets IS 'Tedarikçi toptancıların bakiye, komisyon oranı ve banka hakediş hesapları';

-- Mevcut tüm markalar/tedarikçiler için cüzdan başlat
INSERT INTO catalog.supplier_wallets (brand_id, commission_rate)
SELECT b.id, 10.00
FROM catalog.brands b
ON CONFLICT (brand_id) DO NOTHING;

-- 2. Satıcı Bağımsız Alt Siparişler (Sub-Orders)
CREATE TABLE IF NOT EXISTS catalog.supplier_sub_orders (
    id uuid DEFAULT extensions.uuidv7() PRIMARY KEY,
    order_id uuid NOT NULL REFERENCES catalog.orders(id) ON DELETE CASCADE,
    brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE RESTRICT,
    sub_order_number VARCHAR(64) NOT NULL UNIQUE,
    gross_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    commission_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    net_payout_amount NUMERIC(15,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    tracking_company VARCHAR(100) NULL,
    tracking_number VARCHAR(128) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_sub_orders_order_id ON catalog.supplier_sub_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_supplier_sub_orders_brand_id ON catalog.supplier_sub_orders(brand_id);
CREATE INDEX IF NOT EXISTS idx_supplier_sub_orders_status ON catalog.supplier_sub_orders(status);
CREATE INDEX IF NOT EXISTS idx_supplier_sub_orders_created_at ON catalog.supplier_sub_orders(created_at DESC);

COMMENT ON TABLE catalog.supplier_sub_orders IS 'Ana siparişin tedarikçilere bölünmüş alt siparişleri (Cross-vendor split orders)';

-- 3. Alt Sipariş Kalemleri (Sub-Order Items)
CREATE TABLE IF NOT EXISTS catalog.supplier_sub_order_items (
    id uuid DEFAULT extensions.uuidv7() PRIMARY KEY,
    sub_order_id uuid NOT NULL REFERENCES catalog.supplier_sub_orders(id) ON DELETE CASCADE,
    product_id uuid NOT NULL REFERENCES catalog.products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price_at_purchase NUMERIC(15,2) NOT NULL,
    total_price NUMERIC(15,2) NOT NULL,
    image_url VARCHAR(500) NULL,
    series_ratio VARCHAR(50) NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sub_order_items_sub_order_id ON catalog.supplier_sub_order_items(sub_order_id);
CREATE INDEX IF NOT EXISTS idx_sub_order_items_product_id ON catalog.supplier_sub_order_items(product_id);

-- 4. Cari Hareket Defteri (Denetime Açık Çift Taraflı Finansal Defter - Ledger)
CREATE TABLE IF NOT EXISTS catalog.supplier_ledger (
    id uuid DEFAULT extensions.uuidv7() PRIMARY KEY,
    brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
    sub_order_id uuid NULL REFERENCES catalog.supplier_sub_orders(id) ON DELETE SET NULL,
    payout_request_id uuid NULL,
    transaction_type VARCHAR(32) NOT NULL,
    amount NUMERIC(15,2) NOT NULL,
    balance_after NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_ledger_brand_id ON catalog.supplier_ledger(brand_id);
CREATE INDEX IF NOT EXISTS idx_supplier_ledger_created_at ON catalog.supplier_ledger(created_at DESC);

-- 5. Satıcı Hakediş / Ödeme Talepleri (Payout Requests)
CREATE TABLE IF NOT EXISTS catalog.supplier_payout_requests (
    id uuid DEFAULT extensions.uuidv7() PRIMARY KEY,
    brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
    amount NUMERIC(15,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    iban VARCHAR(50) NOT NULL,
    bank_name VARCHAR(100) NULL,
    account_holder VARCHAR(255) NOT NULL,
    admin_notes TEXT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_payout_requests_brand_id ON catalog.supplier_payout_requests(brand_id);
CREATE INDEX IF NOT EXISTS idx_supplier_payout_requests_status ON catalog.supplier_payout_requests(status);

-- 6. Dışa Aktarılan B2B XML & Müşteri Feed API Anahtarları (Outbound Feeds)
CREATE TABLE IF NOT EXISTS catalog.b2b_api_keys (
    id uuid DEFAULT extensions.uuidv7() PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    api_key VARCHAR(64) NOT NULL UNIQUE,
    margin_rate NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'TRY',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_categories JSONB NULL,
    rate_limit_minute INT NOT NULL DEFAULT 60,
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    last_used_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_b2b_api_keys_key ON catalog.b2b_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_b2b_api_keys_is_active ON catalog.b2b_api_keys(is_active);
