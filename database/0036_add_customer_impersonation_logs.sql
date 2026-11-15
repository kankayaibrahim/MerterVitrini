-- Migration 0036: Customer Impersonation Audit Logs
-- Records every admin/sales-manager session initiated on behalf of a B2B customer.

BEGIN;

CREATE SCHEMA IF NOT EXISTS identity;

CREATE TABLE IF NOT EXISTS identity.impersonation_logs (
    id UUID PRIMARY KEY DEFAULT uuidv7(),
    admin_user_id VARCHAR(255) NOT NULL DEFAULT '',
    admin_email VARCHAR(150) NOT NULL DEFAULT '',
    admin_role VARCHAR(50) NOT NULL DEFAULT '',
    customer_id VARCHAR(255) NOT NULL,
    customer_email VARCHAR(150) NOT NULL DEFAULT '',
    ip_address VARCHAR(64) NOT NULL DEFAULT '',
    user_agent VARCHAR(512) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_customer_created
    ON identity.impersonation_logs (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_impersonation_logs_admin_created
    ON identity.impersonation_logs (admin_email, created_at DESC);

COMMIT;
