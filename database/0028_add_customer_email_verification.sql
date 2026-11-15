-- =========================================================================
-- 0028_add_customer_email_verification.sql
-- Merter Vitrini B2B E-Ticaret Platformu
-- Müşteri E-Posta Doğrulama ve Tedarikçi Görünürlük Şeması
-- =========================================================================

ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255) NULL;
ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMP WITH TIME ZONE NULL;
ALTER TABLE identity.users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_users_email_verification_token ON identity.users(email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON identity.users(email_verified);

COMMENT ON COLUMN identity.users.email_verified IS 'Kullanıcının e-posta adresini doğrulayıp doğrulamadığı (B2B güvenilirlik göstergesi)';
COMMENT ON COLUMN identity.users.email_verification_token IS 'Kullanıcıya gönderilen 24 saat geçerli benzersiz e-posta doğrulama tokenı';
COMMENT ON COLUMN identity.users.email_verification_expires_at IS 'Doğrulama tokenının son geçerlilik zamanı';
COMMENT ON COLUMN identity.users.email_verified_at IS 'Kullanıcının e-postasını başarıyla doğruladığı tarih ve saat';

