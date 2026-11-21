-- Migration 0042: Hosting-Provider (5651 Yer Saglayici), Direct-Seller Disclaimer,
-- Supplier Copyright/IP Indemnification, Legal Consent Audit Logs & 8-Language Legal CMS Pages

-- 1. Extend catalog.policy_type enum (must run outside explicit transaction block)
ALTER TYPE catalog.policy_type ADD VALUE IF NOT EXISTS 'supplier_agreement';
ALTER TYPE catalog.policy_type ADD VALUE IF NOT EXISTS 'copyright_and_takedown';

-- 2. Legal consent audit trail table & consent tracking columns
CREATE TABLE IF NOT EXISTS catalog.legal_consent_logs (
    id                 UUID PRIMARY KEY DEFAULT uuidv7(),
    consent_type       VARCHAR(64) NOT NULL,
    policy_type        VARCHAR(64) NOT NULL,
    policy_version     INTEGER NOT NULL DEFAULT 1,
    actor_role         VARCHAR(32) NOT NULL,
    actor_user_id      VARCHAR(128),
    brand_id           UUID,
    entity_type        VARCHAR(64),
    entity_id          VARCHAR(128),
    email              VARCHAR(255),
    ip_address         VARCHAR(64),
    user_agent         TEXT,
    accepted_text_hash VARCHAR(64),
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    accepted_at        TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_legal_consent_logs_actor_user
    ON catalog.legal_consent_logs (actor_user_id) WHERE actor_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legal_consent_logs_brand
    ON catalog.legal_consent_logs (brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legal_consent_logs_type_date
    ON catalog.legal_consent_logs (consent_type, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_consent_logs_entity
    ON catalog.legal_consent_logs (entity_type, entity_id) WHERE entity_id IS NOT NULL;

ALTER TABLE identity.users
    ADD COLUMN IF NOT EXISTS terms_accepted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS terms_accepted_version INTEGER;

ALTER TABLE catalog.supplier_applications
    ADD COLUMN IF NOT EXISTS legal_terms_accepted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS legal_terms_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS legal_terms_version INTEGER;

ALTER TABLE catalog.products
    ADD COLUMN IF NOT EXISTS content_responsibility_accepted BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS content_responsibility_accepted_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS content_responsibility_version INTEGER;

-- 3. Active legal policies in catalog.legal_policies (structured plain text for PolicyViewerModal)
UPDATE catalog.legal_policies
SET is_active = false, updated_at = CURRENT_TIMESTAMP
WHERE (policy_type = 'terms_of_service' AND policy_version < 2)
   OR (policy_type = 'cancellation_and_return' AND policy_version < 2)
   OR (policy_type = 'privacy_policy' AND policy_version < 2)
   OR (policy_type = 'supplier_agreement' AND policy_version <> 1)
   OR (policy_type = 'copyright_and_takedown' AND policy_version <> 1);

INSERT INTO catalog.legal_policies (id, policy_type, policy_version, title, content, is_active)
VALUES
(
    uuidv7(),
    'terms_of_service',
    2,
    $doc$Üyelik, Platform Kullanım ve Yer Sağlayıcı Çerçeve Sözleşmesi$doc$,
    $doc$MERTER VİTRİNİ (mertervitrini.com.tr)
ÜYELİK, PLATFORM KULLANIM VE YER SAĞLAYICI ÇERÇEVE SÖZLEŞMESİ (v2)

1. TARAFLAR VE PLATFORMUN HUKUKİ STATÜSÜ (5651 SAYILI KANUN MADDE 5)
1.1. mertervitrini.com.tr alan adı, alt alan adları ve bağlantılı mobil/web uygulamaları ("Platform"), 5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun'un 5. maddesi kapsamında "Yer Sağlayıcı" statüsünde faaliyet göstermektedir.
1.2. Platform; toptan hazır giyim, tekstil, aksesuar ve yan sanayi alanında faaliyet gösteren bağımsız üretici ve toptancı firmaların ("Tedarikçi") kendi ürünlerini, toptan fiyatlarını, seri/paket bilgilerini ve doğrudan iletişim kanallarını ticari alıcılara ("Alıcı" veya "Üye") sergilediği dijital bir B2B vitrin ve eşleştirme altyapısıdır.

2. MERTER VİTRİNİ DOĞRUDAN SATICI DEĞİLDİR
2.1. Merter Vitrini; Platform üzerinde sergilenen hiçbir ürünün maliki, üreticisi, ithalatçısı, doğrudan satıcısı, yetkili bayisi, acentesi, komisyoncusu veya lojistik/ödeme garantörü DEĞİLDİR.
2.2. Her ürün sayfasında, sepet özetinde ve firma vitrininde açık ticari unvanı ile iletişim bilgileri yer alan ilgili Tedarikçi, söz konusu ürünün tek "Doğrudan Satıcısı" ve 5651 sayılı Kanun anlamında "İçerik Sağlayıcısı"dır.
2.3. Platformda bir ürünün sergilenmesi, sepet/sipariş talebi oluşturulması, canlı B2B sohbet başlatılması veya WhatsApp hattına yönlendirme yapılması; Merter Vitrini ile Alıcı arasında bir satım sözleşmesi, vekâlet, garanti, kefalet veya emanet (escrow) ilişkisi kurulduğu anlamına gelmez.

3. TİCARİ İŞLEM, ÖDEME, FATURA VE TESLİMAT SORUMLULUĞU
3.1. Ürün bedeli, ödeme şekli, banka/IBAN/havale bilgileri, nakliye/kargo organizasyonu, gümrükleme, e-Fatura/e-Arşiv fatura düzenlenmesi, ürün kalitesi, beden/renk uygunluğu ve teslimat süreçleri münhasıran Alıcı ile doğrudan satıcı olan Tedarikçi arasında kurulacak ticari sözleşmeye tabidir.
3.2. Merter Vitrini hiçbir Tedarikçi adına ürün bedeli tahsil etmez ve ödeme aracılığı garantisi vermez. Ödemeler doğrudan Alıcı ile Tedarikçi arasında kararlaştırılan kanal üzerinden gerçekleşir.

4. MÜŞTERİ ŞİKAYETLERİ, AYIPLI MAL VE UYUŞMAZLIKLARDA MUHATAP
4.1. Alıcı; satın aldığı veya sipariş verdiği ürüne ilişkin her türlü ayıplı mal, eksik teslimat, geç teslimat, taklit/marka ihlali iddiası, iade, değişim, bedel iadesi, fatura veya ticari ihtilaf talebini DOĞRUDAN ve MÜNHASIRAN ilgili satışı gerçekleştiren Tedarikçi firmaya yöneltmekle yükümlüdür.
4.2. Alıcı, Tedarikçiler ile arasında doğabilecek her türlü ticari, mali veya hukuki uyuşmazlıkta Merter Vitrini'nin taraf olmadığını; bu uyuşmazlıklardan doğan doğrudan veya dolaylı zararlardan Merter Vitrini'ne hiçbir sorumluluk yöneltilemeyeceğini gayrikabili rücu kabul ve beyan eder.

5. B2B TİCARİ KULLANIM VE İÇERİK DENETİMİ
5.1. Platform münhasıran tacirler, esnaflar, butikler, toptancılar ve ihracatçılar arasındaki B2B (işletmeden işletmeye) ticari iletişim için sunulmaktadır. 6563 sayılı Elektronik Ticaretin Düzenlenmesi Hakkında Kanun ve ilgili mevzuat uyarınca Merter Vitrini, Tedarikçiler tarafından sağlanan içeriğin hukuka aykırılığını veya fikri mülkiyet ihlali teşkil edip etmediğini önceden denetlemekle yükümlü değildir.
5.2. Hukuka aykırılık veya telif/marka ihlali iddiaları için "Telif Hakkı ve Uyar-Kaldır Politikası" kapsamında bildirilen somut içerikler ivedilikle değerlendirilir ve gerekli hallerde yayından kaldırılır.

6. YETKİLİ MAHKEME VE YÜRÜRLÜK
6.1. Üye, kayıt formundaki onay kutucuğunu işaretleyerek bu Sözleşmenin tüm hükümlerini okuduğunu ve kabul ettiğini elektronik ortamda onaylar; onay anı IP adresi ve zaman damgası ile kayıt altına alınır.
6.2. İşbu Sözleşmeden doğan uyuşmazlıklarda Türk Hukuku uygulanır; İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri yetkilidir.$doc$,
    true
),
(
    uuidv7(),
    'supplier_agreement',
    1,
    $doc$Tedarikçi Üyelik, İçerik Sağlayıcı ve Hukuki Sorumluluk Sözleşmesi$doc$,
    $doc$MERTER VİTRİNİ (mertervitrini.com.tr)
TEDARİKÇİ ÜYELİK, İÇERİK SAĞLAYICI VE HUKUKİ SORUMLULUK SÖZLEŞMESİ (v1)

1. KONU VE TARAFLARIN STATÜSÜ
1.1. İşbu Sözleşme, mertervitrini.com.tr ("Yer Sağlayıcı / Platform") üzerinde firma vitrini açan, başvuru yapan, manuel, toplu taslak, XML veya Excel yoluyla ürün ve medya yayınlayan tüm üretici, toptancı ve ticari satıcılar ("Tedarikçi") bakımından bağlayıcıdır.
1.2. Tedarikçi, Platform üzerinde yayınladığı her türlü ürün görseli, lookbook, video, katalog metni, teknik bilgi, fiyat, stok ve ticari bilginin 5651 sayılı Kanun anlamında tek "İçerik Sağlayıcısı" ve ürün satışlarının tek "Doğrudan Satıcısı" olduğunu kabul ve beyan eder. Merter Vitrini yalnızca teknik barındırma sağlayan "Yer Sağlayıcı"dır (5651 s.K. m. 5).

2. TELİF HAKKI, MARKA, TASARIM VE FİKRİ MÜLKİYET BEYANI (5846 FSEK & 6769 SMK)
2.1. Tedarikçi; Platforma yüklediği, güncellediği veya XML/Excel ile aktardığı tüm fotoğraf, görsel, video, model/manken görüntüsü, ürün tasarımı, katalog açıklaması, marka adı ve logonun:
  a) Münhasıran kendi mülkiyetinde olduğunu veya hak sahiplerinden ticari teşhir ve yayım için yazılı ve geçerli lisans/izin alınmış olduğunu,
  b) Üçüncü kişilerin 5846 sayılı Fikir ve Sanat Eserleri Kanunu (FSEK) kapsamındaki telif haklarını, model/kişilik haklarını (KVKK ve TMK m. 24), 6769 sayılı Sınai Mülkiyet Kanunu (SMK) kapsamındaki tescilli marka, endüstriyel tasarım veya patent haklarını hiçbir surette ihlal etmediğini,
  c) Başka markalara veya üreticilere ait izinsiz, filigranı silinmiş veya kopyalanmış fotoğraf kullanılmadığını
gayrikabili rücu beyan, kabul ve taahhüt eder.

3. TAKLİT / REPLİKA VE HUKUKA AYKIRI ÜRÜN YASAĞI
3.1. Tedarikçi; tescilli markaların izinsiz kopyası/taklidi/replikası ("1:1 kalite", "A kalite replika" vb. dahil) niteliğindeki ürünleri, kaçak, gümrük/vergi kaçağı, sağlığa zararlı, yasaklı veya satışı izne tabi hukuka aykırı hiçbir ürünü veya içeriği Platforma YÜKLEYEMEZ.
3.2. Türkiye Cumhuriyeti kanunları (TCK, 5607 s. Kaçakçılıkla Mücadele Kanunu, 6769 s. SMK, 5846 s. FSEK, 6102 s. TTK) uyarınca suç veya haksız fiil teşkil eden her türlü ürün ve içerik kesin olarak yasaktır.

4. TAM VE MÜNHASIR HUKUKİ, CEZAİ, MALİ VE İDARİ SORUMLULUK
4.1. Alıcılarla yaşanacak tüm ticari uyuşmazlıklar (ayıplı mal, eksik teslimat, gecikme, bedel iadesi, iptal/değişim, ödeme anlaşmazlıkları, faturalandırma, vergi ve gümrük yükümlülükleri) münhasıran Tedarikçiye aittir. Alıcıların veya üçüncü kişilerin yönelteceği her türlü talep ve davanın tek muhatabı Tedarikçidir.
4.2. Tedarikçinin yüklediği içerik, fotoğraf veya ürün sebebiyle üçüncü kişiler, hak sahipleri, alıcılar veya resmi/adli/idari makamlarca Merter Vitrini aleyhine açılabilecek her türlü dava, icra takibi, savcılık soruşturması, idari para cezası, tazminat, mahkeme harcı ve vekâlet ücretinden doğacak tüm zararlardan Tedarikçi tek başına sorumludur.
4.3. Merter Vitrini, böyle bir talep veya yaptırıma muhatap kalması halinde ödediği veya maruz kaldığı tüm tutarları (fer'ileri, yargılama giderleri ve avukatlık ücretleri dahil) ilk yazılı talepte Tedarikçiye RÜCU etme hakkına sahiptir.

5. DENETİM, UYAR-KALDIR VE HESAP ASKIYA ALMA YETKİSİ
5.1. Merter Vitrini, hak sahiplerinden gelen geçerli uyar-kaldır bildirimleri veya hukuka aykırılık şüphesi üzerine herhangi bir ön ihbara gerek olmaksızın ilgili ürünü, görseli veya Tedarikçi hesabını derhal yayından kaldırabilir, askıya alabilir ya da kalıcı olarak silebilir.
5.2. Tedarikçi; hem başvuru sırasında hem de her ürün, toplu taslak veya Excel yüklemesi aşamasında bu sorumluluk beyanını elektronik olarak onaylar. İlgili onay kayıtları (IP adresi, kullanıcı kimliği, tarih/saat ve metin sürümü) yasal delil niteliğinde saklanır.

6. YETKİLİ MAHKEME
6.1. İşbu Sözleşmeden doğan uyuşmazlıklarda Türk Hukuku uygulanır; İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri yetkilidir.$doc$,
    true
),
(
    uuidv7(),
    'cancellation_and_return',
    2,
    $doc$B2B İptal, İade, Değişim ve Doğrudan Tedarikçi Prosedürü$doc$,
    $doc$MERTER VİTRİNİ (mertervitrini.com.tr)
B2B İPTAL, İADE, DEĞİŞİM VE DOĞRUDAN TEDARİKÇİ PROSEDÜRÜ (v2)

1. B2B TİCARİ SATIŞ NİTELİĞİ
mertervitrini.com.tr üzerinde sergilenen tüm ürünler tacirler, işletmeler, toptancılar ve perakende mağazalar arasındaki toptan (seri/paket bazlı B2B) ticari alışverişlere yöneliktir. Tüketici mevzuatı (6502 sayılı Kanun) kapsamındaki tüketici cayma hakkı B2B ticari işlemlerde uygulanmaz; işlemler 6102 sayılı Türk Ticaret Kanunu (TTK) ve 6098 sayılı Türk Borçlar Kanunu (TBK) hükümlerine tabidir.

2. MERTER VİTRİNİ'NİN KONUMU VE MUHATAP
2.1. Merter Vitrini 5651 sayılı Kanun kapsamında yalnızca "Yer Sağlayıcı" B2B vitrin platformudur; doğrudan satıcı, kargo taşıyıcısı veya ödeme tahsildarı değildir.
2.2. İptal, değişim, ayıplı/hasarlı ürün bildirimi, eksik ürün telafisi ve bedel iadesi süreçlerinin tamamı doğrudan ürünü satan ilgili Tedarikçi firma ile Alıcı arasında yürütülür. Alıcı, satış sonrası tüm taleplerini Merter Vitrini'ne değil doğrudan fatura kesen/siparişi alan Tedarikçi firmaya yöneltmelidir.

3. AYIP İHBARI VE GENEL B2B PROSEDÜRÜ
3.1. 6102 sayılı TTK m. 23/1-c uyarınca ticari satışlarda Alıcı; teslim aldığı paketlerdeki açık ayıpları teslimattan itibaren 2 (iki) iş günü içinde, olağan muayene ile fark edilebilecek ayıpları ise 8 (sekiz) gün içinde doğrudan satıcı Tedarikçiye kargo tutanağı ve görsel kanıtlarla birlikte bildirmelidir.
3.2. Özel üretim (Private Label / Fason), renk-beden asorti değişikliği yapılmış veya kullanılmış/yıkanmış/etiketi sökülmüş toptan serilerde iade koşulları ilgili Tedarikçinin yazılı onayına tabidir.
3.3. İade onaylandığında ürünlerin geri gönderim adresi, kargo ücreti sorumluluğu ve bedel iadesi veya cari mahsup takvimi doğrudan ilgili Tedarikçi tarafından sağlanır.$doc$,
    true
),
(
    uuidv7(),
    'copyright_and_takedown',
    1,
    $doc$Fikri Mülkiyet, Telif Hakkı ve 5651 Sayılı Kanun Uyar-Kaldır Politikası$doc$,
    $doc$MERTER VİTRİNİ (mertervitrini.com.tr)
FİKRİ MÜLKİYET, TELİF HAKKI VE 5651 SAYILI KANUN UYAR-KALDIR POLİTİKASI (v1)

1. HUKUKİ ÇERÇEVE VE İHLAL POLİTİKASI
Merter Vitrini, 5651 sayılı Kanun madde 5 uyarınca "Yer Sağlayıcı" olarak faaliyet gösterir ve 5846 sayılı Fikir ve Sanat Eserleri Kanunu (FSEK) ile 6769 sayılı Sınai Mülkiyet Kanunu (SMK) kapsamındaki haklara saygı duyar. Platforma yüklenen tüm görsel ve içeriklerin hukuka ve üçüncü kişi haklarına uygunluğundan münhasıran ilgili içeriği yükleyen Tedarikçi ("İçerik Sağlayıcı") sorumludur.

2. UYAR-KALDIR (NOTICE & TAKEDOWN) BAŞVURU USULÜ
Hak sahibi olduğunu düşündüğünüz bir telif, fotoğraf, tasarım veya marka ihlali tespit ettiğinizde aşağıdaki zorunlu unsurları içeren yazılı bildirimi resmi iletişim adresimiz olan info@mertervitrini.com.tr adresine veya Platform iletişim sayfasına iletebilirsiniz:
  a) Hak sahibinin veya yetkili temsilcisinin adı-soyadı, unvanı, T.C. Kimlik / Vergi No, tebligat adresi, e-posta ve telefon bilgileri (vekil ise yetki/vekalet belgesi),
  b) İhlal edildiği iddia edilen eserin, markanın veya tasarımın tescil/hak sahipliği belgeleri (TÜRKPATENT marka tescil belgesi, orijinal eser çekim/kayıt kanıtı vb.),
  c) Platformda ihlale konu içeriğin bulunduğu tam URL adresi ve varsa ürün SKU kodu,
  d) İhlal edilen hakkın niteliği ve içeriğin kaldırılması talebine dair ıslak veya e-imzalı sorumluluk beyanı.

3. DEĞERLENDİRME VE KALDIRMA SÜRECİ
Eksiksiz ve somut belgeye dayanan uyar-kaldır bildirimleri hukuk birimimizce en geç 48 (kırk sekiz) saat içinde incelenir. İhlal tespit edilmesi halinde ilgili içerik/ürün yayından kaldırılır, bildirimin bir örneği ilgili Tedarikçiye iletilir ve tekrarlayan ihlallerde Tedarikçinin hesabı kalıcı olarak feshedilir. Kötü niyetli veya asılsız bildirimlerde bulunanlar doğabilecek ticari zararlardan sorumludur.$doc$,
    true
),
(
    uuidv7(),
    'privacy_policy',
    2,
    $doc$Gizlilik Politikası ve KVKK Aydınlatma Metni (6698 Sayılı Kanun)$doc$,
    $doc$MERTER VİTRİNİ (mertervitrini.com.tr)
GİZLİLİK POLİTİKASI VE KVKK AYDINLATMA METNİ (v2)

1. VERİ SORUMLUSU VE BAĞIMSIZ VERİ SORUMLUSU TEDARİKÇİLER
1.1. Platform üyeliği, ziyaretçi analitiği, sistem güvenliği ve hukuki onay kayıtları kapsamındaki kişisel veriler, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca veri sorumlusu sıfatıyla Merter Vitrini tarafından işlenmektedir.
1.2. Alıcıların ürün sayfası, WhatsApp hattı, B2B canlı sohbet veya doğrudan sipariş formları aracılığıyla bir Tedarikçiye ilettiği ticari talep, fatura ve iletişim verileri bakımından ilgili Tedarikçi firma, kendi ticari ilişkisi çerçevesinde bağımsız veri sorumlusu sıfatını taşır.

2. İŞLENEN KİŞİSEL VERİLER VE HUKUKİ ONAY KAYITLARI
Kimlik ve iletişim bilgileri (ad, soyad, unvan, e-posta, telefon), firma/adres/vergi bilgileri, işlem güvenliği ve 5651 sayılı Kanun / 6098 sayılı TBK ispat yükümlülükleri kapsamında elektronik sözleşme ve telif beyanı onay logları (IP adresi, tarih/saat damgası, onaylanan metin sürümü, tarayıcı bilgisi) işlenmektedir.

3. İŞLEME AMAÇLARI VE AKTARIM
Verileriniz; B2B üyelik ve tedarikçi portalı erişiminin sağlanması, alıcı-tedarikçi eşleştirmesinin teknik olarak yürütülmesi, bilgi güvenliği ve dolandırıcılık/kötüye kullanım önleme, 5651 sayılı Kanun ile ticari/adli mevzuattan doğan saklama ve yetkili makamlara bildirim yükümlülüklerinin yerine getirilmesi amaçlarıyla işlenir.

4. KVKK MADDE 11 KAPSAMINDAKİ HAKLARINIZ
Kişisel verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini/hesap kapatılmasını talep etme haklarınızı Platformdaki Hesap ve Veri Silme sayfası (/account-deletion) veya info@mertervitrini.com.tr adresi üzerinden kullanabilirsiniz.$doc$,
    true
)
ON CONFLICT (policy_type, policy_version) DO UPDATE
SET title = EXCLUDED.title,
    content = EXCLUDED.content,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP;

-- 4. Publish all 7 Legal CMS Pages across all 8 languages (tr, en, ru, ar, de, fr, pl, bg)
INSERT INTO catalog.pages (id, slug, is_active)
VALUES
    (uuidv7(), 'kullanici-sozlesmesi', true),
    (uuidv7(), 'tedarikci-sozlesmesi', true),
    (uuidv7(), 'yer-saglayici-bildirimi', true),
    (uuidv7(), 'telif-hakki-ve-uyar-kaldir', true),
    (uuidv7(), 'iptal-iade-kosullari', true),
    (uuidv7(), 'gizlilik-politikasi', true),
    (uuidv7(), 'mesafeli-satis-sozlesmesi', true)
ON CONFLICT (slug) DO UPDATE
SET is_active = true,
    updated_at = CURRENT_TIMESTAMP;

DO $migrate$
DECLARE
    v_page_id UUID;
BEGIN
    -- =========================================================================
    -- PAGE 1: kullanici-sozlesmesi
    -- =========================================================================
    SELECT id INTO v_page_id FROM catalog.pages WHERE slug = 'kullanici-sozlesmesi';

    INSERT INTO catalog.page_translations (page_id, language_code, title, content, meta_title, meta_description)
    VALUES
    (
        v_page_id, 'tr',
        'Üyelik, Kullanım ve Yer Sağlayıcı Çerçeve Sözleşmesi',
        $html$<article>
<h2>1. Platformun Hukuki Statüsü (5651 Sayılı Kanun Madde 5)</h2>
<p><strong>mertervitrini.com.tr</strong> ("Platform"), 5651 sayılı Kanun'un 5. maddesi kapsamında <strong>"Yer Sağlayıcı"</strong> statüsünde faaliyet gösteren B2B toptan tekstil ve hazır giyim vitrin platformudur. Merter Vitrini, Platformda listelenen hiçbir ürünün üreticisi, maliki, ithalatçısı, doğrudan satıcısı, ödeme tahsildarı veya kargo taşıyıcısı değildir.</p>
<h2>2. Doğrudan Satıcı Bağımsız Tedarikçilerdir</h2>
<p>Platformda sergilenen her ürünün tek <strong>"Doğrudan Satıcısı"</strong> ve 5651 sayılı Kanun anlamında <strong>"İçerik Sağlayıcısı"</strong>, ürün sayfasında unvanı belirtilen Tedarikçi firmadır. Alıcılar; fiyat teyidi, ödeme, fatura, kargo ve gümrük süreçlerini doğrudan ilgili Tedarikçi firma ile yürütür.</p>
<h2>3. Uyuşmazlıklarda Muhatap ve Sorumluluk Reddi</h2>
<ul>
<li>Ayıplı ürün, eksik veya geç teslimat, renk/beden uyuşmazlığı, iade, değişim, bedel iadesi ve fatura kaynaklı tüm ticari talepler <strong>doğrudan ve münhasıran ilgili satıcı Tedarikçiye</strong> yöneltilmelidir.</li>
<li>Alıcı ile Tedarikçi arasındaki ticari sözleşmelerden veya ürün kusurlarından Merter Vitrini sorumlu tutulamaz; Merter Vitrini aleyhine dava, icra veya tazminat talebinde bulunulamaz.</li>
<li>6563 sayılı Elektronik Ticaret Kanunu uyarınca Yer Sağlayıcı konumundaki Merter Vitrini, Tedarikçi içeriklerini önceden denetlemekle yükümlü değildir; geçerli uyar-kaldır bildirimlerini ise ivedilikle işleme alır.</li>
</ul>
<h2>4. Yetkili Mahkeme</h2>
<p>Türk Hukuku geçerlidir; İstanbul (Çağlayan) Mahkemeleri ve İcra Daireleri yetkilidir.</p>
</article>$html$,
        'Üyelik Sözleşmesi ve Yer Sağlayıcı Bildirimi | Merter Vitrini',
        'Merter Vitrini B2B üyelik sözleşmesi: Platform 5651 sayılı Kanun kapsamında yer sağlayıcıdır; doğrudan satıcı bağımsız tedarikçilerdir.'
    ),
    (
        v_page_id, 'en',
        'Membership Agreement & Hosting Provider Legal Framework',
        $html$<article>
<h2>1. Legal Status Under Turkish Law No. 5651 (Hosting Provider)</h2>
<p><strong>mertervitrini.com.tr</strong> ("Platform") operates strictly as an online B2B digital showcase and <strong>Hosting Provider ("Yer Sağlayıcı")</strong> pursuant to Article 5 of Turkish Law No. 5651. Merter Vitrini is <strong>NOT</strong> the direct seller, manufacturer, importer, broker, payment escrow agent, or shipping carrier of any product listed on the Platform.</p>
<h2>2. Independent Suppliers Are the Sole Direct Sellers</h2>
<p>The independent wholesale manufacturer or supplier explicitly named on each product page and cart inquiry is the sole <strong>Direct Seller ("Doğrudan Satıcı")</strong> and <strong>Content Provider ("İçerik Sağlayıcı")</strong>. All commercial negotiations, payments, proforma/commercial invoicing, shipping, and customs clearances take place directly between Buyer and Supplier.</p>
<h2>3. Buyer Disputes, Defects &amp; Limitation of Platform Liability</h2>
<ul>
<li>Any claim regarding product quality, defective goods, short shipment, delayed delivery, cancellation, return, exchange, refund, or invoicing must be directed <strong>solely and directly to the selling Supplier</strong>.</li>
<li>Merter Vitrini bears zero contractual, financial, or tort liability for commercial transactions or disputes between Buyers and Suppliers, and no legal claims may be asserted against Merter Vitrini as an intermediary showcase.</li>
</ul>
<h2>4. Governing Law &amp; Jurisdiction</h2>
<p>This agreement is governed by the laws of the Republic of Turkey, with exclusive jurisdiction vested in the Istanbul (Çağlayan) Courts and Enforcement Offices.</p>
</article>$html$,
        'Membership Agreement & Hosting Provider Notice | Merter Vitrini',
        'Merter Vitrini B2B membership terms: Platform is a hosting showcase under Law No. 5651; suppliers are sole direct sellers.'
    ),
    (
        v_page_id, 'ru',
        'Пользовательское соглашение и правовой статус хостинг-провайдера',
        $html$<article>
<h2>1. Правовой статус платформы (Закон Турции № 5651)</h2>
<p><strong>mertervitrini.com.tr</strong> действует исключительно как цифровая B2B-витрина и <strong>хостинг-провайдер («Yer Sağlayıcı»)</strong> согласно ст. 5 Закона № 5651. Merter Vitrini <strong>НЕ является прямым продавцом</strong>, производителем, импортером или платежным агентом товаров.</p>
<h2>2. Независимые поставщики — единственные прямые продавцы</h2>
<p>Указанный на странице товара поставщик выступает единственным <strong>Прямым продавцом</strong> и <strong>Поставщиком контента</strong>. Оплата, выставление счетов, логистика и таможенное оформление осуществляются напрямую между Покупателем и Поставщиком.</p>
<h2>3. Споры, возвраты и претензии</h2>
<p>Все претензии по качеству, браку, недовложению, доставке, возврату и расчетам должны направляться <strong>исключительно напрямую Продавцу-поставщику</strong>. Платформа не несет ответственности по коммерческим сделкам между сторонами. Применимое право — законодательство Турции, суды Стамбула (Чаглаян).</p>
</article>$html$,
        'Пользовательское соглашение | Merter Vitrini B2B',
        'Merter Vitrini — B2B хостинг-витрина. Все продажи и претензии решаются напрямую с поставщиком.'
    ),
    (
        v_page_id, 'ar',
        'اتفاقية العضوية والإطار القانوني لمزود الاستضافة',
        $html$<article dir="rtl">
<h2>1. الوضع القانوني للمنصة (القانون التركي رقم 5651)</h2>
<p>تعمل منصة <strong>mertervitrini.com.tr</strong> حصراً بصفتها منصة عرض B2B و<strong>مزود استضافة (Yer Sağlayıcı)</strong> بموجب المادة 5 من القانون التركي رقم 5651. لا تُعد Merter Vitrini بائعاً مباشراً أو منتجاً أو مستورداً أو وسيط تحصيل مالي لأي منتج.</p>
<h2>2. الموردون المستقلون هم البائعون المباشرون الوحيدون</h2>
<p>الشركة الموردة المذكورة في صفحة المنتج هي وحدها <strong>البائع المباشر</strong> و<strong>مزود المحتوى</strong>. تتم جميع عمليات التفاوض والدفع وإصدار الفواتير والشحن مباشرة بين المشتري والمورد.</p>
<h2>3. الشكاوى والنزاعات التجارية</h2>
<p>يجب توجيه جميع المطالبات المتعلقة بالعيوب أو النقص أو التأخير أو الإرجاع أو الاستبدال أو الفواتير <strong>مباشرة وحصرياً إلى المورد البائع</strong> دون أي مسؤولية قانونية على منصة Merter Vitrini. يخضع هذا الاتفاق للقانون التركي ومحاكم إسطنبول (جاغلايان).</p>
</article>$html$,
        'اتفاقية العضوية ومزود الاستضافة | Merter Vitrini',
        'شروط عضوية Merter Vitrini B2B: المنصة مزود استضافة فقط والموردون هم البائعون المباشرون.'
    ),
    (
        v_page_id, 'de',
        'Nutzungsvereinbarung & Hosting-Provider-Rahmenvertrag',
        $html$<article>
<h2>1. Rechtlicher Status (Türkisches Gesetz Nr. 5651, Art. 5)</h2>
<p><strong>mertervitrini.com.tr</strong> agiert ausschließlich als B2B-Digitalvitrine und <strong>Hosting-Provider (Yer Sağlayıcı)</strong>. Merter Vitrini ist <strong>kein Direktverkäufer</strong>, Hersteller, Importeur, Zahlungsabwickler oder Frachtführer.</p>
<h2>2. Unabhängige Lieferanten sind alleinige Direktverkäufer</h2>
<p>Der auf jeder Produktseite genannte Großhändler ist alleiniger <strong>Direktverkäufer</strong> und <strong>Inhaltsanbieter</strong>. Kaufverträge, Zahlungen, Rechnungen, Versand und Exportabwicklung erfolgen direkt zwischen Käufer und Lieferant.</p>
<h2>3. Reklamationen &amp; Haftungsausschluss</h2>
<p>Sämtliche Ansprüche wegen Mängeln, Falschlieferungen, Lieferverzug, Rückgaben oder Erstattungen sind <strong>ausschließlich direkt an den jeweiligen Lieferanten</strong> zu richten. Gerichtsstand ist Istanbul (Çağlayan), Türkei.</p>
</article>$html$,
        'Nutzungsvereinbarung & Hosting-Hinweis | Merter Vitrini',
        'Merter Vitrini B2B Nutzungsbedingungen: Plattform ist Hosting-Provider nach Gesetz 5651; Lieferanten sind Direktverkäufer.'
    ),
    (
        v_page_id, 'fr',
        'Conditions d’utilisation et statut d’hébergeur B2B',
        $html$<article>
<h2>1. Statut juridique d’hébergeur (Loi turque n° 5651, art. 5)</h2>
<p><strong>mertervitrini.com.tr</strong> agit exclusivement en tant que vitrine B2B et <strong>hébergeur technique (Yer Sağlayıcı)</strong>. Merter Vitrini n’est <strong>ni vendeur direct</strong>, ni fabricant, ni importateur, ni intermédiaire de paiement ou transporteur.</p>
<h2>2. Vendeurs directs et responsabilité des fournisseurs</h2>
<p>Le grossiste ou fabricant mentionné sur chaque fiche produit est l’unique <strong>Vendeur Direct</strong> et <strong>Fournisseur de Contenu</strong>. Tous les paiements, factures et expéditions s’effectuent directement entre l’Acheteur et le Fournisseur.</p>
<h2>3. Litiges commerciaux et réclamations</h2>
<p>Toute réclamation relative à un défaut, retard, retour ou remboursement doit être adressée <strong>exclusivement au Fournisseur vendeur</strong>. Droit applicable : droit turc ; tribunaux compétents : Istanbul (Çağlayan).</p>
</article>$html$,
        'Conditions d’utilisation B2B | Merter Vitrini',
        'Merter Vitrini opère comme hébergeur B2B ; les fournisseurs indépendants sont les seuls vendeurs directs.'
    ),
    (
        v_page_id, 'pl',
        'Umowa członkowska i status dostawcy hostingu B2B',
        $html$<article>
<h2>1. Status prawny platformy (Ustawa turecka nr 5651, art. 5)</h2>
<p><strong>mertervitrini.com.tr</strong> działa wyłącznie jako platforma B2B i <strong>dostawca hostingu (Yer Sağlayıcı)</strong>. Merter Vitrini <strong>nie jest bezpośrednim sprzedawcą</strong>, producentem ani pośrednikiem płatniczym.</p>
<h2>2. Niezależni dostawcy jako wyłączni sprzedawcy bezpośredni</h2>
<p>Podmiot wskazany na stronie produktu jest wyłącznym <strong>Sprzedawcą Bezpośrednim</strong> i <strong>Dostawcą Treści</strong>. Wszelkie płatności, faktury i wysyłki odbywają się bezpośrednio między Kupującym a Dostawcą.</p>
<h2>3. Reklamacje i spory</h2>
<p>Wszelkie roszczenia dotyczące wad, dostawy, zwrotów lub rozliczeń należy kierować <strong>wyłącznie bezpośrednio do Dostawcy</strong>. Właściwe są sądy w Stambule (Çağlayan), Turcja.</p>
</article>$html$,
        'Umowa członkowska B2B | Merter Vitrini',
        'Warunki korzystania z Merter Vitrini B2B: platforma pełni rolę hostingu, sprzedawcami są niezależni dostawcy.'
    ),
    (
        v_page_id, 'bg',
        'Споразумение за членство и статут на хостинг доставчик B2B',
        $html$<article>
<h2>1. Правов статут (Турски закон № 5651, чл. 5)</h2>
<p><strong>mertervitrini.com.tr</strong> функционира единствено като B2B витрина и <strong>хостинг доставчик (Yer Sağlayıcı)</strong>. Merter Vitrini <strong>не е директен продавач</strong>, производител или платежен посредник.</p>
<h2>2. Независимите доставчици са единствените директни продавачи</h2>
<p>Посоченият на продуктовата страница доставчик е единственият <strong>Директен продавач</strong> и <strong>Доставчик на съдържание</strong>. Плащанията, фактурите и доставките се извършват директно между Купувача и Доставчика.</p>
<h2>3. Спорове и рекламации</h2>
<p>Всички претенции за дефекти, доставки, връщания или плащания се отправят <strong>изключително директно към Доставчика</strong>. Приложимо право: турско право, съдилища в Истанбул (Чаглаян).</p>
</article>$html$,
        'Споразумение за членство B2B | Merter Vitrini',
        'B2B условия на Merter Vitrini: платформата е хостинг доставчик, а независимите доставчици са директни продавачи.'
    )
    ON CONFLICT (page_id, language_code) DO UPDATE
    SET title = EXCLUDED.title, content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description;

    -- =========================================================================
    -- PAGE 2: tedarikci-sozlesmesi
    -- =========================================================================
    SELECT id INTO v_page_id FROM catalog.pages WHERE slug = 'tedarikci-sozlesmesi';

    INSERT INTO catalog.page_translations (page_id, language_code, title, content, meta_title, meta_description)
    VALUES
    (
        v_page_id, 'tr',
        'Tedarikçi Üyelik, İçerik Sağlayıcı ve Fikri Mülkiyet Sorumluluk Sözleşmesi',
        $html$<article>
<h2>1. Tedarikçinin Doğrudan Satıcı ve İçerik Sağlayıcı Sıfatı</h2>
<p>Platformda firma vitrini açan, başvuran veya herhangi bir kanaldan (tekli ekleme, toplu taslak, Excel veya XML) ürün yayınlayan her firma (<strong>"Tedarikçi"</strong>), ilgili ürünlerin tek <strong>"Doğrudan Satıcısı"</strong> ve 5651 sayılı Kanun anlamında <strong>"İçerik Sağlayıcısı"</strong> olduğunu kabul eder. Merter Vitrini yalnızca teknik alan tahsis eden <strong>"Yer Sağlayıcı"</strong>dır.</p>
<h2>2. Fotoğraf, Telif, Marka ve Tasarım Hakları Taahhüdü (5846 FSEK &amp; 6769 SMK)</h2>
<ul>
<li>Tedarikçi; yüklediği tüm fotoğraf, lookbook, video, manken görseli ve metinlerin kendisine ait olduğunu ya da hak sahiplerinden geçerli ticari yayım lisansı aldığını taahhüt eder.</li>
<li>Üçüncü kişilere ait telifli görsellerin, izinsiz marka/logo kullanımlarının, tescilli endüstriyel tasarımların ve her türlü <strong>taklit/replika ürünün ("1:1", "A kalite" dahil)</strong> yayınlanması kesinlikle yasaktır.</li>
<li>Kaçak, vergisiz, satışı yasak veya hukuka aykırı hiçbir ürün Platforma yüklenemez.</li>
</ul>
<h2>3. Tam Cezai, Hukuki ve Mali Sorumluluk ile Rücu Hakkı</h2>
<p>Yüklenen görsellerden, açıklamalardan, taklit iddialarından, müşteri şikâyetlerinden, ayıplı mal, iade, kargo ve vergi/fatura yükümlülüklerinden doğacak her türlü dava, savcılık soruşturması, idari para cezası, tazminat ve yargılama giderinden <strong>münhasıran ve tek başına Tedarikçi sorumludur</strong>. Merter Vitrini'nin herhangi bir tazminat veya cezaya muhatap olması hâlinde ödediği tüm tutarları avukatlık ücretleri ve faiziyle birlikte Tedarikçiye <strong>rücu etme</strong> hakkı saklıdır.</p>
<h2>4. Derhal Kaldırma ve Hesap Feshi</h2>
<p>Merter Vitrini, ihlal şüphesi veya uyar-kaldır bildirimi üzerine ilgili ürünü veya Tedarikçi hesabını önceden bildirim yapmaksızın derhal kaldırabilir. Onay kayıtları IP adresi ve zaman damgası ile delil olarak saklanır.</p>
</article>$html$,
        'Tedarikçi Üyelik ve Sorumluluk Sözleşmesi | Merter Vitrini',
        'Tedarikçilerin telif, marka, hukuka uygunluk ve doğrudan satıcı sorumluluklarını düzenleyen resmi sözleşme.'
    ),
    (
        v_page_id, 'en',
        'Supplier Membership, Content Provider & IP Indemnification Agreement',
        $html$<article>
<h2>1. Supplier Status as Sole Direct Seller &amp; Content Provider</h2>
<p>Every manufacturer or wholesaler applying to or publishing products on Merter Vitrini (via manual entry, quick draft, Excel, or XML feed) acknowledges that it is the sole <strong>Direct Seller</strong> and <strong>Content Provider</strong> under Turkish Law No. 5651. Merter Vitrini acts exclusively as a technical <strong>Hosting Provider</strong>.</p>
<h2>2. Copyright, Trademark &amp; Anti-Counterfeit Warranty (FSEK 5846 &amp; SMK 6769)</h2>
<ul>
<li>Supplier warrants that it owns or holds valid commercial licenses for every photograph, model image, video, brand name, design, and description uploaded to the Platform.</li>
<li>Counterfeit, replica, watermark-stripped, copyright-infringing, smuggled, or legally prohibited goods are strictly forbidden.</li>
</ul>
<h2>3. Exclusive Liability &amp; Full Indemnification</h2>
<p>Supplier assumes 100% exclusive civil, criminal, tax, and administrative liability for its uploaded content and commercial sales (including buyer disputes, defects, returns, customs, and third-party IP lawsuits) and agrees to fully indemnify and hold Merter Vitrini harmless against any fines, damages, court costs, or attorney fees.</p>
</article>$html$,
        'Supplier Agreement & IP Responsibility | Merter Vitrini',
        'Supplier copyright, anti-counterfeit, direct-seller, and indemnification obligations on Merter Vitrini B2B.'
    ),
    (
        v_page_id, 'ru',
        'Соглашение поставщика об авторских правах и ответственности продавца',
        $html$<article>
<h2>1. Статус прямого продавца и поставщика контента</h2>
<p>Каждый поставщик, публикующий товары на Merter Vitrini, является единственным <strong>Прямым продавцом</strong> и <strong>Поставщиком контента</strong> согласно Закону № 5651. Платформа выступает исключительно хостинг-провайдером.</p>
<h2>2. Гарантия авторских прав и запрет контрафакта</h2>
<p>Поставщик гарантирует наличие полных прав на все фотографии, изображения моделей и товарные знаки. Загрузка контрафактных, незаконных или нарушающих авторские права материалов строго запрещена.</p>
<h2>3. Исключительная ответственность и регресс</h2>
<p>Поставщик несет полную гражданскую, налоговую, административную и уголовную ответственность за размещенный контент и коммерческие споры с покупателями и обязан возместить платформе любые убытки, штрафы и судебные расходы.</p>
</article>$html$,
        'Соглашение с поставщиком | Merter Vitrini',
        'Правовые обязательства поставщиков Merter Vitrini по авторским правам, качеству и продажам.'
    ),
    (
        v_page_id, 'ar',
        'اتفاقية المورد ومسؤولية الملكية الفكرية والبيع المباشر',
        $html$<article dir="rtl">
<h2>1. صفة المورد كبائع مباشر ومزود محتوى</h2>
<p>يقر كل مورد ينشر منتجات عبر منصة Merter Vitrini بأنه <strong>البائع المباشر</strong> الوحيد و<strong>مزود المحتوى</strong> بموجب القانون التركي رقم 5651، بينما تقتصر صفة المنصة على مزود الاستضافة.</p>
<h2>2. ضمان حقوق النشر ومنع التقليد والمحتوى غير القانوني</h2>
<p>يتعهد المورد بامتلاك الحقوق القانونية الكاملة لجميع الصور والتصاميم والعلامات التجارية المرفوعة، ويُحظر تماماً رفع أي منتجات مقلدة أو منتهكة لحقوق الغير أو محظورة قانونياً.</p>
<h2>3. المسؤولية الكاملة والتعويض</h2>
<p>يتحمل المورد وحده كامل المسؤولية المدنية والجزائية والضريبية والتجارية عن جميع المحتويات والمبيعات ونزاعات المشترين، مع حق المنصة في الرجوع عليه بكافة التعويضات والرسوم القانونية.</p>
</article>$html$,
        'اتفاقية المورد والملكية الفكرية | Merter Vitrini',
        'شروط التزامات الموردين وحقوق النشر والمسؤولية المباشرة على منصة Merter Vitrini.'
    ),
    (
        v_page_id, 'de',
        'Lieferantenvertrag, Urheberrecht & Freistellungsvereinbarung',
        $html$<article>
<h2>1. Stellung als Direktverkäufer und Inhaltsanbieter</h2>
<p>Jeder Lieferant, der Produkte auf Merter Vitrini veröffentlicht, handelt als alleiniger <strong>Direktverkäufer</strong> und <strong>Inhaltsanbieter</strong> im Sinne des Gesetzes Nr. 5651. Merter Vitrini ist ausschließlich Hosting-Provider.</p>
<h2>2. Urheber-, Markenrecht &amp; Fälschungsverbot</h2>
<p>Der Lieferant garantiert, über sämtliche Nutzungsrechte an hochgeladenen Fotos, Modelbildern, Beschreibungen und Marken zu verfügen. Repliken, Fälschungen sowie rechtswidrige Inhalte sind streng untersagt.</p>
<h2>3. Alleinige Haftung &amp; Schadloshaltung</h2>
<p>Der Lieferant haftet uneingeschränkt für alle hochgeladenen Inhalte, Produktmängel, Käuferstreitigkeiten sowie behördliche Sanktionen und stellt Merter Vitrini von sämtlichen Ansprüchen, Bußgeldern und Anwaltskosten frei.</p>
</article>$html$,
        'Lieferantenvertrag & Urheberrecht | Merter Vitrini',
        'Rechtliche Pflichten der Lieferanten bezüglich Urheberrecht, Markenschutz und Direktverkauf auf Merter Vitrini.'
    ),
    (
        v_page_id, 'fr',
        'Contrat Fournisseur, Propriété Intellectuelle et Responsabilité',
        $html$<article>
<h2>1. Statut de Vendeur Direct et Fournisseur de Contenu</h2>
<p>Tout fournisseur publiant des produits sur Merter Vitrini reconnaît être l’unique <strong>Vendeur Direct</strong> et <strong>Fournisseur de Contenu</strong> conformément à la loi turque n° 5651. Merter Vitrini agit exclusivement en qualité d’hébergeur.</p>
<h2>2. Droits d’auteur, marques et interdiction de contrefaçon</h2>
<p>Le fournisseur garantit détenir tous les droits sur les photos, visuels, descriptions et marques déposées, et s’interdit de publier toute contrefaçon ou marchandise illicite.</p>
<h2>3. Responsabilité exclusive et indemnisation</h2>
<p>Le fournisseur assume l’entière responsabilité civile, pénale et commerciale de ses contenus et litiges acheteurs et s’engage à indemniser Merter Vitrini de tout dommage, amende ou frais de justice.</p>
</article>$html$,
        'Contrat Fournisseur B2B | Merter Vitrini',
        'Obligations juridiques des fournisseurs : propriété intellectuelle, anti-contrefaçon et vente directe.'
    ),
    (
        v_page_id, 'pl',
        'Umowa Dostawcy, Prawa Autorskie i Odpowiedzialność Prawna',
        $html$<article>
<h2>1. Status Sprzedawcy Bezpośredniego i Dostawcy Treści</h2>
<p>Każdy dostawca publikujący produkty na Merter Vitrini jest wyłącznym <strong>Sprzedawcą Bezpośrednim</strong> i <strong>Dostawcą Treści</strong> w rozumieniu ustawy nr 5651. Platforma pełni wyłącznie funkcję hostingu.</p>
<h2>2. Prawa autorskie i zakaz podróbek</h2>
<p>Dostawca gwarantuje posiadanie pełni praw do zamieszczanych zdjęć, opisów i znaków towarowych oraz zobowiązuje się do niepublikowania podróbek ani towarów nielegalnych.</p>
<h2>3. Wyłączna odpowiedzialność i regres</h2>
<p>Dostawca ponosi pełną odpowiedzialność prawną, finansową i podatkową za treści oraz spory z kupującymi i zwalnia Merter Vitrini z wszelkich roszczeń i kosztów sądowych.</p>
</article>$html$,
        'Umowa Dostawcy B2B | Merter Vitrini',
        'Zasady odpowiedzialności dostawców Merter Vitrini w zakresie praw autorskich i sprzedaży bezpośredniej.'
    ),
    (
        v_page_id, 'bg',
        'Споразумение с доставчика, авторски права и отговорност',
        $html$<article>
<h2>1. Статут на директен продавач и доставчик на съдържание</h2>
<p>Всеки доставчик, публикуващ стоки в Merter Vitrini, е единствен <strong>Директен продавач</strong> и <strong>Доставчик на съдържание</strong> по Закон № 5651. Платформата е единствено хостинг доставчик.</p>
<h2>2. Авторски права и забрана за фалшификати</h2>
<p>Доставчикът гарантира пълните права върху всички качени снимки, описания и търговски марки и се задължава да не публикува фалшификати или незаконни стоки.</p>
<h2>3. Пълна отговорност и обезщетение</h2>
<p>Доставчикът носи изцяло гражданската, наказателната, данъчната и търговската отговорност за съдържанието и споровете с купувачите и обезщетява Merter Vitrini при всякакви претенции.</p>
</article>$html$,
        'Споразумение с доставчика | Merter Vitrini',
        'Правни задължения на доставчиците за авторски права и директни продажби в Merter Vitrini.'
    )
    ON CONFLICT (page_id, language_code) DO UPDATE
    SET title = EXCLUDED.title, content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description;

    -- =========================================================================
    -- PAGE 3: yer-saglayici-bildirimi
    -- =========================================================================
    SELECT id INTO v_page_id FROM catalog.pages WHERE slug = 'yer-saglayici-bildirimi';

    INSERT INTO catalog.page_translations (page_id, language_code, title, content, meta_title, meta_description)
    VALUES
    (
        v_page_id, 'tr',
        '5651 Sayılı Kanun Yer Sağlayıcı Bildirimi ve Muafiyet Beyanı',
        $html$<article>
<h2>1. 5651 Sayılı Kanun Madde 5 Kapsamında Yer Sağlayıcı Konumu</h2>
<p><strong>mertervitrini.com.tr</strong>; 5651 sayılı İnternet Ortamında Yapılan Yayınların Düzenlenmesi ve Bu Yayınlar Yoluyla İşlenen Suçlarla Mücadele Edilmesi Hakkında Kanun'un 2/1-m ve 5. maddeleri uyarınca <strong>"Yer Sağlayıcı"</strong>dır.</p>
<ul>
<li>Yer Sağlayıcı, Tedarikçiler tarafından sisteme yüklenen ürün, fotoğraf, fiyat, stok ve ticari içerikleri önceden kontrol etmek veya hukuka aykırı bir faaliyet olup olmadığını araştırmakla yükümlü değildir (5651 s.K. m. 5/1).</li>
<li>Platform üzerinde yayınlanan tüm ticari içeriklerden ve bu içeriklerin konu olduğu satış işlemlerinden doğrudan içeriği sağlayan ve satışı gerçekleştiren <strong>bağımsız Tedarikçi firma ("İçerik Sağlayıcı" ve "Doğrudan Satıcı")</strong> sorumludur.</li>
</ul>
<h2>2. Alıcı-Tedarikçi İlişkilerinde Tarafsızlık</h2>
<p>Merter Vitrini satış sözleşmesinin tarafı değildir; ürün bedeli tahsil etmez, fatura kesmez, teslimat garantisi vermez. Bir Tedarikçi ile ticari uyuşmazlık yaşayan Alıcı doğrudan ilgili Tedarikçi ile muhatap olmalıdır.</p>
<h2>3. Hukuka Aykırı İçerik Bildirimi</h2>
<p>5651 sayılı Kanun ve FSEK/SMK kapsamında hak ihlali barındıran içerikler için <strong>info@mertervitrini.com.tr</strong> adresine belgeli uyar-kaldır bildirimi iletilebilir.</p>
</article>$html$,
        '5651 Sayılı Kanun Yer Sağlayıcı Bildirimi | Merter Vitrini',
        'Merter Vitrini 5651 sayılı Kanun madde 5 kapsamında Yer Sağlayıcıdır; ürün içeriklerinden ve satışlardan bağımsız tedarikçiler sorumludur.'
    ),
    (
        v_page_id, 'en',
        'Law No. 5651 Hosting Provider Legal Disclosure',
        $html$<article>
<h2>1. Hosting Provider Safe Harbor (Turkish Law No. 5651, Art. 5)</h2>
<p>Under Article 5 of Turkish Law No. 5651, <strong>mertervitrini.com.tr</strong> operates strictly as a <strong>Hosting Provider ("Yer Sağlayıcı")</strong> hosting product showcases and contact profiles created by independent wholesale suppliers.</p>
<ul>
<li>Merter Vitrini has no general statutory obligation to pre-screen user/supplier content for illegality prior to publication.</li>
<li>Each Supplier acts independently as <strong>Content Provider</strong> and <strong>Direct Seller</strong> and bears full responsibility for product authenticity, copyright clearance, pricing, invoicing, and order fulfillment.</li>
</ul>
<h2>2. Takedown Requests</h2>
<p>Verified copyright, trademark, or unlawful content takedown notices can be sent with supporting documentation to <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$html$,
        'Law No. 5651 Hosting Provider Notice | Merter Vitrini',
        'Official Turkish Law No. 5651 Hosting Provider disclosure for Merter Vitrini B2B showcase.'
    ),
    (
        v_page_id, 'ru',
        'Уведомление о статусе хостинг-провайдера (Закон № 5651)',
        $html$<article>
<h2>Правовой статус по ст. 5 Закона № 5651</h2>
<p><strong>mertervitrini.com.tr</strong> является исключительно хостинг-провайдером B2B-каталогов («Yer Sağlayıcı»). Платформа не несет ответственности за контент, размещенный поставщиками, и не выступает стороной договоров купли-продажи. Уведомления о нарушениях направляются на <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$html$,
        'Статус хостинг-провайдера | Merter Vitrini',
        'Правовое уведомление Merter Vitrini согласно Закону № 5651 о статусе хостинг-провайдера.'
    ),
    (
        v_page_id, 'ar',
        'إفصاح مزود الاستضافة بموجب القانون رقم 5651',
        $html$<article dir="rtl">
<h2>الوضع القانوني بموجب المادة 5 من القانون رقم 5651</h2>
<p>تعمل منصة <strong>mertervitrini.com.tr</strong> حصراً بصفتها مزود استضافة تقني (Yer Sağlayıcı) ولا تتحمل مسؤولية مسبقة عن محتوى الموردين أو عقود البيع المبرمة مباشرة بين المشتري والمورد. تُرسل إخطارات إزالة المحتوى المخالف إلى <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$html$,
        'إفصاح مزود الاستضافة 5651 | Merter Vitrini',
        'الإفصاح الرسمي لمنصة Merter Vitrini بصفتها مزود استضافة بموجب القانون التركي 5651.'
    ),
    (
        v_page_id, 'de',
        'Hosting-Provider-Hinweis gemäß Gesetz Nr. 5651',
        $html$<article>
<h2>Haftungsprivileg nach Art. 5 des Gesetzes Nr. 5651</h2>
<p><strong>mertervitrini.com.tr</strong> fungiert ausschließlich als technischer Hosting-Provider für B2B-Lieferantenprofile. Alle Produktinhalte und Direktverkäufe liegen in der alleinigen Verantwortung des jeweiligen Lieferanten. Meldungen zu Rechtsverstößen senden Sie bitte an <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$html$,
        'Hosting-Provider-Hinweis 5651 | Merter Vitrini',
        'Rechtlicher Hinweis zum Status als Hosting-Provider gemäß türkischem Gesetz Nr. 5651.'
    ),
    (
        v_page_id, 'fr',
        'Mentions légales d’hébergeur (Loi n° 5651)',
        $html$<article>
<h2>Statut d’hébergeur technique (Loi turque n° 5651, art. 5)</h2>
<p><strong>mertervitrini.com.tr</strong> agit exclusivement en qualité d’hébergeur. Les fournisseurs indépendants sont seuls responsables des contenus publiés et des transactions conclues avec les acheteurs. Notifications à adresser à <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$html$,
        'Statut d’hébergeur 5651 | Merter Vitrini',
        'Déclaration officielle d’hébergeur B2B conformément à la loi turque n° 5651.'
    ),
    (
        v_page_id, 'pl',
        'Informacja o statusie dostawcy hostingu (Ustawa nr 5651)',
        $html$<article>
<h2>Status prawny na mocy art. 5 Ustawy nr 5651</h2>
<p><strong>mertervitrini.com.tr</strong> działa wyłącznie jako dostawca hostingu dla katalogów B2B. Za publikowane treści i transakcje odpowiadają wyłącznie niezależni dostawcy. Zgłoszenia naruszeń: <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$html$,
        'Status dostawcy hostingu | Merter Vitrini',
        'Oficjalna informacja o statusie hostingu Merter Vitrini na podstawie ustawy nr 5651.'
    ),
    (
        v_page_id, 'bg',
        'Обявление за статут на хостинг доставчик (Закон № 5651)',
        $html$<article>
<h2>Правов статут съгласно чл. 5 от Закон № 5651</h2>
<p><strong>mertervitrini.com.tr</strong> е единствено технически хостинг доставчик. Независимите доставчици носят пълна отговорност за съдържанието и директните продажби. Сигнали за нарушения: <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$html$,
        'Статут на хостинг доставчик | Merter Vitrini',
        'Официална информация за хостинг статута на Merter Vitrini по турския Закон № 5651.'
    )
    ON CONFLICT (page_id, language_code) DO UPDATE
    SET title = EXCLUDED.title, content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description;

    -- =========================================================================
    -- PAGE 4: telif-hakki-ve-uyar-kaldir
    -- =========================================================================
    SELECT id INTO v_page_id FROM catalog.pages WHERE slug = 'telif-hakki-ve-uyar-kaldir';

    INSERT INTO catalog.page_translations (page_id, language_code, title, content, meta_title, meta_description)
    VALUES
    (
        v_page_id, 'tr',
        'Telif Hakkı, Marka İhlali ve Uyar-Kaldır Bildirim Prosedürü',
        $html$<article>
<h2>1. Fikri Mülkiyet İhlallerine Sıfır Tolerans</h2>
<p>Merter Vitrini, 5846 sayılı FSEK ve 6769 sayılı SMK kapsamında korunan fotoğraf, tasarım ve marka haklarına saygı duyar. Platformda içerik yayınlayan tüm Tedarikçiler, görsellerin ve ürünlerin lisanslı/orijinal olduğunu hukuken taahhüt eder ve doğabilecek tüm hukuki/cezai/mali sonuçları üstlenir.</p>
<h2>2. Uyar-Kaldır Başvurusunda İstenen Belgeler</h2>
<p>Hak ihlali iddianızı aşağıdaki bilgilerle birlikte <strong>info@mertervitrini.com.tr</strong> adresine gönderebilirsiniz:</p>
<ul>
<li>Hak sahibi veya yetkili vekilin kimlik, unvan, adres, telefon ve e-posta bilgileri,</li>
<li>Marka tescil belgesi veya eserin/fotoğrafın ilk sahipliğini gösteren somut kanıtlar,</li>
<li>İhlale konu ürünün Merter Vitrini üzerindeki tam URL adresi ve SKU kodu,</li>
<li>Bildirimin doğruluğuna dair imzalı sorumluluk beyanı.</li>
</ul>
<h2>3. 48 Saat İçinde İşlem</h2>
<p>Geçerli ve belgeli başvurular en geç 48 saat içinde değerlendirilerek ihlal tespit edilen ürün veya görseller yayından kaldırılır ve ilgili Tedarikçi hakkında işlem yapılır.</p>
</article>$html$,
        'Telif Hakkı ve Uyar-Kaldır Prosedürü | Merter Vitrini',
        '5846 sayılı FSEK, 6769 sayılı SMK ve 5651 sayılı Kanun kapsamında fikri mülkiyet ve uyar-kaldır bildirim prosedürü.'
    ),
    (
        v_page_id, 'en',
        'Copyright, Trademark & Notice-and-Takedown Policy',
        $html$<article>
<h2>1. Intellectual Property &amp; Hosting Provider Safe Harbor</h2>
<p>Suppliers are contractually bound as Content Providers to upload only authorized, non-infringing product images and original designs. Merter Vitrini responds expeditiously to valid copyright and trademark takedown notices under Law No. 5651, FSEK No. 5846, and SMK No. 6769.</p>
<h2>2. Required Takedown Notice Elements</h2>
<ul>
<li>Full legal name, company title, email, phone, and power of attorney (if acting on behalf of a rightsholder),</li>
<li>Trademark registration certificate or dated proof of original copyright ownership,</li>
<li>Exact Merter Vitrini product URL(s) and SKU code(s),</li>
<li>Signed statement declaring accuracy under penalty of commercial liability.</li>
</ul>
<p>Send complete notices to <strong>info@mertervitrini.com.tr</strong>. Valid notices are processed within 48 hours.</p>
</article>$html$,
        'Copyright & Notice-and-Takedown Policy | Merter Vitrini',
        'How rightsholders can submit copyright or trademark takedown requests to Merter Vitrini.'
    ),
    (
        v_page_id, 'ru',
        'Политика авторских прав и процедура «Notice & Takedown»',
        $html$<article>
<h2>Защита интеллектуальной собственности</h2>
<p>Все поставщики гарантируют легальность загружаемых изображений и брендов. Для подачи жалобы о нарушении авторских прав или товарного знака направьте документы, подтверждающие права, точный URL и SKU на <strong>info@mertervitrini.com.tr</strong>. Заявки рассматриваются в течение 48 часов.</p>
</article>$html$,
        'Авторские права и удаление контента | Merter Vitrini',
        'Процедура подачи жалоб о нарушении авторских прав и товарных знаков на Merter Vitrini.'
    ),
    (
        v_page_id, 'ar',
        'سياسة حقوق النشر وإجراء الإخطار والإزالة',
        $html$<article dir="rtl">
<h2>حماية الملكية الفكرية وحقوق العلامات التجارية</h2>
<p>يتحمل الموردون كامل المسؤولية القانونية عن حقوق الصور والعلامات المنشورة. لتقديم طلب إزالة محتوى منتهك لحقوق النشر أو العلامة التجارية، يُرجى إرسال مستندات الملكية والرابط الكامل ورمز SKU إلى <strong>info@mertervitrini.com.tr</strong>، وتتم المعالجة خلال 48 ساعة.</p>
</article>$html$,
        'سياسة حقوق النشر والإزالة | Merter Vitrini',
        'إجراءات الإخطار والإزالة الفورية لمحتوى حقوق النشر والعلامات التجارية على Merter Vitrini.'
    ),
    (
        v_page_id, 'de',
        'Urheberrecht, Markenschutz & Notice-and-Takedown-Verfahren',
        $html$<article>
<h2>Schutz geistigen Eigentums</h2>
<p>Lieferanten haften allein für hochgeladene Produktbilder und Markenrechte. Berechtigte Löschungsanträge unter Beifügung von Schutzrechtsnachweisen sowie der genauen Produkt-URL bitte an <strong>info@mertervitrini.com.tr</strong> senden (Bearbeitung innerhalb von 48 Stunden).</p>
</article>$html$,
        'Urheberrecht & Takedown-Verfahren | Merter Vitrini',
        'Notice-and-Takedown-Verfahren bei Urheberrechts- und Markenverletzungen auf Merter Vitrini.'
    ),
    (
        v_page_id, 'fr',
        'Politique de droits d’auteur et procédure de retrait',
        $html$<article>
<h2>Protection de la propriété intellectuelle</h2>
<p>Les fournisseurs garantissent la conformité de leurs visuels et marques. Toute notification de retrait accompagnée des justificatifs de propriété et de l’URL exacte doit être envoyée à <strong>info@mertervitrini.com.tr</strong> (traitement sous 48 heures).</p>
</article>$html$,
        'Droits d’auteur et retrait | Merter Vitrini',
        'Procédure de signalement et de retrait pour atteinte aux droits d’auteur ou marques.'
    ),
    (
        v_page_id, 'pl',
        'Polityka praw autorskich i procedura zgłaszania naruszeń',
        $html$<article>
<h2>Ochrona własności intelektualnej</h2>
<p>Dostawcy odpowiadają za legalność publikowanych zdjęć i marek. Zgłoszenia naruszeń wraz z dokumentacją praw i adresem URL prosimy kierować na <strong>info@mertervitrini.com.tr</strong> (rozpatrzenie w ciągu 48 godzin).</p>
</article>$html$,
        'Prawa autorskie i zgłaszanie naruszeń | Merter Vitrini',
        'Procedura Notice & Takedown w zakresie praw autorskich i znaków towarowych na Merter Vitrini.'
    ),
    (
        v_page_id, 'bg',
        'Политика за авторски права и премахване на съдържание',
        $html$<article>
<h2>Защита на интелектуалната собственост</h2>
<p>Доставчиците носят пълна отговорност за качените изображения и марки. Искания за премахване с доказателства за собственост и точен URL изпращайте на <strong>info@mertervitrini.com.tr</strong> (обработка до 48 часа).</p>
</article>$html$,
        'Авторски права и премахване | Merter Vitrini',
        'Процедура за сигнализиране и премахване при нарушени авторски права в Merter Vitrini.'
    )
    ON CONFLICT (page_id, language_code) DO UPDATE
    SET title = EXCLUDED.title, content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description;

    -- =========================================================================
    -- PAGE 5: iptal-iade-kosullari
    -- =========================================================================
    SELECT id INTO v_page_id FROM catalog.pages WHERE slug = 'iptal-iade-kosullari';

    INSERT INTO catalog.page_translations (page_id, language_code, title, content, meta_title, meta_description)
    VALUES
    (
        v_page_id, 'tr',
        'B2B İptal, İade, Değişim ve Doğrudan Tedarikçi Koşulları',
        $html$<article>
<h2>1. Toptan (B2B) Satışlarda İptal ve İade Esasları</h2>
<p>mertervitrini.com.tr münhasıran işletmeler arası (B2B) toptan satış vitrinidir. Tüketici Kanunu kapsamındaki cayma hakkı uygulanmaz; tüm siparişler 6102 sayılı TTK ve 6098 sayılı TBK ticari satış hükümlerine tabidir.</p>
<h2>2. Muhatap Yalnızca Doğrudan Satıcı Olan Tedarikçidir</h2>
<ul>
<li>Merter Vitrini yer sağlayıcı olup doğrudan satıcı değildir; ödeme almaz, ürün göndermez ve iade depolamaz.</li>
<li>Her türlü iptal, değişim, ayıplı/hasarlı ürün, eksik koli veya bedel iadesi talebi <strong>doğrudan faturayı düzenleyen ve satışı yapan Tedarikçi firmaya</strong> iletilmelidir.</li>
<li>TTK m. 23 uyarınca açık ayıplarda 2 iş günü, diğer ayıplarda 8 gün içinde satıcı Tedarikçiye yazılı ve görsel ihbarda bulunulmalıdır.</li>
</ul>
</article>$html$,
        'B2B İptal ve İade Koşulları | Merter Vitrini',
        'Toptan B2B satışlarda iptal, iade, ayıp ihbarı ve doğrudan tedarikçi muhataplık koşulları.'
    ),
    (
        v_page_id, 'en',
        'B2B Cancellation, Return & Direct Supplier Procedure',
        $html$<article>
<h2>1. Commercial B2B Sales Framework</h2>
<p>All transactions initiated through Merter Vitrini are wholesale B2B transactions governed by the Turkish Commercial Code (Law No. 6102). Retail consumer withdrawal rights do not apply.</p>
<h2>2. Direct Supplier Handling Only</h2>
<p>Because Merter Vitrini is solely a Hosting Provider and never acts as Direct Seller or payment collector, every cancellation, defective-item claim, missing-piece notification, return, exchange, or refund must be resolved <strong>directly with the selling Supplier</strong> according to the Supplier's commercial terms.</p>
</article>$html$,
        'B2B Cancellation & Return Policy | Merter Vitrini',
        'B2B wholesale return, defect claim, and direct-supplier resolution procedure.'
    ),
    (
        v_page_id, 'ru',
        'Условия отмены, возврата и обмена для B2B',
        $html$<article>
<h2>Правила B2B-возвратов</h2>
<p>Все заказы носят коммерческий B2B-характер (Торговый кодекс Турции № 6102). Поскольку Merter Vitrini не является продавцом и не принимает оплату, любые вопросы отмены, брака, обмена и возврата средств решаются <strong>исключительно напрямую с Поставщиком</strong>.</p>
</article>$html$,
        'Отмена и возврат B2B | Merter Vitrini',
        'Коммерческие B2B-правила отмены и возврата напрямую через поставщика.'
    ),
    (
        v_page_id, 'ar',
        'شروط الإلغاء والاسترجاع والاستبدال التجاري (B2B)',
        $html$<article dir="rtl">
<h2>إجراءات الإلغاء والاسترجاع بين الشركات</h2>
<p>تخضع جميع المبيعات لأحكام التجارة بالجملة (B2B) بموجب القانون التجاري التركي رقم 6102. وبما أن منصة Merter Vitrini مزود استضافة فقط، تُوجَّه جميع طلبات الإلغاء أو الاستبدال أو العيوب أو استرداد الأموال <strong>مباشرة إلى المورد البائع</strong>.</p>
</article>$html$,
        'شروط الإلغاء والاسترجاع B2B | Merter Vitrini',
        'سياسة الإلغاء والاسترجاع والتواصل المباشر مع المورد لطلبات الجملة على Merter Vitrini.'
    ),
    (
        v_page_id, 'de',
        'B2B-Stornierungs-, Rückgabe- & Direktlieferantenbedingungen',
        $html$<article>
<h2>B2B-Großhandelsbedingungen</h2>
<p>Alle über die Plattform angebahnten Geschäfte sind reine B2B-Handelsgeschäfte. Reklamationen, Mängelrügen, Rücksendungen und Erstattungen sind <strong>ausschließlich direkt mit dem jeweiligen verkaufenden Lieferanten</strong> zu klären.</p>
</article>$html$,
        'B2B Rückgabe & Stornierung | Merter Vitrini',
        'B2B-Bedingungen für Stornierungen, Mängel und Rückgaben direkt beim Lieferanten.'
    ),
    (
        v_page_id, 'fr',
        'Conditions d’annulation et de retour B2B',
        $html$<article>
<h2>Ventes professionnelles B2B</h2>
<p>Les transactions relèvent exclusivement du droit commercial B2B. Toute demande d’annulation, de réclamation pour défaut, de retour ou de remboursement doit être traitée <strong>directement avec le fournisseur vendeur</strong>.</p>
</article>$html$,
        'Annulation et retour B2B | Merter Vitrini',
        'Conditions B2B de retour et résolution directe avec les fournisseurs.'
    ),
    (
        v_page_id, 'pl',
        'Warunki anulowania i zwrotów B2B',
        $html$<article>
<h2>Zasady transakcji hurtowych B2B</h2>
<p>Wszystkie transakcje mają charakter B2B. Wszelkie reklamacje wad, braki, zwroty i rozliczenia należy załatwiać <strong>bezpośrednio z dostawcą wystawiającym towar</strong>.</p>
</article>$html$,
        'Anulowanie i zwroty B2B | Merter Vitrini',
        'Zasady zwrotów B2B i reklamacji bezpośrednio u dostawcy Merter Vitrini.'
    ),
    (
        v_page_id, 'bg',
        'Условия за анулиране и връщане B2B',
        $html$<article>
<h2>Търговски B2B правила</h2>
<p>Всички сделки са търговски B2B продажби на едро. Рекламации за дефекти, връщания и възстановяване на суми се уреждат <strong>директно с продаващия доставчик</strong>.</p>
</article>$html$,
        'Анулиране и връщане B2B | Merter Vitrini',
        'B2B условия за връщане и рекламации директно към доставчика.'
    )
    ON CONFLICT (page_id, language_code) DO UPDATE
    SET title = EXCLUDED.title, content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description;

    -- =========================================================================
    -- PAGE 6: gizlilik-politikasi
    -- =========================================================================
    SELECT id INTO v_page_id FROM catalog.pages WHERE slug = 'gizlilik-politikasi';

    INSERT INTO catalog.page_translations (page_id, language_code, title, content, meta_title, meta_description)
    VALUES
    (
        v_page_id, 'tr',
        'Gizlilik Politikası ve 6698 Sayılı KVKK Aydınlatma Metni',
        $html$<article>
<h2>1. Veri Sorumlusu ve Bağımsız Veri Sorumlusu Tedarikçiler</h2>
<p>Üyelik, güvenlik ve hukuki onay logları kapsamında kişisel verileriniz 6698 sayılı KVKK uyarınca Merter Vitrini tarafından işlenir. Bir Tedarikçi ile WhatsApp, B2B sohbet veya sipariş formu üzerinden paylaştığınız ticari ve fatura bilgilerinde ilgili <strong>Tedarikçi firma bağımsız veri sorumlusudur</strong>.</p>
<h2>2. Hukuki Onay ve İspat Kayıtları</h2>
<p>5651 sayılı Kanun ve 6098 sayılı TBK uyarınca üyelik sözleşmesi, tedarikçi başvurusu ve ürün/içerik yükleme sorumluluk beyanı onayları IP adresi, zaman damgası ve metin sürümü ile güvenli biçimde saklanır.</p>
<h2>3. KVKK Madde 11 Hakları</h2>
<p>Hesabınıza ve verilerinize ilişkin silme/düzeltme taleplerinizi <strong>/account-deletion</strong> sayfası veya <strong>info@mertervitrini.com.tr</strong> üzerinden iletebilirsiniz.</p>
</article>$html$,
        'Gizlilik Politikası ve KVKK Aydınlatma Metni | Merter Vitrini',
        'Merter Vitrini B2B gizlilik politikası, KVKK aydınlatma metni ve yasal onay kayıtları hakkında bilgilendirme.'
    ),
    (
        v_page_id, 'en',
        'Privacy Policy & Data Protection Notice (KVKK Law No. 6698)',
        $html$<article>
<h2>1. Platform Controller &amp; Independent Supplier Controllers</h2>
<p>Merter Vitrini processes account, security, and mandatory legal consent logs (IP address, timestamp, accepted version) under Turkish Data Protection Law No. 6698 (KVKK). When you submit a direct inquiry or order to an independent Supplier, that Supplier acts as an independent data controller for fulfillment and invoicing.</p>
<h2>2. Your Rights &amp; Data Deletion</h2>
<p>You may request access, correction, or account deletion at <strong>/account-deletion</strong> or by writing to <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$html$,
        'Privacy Policy & Data Protection | Merter Vitrini',
        'Privacy policy and Law No. 6698 (KVKK) disclosure for Merter Vitrini B2B buyers and suppliers.'
    ),
    (
        v_page_id, 'ru',
        'Политика конфиденциальности и защиты данных (KVKK № 6698)',
        $html$<article>
<h2>Обработка данных и журналы согласий</h2>
<p>Merter Vitrini обрабатывает данные регистрации и журналы юридических согласий (IP, время, версия) в соответствии с Законом № 6698. При прямых заказах поставщик выступает самостоятельным оператором данных. Запросы на удаление: <strong>/account-deletion</strong> или <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$html$,
        'Политика конфиденциальности | Merter Vitrini',
        'Политика конфиденциальности и защиты персональных данных Merter Vitrini B2B.'
    ),
    (
        v_page_id, 'ar',
        'سياسة الخصوصية وحماية البيانات (القانون 6698)',
        $html$<article dir="rtl">
<h2>معالجة البيانات وسجلات الموافقة القانونية</h2>
<p>تعالج منصة Merter Vitrini بيانات الحسابات وسجلات الموافقات القانونية (عنوان IP والوقت والإصدار) وفقاً للقانون التركي رقم 6698. وعند التواصل المباشر مع المورد، يتحمل المورد مسؤولية البيانات بشكل مستقل. لطلبات الحذف: <strong>/account-deletion</strong>.</p>
</article>$html$,
        'سياسة الخصوصية | Merter Vitrini',
        'سياسة الخصوصية وحماية البيانات الشخصية على منصة Merter Vitrini B2B.'
    ),
    (
        v_page_id, 'de',
        'Datenschutzerklärung (Gesetz Nr. 6698 / KVKK)',
        $html$<article>
<h2>Datenverarbeitung &amp; Einwilligungsprotokolle</h2>
<p>Merter Vitrini speichert Konto-, Sicherheits- und rechtliche Einwilligungsnachweise (IP-Adresse, Zeitstempel, Version) gemäß dem türkischen Datenschutzgesetz Nr. 6698. Bei Direktanfragen ist der jeweilige Lieferant eigenständiger Verantwortlicher. Löschanfragen: <strong>/account-deletion</strong>.</p>
</article>$html$,
        'Datenschutzerklärung | Merter Vitrini',
        'Datenschutzhinweise gemäß KVKK für B2B-Käufer und Lieferanten auf Merter Vitrini.'
    ),
    (
        v_page_id, 'fr',
        'Politique de confidentialité et protection des données',
        $html$<article>
<h2>Traitement des données et preuves de consentement</h2>
<p>Merter Vitrini traite les données de compte et conserve les journaux de consentement (IP, horodatage, version) conformément à la loi n° 6698. Chaque fournisseur reste responsable indépendant des données reçues en direct. Suppression de compte : <strong>/account-deletion</strong>.</p>
</article>$html$,
        'Politique de confidentialité | Merter Vitrini',
        'Politique de confidentialité B2B et protection des données Merter Vitrini.'
    ),
    (
        v_page_id, 'pl',
        'Polityka prywatności i ochrony danych (KVKK nr 6698)',
        $html$<article>
<h2>Przetwarzanie danych i rejestry zgód</h2>
<p>Merter Vitrini przetwarza dane kont oraz rejestry zgód prawnych (IP, znacznik czasu, wersja) zgodnie z ustawą nr 6698. Przy zamówieniach bezpośrednich odrębnym administratorem danych jest dostawca. Usunięcie konta: <strong>/account-deletion</strong>.</p>
</article>$html$,
        'Polityka prywatności | Merter Vitrini',
        'Polityka prywatności i ochrony danych osobowych w serwisie Merter Vitrini B2B.'
    ),
    (
        v_page_id, 'bg',
        'Политика за поверителност и защита на данните',
        $html$<article>
<h2>Обработка на данни и записи за съгласие</h2>
<p>Merter Vitrini обработва данни за акаунти и законови съгласия (IP, час, версия) съгласно Закон № 6698. При директни запитвания доставчикът е самостоятелен администратор. Заявки за изтриване: <strong>/account-deletion</strong>.</p>
</article>$html$,
        'Политика за поверителност | Merter Vitrini',
        'Политика за поверителност и защита на личните данни в Merter Vitrini B2B.'
    )
    ON CONFLICT (page_id, language_code) DO UPDATE
    SET title = EXCLUDED.title, content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description;

    -- =========================================================================
    -- PAGE 7: mesafeli-satis-sozlesmesi
    -- =========================================================================
    SELECT id INTO v_page_id FROM catalog.pages WHERE slug = 'mesafeli-satis-sozlesmesi';

    INSERT INTO catalog.page_translations (page_id, language_code, title, content, meta_title, meta_description)
    VALUES
    (
        v_page_id, 'tr',
        'B2B Doğrudan Tedarikçi Sipariş ve Bilgilendirme Metni',
        $html$<article>
<h2>1. Merter Vitrini Satıcı Taraf Değildir</h2>
<p>mertervitrini.com.tr yalnızca 5651 sayılı Kanun kapsamında <strong>"Yer Sağlayıcı"</strong>dır. Platform üzerinden iletilen sipariş veya WhatsApp taleplerinde alım-satım ilişkisi doğrudan <strong>Alıcı</strong> ile ilgili ürünün sahibi olan <strong>bağımsız Tedarikçi ("Doğrudan Satıcı")</strong> arasında kurulur.</p>
<h2>2. Ticari Satış (B2B) ve Tüketici Mevzuatı İstisnası</h2>
<p>Platformda yalnızca tacirler arası (B2B) toptan seri satışı yapıldığından 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uygulanmaz; sözleşmeler 6102 sayılı TTK ve 6098 sayılı TBK hükümlerine tabidir.</p>
<h2>3. Ödeme, Fatura, Teslimat ve Uyuşmazlık Muhatabı</h2>
<p>Fiyat, ödeme/IBAN bilgileri, fatura kesimi, nakliye, gümrük ve olası ayıplı mal/iade ihtilaflarında <strong>tek muhatap ve sorumlu ilgili Tedarikçi firmadır</strong>. Merter Vitrini aleyhine bu işlemlerden kaynaklı hiçbir talep yöneltilemez.</p>
</article>$html$,
        'B2B Doğrudan Tedarikçi Sipariş Çerçeve Metni | Merter Vitrini',
        'B2B doğrudan tedarikçi sipariş esasları: Merter Vitrini satıcı değildir; tüm ticari sözleşmeler alıcı ile tedarikçi arasındadır.'
    ),
    (
        v_page_id, 'en',
        'B2B Direct-Supplier Order & Non-Seller Legal Notice',
        $html$<article>
<h2>1. Platform Is Not the Contracting Seller</h2>
<p>When a buyer submits a cart order or WhatsApp inquiry through Merter Vitrini, the commercial sales contract is formed directly between the <strong>Buyer</strong> and the named independent <strong>Supplier (Direct Seller)</strong>. Merter Vitrini acts strictly as a 5651 Hosting Provider.</p>
<h2>2. Commercial B2B Exclusion &amp; Dispute Resolution</h2>
<p>Consumer distance-selling statutes do not apply to wholesale B2B transactions. Pricing confirmation, bank/IBAN settlement, invoicing, shipment, and any post-sale complaints or returns are handled solely between Buyer and Supplier.</p>
</article>$html$,
        'B2B Direct-Supplier Order Terms | Merter Vitrini',
        'Commercial order terms clarifying Merter Vitrini is not a seller and buyers contract directly with independent suppliers.'
    ),
    (
        v_page_id, 'ru',
        'Условия прямых B2B-заказов у поставщика',
        $html$<article>
<h2>Прямой договор с поставщиком</h2>
<p>При оформлении запроса или заказа через Merter Vitrini коммерческая сделка заключается напрямую между Покупателем и указанным Поставщиком. Платформа не является стороной договора и не отвечает за оплату, отгрузку или возвраты.</p>
</article>$html$,
        'Условия прямых B2B-заказов | Merter Vitrini',
        'Merter Vitrini не выступает продавцом: все B2B-заказы оформляются напрямую у поставщика.'
    ),
    (
        v_page_id, 'ar',
        'إشعار الطلب المباشر مع المورد (B2B)',
        $html$<article dir="rtl">
<h2>التعاقد المباشر مع المورد البائع</h2>
<p>عند إرسال أي طلب شراء أو استفسار عبر المنصة، ينعقد الاتفاق التجاري مباشرة بين المشتري والمورد المستقل المسمى في المنتج. لا تُعد منصة Merter Vitrini طرفاً بائعاً ولا مسؤولة عن الدفع أو الشحن أو النزاعات.</p>
</article>$html$,
        'شروط الطلب المباشر مع المورد | Merter Vitrini',
        'يوضح هذا الإشعار أن جميع عقود البيع B2B تتم مباشرة بين المشتري والمورد البائع.'
    ),
    (
        v_page_id, 'de',
        'B2B-Bestellhinweis & Direktvertrag mit Lieferanten',
        $html$<article>
<h2>Direkter Vertragsschluss mit dem Lieferanten</h2>
<p>Bestell- oder WhatsApp-Anfragen über Merter Vitrini begründen ausschließlich Rechtsbeziehungen direkt zwischen Käufer und dem benannten Lieferanten. Merter Vitrini ist nicht Verkäufer und haftet nicht für Zahlung, Lieferung oder Mängel.</p>
</article>$html$,
        'B2B Bestellhinweis | Merter Vitrini',
        'Rechtlicher Hinweis: Kaufverträge über Merter Vitrini kommen ausschließlich direkt mit den Lieferanten zustande.'
    ),
    (
        v_page_id, 'fr',
        'Notice de commande B2B directe auprès du fournisseur',
        $html$<article>
<h2>Contrat direct avec le fournisseur</h2>
<p>Toute demande de commande soumise sur Merter Vitrini engage exclusivement l’Acheteur et le Fournisseur indépendant désigné. Merter Vitrini n’est pas partie vendeuse et décline toute responsabilité relative aux paiements, livraisons ou litiges.</p>
</article>$html$,
        'Notice de commande B2B | Merter Vitrini',
        'Les commandes B2B engagent uniquement l’acheteur et le fournisseur vendeur direct.'
    ),
    (
        v_page_id, 'pl',
        'Zasady zamówień bezpośrednich B2B u dostawcy',
        $html$<article>
<h2>Bezpośrednia umowa ze sprzedawcą</h2>
<p>Złożenie zapytania lub zamówienia przez Merter Vitrini oznacza kontakt bezpośrednio ze wskazanym Dostawcą. Platforma nie jest stroną sprzedaży i nie odpowiada za płatności, wysyłki ani reklamacje.</p>
</article>$html$,
        'Zasady zamówień B2B | Merter Vitrini',
        'Merter Vitrini nie jest stroną umowy sprzedaży — zamówienia realizowane są bezpośrednio u dostawców.'
    ),
    (
        v_page_id, 'bg',
        'Условия за директни B2B поръчки към доставчика',
        $html$<article>
<h2>Директен договор с доставчика</h2>
<p>Всяка заявка за поръчка през Merter Vitrini се отправя директно към посочения независим доставчик. Платформата не е продавач и не носи отговорност за плащане, доставка или рекламации.</p>
</article>$html$,
        'Условия за директни B2B поръчки | Merter Vitrini',
        'Merter Vitrini не е продавач; търговските сделки се сключват директно с доставчиците.'
    )
    ON CONFLICT (page_id, language_code) DO UPDATE
    SET title = EXCLUDED.title, content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title, meta_description = EXCLUDED.meta_description;
END $migrate$;
