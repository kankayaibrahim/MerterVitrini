BEGIN;

ALTER TABLE catalog.brands
    ADD COLUMN IF NOT EXISTS whatsapp_only_ordering BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE catalog.brands
SET whatsapp_only_ordering = TRUE,
    updated_at = CURRENT_TIMESTAMP
WHERE UPPER(COALESCE(alias_code, '')) = 'BLACK_FASHION';

COMMIT;
