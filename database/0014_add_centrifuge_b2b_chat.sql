-- Migration 0014: Centrifuge Real-Time B2B Supplier-Customer Chat, Sub-Users & Custom Price Offers
-- Compatible with PostgreSQL 18 native uuidv7()

-- 1. Enhance catalog.supplier_users to support multi-agent sales representatives per supplier
ALTER TABLE catalog.supplier_users ADD COLUMN IF NOT EXISTS job_title VARCHAR(100) NOT NULL DEFAULT 'Satış Temsilcisi';
ALTER TABLE catalog.supplier_users ADD COLUMN IF NOT EXISTS spoken_languages VARCHAR(100) NOT NULL DEFAULT 'TR';
ALTER TABLE catalog.supplier_users ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT false;

-- 2. Chat rooms supporting distinct conversations per supplier sub-user (sales representative)
CREATE TABLE IF NOT EXISTS catalog.chat_rooms (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    brand_id uuid NOT NULL REFERENCES catalog.brands(id) ON DELETE CASCADE,
    supplier_user_id uuid NULL REFERENCES catalog.supplier_users(id) ON DELETE SET NULL,
    customer_id VARCHAR(255) NOT NULL,
    customer_name VARCHAR(150) NOT NULL DEFAULT 'Misafir Alıcı',
    customer_email VARCHAR(150) NULL,
    customer_phone VARCHAR(50) NULL,
    initial_product_id uuid NULL REFERENCES catalog.products(id) ON DELETE SET NULL,
    last_message_preview TEXT NOT NULL DEFAULT '',
    last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unread_customer_count INT NOT NULL DEFAULT 0,
    unread_supplier_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE catalog.chat_rooms ADD COLUMN IF NOT EXISTS supplier_user_id uuid NULL REFERENCES catalog.supplier_users(id) ON DELETE SET NULL;
ALTER TABLE catalog.chat_rooms DROP CONSTRAINT IF EXISTS uq_chat_rooms_brand_customer;

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_rooms_brand_agent_customer
ON catalog.chat_rooms (brand_id, COALESCE(supplier_user_id, '00000000-0000-0000-0000-000000000000'::uuid), customer_id);

CREATE INDEX IF NOT EXISTS idx_chat_rooms_brand_id ON catalog.chat_rooms(brand_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_supplier_user_id ON catalog.chat_rooms(supplier_user_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_customer_id ON catalog.chat_rooms(customer_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS catalog.chat_messages (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    room_id uuid NOT NULL REFERENCES catalog.chat_rooms(id) ON DELETE CASCADE,
    sender_type VARCHAR(20) NOT NULL CHECK (sender_type IN ('customer', 'supplier', 'admin')),
    sender_id VARCHAR(255) NOT NULL,
    sender_name VARCHAR(150) NOT NULL,
    message_type VARCHAR(30) NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'product_card', 'custom_offer')),
    content TEXT NOT NULL DEFAULT '',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON catalog.chat_messages(room_id, created_at ASC);

-- Allow custom negotiated unit prices in B2B cart items from accepted supplier offers
ALTER TABLE catalog.cart_items ADD COLUMN IF NOT EXISTS custom_unit_price DECIMAL(12, 2) NULL;
ALTER TABLE catalog.cart_items ADD COLUMN IF NOT EXISTS offer_message_id uuid NULL;
