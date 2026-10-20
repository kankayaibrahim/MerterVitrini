-- Migration 0015: Supplier Application Verification and Password Setup
ALTER TABLE catalog.supplier_applications 
    ADD COLUMN IF NOT EXISTS verification_token VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMP WITH TIME ZONE NULL,
    ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_applications_verification_token 
    ON catalog.supplier_applications(verification_token);

CREATE INDEX IF NOT EXISTS idx_supplier_applications_verification_expires 
    ON catalog.supplier_applications(verification_expires_at);

ALTER TABLE catalog.supplier_users 
    ADD COLUMN IF NOT EXISTS setup_token VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS setup_token_expires_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_supplier_users_setup_token 
    ON catalog.supplier_users(setup_token);

-- Existing pending applications before this migration can be marked verified so admin does not lose them
UPDATE catalog.supplier_applications 
SET email_verified = true, verified_at = created_at 
WHERE status != 'pending' OR (status = 'pending' AND verification_token IS NULL);
