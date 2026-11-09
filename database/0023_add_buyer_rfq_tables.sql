-- Migration 0023: Add Buyer RFQ (Buying Leads / Alıcı Talep Panosu) tables
-- Enables global B2B buyers to post wholesale/Private Label/Fason buying requests
-- and verified Merter manufacturers to submit direct offers.

CREATE SEQUENCE IF NOT EXISTS catalog.buyer_rfq_seq START 1;

CREATE TABLE IF NOT EXISTS catalog.buyer_rfqs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    rfq_number VARCHAR(40) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    category_name VARCHAR(150) NOT NULL DEFAULT '',
    target_quantity INT NOT NULL DEFAULT 100,
    unit_type VARCHAR(30) NOT NULL DEFAULT 'ADET',
    target_price NUMERIC(12,2) NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    production_type VARCHAR(50) NOT NULL DEFAULT 'hazir_toptan',
    description TEXT NOT NULL DEFAULT '',
    buyer_name VARCHAR(150) NOT NULL,
    buyer_company VARCHAR(150) NOT NULL DEFAULT '',
    buyer_country VARCHAR(80) NOT NULL DEFAULT 'Türkiye',
    buyer_phone VARCHAR(60) NOT NULL,
    buyer_whatsapp VARCHAR(60) NOT NULL DEFAULT '',
    buyer_email VARCHAR(150) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'APPROVED',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_buyer_rfqs_status_created
    ON catalog.buyer_rfqs(status, created_at DESC);

CREATE TABLE IF NOT EXISTS catalog.buyer_rfq_offers (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    rfq_id UUID NOT NULL REFERENCES catalog.buyer_rfqs(id) ON DELETE CASCADE,
    brand_id UUID NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
    offered_unit_price NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    min_order_quantity INT NOT NULL DEFAULT 1,
    delivery_days INT NOT NULL DEFAULT 7,
    notes TEXT NOT NULL DEFAULT '',
    supplier_phone VARCHAR(60) NOT NULL DEFAULT '',
    supplier_whatsapp VARCHAR(60) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'SENT',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_rfq_brand_offer UNIQUE (rfq_id, brand_id)
);

CREATE INDEX IF NOT EXISTS idx_buyer_rfq_offers_rfq_id
    ON catalog.buyer_rfq_offers(rfq_id, created_at DESC);

