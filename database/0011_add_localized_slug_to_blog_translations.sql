BEGIN;

-- 1. Add localized slug column to catalog.blog_post_translations
ALTER TABLE catalog.blog_post_translations ADD COLUMN IF NOT EXISTS slug VARCHAR(200);

-- 2. Populate slug from master catalog.blog_posts for existing records where slug is null
UPDATE catalog.blog_post_translations t
SET slug = b.slug
FROM catalog.blog_posts b
WHERE t.post_id = b.id AND (t.slug IS NULL OR t.slug = '');

-- 3. Create index for fast lookup by (language_code, slug)
CREATE INDEX IF NOT EXISTS idx_blog_post_translations_lang_slug ON catalog.blog_post_translations (language_code, slug);

COMMIT;
