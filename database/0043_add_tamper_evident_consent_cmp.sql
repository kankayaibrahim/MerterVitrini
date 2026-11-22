-- Migration 0043: Tamper-Evident KVKK/GDPR Cookie & Consent Management Platform (c15t + Hash Chain + RFC 3161 TSA)
-- Strictly append-only ledger (WORM triggers), canonical SHA-256 hash chaining, Merkle batch roots,
-- independent free RFC 3161 timestamp anchors (DigiCert / Sectigo / FreeTSA), live cookie inventory & 8-lang cookie policy.

-- 1. Extend catalog.policy_type enum (MUST stay outside explicit transaction block)
ALTER TYPE catalog.policy_type ADD VALUE IF NOT EXISTS 'cookie_policy';

-- 2. Dedicated compliance schema
CREATE SCHEMA IF NOT EXISTS compliance;

-- 3. Immutable WORM protection trigger function (forbids UPDATE and DELETE on forensic evidence tables)
CREATE OR REPLACE FUNCTION compliance.prevent_immutable_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Compliance table % is append-only (WORM); % operations are forbidden for forensic integrity.', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

-- 4. Runtime CMP, Google Consent Mode v2, IAB TCF & TSA Settings
CREATE TABLE IF NOT EXISTS compliance.consent_settings (
    id                        INTEGER PRIMARY KEY CHECK (id = 1),
    banner_enabled            BOOLEAN NOT NULL DEFAULT true,
    banner_layout             VARCHAR(24) NOT NULL DEFAULT 'floating',
    floating_trigger_enabled  BOOLEAN NOT NULL DEFAULT true,
    ga_measurement_id         VARCHAR(64) NOT NULL DEFAULT 'G-CNMNCL62Q2',
    google_consent_mode       VARCHAR(24) NOT NULL DEFAULT 'always',
    reconsent_days            INTEGER NOT NULL DEFAULT 365,
    iab_enabled               BOOLEAN NOT NULL DEFAULT false,
    iab_cmp_id                INTEGER NOT NULL DEFAULT 0,
    tsa_primary_url           VARCHAR(255) NOT NULL DEFAULT 'http://timestamp.digicert.com',
    tsa_fallback_urls         JSONB NOT NULL DEFAULT '["http://timestamp.sectigo.com","https://freetsa.org/tsr"]'::jsonb,
    auto_anchor_interval_min  INTEGER NOT NULL DEFAULT 15,
    strict_opt_in_countries   JSONB NOT NULL DEFAULT '["TR","EU","EEA","GB","CH"]'::jsonb,
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO compliance.consent_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 5. Dynamic Cookie & Script Inventory (supports auto-scanner + admin curation across 8 languages)
CREATE TABLE IF NOT EXISTS compliance.cookie_inventory (
    id                    UUID PRIMARY KEY DEFAULT uuidv7(),
    cookie_name           VARCHAR(128) NOT NULL UNIQUE,
    category              VARCHAR(32) NOT NULL CHECK (category IN ('necessary', 'functionality', 'experience', 'measurement', 'marketing')),
    provider              VARCHAR(128) NOT NULL,
    domain                VARCHAR(180) NOT NULL DEFAULT 'mertervitrini.com.tr',
    storage_type          VARCHAR(32) NOT NULL DEFAULT 'cookie' CHECK (storage_type IN ('cookie', 'localStorage', 'sessionStorage', 'script')),
    duration              VARCHAR(120) NOT NULL DEFAULT 'Oturum / Session',
    is_third_party        BOOLEAN NOT NULL DEFAULT false,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    source                VARCHAR(32) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'auto_scan')),
    purpose_translations  JSONB NOT NULL DEFAULT '{}'::jsonb,
    last_seen_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Automated Cookie & Script Scanner Run History
CREATE TABLE IF NOT EXISTS compliance.cookie_scan_runs (
    id                UUID PRIMARY KEY DEFAULT uuidv7(),
    triggered_by      VARCHAR(128),
    scanned_urls      JSONB NOT NULL DEFAULT '[]'::jsonb,
    detected_count    INTEGER NOT NULL DEFAULT 0,
    new_cookies_count INTEGER NOT NULL DEFAULT 0,
    findings          JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 7. Immutable Policy & Cookie Inventory Snapshots (proves verbatim text shown at decision time)
CREATE TABLE IF NOT EXISTS compliance.consent_policy_snapshots (
    id                        UUID PRIMARY KEY DEFAULT uuidv7(),
    content_sha256            CHAR(64) NOT NULL UNIQUE,
    policy_version            INTEGER NOT NULL DEFAULT 1,
    language                  VARCHAR(10) NOT NULL,
    banner_copy               JSONB NOT NULL DEFAULT '{}'::jsonb,
    cookie_inventory_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    legal_policy_text         TEXT NOT NULL DEFAULT '',
    created_at                TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_consent_policy_snapshots_worm ON compliance.consent_policy_snapshots;
CREATE TRIGGER trg_consent_policy_snapshots_worm
    BEFORE UPDATE OR DELETE ON compliance.consent_policy_snapshots
    FOR EACH ROW EXECUTE FUNCTION compliance.prevent_immutable_mutation();

-- 8. Tamper-Evident Append-Only Consent Ledger (WORM + Prev-Hash Chain + Server HMAC)
CREATE TABLE IF NOT EXISTS compliance.consent_ledger (
    seq_no               BIGSERIAL NOT NULL UNIQUE,
    id                   UUID PRIMARY KEY DEFAULT uuidv7(),
    consent_ref_id       VARCHAR(32) NOT NULL UNIQUE,
    subject_id           VARCHAR(128) NOT NULL,
    visitor_id           VARCHAR(128),
    user_id              VARCHAR(128),
    user_email_hash      CHAR(64),
    supersedes_consent_id UUID,
    action               VARCHAR(32) NOT NULL CHECK (action IN ('accept_all', 'reject_all', 'custom', 'withdraw')),
    model                VARCHAR(24) NOT NULL DEFAULT 'opt-in',
    ui_source            VARCHAR(32) NOT NULL DEFAULT 'banner',
    given_consents       JSONB NOT NULL,
    google_consent_mode  JSONB NOT NULL DEFAULT '{}'::jsonb,
    tcf_tc_string        TEXT,
    addtl_consent        TEXT,
    gpc_signal           BOOLEAN NOT NULL DEFAULT false,
    policy_snapshot_id   UUID NOT NULL REFERENCES compliance.consent_policy_snapshots(id),
    policy_snapshot_hash CHAR(64) NOT NULL,
    language             VARCHAR(10) NOT NULL,
    country_code         VARCHAR(8),
    ip_masked            VARCHAR(64),
    ip_hash_sha256       CHAR(64),
    user_agent_hash      CHAR(64),
    page_url             TEXT,
    canonical_payload    TEXT NOT NULL,
    payload_sha256       CHAR(64) NOT NULL,
    prev_hash            CHAR(64) NOT NULL,
    entry_hash           CHAR(64) NOT NULL UNIQUE,
    server_hmac_sha256   CHAR(64) NOT NULL,
    recorded_at_utc      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_consent_ledger_worm ON compliance.consent_ledger;
CREATE TRIGGER trg_consent_ledger_worm
    BEFORE UPDATE OR DELETE ON compliance.consent_ledger
    FOR EACH ROW EXECUTE FUNCTION compliance.prevent_immutable_mutation();

CREATE INDEX IF NOT EXISTS idx_consent_ledger_subject ON compliance.consent_ledger (subject_id, seq_no DESC);
CREATE INDEX IF NOT EXISTS idx_consent_ledger_visitor ON compliance.consent_ledger (visitor_id, seq_no DESC) WHERE visitor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consent_ledger_user ON compliance.consent_ledger (user_id, seq_no DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_consent_ledger_date ON compliance.consent_ledger (recorded_at_utc DESC);
CREATE INDEX IF NOT EXISTS idx_consent_ledger_action ON compliance.consent_ledger (action);

-- 9. Independent RFC 3161 TSA Merkle Anchors (WORM-protected proofs verifiable offline by OpenSSL)
CREATE TABLE IF NOT EXISTS compliance.consent_merkle_anchors (
    anchor_seq        BIGSERIAL NOT NULL UNIQUE,
    id                UUID PRIMARY KEY DEFAULT uuidv7(),
    seq_from          BIGINT NOT NULL,
    seq_to            BIGINT NOT NULL,
    record_count      INTEGER NOT NULL,
    merkle_root       CHAR(64) NOT NULL,
    prev_anchor_hash  CHAR(64) NOT NULL,
    anchor_chain_hash CHAR(64) NOT NULL UNIQUE,
    tsa_provider      VARCHAR(120) NOT NULL,
    tsa_url           VARCHAR(255) NOT NULL,
    tsa_status        VARCHAR(32) NOT NULL,
    tsa_gen_time_utc  TIMESTAMPTZ,
    tsa_serial_hex    VARCHAR(128),
    tsa_policy_oid    VARCHAR(128),
    tsa_token_base64  TEXT NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_consent_merkle_anchors_worm ON compliance.consent_merkle_anchors;
CREATE TRIGGER trg_consent_merkle_anchors_worm
    BEFORE UPDATE OR DELETE ON compliance.consent_merkle_anchors
    FOR EACH ROW EXECUTE FUNCTION compliance.prevent_immutable_mutation();

-- 10. Seed default Cookie & Script Inventory for Merter Vitrini
INSERT INTO compliance.cookie_inventory (cookie_name, category, provider, domain, storage_type, duration, is_third_party, is_active, source, purpose_translations)
VALUES
(
    'c15t',
    'necessary',
    'Merter Vitrini CMP (c15t)',
    'mertervitrini.com.tr',
    'cookie',
    '365 gün / 1 year',
    false,
    true,
    'manual',
    '{"tr":"Ziyaretçinin çerez rıza tercihlerini ve rıza referans numarasını KVKK/GDPR uyarınca saklar.","en":"Stores visitor cookie consent choices and verifiable consent reference ID.","ru":"Сохраняет настройки согласия пользователя и идентификатор записи.","ar":"يحفظ اختيارات ملفات تعريف الارتباط ومعرّف إثبات الموافقة.","de":"Speichert die Cookie-Einwilligungen des Besuchers und die Nachweis-ID.","fr":"Enregistre les choix de consentement et la référence cryptographique.","pl":"Przechowuje zgody użytkownika na pliki cookie i numer dowodowy.","bg":"Съхранява избора на посетителя за бисквитки и доказателствения номер."}'::jsonb
),
(
    'store_user_token',
    'necessary',
    'Merter Vitrini / Keycloak IAM',
    'mertervitrini.com.tr',
    'localStorage',
    'Oturum süresince / Session',
    false,
    true,
    'manual',
    '{"tr":"Giriş yapmış toptan alıcı ve tedarikçilerin güvenli oturum kimliğini korur.","en":"Maintains authenticated session security for B2B buyers and suppliers.","ru":"Поддерживает безопасную сессию авторизованных оптовых покупателей.","ar":"يحافظ على أمان جلسة تسجيل الدخول للمشترين والموردين.","de":"Hält die sichere Sitzung angemeldeten B2B-Käufer und Lieferanten aufrecht.","fr":"Maintient la session sécurisée des acheteurs et fournisseurs connectés.","pl":"Utrzymuje bezpieczną sesję zalogowanych kupujących i dostawców B2B.","bg":"Поддържа сигурна сесия за влезли B2B купувачи и доставчици."}'::jsonb
),
(
    'merter_b2b_cart',
    'necessary',
    'Merter Vitrini',
    'mertervitrini.com.tr',
    'localStorage',
    'Kalıcı / Persistent',
    false,
    true,
    'manual',
    '{"tr":"Seçtiğiniz seri/paket sepet kalemlerini tedarikçilere iletilmek üzere cihazınızda tutar.","en":"Retains wholesale cart pack selections in your browser prior to order dispatch.","ru":"Сохраняет выбранные серии и упаковки в корзине перед отправкой поставщикам.","ar":"يحتفظ بمنتجات سلة الجملة في متصفحك قبل إرسال الطلب للموردين.","de":"Speichert ausgewählte Großhandelsserien im Warenkorb bis zur Anfrage.","fr":"Conserve vos séries sélectionnées dans le panier avant l’envoi aux fournisseurs.","pl":"Przechowuje wybrane pakiety w koszyku B2B przed wysłaniem zapytania.","bg":"Запазва избраните серии в количката преди изпращане към доставчиците."}'::jsonb
),
(
    '_grecaptcha',
    'necessary',
    'Google reCAPTCHA v3',
    'google.com',
    'localStorage',
    '6 ay / 6 months',
    true,
    true,
    'manual',
    '{"tr":"Bot saldırılarını, sahte üyelikleri ve spam sipariş taleplerini engellemek için zorunlu güvenlik doğrulamasıdır.","en":"Essential anti-bot protection preventing spam registrations and fraudulent quote requests.","ru":"Обязательная защита от ботов и спам-запросов.","ar":"حماية أمنية ضرورية لمنع البوتات والطلبات الوهمية.","de":"Erforderlicher Bot-Schutz gegen Missbrauch und Spam-Anfragen.","fr":"Protection anti-bot obligatoire sécurisant les formulaires B2B.","pl":"Niezbędna ochrona przed botami i fałszywymi zapytaniami.","bg":"Задължителна защита срещу ботове и спам заявки."}'::jsonb
),
(
    'preferred_lang',
    'functionality',
    'Merter Vitrini',
    'mertervitrini.com.tr',
    'localStorage',
    '365 gün / 1 year',
    false,
    true,
    'manual',
    '{"tr":"Seçtiğiniz arayüz dilini (TR/EN/RU/AR/DE/FR/PL/BG) sonraki ziyaretlerde hatırlar.","en":"Remembers your chosen interface language across visits.","ru":"Запоминает выбранный язык интерфейса.","ar":"يتذكر لغة الواجهة المختارة عند زيارتك القادمة.","de":"Speichert Ihre gewählte Anzeigesprache.","fr":"Mémorise votre langue d’affichage préférée.","pl":"Zapamiętuje wybrany język interfejsu.","bg":"Запомня избрания език на интерфейса."}'::jsonb
),
(
    'merter_preferred_currency',
    'functionality',
    'Merter Vitrini',
    'mertervitrini.com.tr',
    'localStorage',
    '365 gün / 1 year',
    false,
    true,
    'manual',
    '{"tr":"Tercih ettiğiniz para birimi gösterimini (TRY/USD/EUR/GBP) korur.","en":"Remembers your preferred display currency (TRY/USD/EUR/GBP).","ru":"Сохраняет выбранную валюту отображения цен.","ar":"يحفظ عملة العرض المفضلة لديك.","de":"Merkt sich Ihre bevorzugte Anzeigewährung.","fr":"Conserve votre devise d’affichage préférée.","pl":"Zapamiętuje wybraną walutę wyświetlania cen.","bg":"Запазва предпочитаната валута за показване на цените."}'::jsonb
),
(
    'euconsent-v2',
    'experience',
    'IAB TCF 2.2 CMP',
    'mertervitrini.com.tr',
    'cookie',
    '365 gün / 1 year',
    false,
    true,
    'manual',
    '{"tr":"IAB TCF uyumu aktif edildiğinde reklam ortaklarıyla standart TC dizesini paylaşır.","en":"Stores standard IAB Transparency & Consent Framework v2 preference string when enabled.","ru":"Хранит строку согласия IAB TCF v2 при активации.","ar":"يحفظ سلسلة تفضيلات IAB TCF v2 عند التفعيل.","de":"Speichert die standardisierte IAB TCF v2 Einwilligungszeichenfolge.","fr":"Enregistre la chaîne de consentement standard IAB TCF v2 lorsque activée.","pl":"Przechowuje ciąg preferencji IAB TCF v2 po jego włączeniu.","bg":"Съхранява низа за съгласие по IAB TCF v2 при активиране."}'::jsonb
),
(
    '_ga',
    'measurement',
    'Google Analytics 4',
    '.mertervitrini.com.tr',
    'cookie',
    '2 yıl / 2 years',
    true,
    true,
    'manual',
    '{"tr":"Ziyaretçi trafiğini, kategori ilgisini ve site performansını anonimleştirerek ölçer (Google Consent Mode v2 uyumlu).","en":"Distinguishes unique sessions for anonymized traffic & catalog performance analytics under Google Consent Mode v2.","ru":"Измеряет посещаемость и эффективность каталога в анонимном виде (Consent Mode v2).","ar":"يقيس زيارات الموقع وأداء الفئات بشكل مجهول الهوية وفق Consent Mode v2.","de":"Misst anonymisierte Besucherströme und Kategorieleistung unter Google Consent Mode v2.","fr":"Mesure l’audience de façon anonymisée selon Google Consent Mode v2.","pl":"Mierzy anonimowy ruch i wydajność katalogu zgodnie z Google Consent Mode v2.","bg":"Измерва анонимизирания трафик и ефективността на каталога с Consent Mode v2."}'::jsonb
),
(
    '_ga_*',
    'measurement',
    'Google Analytics 4',
    '.mertervitrini.com.tr',
    'cookie',
    '2 yıl / 2 years',
    true,
    true,
    'manual',
    '{"tr":"GA4 oturum durumunu sürdürür; rıza geri çekildiğinde otomatik olarak temizlenir.","en":"Maintains GA4 session state; automatically purged if measurement consent is revoked.","ru":"Поддерживает состояние сессии GA4; удаляется при отзыве согласия.","ar":"يحافظ على حالة جلسة GA4 ويُحذف تلقائياً عند سحب الموافقة.","de":"Verwaltet den GA4-Sitzungsstatus; wird bei Widerruf automatisch gelöscht.","fr":"Maintient l’état de session GA4 ; supprimé automatiquement en cas de retrait.","pl":"Utrzymuje stan sesji GA4; usuwany automatycznie po wycofaniu zgody.","bg":"Поддържа състоянието на GA4 сесия; изтрива се при оттегляне на съгласието."}'::jsonb
),
(
    'mv_vid / mv_sid',
    'measurement',
    'Merter Vitrini Analytics',
    'mertervitrini.com.tr',
    'localStorage',
    '30 dk oturum / 1 yıl',
    false,
    true,
    'manual',
    '{"tr":"Arama/kategori performansı, sıcak alıcı metrikleri ve tedarikçi görüntülenme raporları için birinci taraf ölçüm sağlar.","en":"Provides first-party catalog analytics, zero-result search insights, and supplier view metrics.","ru":"Обеспечивает внутреннюю аналитику просмотров категорий и поставщиков.","ar":"يوفر تحليلات داخلية لأداء البحث ومشاهدات الموردين.","de":"Ermöglicht First-Party-Katalog- und Suchanalysen.","fr":"Fournit des statistiques internes de consultation des catalogues et fournisseurs.","pl":"Zapewnia własną analitykę wyszukiwań i wyświetleń dostawców.","bg":"Осигурява вътрешен анализ на търсенията и прегледите на доставчици."}'::jsonb
),
(
    '_gcl_au',
    'marketing',
    'Google Ads / Conversion Linker',
    '.mertervitrini.com.tr',
    'cookie',
    '90 gün / 90 days',
    true,
    true,
    'manual',
    '{"tr":"Yalnızca pazarlama/reklam izni verildiğinde reklam dönüşüm performansını ilişkilendirmek için kullanılır.","en":"Used strictly when marketing consent is granted to measure advertising campaign effectiveness.","ru":"Используется только при согласии на маркетинг для оценки эффективности рекламы.","ar":"يُستخدم فقط عند الموافقة على التسويق لقياس فعالية الحملات الإعلانية.","de":"Wird ausschließlich nach Marketing-Einwilligung zur Kampagnenmessung eingesetzt.","fr":"Utilisé uniquement avec votre accord marketing pour mesurer l’efficacité des campagnes.","pl":"Używany wyłącznie po wyrażeniu zgody marketingowej do oceny skuteczności reklam.","bg":"Използва се само след маркетингово съгласие за измерване на рекламни кампании."}'::jsonb
)
ON CONFLICT (cookie_name) DO UPDATE
SET category = EXCLUDED.category,
    provider = EXCLUDED.provider,
    domain = EXCLUDED.domain,
    storage_type = EXCLUDED.storage_type,
    duration = EXCLUDED.duration,
    is_third_party = EXCLUDED.is_third_party,
    purpose_translations = EXCLUDED.purpose_translations,
    updated_at = CURRENT_TIMESTAMP;

-- 11. Active Cookie Policy (cookie_policy v1) in catalog.legal_policies
INSERT INTO catalog.legal_policies (id, policy_type, policy_version, title, content, is_active)
VALUES (
    uuidv7(),
    'cookie_policy',
    1,
    $doc$Çerez (Cookie) Politikası, Google Consent Mode v2 ve Rıza Yönetimi Aydınlatma Metni$doc$,
    $doc$MERTER VİTRİNİ (mertervitrini.com.tr)
ÇEREZ POLİTİKASI VE RIZA YÖNETİMİ AYDINLATMA METNİ (v1)

1. GENEL BİLGİLENDİRME VE HUKUKİ DAYANAK
6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK"), Kişisel Verileri Koruma Kurulu'nun Çerez Uygulamaları Rehberi ve Avrupa Birliği ePrivacy / GDPR standartları uyarınca mertervitrini.com.tr ("Platform"), ziyaretçilerine hangi çerezlerin hangi amaçla kullanıldığını şeffaf biçimde sunar ve zorunlu çerezler dışındaki tüm kategoriler için önceden açık rıza alır.

2. ÇEREZ KATEGORİLERİ
- Zorunlu Çerezler (necessary): Platformun güvenliği (reCAPTCHA v3), üye/tedarikçi oturum yönetimi, sepet kalemlerinin korunması ve çerez tercihlerinizin kaydedilmesi için teknik olarak zorunludur; kapatılamaz.
- İşlevsellik Çerezleri (functionality): Seçtiğiniz dil (TR/EN/RU/AR/DE/FR/PL/BG) ve para birimi (TRY/USD/EUR/GBP) tercihlerini hatırlar.
- Deneyim Çerezleri (experience): Kişiselleştirilmiş vitrin ve gizlilik tercih dizelerinin (varsa IAB TCF) yönetimini destekler.
- Ölçüm / Analitik Çerezleri (measurement): Google Consent Mode v2 (`analytics_storage`) ve birinci taraf katalog analitiği kapsamında ziyaretçi istatistiklerini anonimleştirilmiş biçimde analiz eder.
- Pazarlama Çerezleri (marketing): `ad_storage`, `ad_user_data` ve `ad_personalization` sinyalleri doğrultusunda yalnızca açık rızanız halinde reklam ölçümlemesi yapar.

3. DEĞİŞTİRİLEMEZ RIZA KAYIT SİSTEMİ (BİLİRKİŞİ DOĞRULAMASI)
Merter Vitrini üzerinde çerez rızası verdiğinizde, reddettiğinizde veya tercihlerinizi değiştirdiğinizde:
- Önceki kaydın üzerine yazılmaz; WORM (güncellenemez/silinemez) veritabanı defterine yeni bir sıralı kayıt eklenir.
- Gösterilen politika metni ve çerez envanteri SHA-256 özeti (`policy_snapshot_hash`), önceki kayıt özeti (`prev_hash`) ve kanonik JSON yükü birbirine zincirlenir.
- Kayıtlar periyodik olarak Merkle ağacı ile bağımsız RFC 3161 Zaman Damgası Otoriteleri (DigiCert / Sectigo / FreeTSA) nezdinde zaman damgasıyla mühürlenir.
- Tarayıcınızda oluşan "Rıza Referans Kodu"nu istediğiniz zaman Çerez Tercihleri panelinden görüntüleyebilir ve tercihinizi dilediğiniz an geri çekebilirsiniz.$doc$,
    true
)
ON CONFLICT (policy_type, policy_version) DO UPDATE
SET title = EXCLUDED.title,
    content = EXCLUDED.content,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP;

-- 12. Publish 8-Language Cookie Policy CMS Page (/pages/cerez-politikasi)
INSERT INTO catalog.pages (id, slug, is_active)
VALUES (uuidv7(), 'cerez-politikasi', true)
ON CONFLICT (slug) DO UPDATE
SET is_active = true,
    updated_at = CURRENT_TIMESTAMP;

DO $cpage$
DECLARE
    v_page_id UUID;
BEGIN
    SELECT id INTO v_page_id FROM catalog.pages WHERE slug = 'cerez-politikasi';

    INSERT INTO catalog.page_translations (page_id, language_code, title, content, meta_title, meta_description)
    VALUES
    (
        v_page_id, 'tr',
        'Çerez (Cookie) Politikası ve KVKK Rıza Yönetimi',
        $html$<article>
<h2>1. Çerez Politikası ve Kapsam</h2>
<p><strong>mertervitrini.com.tr</strong> ("Platform"), 6698 sayılı KVKK ve uluslararası GDPR / ePrivacy standartları doğrultusunda çerez yönetimi altyapısı olarak <strong>c15t Consent Management</strong> ve <strong>Google Consent Mode v2</strong> kullanır. Zorunlu teknik çerezler dışında hiçbir analitik veya pazarlama çerezi açık rızanız olmadan etkinleştirilmez.</p>
<h2>2. Çerez Kategorileri</h2>
<ul>
<li><strong>Zorunlu:</strong> Güvenlik (Google reCAPTCHA v3), B2B üye oturumu, sepet kalemleri ve rıza tercih kaydı (`c15t`).</li>
<li><strong>İşlevsellik:</strong> Dil (8 dil) ve para birimi (TRY/USD/EUR/GBP) tercihlerinin hatırlanması.</li>
<li><strong>Deneyim:</strong> Arayüz deneyimi ve standart gizlilik sinyallerinin korunması.</li>
<li><strong>Ölçüm / Analitik:</strong> Google Analytics 4 (`analytics_storage`) ve arama/katalog performans istatistikleri.</li>
<li><strong>Pazarlama:</strong> `ad_storage`, `ad_user_data` ve `ad_personalization` sinyalleri kapsamındaki reklam ölçümlemesi.</li>
</ul>
<h2>3. Değiştirilemez Rıza İspat ve RFC 3161 Zaman Damgası Mimarisi</h2>
<p>Tüm onay, ret ve geri çekme işlemleri geriye dönük değiştirilemeyen ekleme-tabanlı (append-only / WORM) kayıt defterine işlenir, SHA-256 hash zinciri ile bağlanır ve bağımsız RFC 3161 Zaman Damgası (DigiCert / Sectigo / FreeTSA) ile mühürlenir. Footer alanındaki <strong>"Çerez Tercihleri"</strong> bağlantısından rıza makbuzunuzu görebilir veya tercihlerinizi anında güncelleyebilirsiniz.</p>
</article>$html$,
        'Çerez Politikası ve KVKK Rıza Yönetimi | Merter Vitrini',
        'Merter Vitrini çerez politikası, Google Consent Mode v2 ayarları ve değiştirilemez RFC 3161 zaman damgalı KVKK rıza yönetim merkezi.'
    ),
    (
        v_page_id, 'en',
        'Cookie Policy & Privacy Preferences (KVKK / GDPR)',
        $html$<article>
<h2>1. Cookie Management &amp; Legal Standards</h2>
<p><strong>mertervitrini.com.tr</strong> uses <strong>c15t</strong> Consent Management and <strong>Google Consent Mode v2</strong> in compliance with Turkish Law No. 6698 (KVKK), EU GDPR, and ePrivacy rules. Strictly necessary security and session storage aside, no analytics or marketing cookies are activated without your explicit consent.</p>
<h2>2. Categories Managed on This Platform</h2>
<ul>
<li><strong>Necessary:</strong> Anti-bot protection (reCAPTCHA v3), authenticated B2B sessions, wholesale cart persistence, and consent receipt storage (`c15t`).</li>
<li><strong>Functionality:</strong> Language (8 languages) and display currency preferences.</li>
<li><strong>Experience:</strong> User experience and standard privacy preference strings.</li>
<li><strong>Measurement:</strong> Google Analytics 4 (`analytics_storage`) and catalog performance analytics.</li>
<li><strong>Marketing:</strong> Advertising signals (`ad_storage`, `ad_user_data`, `ad_personalization`) strictly gated on explicit consent.</li>
</ul>
<h2>3. Tamper-Evident Audit Chain &amp; RFC 3161 Timestamping</h2>
<p>Every consent action is appended to an immutable WORM ledger chained via SHA-256 and periodically sealed with independent RFC 3161 Trusted Timestamps. Open <strong>"Cookie Preferences"</strong> in the footer anytime to inspect your receipt or withdraw consent.</p>
</article>$html$,
        'Cookie Policy & Consent Preferences | Merter Vitrini',
        'Merter Vitrini cookie policy, Google Consent Mode v2 compliance, and immutable RFC 3161 timestamped consent records.'
    ),
    (
        v_page_id, 'ru',
        'Политика в отношении файлов Cookie и управление согласием',
        $html$<article>
<h2>1. Управление файлами Cookie (KVKK / GDPR)</h2>
<p>Платформа <strong>mertervitrini.com.tr</strong> использует систему <strong>c15t</strong> и <strong>Google Consent Mode v2</strong>. Необязательные аналитические и маркетинговые cookie не активируются без вашего явного согласия.</p>
<h2>2. Категории</h2>
<ul>
<li><strong>Обязательные:</strong> безопасность (reCAPTCHA v3), сессия B2B, корзина и запись вашего выбора (`c15t`).</li>
<li><strong>Функциональные:</strong> язык интерфейса и выбранная валюта.</li>
<li><strong>Персонализация / Опыт:</strong> сохранение пользовательских параметров отображения.</li>
<li><strong>Аналитика:</strong> Google Analytics 4 и статистика поиска по каталогу.</li>
<li><strong>Маркетинг:</strong> рекламные сигналы Consent Mode v2 только после согласия.</li>
</ul>
<h2>3. Неизменяемый журнал и метки времени RFC 3161</h2>
<p>Каждое решение фиксируется в неизменяемом журнале SHA-256 и заверяется независимыми метками времени RFC 3161. Изменить выбор можно в любое время через ссылку <strong>«Настройки Cookie»</strong> внизу страницы.</p>
</article>$html$,
        'Политика Cookie | Merter Vitrini',
        'Политика использования файлов cookie и неизменяемый журнал согласий KVKK/GDPR на Merter Vitrini.'
    ),
    (
        v_page_id, 'ar',
        'سياسة ملفات تعريف الارتباط وإدارة الموافقات',
        $html$<article dir="rtl">
<h2>1. سياسة ملفات تعريف الارتباط</h2>
<p>تعتمد منصة <strong>mertervitrini.com.tr</strong> نظام <strong>c15t</strong> و<strong>Google Consent Mode v2</strong> وفقاً لقانون حماية البيانات (KVKK / GDPR). لا يتم تفعيل أي ملفات إحصائية أو تسويقية دون موافقتك الصريحة المسبقة.</p>
<h2>2. فئات ملفات تعريف الارتباط</h2>
<ul>
<li><strong>ضرورية:</strong> الحماية الأمنية، جلسات الحسابات التجارية، سلة الجملة وتوثيق تفضيلات الموافقة.</li>
<li><strong>وظيفية:</strong> تذكر اللغة والعملة المفضلة.</li>
<li><strong>التجربة:</strong> حفظ تفضيلات التصفح والخصوصية القياسية.</li>
<li><strong>القياس والتحليل:</strong> قياس حركة الزوار وأداء الكتالوج بعد الموافقة.</li>
<li><strong>التسويق:</strong> إشارات الإعلانات بموافقة صريحة فقط.</li>
</ul>
<h2>3. سجل إثبات غير قابل للتعديل وطابع زمني RFC 3161</h2>
<p>يتم تسجيل كل قرار في سجل غير قابل للتعديل ومختوم بسلسلة SHA-256 وطوابع زمنية مستقلة RFC 3161. يمكنك تعديل اختياراتك في أي وقت عبر زر <strong>«تفضيلات ملفات الارتباط»</strong>.</p>
</article>$html$,
        'سياسة ملفات تعريف الارتباط | Merter Vitrini',
        'سياسة ملفات تعريف الارتباط وسجل الموافقات غير القابل للتعديل في Merter Vitrini.'
    ),
    (
        v_page_id, 'de',
        'Cookie-Richtlinie & Einwilligungsverwaltung (DSGVO / KVKK)',
        $html$<article>
<h2>1. Cookie-Verwaltung &amp; Google Consent Mode v2</h2>
<p><strong>mertervitrini.com.tr</strong> nutzt <strong>c15t</strong> und <strong>Google Consent Mode v2</strong> gemäß DSGVO/ePrivacy und KVKK. Optionale Analyse- oder Marketing-Cookies werden erst nach Ihrer ausdrücklichen Einwilligung aktiviert.</p>
<h2>2. Kategorien</h2>
<ul>
<li><strong>Unbedingt erforderlich:</strong> Sicherheit (reCAPTCHA v3), B2B-Sitzung, Warenkorb und Speicherung Ihrer Einwilligung.</li>
<li><strong>Funktionalität:</strong> Sprach- und Währungspräferenzen.</li>
<li><strong>Erlebnis:</strong> Oberflächeneinstellungen und Datenschutzsignale.</li>
<li><strong>Messung / Statistik:</strong> Anonymisierte Nutzungs- und Kataloganalyse.</li>
<li><strong>Marketing:</strong> Werbemessung ausschließlich mit Ihrer Zustimmung.</li>
</ul>
<h2>3. Revisionssicheres Protokoll &amp; RFC 3161 Zeitstempel</h2>
<p>Jede Entscheidung wird unveränderbar (WORM) mit SHA-256 verkettet und regelmäßig durch unabhängige RFC-3161-Zeitstempel gesiegelt. Über <strong>„Cookie-Einstellungen“</strong> im Footer können Sie jederzeit Ihren Beleg prüfen oder widerrufen.</p>
</article>$html$,
        'Cookie-Richtlinie | Merter Vitrini',
        'Cookie-Richtlinie, Google Consent Mode v2 und unveränderbare RFC-3161-Einwilligungsprotokolle.'
    ),
    (
        v_page_id, 'fr',
        'Politique relative aux cookies et gestion du consentement',
        $html$<article>
<h2>1. Gestion des cookies (RGPD / KVKK)</h2>
<p><strong>mertervitrini.com.tr</strong> intègre <strong>c15t</strong> et <strong>Google Consent Mode v2</strong>. Aucun traceur analytique ou publicitaire n’est activé sans votre consentement préalable explicite.</p>
<h2>2. Catégories</h2>
<ul>
<li><strong>Nécessaires :</strong> sécurité anti-bot, session B2B, panier grossiste et preuve de consentement (`c15t`).</li>
<li><strong>Fonctionnels :</strong> langue d’affichage et devise préférée.</li>
<li><strong>Expérience :</strong> préférences d’expérience et signaux de confidentialité.</li>
<li><strong>Mesure d’audience :</strong> statistiques Google Analytics 4 et catalogue après consentement.</li>
<li><strong>Marketing :</strong> signaux publicitaires soumis au consentement explicite.</li>
</ul>
<h2>3. Journal infalsifiable et horodatage RFC 3161</h2>
<p>Chaque action est enregistrée dans un journal immuable (WORM) chaîné par SHA-256 et horodaté via RFC 3161. Vous pouvez consulter votre reçu ou modifier vos choix à tout moment via <strong>« Préférences cookies »</strong>.</p>
</article>$html$,
        'Politique Cookies | Merter Vitrini',
        'Politique cookies, Google Consent Mode v2 et registre de consentement horodaté RFC 3161.'
    ),
    (
        v_page_id, 'pl',
        'Polityka plików Cookie i zarządzanie zgodami (RODO / KVKK)',
        $html$<article>
<h2>1. Zarządzanie plikami Cookie</h2>
<p>Platforma <strong>mertervitrini.com.tr</strong> korzysta z silnika <strong>c15t</strong> oraz <strong>Google Consent Mode v2</strong>. Pliki analityczne i marketingowe nie są uruchamiane bez uprzedniej wyraźnej zgody użytkownika.</p>
<h2>2. Kategorie plików cookie</h2>
<ul>
<li><strong>Niezbędne:</strong> ochrona antyspamowa, sesja B2B, koszyk hurtowy oraz zapis preferencji (`c15t`).</li>
<li><strong>Funkcjonalne:</strong> zapamiętywanie języka i waluty.</li>
<li><strong>Doświadczenie:</strong> ustawienia komfortu i standardowe sygnały prywatności.</li>
<li><strong>Analityka / Pomiary:</strong> statystyki ruchu i katalogu po uzyskaniu zgody.</li>
<li><strong>Marketing:</strong> sygnały reklamowe uruchamiane wyłącznie po wyrażeniu zgody.</li>
</ul>
<h2>3. Niezmienny rejestr dowodowy i znaczniki czasu RFC 3161</h2>
<p>Każda zgoda i wycofanie zgody są dopisywane do niezmiennego rejestru WORM (łańcuch SHA-256) oraz pieczętowane niezależnym znacznikiem czasu RFC 3161. W stopce w każdej chwili otworzysz <strong>„Preferencje cookies”</strong>.</p>
</article>$html$,
        'Polityka Cookie | Merter Vitrini',
        'Polityka plików cookie, Google Consent Mode v2 i niezmienny rejestr zgód z pieczęcią czasu RFC 3161.'
    ),
    (
        v_page_id, 'bg',
        'Политика за бисквитки (Cookies) и управление на съгласието',
        $html$<article>
<h2>1. Управление на бисквитки и съответствие с GDPR / KVKK</h2>
<p><strong>mertervitrini.com.tr</strong> използва <strong>c15t</strong> и <strong>Google Consent Mode v2</strong>. Незадължителните аналитични и маркетингови бисквитки не се активират без вашето изрично предварително съгласие.</p>
<h2>2. Категории бисквитки</h2>
<ul>
<li><strong>Необходими:</strong> сигурност (reCAPTCHA v3), B2B сесия, количка и запис на съгласието (`c15t`).</li>
<li><strong>Функционални:</strong> запомняне на избрания език и валута.</li>
<li><strong>Изживяване:</strong> настройки на интерфейса и стандартни сигнали за поверителност.</li>
<li><strong>Измерване / Аналитика:</strong> анонимизирани статистики след дадено съгласие.</li>
<li><strong>Маркетинг:</strong> рекламни сигнали единствено при изрично съгласие.</li>
</ul>
<h2>3. Непроменим доказателствен регистър и RFC 3161 печат за време</h2>
<p>Всяко решение се записва в регистър без право на редакция (WORM), свързан с SHA-256 верига и независим RFC 3161 печат за време. По всяко време можете да отворите <strong>„Предпочитания за бисквитки“</strong> в долния колонтитул.</p>
</article>$html$,
        'Политика за бисквитки | Merter Vitrini',
        'Политика за бисквитки, Google Consent Mode v2 и непроменим доказателствен регистър с RFC 3161.'
    )
    ON CONFLICT (page_id, language_code) DO UPDATE
    SET title = EXCLUDED.title,
        content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title,
        meta_description = EXCLUDED.meta_description;
END $cpage$;
