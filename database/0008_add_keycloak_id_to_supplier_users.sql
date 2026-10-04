-- Migration 0008: Add Keycloak ID to Supplier Users
ALTER TABLE catalog.supplier_users ADD COLUMN IF NOT EXISTS keycloak_id VARCHAR(100) NULL;
ALTER TABLE catalog.supplier_users ALTER COLUMN password_hash DROP NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supplier_users_keycloak_id ON catalog.supplier_users(keycloak_id);

COMMENT ON COLUMN catalog.supplier_users.keycloak_id IS 'Keycloak Realm merter üzerindeki eşleşen kullanıcı UUID si';
