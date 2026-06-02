BEGIN;

-- Add seo_description column to catalog.category_translations
ALTER TABLE catalog.category_translations ADD COLUMN seo_description TEXT NULL;

COMMIT;
