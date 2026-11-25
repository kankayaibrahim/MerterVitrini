-- 0020_add_product_media_type.sql
-- Adds media_type ('image' | 'video') discriminator to catalog.product_images
-- so products can store native MP4/WebM videos alongside product photos.

ALTER TABLE catalog.product_images
    ADD COLUMN IF NOT EXISTS media_type VARCHAR(16) NOT NULL DEFAULT 'image';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'product_images_media_type_check'
          AND conrelid = 'catalog.product_images'::regclass
    ) THEN
        ALTER TABLE catalog.product_images
            ADD CONSTRAINT product_images_media_type_check
            CHECK (media_type IN ('image', 'video'));
    END IF;
END
$$;

UPDATE catalog.product_images
SET media_type = 'video'
WHERE media_type <> 'video'
  AND LOWER(image_url) ~ '\.(mp4|webm|m4v|mov)(\?.*)?$';

COMMENT ON COLUMN catalog.product_images.media_type IS 'Medya türü (image veya video)';
