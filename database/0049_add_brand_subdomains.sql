-- 0049_add_brand_subdomains.sql
-- Adds Sahibinden.com-style per-supplier multi-tenant subdomain fields and constraints.

ALTER TABLE catalog.brands
    ADD COLUMN IF NOT EXISTS subdomain VARCHAR(63) NULL,
    ADD COLUMN IF NOT EXISTS subdomain_enabled BOOLEAN NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS uq_brands_subdomain_lower
    ON catalog.brands (LOWER(subdomain))
    WHERE subdomain IS NOT NULL AND BTRIM(subdomain) <> '';

DO $$
DECLARE
    rec RECORD;
    raw_src TEXT;
    clean_sub TEXT;
    fallback_sub TEXT;
    taken BOOLEAN;
    reserved_subs CONSTANT TEXT[] := ARRAY[
        'www', 'api', 'admin', 'adminapi', 'auth', 'mail', 'translateapi',
        'app', 'web', 'shop', 'store', 'storefront', 'static', 'cdn',
        'media', 'uploads', 'img', 'images', 'assets', 'files',
        'ftp', 'sftp', 'smtp', 'imap', 'pop', 'pop3', 'mx', 'ns',
        'ns1', 'ns2', 'ns3', 'ns4', 'dns', 'vpn', 'ssh', 'proxy',
        'gateway', 'edge', 'dev', 'staging', 'stage', 'test', 'beta',
        'alpha', 'demo', 'sandbox', 'local', 'localhost', 'panel',
        'dashboard', 'portal', 'supplier', 'suppliers', 'tedarikci',
        'tedarikciler', 'uretici', 'ureticiler', 'vendor', 'seller',
        'merchant', 'partner', 'blog', 'news', 'help', 'support',
        'destek', 'status', 'health', 'metrics', 'docs', 'swagger',
        'graphql', 'ws', 'wss', 'chat', 'billing', 'pay', 'payment',
        'checkout', 'cart', 'order', 'orders', 'account', 'accounts',
        'profile', 'login', 'register', 'signup', 'signin', 'oauth',
        'sso', 'keycloak', 'iam', 'root', 'system', 'sys', 'ops',
        'security', 'abuse', 'postmaster', 'webmaster', 'hostmaster',
        'noreply', 'info', 'contact', 'iletisim', 'merter',
        'mertervitrini', 'vitrini', 'b2b', 'wholesale', 'toptan',
        'rfq', 'mobile', 'android', 'ios', 'apk', 'sitemap', 'robots'
    ];
BEGIN
    FOR rec IN
        SELECT id, brand_name, slug, alias_code
        FROM catalog.brands
        WHERE subdomain IS NULL OR BTRIM(subdomain) = ''
        ORDER BY created_at ASC, brand_name ASC
    LOOP
        raw_src := COALESCE(NULLIF(BTRIM(rec.alias_code), ''), NULLIF(BTRIM(rec.slug), ''), rec.brand_name);
        clean_sub := LOWER(TRANSLATE(raw_src, 'ıİğĞüÜşŞöÖçÇ_', 'iigguussoocc-'));
        clean_sub := REGEXP_REPLACE(clean_sub, '[^a-z0-9-]+', '-', 'g');
        clean_sub := REGEXP_REPLACE(clean_sub, '-{2,}', '-', 'g');
        clean_sub := BTRIM(clean_sub, '-');

        IF LENGTH(clean_sub) < 3 OR LENGTH(clean_sub) > 63 OR clean_sub = ANY(reserved_subs) THEN
            clean_sub := LOWER(TRANSLATE(COALESCE(NULLIF(BTRIM(rec.slug), ''), rec.brand_name), 'ıİğĞüÜşŞöÖçÇ_', 'iigguussoocc-'));
            clean_sub := REGEXP_REPLACE(clean_sub, '[^a-z0-9-]+', '-', 'g');
            clean_sub := REGEXP_REPLACE(clean_sub, '-{2,}', '-', 'g');
            clean_sub := BTRIM(clean_sub, '-');
        END IF;

        IF LENGTH(clean_sub) > 63 THEN
            clean_sub := BTRIM(LEFT(clean_sub, 63), '-');
        END IF;

        IF LENGTH(clean_sub) < 3 OR clean_sub = ANY(reserved_subs) THEN
            clean_sub := 'firma-' || LEFT(REPLACE(rec.id::text, '-', ''), 8);
        END IF;

        SELECT EXISTS(
            SELECT 1 FROM catalog.brands
            WHERE id <> rec.id AND LOWER(subdomain) = LOWER(clean_sub)
        ) INTO taken;

        IF taken THEN
            fallback_sub := LOWER(TRANSLATE(COALESCE(NULLIF(BTRIM(rec.slug), ''), ''), 'ıİğĞüÜşŞöÖçÇ_', 'iigguussoocc-'));
            fallback_sub := REGEXP_REPLACE(fallback_sub, '[^a-z0-9-]+', '-', 'g');
            fallback_sub := REGEXP_REPLACE(fallback_sub, '-{2,}', '-', 'g');
            fallback_sub := BTRIM(fallback_sub, '-');

            IF LENGTH(fallback_sub) >= 3 AND LENGTH(fallback_sub) <= 63 AND NOT (fallback_sub = ANY(reserved_subs)) THEN
                SELECT EXISTS(
                    SELECT 1 FROM catalog.brands
                    WHERE id <> rec.id AND LOWER(subdomain) = LOWER(fallback_sub)
                ) INTO taken;
                IF NOT taken THEN
                    clean_sub := fallback_sub;
                END IF;
            END IF;

            SELECT EXISTS(
                SELECT 1 FROM catalog.brands
                WHERE id <> rec.id AND LOWER(subdomain) = LOWER(clean_sub)
            ) INTO taken;
            IF taken THEN
                clean_sub := LEFT(clean_sub, 54) || '-' || LEFT(REPLACE(rec.id::text, '-', ''), 8);
            END IF;
        END IF;

        UPDATE catalog.brands
        SET subdomain = clean_sub
        WHERE id = rec.id;
    END LOOP;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'chk_brands_subdomain_format'
          AND conrelid = 'catalog.brands'::regclass
    ) THEN
        ALTER TABLE catalog.brands
            ADD CONSTRAINT chk_brands_subdomain_format
            CHECK (
                subdomain IS NULL OR (
                    subdomain ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$'
                    AND subdomain NOT LIKE '%--%'
                )
            );
    END IF;
END $$;
