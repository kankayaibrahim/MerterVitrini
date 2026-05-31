BEGIN;

-- 1. Rename catalog.currencies.active -> is_active
ALTER TABLE catalog.currencies RENAME COLUMN active TO is_active;

-- 2. Rename catalog.product_variants.size -> variant_size
ALTER TABLE catalog.product_variants RENAME COLUMN size TO variant_size;

-- 3. Rename catalog.languages.dir -> text_direction
ALTER TABLE catalog.languages RENAME COLUMN dir TO text_direction;

-- 4. Rename catalog.countries.names -> localized_names
ALTER TABLE catalog.countries RENAME COLUMN names TO localized_names;

-- 5. Rename catalog.country_groups.names -> localized_names
ALTER TABLE catalog.country_groups RENAME COLUMN names TO localized_names;

-- 6. Rename identity.users.role -> user_role
ALTER TABLE identity.users RENAME COLUMN role TO user_role;

COMMIT;
