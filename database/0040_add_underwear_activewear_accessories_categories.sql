-- Migration 0040: Add İç Giyim, Spor & Eşofman, and Aksesuar & Çanta category trees with 8-language translations

BEGIN;

DO $$
DECLARE
    v_kadin_id    UUID;
    v_ic_giyim_id UUID;
    v_spor_id     UUID;
    v_aksesuar_id UUID;
BEGIN
    SELECT id INTO v_kadin_id
    FROM catalog.categories
    WHERE slug = 'kadin-giyim'
    LIMIT 1;

    IF v_kadin_id IS NULL THEN
        RAISE EXCEPTION 'Required root category "kadin-giyim" was not found.';
    END IF;

    -- 2nd-level parents under Kadın Giyim + new root Aksesuar & Çanta
    INSERT INTO catalog.categories (parent_id, title, slug, is_active)
    VALUES (v_kadin_id, 'İç Giyim', 'ic-giyim', true)
    ON CONFLICT (slug) DO NOTHING;
    SELECT id INTO v_ic_giyim_id FROM catalog.categories WHERE slug = 'ic-giyim';

    INSERT INTO catalog.categories (parent_id, title, slug, is_active)
    VALUES (v_kadin_id, 'Spor & Eşofman', 'spor-esofman', true)
    ON CONFLICT (slug) DO NOTHING;
    SELECT id INTO v_spor_id FROM catalog.categories WHERE slug = 'spor-esofman';

    INSERT INTO catalog.categories (parent_id, title, slug, is_active)
    VALUES (NULL, 'Aksesuar & Çanta', 'aksesuar-canta', true)
    ON CONFLICT (slug) DO NOTHING;
    SELECT id INTO v_aksesuar_id FROM catalog.categories WHERE slug = 'aksesuar-canta';

    -- Leaf categories (ltree node_path calculated automatically by trig01_calculate_path)
    INSERT INTO catalog.categories (parent_id, title, slug, is_active) VALUES
        (v_ic_giyim_id, 'Bra & Sporcu Sütyeni', 'bra-sporcu-sutyeni', true),
        (v_ic_giyim_id, 'Külot & İç Çamaşırı', 'kulot-ic-camasiri', true),
        (v_ic_giyim_id, 'Bodysuit & Korse', 'bodysuit-korse', true),
        (v_spor_id, 'Eşofman Altı', 'esofman-alti', true),
        (v_spor_id, 'Eşofman Takımı', 'esofman-takimi', true),
        (v_spor_id, 'Sweatshirt', 'sweatshirt', true),
        (v_aksesuar_id, 'Çanta', 'canta', true),
        (v_aksesuar_id, 'Kemer', 'kemer', true),
        (v_aksesuar_id, 'Şal & Eşarp', 'sal-esarp', true),
        (v_aksesuar_id, 'Şapka & Bere & Atkı', 'sapka-bere-atki', true),
        (v_aksesuar_id, 'Bel Aksesuarı', 'bel-aksesuari', true)
    ON CONFLICT (slug) DO NOTHING;
END $$;

WITH cat_i18n(slug, tr_title, en_title, ru_title, ar_title, de_title, fr_title, pl_title, bg_title) AS (
    VALUES
        ('ic-giyim',             'İç Giyim',             'Underwear & Lingerie',    'Нижнее бельё',            'ملابس داخلية',            'Unterwäsche & Dessous',   'Lingerie & Sous-vêtements',    'Bielizna',                   'Бельо'),
        ('bra-sporcu-sutyeni',   'Bra & Sporcu Sütyeni', 'Bras & Sports Bras',      'Бюстгальтеры и топы-бра', 'حمالات صدر رياضية وبرا',  'BHs & Sport-BHs',         'Soutiens-gorge & Brassières',  'Biustonosze i topy sportowe', 'Сутиени и спортни бюстиета'),
        ('kulot-ic-camasiri',    'Külot & İç Çamaşırı',  'Briefs & Panties',        'Трусы и нижнее бельё',    'سراويل داخلية',           'Slips & Unterhosen',      'Culottes & Slips',             'Majtki i bielizna',          'Бикини и долно бельо'),
        ('bodysuit-korse',       'Bodysuit & Korse',     'Bodysuits & Shapewear',   'Боди и корсеты',          'بودي سوت وكورسيه',        'Bodys & Shapewear',       'Bodys & Corsets',              'Body i gorsety',             'Бодита и корсети'),
        ('spor-esofman',         'Spor & Eşofman',       'Activewear & Tracksuits', 'Спортивная одежда',       'ملابس رياضية وترنجات',    'Sportbekleidung & Jogging', 'Sportswear & Survêtements',  'Odzież sportowa i dresy',    'Спортни дрехи и анцузи'),
        ('esofman-alti',         'Eşofman Altı',         'Joggers & Sweatpants',    'Спортивные брюки',        'بناطيل رياضية',           'Jogginghosen',            'Pantalons de jogging',         'Spodnie dresowe',            'Спортни долнища'),
        ('esofman-takimi',       'Eşofman Takımı',       'Tracksuit Sets',          'Спортивные костюмы',      'أطقم رياضية',             'Jogginganzüge',           'Ensembles de survêtement',     'Komplety dresowe',           'Спортни комплекти'),
        ('sweatshirt',           'Sweatshirt',           'Sweatshirts & Hoodies',   'Свитшоты и худи',         'سويت شيرت',               'Sweatshirts & Hoodies',   'Sweatshirts & Sweats',         'Bluzy',                      'Суитшърти'),
        ('aksesuar-canta',       'Aksesuar & Çanta',     'Accessories & Bags',      'Аксессуары и сумки',      'إكسسوارات وحقائب',        'Accessoires & Taschen',   'Accessoires & Sacs',           'Akcesoria i torebki',        'Аксесоари и чанти'),
        ('canta',                'Çanta',                'Bags & Handbags',         'Сумки',                   'حقائب',                   'Taschen',                 'Sacs',                         'Torebki',                    'Чанти'),
        ('kemer',                'Kemer',                'Belts',                   'Ремни',                   'أحزمة',                   'Gürtel',                  'Ceintures',                    'Paski',                      'Колани'),
        ('sal-esarp',            'Şal & Eşarp',          'Shawls & Scarves',        'Шали и шарфы',            'شالات وأوشحة',            'Schals & Tücher',         'Châles & Foulards',            'Szale i chusty',             'Шалове'),
        ('sapka-bere-atki',      'Şapka & Bere & Atkı',  'Hats, Beanies & Scarves', 'Шапки, береты и шарфы',   'قبعات وأوشحة',            'Mützen, Hüte & Schals',   'Chapeaux, Bonnets & Écharpes', 'Czapki, kapelusze i szaliki', 'Шапки и шалове'),
        ('bel-aksesuari',        'Bel Aksesuarı',        'Waist Accessories',       'Аксессуары на талию',     'إكسسوارات الخصر',         'Taillen-Accessoires',     'Accessoires de taille',        'Akcesoria do talii',         'Аксесоари за талия')
),
expanded_translations AS (
    SELECT c.id AS category_id, v.lang_code, v.title,
           CASE
               WHEN v.lang_code = 'tr' THEN
                   'İstanbul Merter toptan ' || ci.tr_title || ' modelleri ve yeni sezon B2B fiyatları. İmalatçıdan doğrudan toptan sipariş imkanlarıyla hemen inceleyin.'
               ELSE NULL
           END AS seo_description
    FROM cat_i18n ci
    JOIN catalog.categories c ON c.slug = ci.slug
    CROSS JOIN LATERAL (
        VALUES
            ('tr', ci.tr_title),
            ('en', ci.en_title),
            ('ru', ci.ru_title),
            ('ar', ci.ar_title),
            ('de', ci.de_title),
            ('fr', ci.fr_title),
            ('pl', ci.pl_title),
            ('bg', ci.bg_title)
    ) AS v(lang_code, title)
)
INSERT INTO catalog.category_translations (category_id, language_code, title, seo_description)
SELECT category_id, lang_code, title, seo_description
FROM expanded_translations
ON CONFLICT (category_id, language_code) DO UPDATE SET
    title = EXCLUDED.title,
    seo_description = COALESCE(NULLIF(catalog.category_translations.seo_description, ''), EXCLUDED.seo_description);

COMMIT;
