-- Migration 0046: Complete native 8-language CMS pages, full legal policy parity, and blog translation fixes
-- Languages covered: tr, en, ru, ar, de, fr, pl, bg

BEGIN;

CREATE FUNCTION pg_temp.upsert_page_tx(
    p_slug TEXT,
    p_lang TEXT,
    p_title TEXT,
    p_content TEXT,
    p_meta_title TEXT,
    p_meta_desc TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_page_id UUID;
BEGIN
    SELECT id INTO v_page_id FROM catalog.pages WHERE slug = p_slug;
    IF v_page_id IS NULL THEN
        RAISE EXCEPTION 'Missing catalog.pages slug: %', p_slug;
    END IF;

    INSERT INTO catalog.page_translations (
        page_id, language_code, title, content, meta_title, meta_description
    ) VALUES (
        v_page_id, p_lang, p_title, p_content, p_meta_title, p_meta_desc
    )
    ON CONFLICT (page_id, language_code) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title,
        meta_description = EXCLUDED.meta_description;
END
$$;

CREATE FUNCTION pg_temp.upsert_blog_tx(
    p_slug TEXT,
    p_lang TEXT,
    p_title TEXT,
    p_summary TEXT,
    p_content TEXT,
    p_meta_title TEXT,
    p_meta_desc TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_post_id UUID;
BEGIN
    SELECT id INTO v_post_id FROM catalog.blog_posts WHERE slug = p_slug;
    IF v_post_id IS NULL THEN
        RAISE EXCEPTION 'Missing catalog.blog_posts slug: %', p_slug;
    END IF;

    INSERT INTO catalog.blog_post_translations (
        post_id, language_code, title, summary, content, meta_title, meta_description, slug
    ) VALUES (
        v_post_id, p_lang, p_title, p_summary, p_content, p_meta_title, p_meta_desc, p_slug
    )
    ON CONFLICT (post_id, language_code) DO UPDATE SET
        title = EXCLUDED.title,
        summary = EXCLUDED.summary,
        content = EXCLUDED.content,
        meta_title = EXCLUDED.meta_title,
        meta_description = EXCLUDED.meta_description;
END
$$;

-- ============================================================================
-- SECTION 1: CORPORATE / INFORMATIVE CMS PAGES (8 LANGUAGES)
-- Slugs: hakkimizda, iletisim, b2b, faq
-- ============================================================================

-- 1.1 hakkimizda
SELECT pg_temp.upsert_page_tx(
    'hakkimizda', 'tr',
    'Hakkımızda',
    $t$<article>
<h2>Biz Kimiz?</h2>
<p><strong>Merter Vitrini</strong>, Türkiye'nin en köklü ve seçkin hazır giyim üreticilerini küresel alıcılarla buluşturan yeni nesil dijital B2B toptan satış platformudur. İstanbul Merter Tekstil Merkezi'nin kalbinde doğrudan üretici showroom'u olarak hizmet veriyor; butiklerin, mağaza zincirlerinin ve e-ticaret işletmelerinin en hızlı ve güvenilir biçimde toptan tedarik yapmasını sağlıyoruz.</p>
<h2>Misyonumuz</h2>
<p>Tekstil ticaretindeki fiziki sınırları ortadan kaldırarak uluslararası B2B toptan alım süreçlerini şeffaf, hızlı ve öngörülebilir hâle getirmektir. Geleneksel toptan giyim tedarikini dijitalleştirerek yüksek kaliteli seri ve asorti paketleri doğrudan üretici koşullarıyla alıcılarla buluşturuyoruz.</p>
<h2>Neden Merter Vitrini?</h2>
<ul>
<li><strong>Doğrudan Üretici İletişimi:</strong> Doğrulanmış Merter toptancı ve imalatçı firmalarının güncel koleksiyonlarını açık firma kimliğiyle doğrudan keşfedersiniz.</li>
<li><strong>Küresel Lojistik ve Kargo:</strong> Türkiye içi hızlı kargonun yanı sıra Merter, Laleli ve Osmanbey kargo acentelerine ücretsiz teslimat ve uluslararası gümrüklü sevkiyat imkânı sunulur.</li>
<li><strong>Kurumsal B2B Altyapısı:</strong> Çok dilli (8 dil) dijital vitrin, çoklu para birimi desteği (TRY/USD/EUR/GBP) ve şeffaf seri stok takibi sağlanır.</li>
</ul>
<h2>İletişim</h2>
<p>Toptan sipariş süreçleri, tedarikçi başvuruları ve XML entegrasyonu için bizimle iletişime geçebilirsiniz.</p>
<p><strong>E-Posta:</strong> info@mertervitrini.com.tr<br/><strong>7/24 Destek Hattı:</strong> +90 533 703 08 83<br/><strong>Merkez Adres:</strong> Merter Tekstil Merkezi, Mehmet Nesih Özmen Mah., Güngören / İstanbul</p>
</article>$t$,
    'Hakkımızda | Merter Vitrini Toptan B2B Giyim',
    'Merter Vitrini toptan hazır giyim dijital B2B showroomu hakkında bilgi edinin. Doğrudan Merter imalatçılarından güvenli toptan tedarik.'
);

SELECT pg_temp.upsert_page_tx(
    'hakkimizda', 'en',
    'About Us',
    $t$<article>
<h2>Who We Are</h2>
<p><strong>Merter Vitrini</strong> is a next-generation digital B2B wholesale marketplace connecting Turkey's established ready-to-wear apparel manufacturers with global commercial buyers. Operating from the heart of the Merter Textile Center in Istanbul, we enable boutiques, retail chains, and online fashion businesses to source wholesale apparel directly and efficiently.</p>
<h2>Our Mission</h2>
<p>Our mission is to eliminate physical boundaries in international wholesale apparel trade by making B2B sourcing transparent, reliable, and digital. We connect wholesale buyers with verified factory-direct series and assortment packs at competitive manufacturer pricing.</p>
<h2>Why Choose Merter Vitrini?</h2>
<ul>
<li><strong>Verified Direct Suppliers:</strong> Browse collections published directly by verified Merter manufacturers and wholesalers with transparent company identities.</li>
<li><strong>Global Export &amp; Cargo Hub Access:</strong> Free drop-off to your designated cargo agency in Merter, Laleli, or Osmanbey, plus international air, road, and sea freight coordination.</li>
<li><strong>Enterprise B2B Infrastructure:</strong> Full 8-language showroom localization, multi-currency pricing (USD, EUR, TRY, GBP), and live wholesale series tracking.</li>
</ul>
<h2>Contact Information</h2>
<p>Reach out to our B2B desk for wholesale inquiries, supplier onboarding, or XML catalog integration.</p>
<p><strong>Email:</strong> info@mertervitrini.com.tr<br/><strong>24/7 Support Line:</strong> +90 533 703 08 83<br/><strong>Address:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Istanbul, Turkey</p>
</article>$t$,
    'About Us | Merter Vitrini Wholesale B2B Apparel',
    'Learn about Merter Vitrini, Istanbul Merter wholesale B2B fashion showroom. Connect directly with verified Turkish apparel manufacturers.'
);

SELECT pg_temp.upsert_page_tx(
    'hakkimizda', 'ru',
    'О нас',
    $t$<article>
<h2>Кто мы</h2>
<p><strong>Merter Vitrini</strong> — это цифровая оптовая B2B-платформа нового поколения, объединяющая ведущих производителей готовой одежды из Стамбула (район Мертер) с профессиональными покупателями по всему миру. Мы помогаем бутикам, торговым сетям и интернет-магазинам закупать качественные коллекции напрямую без лишних посредников.</p>
<h2>Наша миссия</h2>
<p>Устранить географические барьеры в оптовой торговле одеждой, сделав международные B2B-закупки быстрыми, прозрачными и удобными. Мы оцифровываем процессы оптового снабжения и открываем прямой доступ к фабричным сериям и размерным рядам.</p>
<h2>Почему Merter Vitrini?</h2>
<ul>
<li><strong>Прямые проверенные поставщики:</strong> Открытые профили фабрик и оптовых домов Мертера с прямой связью и актуальными каталогами.</li>
<li><strong>Глобальная логистика и карго:</strong> Бесплатная доставка до вашего карго-агентства в Мертере, Лалели или Османбее, а также международная отправка авиатранспортом и автодоставкой.</li>
<li><strong>Мультиязычная B2B-инфраструктура:</strong> Поддержка 8 языков, расчеты в USD, EUR, TRY и GBP, а также актуальное наличие размерных рядов.</li>
</ul>
<h2>Контакты</h2>
<p>Свяжитесь с нашей командой по вопросам оптовых заказов, подключения поставщиков или XML-интеграции.</p>
<p><strong>E-mail:</strong> info@mertervitrini.com.tr<br/><strong>Линия поддержки 24/7:</strong> +90 533 703 08 83<br/><strong>Адрес:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Стамбул, Турция</p>
</article>$t$,
    'О нас | Merter Vitrini Оптовая B2B Одежда',
    'Информация о цифровой B2B-платформе оптовой одежды Merter Vitrini в Стамбуле. Прямые поставки от производителей Мертера для бутиков.'
);

SELECT pg_temp.upsert_page_tx(
    'hakkimizda', 'ar',
    'معلومات عنا',
    $t$<article dir="rtl">
<h2>من نحن؟</h2>
<p><strong>Merter Vitrini</strong> هي منصة تجارة إلكترونية رقمية متطورة بنظام B2B للبيع بالجملة، تجمع بين أبرز مصنعي وتجار الملابس الجاهزة في مركز مرتر للنسيج بإسطنبول والمشترين التجاريين حول العالم. نُمكّن أصحاب البوتيكات وسلاسل المتاجر ومتاجر التجارة الإلكترونية من التوريد المباشر بأعلى موثوقية.</p>
<h2>رسالتنا</h2>
<p>إزالة الحدود الجغرافية أمام تجارة الملابس بالجملة من خلال تحويل سلاسل الإمداد التقليدية إلى تجربة رقمية شفافة وسريعة تتيح الوصول المباشر إلى السيريات والطرود الجاهزة بأسعار المصنع.</p>
<h2>لماذا Merter Vitrini؟</h2>
<ul>
<li><strong>موردون ومصنعون موثوقون:</strong> عرض مباشر لهوية المصانع وتجار الجملة المعتمدين في مرتر وقنوات التواصل المباشرة معهم.</li>
<li><strong>شحن دولي ولوجستيات مرنة:</strong> توصيل مجاني إلى شركات الشحن المعتمدة لديكم في مناطق مرتر ولالالي وعثمان بيه في إسطنبول، بالإضافة إلى الشحن الجوي والبري والبحري الدولي.</li>
<li><strong>بنية B2B احترافية:</strong> دعم كامل بـ 8 لغات وأسعار متعددة العملات (USD وEUR وTRY وGBP) ومتابعة دقيقة لتوافر السيريات.</li>
</ul>
<h2>بيانات التواصل</h2>
<p>للاستفسارات المتعلقة بطلبات الجملة أو انضمام الموردين أو ربط كتالوج XML يرجى التواصل معنا:</p>
<p><strong>البريد الإلكتروني:</strong> info@mertervitrini.com.tr<br/><strong>خط الدعم 24/7:</strong> +90 533 703 08 83<br/><strong>العنوان:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / إسطنبول، تركيا</p>
</article>$t$,
    'من نحن | Merter Vitrini لتجارة الملابس بالجملة B2B',
    'تعرف على منصة Merter Vitrini في إسطنبول لتوريد الملابس النسائية والرجالية بالجملة مباشرة من مصانع مرتر.'
);

SELECT pg_temp.upsert_page_tx(
    'hakkimizda', 'de',
    'Über uns',
    $t$<article>
<h2>Wer wir sind</h2>
<p><strong>Merter Vitrini</strong> ist ein digitaler B2B-Großhandelsmarktplatz der nächsten Generation, der führende Bekleidungshersteller aus dem Textilzentrum Istanbul-Merter direkt mit internationalen Fachhändlern verbindet. Boutiquen, Modeketten und E-Commerce-Händler beziehen über unsere Plattform schnell und zuverlässig aktuelle Kollektionen.</p>
<h2>Unsere Mission</h2>
<p>Wir beseitigen geografische Hürden im internationalen Textilgroßhandel, indem wir die klassische B2B-Beschaffung digitalisieren und geprüfte Größensortimente (Serien) direkt zu Herstellerkonditionen zugänglich machen.</p>
<h2>Warum Merter Vitrini?</h2>
<ul>
<li><strong>Verifizierte Direkthersteller:</strong> Alle Lieferanten präsentieren sich transparent mit ihren offiziellen Unternehmensdaten und direkten Kontaktkanälen.</li>
<li><strong>Globale Logistik &amp; Cargo-Service:</strong> Kostenlose Anlieferung an Ihre Cargo-Agentur in Merter, Laleli oder Osmanbey sowie weltweiter Luft-, Land- und Seefrachtversand mit Exportunterstützung.</li>
<li><strong>Professionelle B2B-Plattform:</strong> Mehrsprachiger Showroom (8 Sprachen), flexible Währungen (EUR, USD, TRY, GBP) und transparente Serienstruktur.</li>
</ul>
<h2>Kontakt</h2>
<p>Bei Fragen zu Großhandelsbestellungen, Lieferantenpartnerschaften oder XML-Integration erreichen Sie uns jederzeit:</p>
<p><strong>E-Mail:</strong> info@mertervitrini.com.tr<br/><strong>24/7 Support-Hotline:</strong> +90 533 703 08 83<br/><strong>Standort:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Istanbul</p>
</article>$t$,
    'Über uns | Merter Vitrini B2B Textilgroßhandel',
    'Informationen über den digitalen B2B-Showroom Merter Vitrini in Istanbul-Merter. Direktbezug vom türkischen Bekleidungshersteller.'
);

SELECT pg_temp.upsert_page_tx(
    'hakkimizda', 'fr',
    'À propos de nous',
    $t$<article>
<h2>Qui sommes-nous ?</h2>
<p><strong>Merter Vitrini</strong> est une plateforme B2B numérique de vente en gros de nouvelle génération reliant les fabricants de prêt-à-porter établis d'Istanbul-Merter aux acheteurs professionnels du monde entier. Nous permettons aux boutiques, chaînes de magasins et sites e-commerce de s'approvisionner directement auprès des ateliers et grossistes.</p>
<h2>Notre mission</h2>
<p>Supprimer les barrières physiques du commerce textile international en digitalisant l'approvisionnement B2B pour proposer des séries et lots de qualité aux conditions directes des fabricants.</p>
<h2>Pourquoi choisir Merter Vitrini ?</h2>
<ul>
<li><strong>Fournisseurs directs vérifiés :</strong> Accédez aux catalogues des grossistes et fabricants certifiés de Merter avec leurs coordonnées professionnelles transparentes.</li>
<li><strong>Logistique internationale &amp; Cargo :</strong> Livraison gratuite vers votre agence cargo partenaire à Merter, Laleli ou Osmanbey, ainsi que l'expédition internationale aérienne, routière ou maritime.</li>
<li><strong>Infrastructure B2B complète :</strong> Vitrine disponible en 8 langues, affichage multi-devises (EUR, USD, TRY, GBP) et gestion claire par séries de tailles.</li>
</ul>
<h2>Contact</h2>
<p>Pour toute demande relative aux commandes en gros, à l'inscription fournisseur ou à l'intégration XML :</p>
<p><strong>E-mail :</strong> info@mertervitrini.com.tr<br/><strong>Support 24/7 :</strong> +90 533 703 08 83<br/><strong>Adresse :</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Istanbul, Turquie</p>
</article>$t$,
    'À propos | Merter Vitrini Prêt-à-Porter en Gros B2B',
    'Découvrez Merter Vitrini, le showroom numérique B2B d''Istanbul-Merter. Approvisionnement direct auprès des fabricants textiles turcs.'
);

SELECT pg_temp.upsert_page_tx(
    'hakkimizda', 'pl',
    'O nas',
    $t$<article>
<h2>Kim jesteśmy?</h2>
<p><strong>Merter Vitrini</strong> to nowoczesna cyfrowa platforma hurtowa B2B łącząca renomowanych producentów odzieży ze Stambułu (centrum tekstylnego Merter) z profesjonalnymi kupcami na całym świecie. Pomagamy butikom, sieciom sklepów oraz sprzedawcom e-commerce w szybkim i bezpiecznym zaopatrzeniu bezpośrednio u źródeł.</p>
<h2>Nasza misja</h2>
<p>Znosimy bariery geograficzne w międzynarodowym handlu odzieżą, cyfryzując procesy B2B i udostępniając pełne serie rozmiarowe na warunkach bezpośrednio od producentów.</p>
<h2>Dlaczego Merter Vitrini?</h2>
<ul>
<li><strong>Zweryfikowani bezpośredni dostawcy:</strong> Przejrzyste profile producentów i hurtowników z dzielnicy Merter z bezpośrednim kontaktem handlowym.</li>
<li><strong>Logistyka międzynarodowa i cargo:</strong> Bezpłatne dostarczenie paczek do Twojej agencji cargo w Merter, Laleli lub Osmanbey oraz organizacja transportu lotniczego, drogowego i morskiego.</li>
<li><strong>Profesjonalna platforma B2B:</strong> Obsługa 8 języków, płatności i wyceny w USD, EUR, TRY oraz GBP, a także przejrzyste zestawy rozmiarowe.</li>
</ul>
<h2>Kontakt</h2>
<p>Skontaktuj się z nami w sprawie zamówień hurtowych, rejestracji dostawców lub integracji XML:</p>
<p><strong>E-mail:</strong> info@mertervitrini.com.tr<br/><strong>Wsparcie 24/7:</strong> +90 533 703 08 83<br/><strong>Adres:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Stambuł, Turcja</p>
</article>$t$,
    'O nas | Merter Vitrini Hurtownia Odzieży B2B',
    'Poznaj cyfrowy showroom hurtowy Merter Vitrini w Stambule. Bezpośrednie zakupy odzieży damskiej i męskiej od tureckich producentów.'
);

SELECT pg_temp.upsert_page_tx(
    'hakkimizda', 'bg',
    'За нас',
    $t$<article>
<h2>Кои сме ние?</h2>
<p><strong>Merter Vitrini</strong> е съвременна дигитална B2B платформа за търговия на едро, която свързва утвърдените производители на готово облекло в Истанбул (текстилен център Мертер) с търговци от целия свят. Подпомагаме бутици, магазинни вериги и онлайн търговци да зареждат актуални колекции директно и сигурно.</p>
<h2>Нашата мисия</h2>
<p>Да премахнем физическите граници в международната търговия с облекло на едро, като дигитализираме B2B доставките и осигурим директен достъп до серийни пакети на фабрични условия.</p>
<h2>Защо Merter Vitrini?</h2>
<ul>
<li><strong>Проверени директни производители:</strong> Директен достъп до утвърдени турски производители и търговци на едро в Мертер с прозрачни фирмени данни.</li>
<li><strong>Глобална логистика и карго:</strong> Безплатна доставка до избраната от вас карго агенция в Мертер, Лалели или Османбей и международен въздушен, сухопътен или морски транспорт.</li>
<li><strong>Корпоративна B2B инфраструктура:</strong> Поддръжка на 8 езика, валути EUR, USD, TRY и GBP и ясно представяне на серийните размери.</li>
</ul>
<h2>Контакти</h2>
<p>Свържете се с нашия B2B екип за поръчки на едро, регистрация на доставчици или XML интеграция:</p>
<p><strong>Имейл:</strong> info@mertervitrini.com.tr<br/><strong>Линия за поддръжка 24/7:</strong> +90 533 703 08 83<br/><strong>Адрес:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Истанбул, Турция</p>
</article>$t$,
    'За нас | Merter Vitrini B2B Облекло на едро',
    'Информация за дигиталния B2B шоурум Merter Vitrini в Мертер, Истанбул. Директни доставки на облекло на едро от турски производители.'
);

-- 1.2 iletisim
SELECT pg_temp.upsert_page_tx(
    'iletisim', 'tr',
    'İletişim & Showroom',
    $t$<article>
<h2>Merter Vitrini İletişim &amp; B2B Showroom</h2>
<p>İstanbul Merter tekstil piyasasından doğrudan toptan hazır giyim tedariğiniz, showroom ziyaretleriniz, tedarikçi başvurularınız ve XML entegrasyon talepleriniz için haftanın 7 günü destek ekibimizle iletişime geçebilirsiniz.</p>
<ul>
<li><strong>7/24 WhatsApp &amp; Telefon Hattı:</strong> +90 533 703 08 83</li>
<li><strong>Kurumsal E-Posta (Destek &amp; Uyar-Kaldır):</strong> info@mertervitrini.com.tr</li>
<li><strong>Showroom &amp; Merkez Adres:</strong> Merter Tekstil Merkezi, Mehmet Nesih Özmen Mah., Güngören / İstanbul</li>
<li><strong>Teslimat &amp; Lojistik Ağı:</strong> İstanbul içi Merter, Laleli ve Osmanbey kargo acentelerine ücretsiz sevkiyat; Avrupa, Orta Doğu, BDT ve Afrika'ya uluslararası ihracat kargosu.</li>
</ul>
</article>$t$,
    'İletişim Bilgileri | Merter Vitrini Toptan B2B',
    'Merter toptan tekstil showroom adresi, müşteri hizmetleri telefonu, 7/24 WhatsApp sipariş hattı ve kurumsal e-posta iletişim bilgileri.'
);

SELECT pg_temp.upsert_page_tx(
    'iletisim', 'en',
    'Contact & Showroom Information',
    $t$<article>
<h2>Merter Vitrini Contact &amp; B2B Showroom</h2>
<p>Get in touch with our B2B wholesale desk 7 days a week for Istanbul Merter showroom visits, wholesale apparel sourcing, supplier applications, and XML integration support.</p>
<ul>
<li><strong>24/7 WhatsApp &amp; Phone Support:</strong> +90 533 703 08 83</li>
<li><strong>Corporate Email (Support &amp; Legal Notices):</strong> info@mertervitrini.com.tr</li>
<li><strong>Showroom &amp; Center Address:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Istanbul, Turkey</li>
<li><strong>Cargo &amp; Export Delivery Network:</strong> Free local drop-off to your cargo agency in Merter, Laleli, or Osmanbey, plus international freight across Europe, CIS, MENA, and global markets.</li>
</ul>
</article>$t$,
    'Contact Information | Merter Vitrini Wholesale B2B',
    'Istanbul Merter wholesale textile showroom address, 24/7 WhatsApp B2B support line, and corporate email contact details.'
);

SELECT pg_temp.upsert_page_tx(
    'iletisim', 'ru',
    'Контакты и шоурум',
    $t$<article>
<h2>Контакты и B2B-шоурум Merter Vitrini</h2>
<p>Свяжитесь с нашей службой поддержки B2B 7 дней в неделю для визитов в шоурум в Стамбуле (Мертер), оптовых закупок одежды, регистрации поставщиков и настройки XML-интеграции.</p>
<ul>
<li><strong>WhatsApp и телефон 24/7:</strong> +90 533 703 08 83</li>
<li><strong>Корпоративная почта:</strong> info@mertervitrini.com.tr</li>
<li><strong>Адрес шоурума:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Стамбул, Турция</li>
<li><strong>Карго и экспортная доставка:</strong> Бесплатная передача заказов вашему карго в Мертере, Лалели и Османбее; международная доставка в страны СНГ, Европы, Ближнего Востока и мира.</li>
</ul>
</article>$t$,
    'Контакты и шоурум | Merter Vitrini Оптовый B2B',
    'Адрес шоурума Merter Vitrini в Стамбуле, круглосуточная поддержка в WhatsApp и корпоративные контакты для оптовых покупателей.'
);

SELECT pg_temp.upsert_page_tx(
    'iletisim', 'ar',
    'بيانات التواصل وصالة العرض',
    $t$<article dir="rtl">
<h2>بيانات التواصل وصالة عرض Merter Vitrini B2B</h2>
<p>تواصل مع فريق الدعم التجاري لدينا على مدار الأسبوع للاستفسار عن طلبات الجملة من سوق مرتر، وتنسيق زيارات صالة العرض، وتقديم طلبات الموردين أو الربط البرمجي عبر XML.</p>
<ul>
<li><strong>خط الدعم والواتساب 24/7:</strong> +90 533 703 08 83</li>
<li><strong>البريد الإلكتروني الرسمي:</strong> info@mertervitrini.com.tr</li>
<li><strong>عنوان صالة العرض والمركز:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / إسطنبول، تركيا</li>
<li><strong>شبكة الشحن والتصدير:</strong> توصيل مجاني لشركات الشحن المعتمدة في مرتر ولالالي وعثمان بيه، وشحن دولي إلى الخليج العربي والشرق الأوسط وأوروبا وأفريقيا.</li>
</ul>
</article>$t$,
    'بيانات التواصل | Merter Vitrini B2B للجملة',
    'عنوان صالة عرض Merter Vitrini في إسطنبول مرتر، ورقم الواتساب على مدار الساعة، والبريد الإلكتروني الرسمي لطلبات الجملة.'
);

SELECT pg_temp.upsert_page_tx(
    'iletisim', 'de',
    'Kontakt & Showroom',
    $t$<article>
<h2>Merter Vitrini Kontakt &amp; B2B-Showroom</h2>
<p>Unser B2B-Team steht Ihnen rund um die Uhr für Großhandelsanfragen aus Istanbul-Merter, Showroom-Termine, Lieferantenbewerbungen und XML-Kataloganbindungen zur Verfügung.</p>
<ul>
<li><strong>24/7 WhatsApp &amp; Telefon-Hotline:</strong> +90 533 703 08 83</li>
<li><strong>Unternehmens-E-Mail:</strong> info@mertervitrini.com.tr</li>
<li><strong>Showroom-Adresse:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Istanbul, Türkei</li>
<li><strong>Logistik &amp; Cargo-Anbindung:</strong> Kostenlose Übergabe an Ihre Cargo-Agentur in Merter, Laleli oder Osmanbey sowie internationaler Exportversand nach Europa und weltweit.</li>
</ul>
</article>$t$,
    'Kontakt & Showroom | Merter Vitrini B2B Großhandel',
    'Adresse des B2B-Showrooms Merter Vitrini in Istanbul-Merter, 24/7 WhatsApp-Support und geschäftliche E-Mail-Kontaktdaten.'
);

SELECT pg_temp.upsert_page_tx(
    'iletisim', 'fr',
    'Contact & Showroom',
    $t$<article>
<h2>Contact &amp; Showroom B2B Merter Vitrini</h2>
<p>Contactez notre service B2B 7 jours sur 7 pour vos commandes de prêt-à-porter en gros depuis Istanbul-Merter, vos visites au showroom, vos candidatures fournisseurs ou l'intégration XML.</p>
<ul>
<li><strong>Ligne WhatsApp &amp; Téléphone 24/7 :</strong> +90 533 703 08 83</li>
<li><strong>E-mail officiel :</strong> info@mertervitrini.com.tr</li>
<li><strong>Adresse du showroom :</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Istanbul, Turquie</li>
<li><strong>Réseau logistique &amp; Cargo :</strong> Dépôt gratuit auprès de votre agence cargo à Merter, Laleli ou Osmanbey et expéditions internationales vers l'Europe, l'Afrique et le monde entier.</li>
</ul>
</article>$t$,
    'Contact & Showroom | Merter Vitrini B2B Gros',
    'Adresse du showroom textile Merter Vitrini à Istanbul, assistance WhatsApp 24/7 et coordonnées professionnelles B2B.'
);

SELECT pg_temp.upsert_page_tx(
    'iletisim', 'pl',
    'Kontakt i Showroom',
    $t$<article>
<h2>Kontakt i Showroom B2B Merter Vitrini</h2>
<p>Skontaktuj się z naszym działem B2B przez 7 dni w tygodniu w sprawie zamówień hurtowych z centrum tekstylnego Merter w Stambule, wizyt w showroomie, rejestracji dostawców oraz integracji XML.</p>
<ul>
<li><strong>Infolinia i WhatsApp 24/7:</strong> +90 533 703 08 83</li>
<li><strong>Oficjalny e-mail:</strong> info@mertervitrini.com.tr</li>
<li><strong>Adres showroomu:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Stambuł, Turcja</li>
<li><strong>Logistyka i Cargo:</strong> Bezpłatna dostawa paczek do agencji cargo w dzielnicach Merter, Laleli i Osmanbey oraz eksport międzynarodowy do Polski i całej Europy.</li>
</ul>
</article>$t$,
    'Kontakt i Showroom | Merter Vitrini Hurt B2B',
    'Dane kontaktowe showroomu hurtowego Merter Vitrini w Stambule, całodobowe wsparcie WhatsApp oraz e-mail dla klientów B2B.'
);

SELECT pg_temp.upsert_page_tx(
    'iletisim', 'bg',
    'Контакти и шоурум',
    $t$<article>
<h2>Контакти и B2B шоурум Merter Vitrini</h2>
<p>Свържете се с нашия B2B екип 7 дни в седмицата относно поръчки на едро от Истанбул (Мертер), посещения на шоурума, кандидатстване за доставчици и XML интеграция.</p>
<ul>
<li><strong>Денонощна WhatsApp и телефонна линия:</strong> +90 533 703 08 83</li>
<li><strong>Официален имейл:</strong> info@mertervitrini.com.tr</li>
<li><strong>Адрес на шоурума:</strong> Merter Textile Center, Mehmet Nesih Özmen Mah., Güngören / Истанбул, Турция</li>
<li><strong>Карго и международна логистика:</strong> Безплатно предаване до вашата карго агенция в Мертер, Лалели или Османбей и международен износ към България и Европа.</li>
</ul>
</article>$t$,
    'Контакти и шоурум | Merter Vitrini B2B на едро',
    'Адрес на текстилния шоурум Merter Vitrini в Мертер, Истанбул, денонощна WhatsApp поддръжка и фирмен имейл за поръчки на едро.'
);

-- 1.3 b2b
SELECT pg_temp.upsert_page_tx(
    'b2b', 'tr',
    'Toptan Satış & B2B Şartları',
    $t$<article>
<h2>Merter Vitrini B2B Toptan Alım Rehberi</h2>
<p><strong>Merter Vitrini</strong>, Türkiye'nin en büyük toptan hazır giyim merkezi olan Merter'in üretici gücünü küresel B2B alıcılarla doğrudan buluşturan dijital toptan ticaret vitrinidir.</p>
<h2>1. Minimum Sipariş Miktarı (MOQ) ve Seri Düzeni</h2>
<ul>
<li>Tüm ürünler üretici standartlarına uygun olarak <strong>asorti seri paketleri</strong> hâlinde sunulur.</li>
<li>Bir asorti seri genellikle beden dağılımına göre 3'lü, 4'lü veya 6'lı (örneğin S-M-L veya 2-2-2) adetlerden oluşur.</li>
<li>Minimum sipariş miktarı veya koli adedi, tedarikçi ve ürün bazında esnek tutulmaktadır.</li>
</ul>
<h2>2. Ödeme Yöntemleri</h2>
<ul>
<li>Doğrudan ilgili tedarikçiyle kararlaştırılan Banka Havalesi / EFT (USD, EUR, TRY)</li>
<li>Uluslararası SWIFT Transferi</li>
<li>Tedarikçi veya anlaşmalı ödeme altyapısı üzerinden güvenli ödeme seçenekleri</li>
</ul>
<h2>3. Kargo ve Uluslararası Lojistik</h2>
<ul>
<li>Siparişler anlaşmalı uluslararası hava, kara veya deniz yolu kargo/lojistik firmaları aracılığıyla sevk edilir.</li>
<li>İstanbul Merter, Laleli ve Osmanbey'deki çalıştığınız kargo acentesine ücretsiz teslimat sağlanır.</li>
</ul>
<h2>4. Özel Üretim ve Private Label</h2>
<p>Butiğiniz veya markanız için belirli adetlerde özel etiketleme, barkodlama ve fason (Private Label) üretim imkânları tedarikçilerimiz aracılığıyla sunulmaktadır.</p>
</article>$t$,
    'Toptan Satış & B2B | Merter Vitrini Hazır Giyim',
    'Merter toptan kadın ve erkek giyim alım şartları, asorti seri paketleri, uluslararası kargo ve toptan B2B sipariş koşulları.'
);

SELECT pg_temp.upsert_page_tx(
    'b2b', 'en',
    'Wholesale & B2B Terms',
    $t$<article>
<h2>Merter Vitrini B2B Wholesale Purchasing Guide</h2>
<p><strong>Merter Vitrini</strong> connects the manufacturing power of Istanbul-Merter—Turkey's premier wholesale apparel hub—directly with boutiques, retail chains, and commercial B2B buyers worldwide.</p>
<h2>1. Minimum Order Quantity (MOQ) &amp; Series Packs</h2>
<ul>
<li>Products are sold in original manufacturer <strong>assorted series packs (lots)</strong>.</li>
<li>A typical series pack contains 3, 4, or 6 pieces across standard size ratios (e.g., S-M-L or 2-2-2).</li>
<li>Minimum order quantities remain flexible per model and supplier.</li>
</ul>
<h2>2. Accepted B2B Payment Methods</h2>
<ul>
<li>Direct Bank Transfer / Wire (USD, EUR, TRY) coordinated with the direct supplier</li>
<li>International SWIFT Transfer</li>
<li>Trade-approved corporate invoice and secure B2B payment channels</li>
</ul>
<h2>3. Cargo &amp; International Logistics</h2>
<ul>
<li>Shipments are coordinated via partnered international air, road, and sea freight forwarders.</li>
<li>Complimentary local drop-off is provided to your appointed cargo agency in Merter, Laleli, or Osmanbey (Istanbul).</li>
</ul>
<h2>4. Private Label &amp; Custom Production</h2>
<p>Qualified orders can benefit from custom brand labeling, hangtag barcoding, and Private Label manufacturing directly through verified Merter suppliers.</p>
</article>$t$,
    'Wholesale & B2B Terms | Merter Vitrini',
    'Istanbul Merter wholesale clothing MOQ rules, size series assortment packs, international cargo shipping, and B2B trade terms.'
);

SELECT pg_temp.upsert_page_tx(
    'b2b', 'ru',
    'Условия оптовых закупок и B2B',
    $t$<article>
<h2>Руководство по оптовым B2B-закупкам Merter Vitrini</h2>
<p><strong>Merter Vitrini</strong> объединяет производственные мощности крупнейшего оптового текстильного центра Турции — стамбульского района Мертер — с профессиональными закупщиками по всему миру.</p>
<h2>1. Минимальный заказ (MOQ) и размерные ряды</h2>
<ul>
<li>Все модели поставляются в фабричных <strong>серийных упаковках (размерных рядах)</strong>.</li>
<li>Стандартная серия обычно состоит из 3, 4 или 6 единиц одного цвета в разных размерах (например, S-M-L или 2-2-2).</li>
<li>Минимальный объем заказа гибко настраивается в зависимости от модели и производителя.</li>
</ul>
<h2>2. Способы оплаты</h2>
<ul>
<li>Банковский перевод (USD, EUR, TRY) напрямую согласованному поставщику</li>
<li>Международный перевод SWIFT</li>
<li>Защищенные B2B-расчеты по коммерческим инвойсам</li>
</ul>
<h2>3. Карго и международная логистика</h2>
<ul>
<li>Отправка осуществляется проверенными авиа-, авто- и морскими карго-компаниями.</li>
<li>Бесплатная доставка до вашего карго-агентства в районах Мертер, Лалели или Османбей в Стамбуле.</li>
</ul>
<h2>4. Индивидуальный пошив и Private Label</h2>
<p>Для сетей и бутиков доступна услуга нанесения собственной бирки, маркировки штрих-кодами и контрактного производства (Private Label).</p>
</article>$t$,
    'Оптовые закупки и B2B | Merter Vitrini',
    'Условия оптовых заказов одежды из Мертера, размерные серии, международная доставка карго и B2B-сотрудничество.'
);

SELECT pg_temp.upsert_page_tx(
    'b2b', 'ar',
    'شروط البيع بالجملة وB2B',
    $t$<article dir="rtl">
<h2>دليل الشراء بالجملة B2B عبر Merter Vitrini</h2>
<p>تجمع منصة <strong>Merter Vitrini</strong> القوة الإنتاجية لمصانع الملابس في حي مرتر بإسطنبول مباشرة مع المشترين التجاريين وأصحاب البوتيكات حول العالم.</p>
<h2>1. الحد الأدنى للطلب (MOQ) ونظام السيريات</h2>
<ul>
<li>تُباع جميع الموديلات ضمن <strong>سيريات (باقات مقاسات)</strong> متكاملة وفق معايير المصانع المنتجة.</li>
<li>يتكون السيري عادةً من 3 أو 4 أو 6 قطع بتوزيع مقاسات قياسي (مثل S-M-L أو 2-2-2).</li>
<li>تتمتع شروط الحد الأدنى للطلب بمرونة تتناسب مع كل موديل ومورد.</li>
</ul>
<h2>2. طرق الدفع المتاحة</h2>
<ul>
<li>تحويل بنكي مباشر (بالدولار USD أو اليورو EUR أو الليرة التركية TRY)</li>
<li>تحويل دولي عبر نظام SWIFT</li>
<li>خيارات سداد تجارية معتمدة وفواتير رسمية مباشرة مع المورد</li>
</ul>
<h2>3. الشحن والخدمات اللوجستية الدولية</h2>
<ul>
<li>يتم شحن الطلبيات عبر شركات الشحن الدولي المعتمدة جوياً أو برياً أو بحرياً.</li>
<li>توصيل مجاني إلى شركة الشحن الخاصة بكم داخل مناطق مرتر ولالالي وعثمان بيه في إسطنبول.</li>
</ul>
<h2>4. التصنيع الخاص والعلامة التجارية (Private Label)</h2>
<p>تتوفر إمكانية التصنيع تحت علامتكم التجارية الخاصة مع وضع الملصقات والباركود وفق الكميات المتفق عليها مع الموردين.</p>
</article>$t$,
    'شروط البيع بالجملة وB2B | Merter Vitrini',
    'شروط شراء الملابس بالجملة من مرتر، نظام السيريات، الشحن الدولي وطرق الدفع لعملاء B2B.'
);

SELECT pg_temp.upsert_page_tx(
    'b2b', 'de',
    'Großhandel & B2B-Konditionen',
    $t$<article>
<h2>Merter Vitrini B2B-Einkaufsleitfaden für den Großhandel</h2>
<p><strong>Merter Vitrini</strong> verbindet die Produktionskraft von Istanbul-Merter, dem größten Textilgroßhandelszentrum der Türkei, direkt mit Boutiquen und B2B-Fachhändlern weltweit.</p>
<h2>1. Mindestbestellmenge (MOQ) &amp; Größensortimente (Serien)</h2>
<ul>
<li>Alle Modelle werden herstellerkonform in sortierten <strong>Serienpaketen (Lots)</strong> angeboten.</li>
<li>Eine Standardserie umfasst üblicherweise 3, 4 oder 6 Teile pro Modell (z. B. S-M-L oder 2-2-2).</li>
<li>Mindestabnahmemengen bleiben modell- und lieferantenbezogen flexibel.</li>
</ul>
<h2>2. Zahlungsmethoden</h2>
<ul>
<li>Direkte Banküberweisung (EUR, USD, TRY) gemäß Vereinbarung mit dem direkten Lieferanten</li>
<li>Internationale SWIFT-Überweisung</li>
<li>Sichere B2B-Abwicklung und ordnungsgemäße Export-Rechnungsstellung</li>
</ul>
<h2>3. Logistik &amp; Internationaler Versand</h2>
<ul>
<li>Weltweite Lieferung über erfahrene Luft-, Land- oder Seefrachtpartner.</li>
<li>Kostenlose Übergabe an Ihre bevorzugte Cargo-Agentur in Merter, Laleli oder Osmanbey (Istanbul).</li>
</ul>
<h2>4. Private Label &amp; Sonderanfertigung</h2>
<p>Für etablierte Marken und Modehäuser bieten ausgewählte Produzenten eigene Etikettierung, Barcode-Auszeichnung und Auftragsfertigung (Private Label) an.</p>
</article>$t$,
    'Großhandel & B2B-Konditionen | Merter Vitrini',
    'Einkaufsbedingungen für türkische Großhandelsmode in Merter: Serienpakete, MOQ, internationaler Cargo-Versand und B2B-Abwicklung.'
);

SELECT pg_temp.upsert_page_tx(
    'b2b', 'fr',
    'Conditions de Vente en Gros & B2B',
    $t$<article>
<h2>Guide d'achat en gros B2B Merter Vitrini</h2>
<p><strong>Merter Vitrini</strong> met directement la capacité de production textile d'Istanbul-Merter au service des acheteurs professionnels, boutiques et distributeurs B2B dans le monde entier.</p>
<h2>1. Quantité minimale de commande (MOQ) et séries de tailles</h2>
<ul>
<li>Tous les articles sont commercialisés en <strong>séries assorties d'origine fabricant</strong>.</li>
<li>Une série standard comprend généralement 3, 4 ou 6 pièces (par exemple S-M-L ou 2-2-2).</li>
<li>Les seuils minimums restent souples selon chaque modèle et fournisseur.</li>
</ul>
<h2>2. Modes de paiement</h2>
<ul>
<li>Virement bancaire direct (EUR, USD, TRY) convenu avec le fournisseur vendeur</li>
<li>Transfert international SWIFT</li>
<li>Règlements sécurisés et facturation commerciale export B2B</li>
</ul>
<h2>3. Transport cargo et logistique internationale</h2>
<ul>
<li>Expédition par voie aérienne, routière ou maritime via nos partenaires logistiques internationaux.</li>
<li>Remise gratuite des colis auprès de votre transporteur à Merter, Laleli ou Osmanbey (Istanbul).</li>
</ul>
<h2>4. Private Label &amp; Fabrication sur mesure</h2>
<p>Possibilité d'étiquetage personnalisé, de pose de codes-barres et de fabrication à façon (Private Label) selon les quantités convenues.</p>
</article>$t$,
    'Vente en Gros & B2B | Merter Vitrini Prêt-à-Porter',
    'Conditions d''achat en gros à Merter : assortiments de tailles par série, MOQ, expédition cargo internationale et paiement B2B.'
);

SELECT pg_temp.upsert_page_tx(
    'b2b', 'pl',
    'Warunki Hurtu i Współpracy B2B',
    $t$<article>
<h2>Przewodnik po zakupach hurtowych B2B w Merter Vitrini</h2>
<p><strong>Merter Vitrini</strong> łączy potencjał produkcyjny dzielnicy tekstylnej Merter w Stambule bezpośrednio z butikami i kupcami hurtowymi B2B na całym świecie.</p>
<h2>1. Minimalne zamówienie (MOQ) i pakiety seryjne</h2>
<ul>
<li>Wszystkie produkty sprzedawane są w oryginalnych <strong>pakietach seryjnych</strong> (kompletach rozmiarów).</li>
<li>Standardowa seria obejmuje zazwyczaj 3, 4 lub 6 sztuk w różnych rozmiarach (np. S-M-L lub 2-2-2).</li>
<li>Minimalna wartość lub liczba serii jest elastyczna w zależności od producenta i modelu.</li>
</ul>
<h2>2. Metody płatności B2B</h2>
<ul>
<li>Przelew bankowy (EUR, USD, TRY) uzgadniany bezpośrednio ze sprzedającym dostawcą</li>
<li>Międzynarodowy przelew SWIFT</li>
<li>Bezpieczne rozliczenia B2B oraz faktury eksportowe</li>
</ul>
<h2>3. Cargo i logistyka międzynarodowa</h2>
<ul>
<li>Wysyłki realizowane są przez sprawdzone firmy transportowe drogą lotniczą, lądową lub morską.</li>
<li>Bezpłatne dostarczenie towaru do wyznaczonej przez Ciebie agencji cargo w Merter, Laleli lub Osmanbey w Stambule.</li>
</ul>
<h2>4. Private Label i produkcja na zlecenie</h2>
<p>Wybrani producenci oferują wszywanie własnych metek, etykietowanie kodami kreskowymi oraz szycie pod marką własną klienta (Private Label).</p>
</article>$t$,
    'Sprzedaż hurtowa i B2B | Merter Vitrini',
    'Zasady zakupów hurtowych odzieży z Merter w Stambule: pakiety seryjne, MOQ, międzynarodowe cargo i warunki B2B.'
);

SELECT pg_temp.upsert_page_tx(
    'b2b', 'bg',
    'Условия за търговия на едро и B2B',
    $t$<article>
<h2>Ръководство за B2B покупки на едро в Merter Vitrini</h2>
<p><strong>Merter Vitrini</strong> свързва производствената мощ на най-големия текстилен център в Турция — Мертер, Истанбул — директно с бутици и B2B търговци по целия свят.</p>
<h2>1. Минимално количество (MOQ) и серийни пакети</h2>
<ul>
<li>Всички артикули се предлагат в оригинални <strong>серийни пакети</strong> според стандартите на производителя.</li>
<li>Една стандартна серия обикновено включва 3, 4 или 6 броя по размери (напр. S-M-L или 2-2-2).</li>
<li>Минималните количества за поръчка са гъвкави според модела и доставчика.</li>
</ul>
<h2>2. Начини на плащане</h2>
<ul>
<li>Банков превод (EUR, USD, TRY) директно към съответния доставчик</li>
<li>Международен SWIFT превод</li>
<li>Сигурни B2B разплащания и търговски фактури за износ</li>
</ul>
<h2>3. Карго и международна логистика</h2>
<ul>
<li>Доставките се извършват чрез утвърдени международни карго партньори по въздух, суша или море.</li>
<li>Безплатна доставка до избраната от вас карго агенция в Мертер, Лалели или Османбей (Истанбул).</li>
</ul>
<h2>4. Собствена марка (Private Label)</h2>
<p>Предлага се възможност за поставяне на собствени етикети, баркодиране и производство по поръчка при договорени количества.</p>
</article>$t$,
    'Търговия на едро и B2B | Merter Vitrini',
    'Условия за покупка на облекло на едро от Мертер, серийни размери, международен карго транспорт и B2B поръчки.'
);

-- 1.4 faq
SELECT pg_temp.upsert_page_tx(
    'faq', 'tr',
    'Sıkça Sorulan Sorular (SSS)',
    $t$<article>
<h2>Merter Vitrini Toptan Alım Sıkça Sorulan Sorular</h2>
<h3>1. Minimum Sipariş Miktarı (MOQ) Nedir?</h3>
<p>Merter Vitrini'nde ürünler toptan imalat standartlarında asorti seri paketleri hâlinde sunulmaktadır. Bir modelden genellikle minimum 1 seri (3 veya 4 adet) sipariş verebilirsiniz.</p>
<h3>2. Kargo ve Teslimat Süreci Nasıl İşler?</h3>
<p>İstanbul içi Merter, Laleli ve Osmanbey'deki anlaşmalı kargo acentenize ücretsiz teslimat yapılır. Yurt dışı gönderimlerde çalıştığınız hava, kara veya deniz kargo firması aracılığıyla kapınıza kadar sevkiyat koordine edilir.</p>
<h3>3. Ödeme Seçenekleri Nelerdir?</h3>
<p>Ödemeler; doğrudan satıcı olan ilgili tedarikçiyle kararlaştırılan Banka Havalesi/EFT (USD, EUR, TRY), Uluslararası SWIFT Transferi veya güvenli ticari ödeme kanalları üzerinden gerçekleştirilir.</p>
<h3>4. Defolu veya Eksik Ürün Durumunda Ne Yapmalıyım?</h3>
<p>Tüm sevkiyatlar öncesi kalite kontrol yapılır. Olası bir üretim hatası, ayıp veya eksik koli durumunda teslimattan itibaren 6102 sayılı TTK m. 23 süreleri (açık ayıpta 2 iş günü, diğerlerinde 8 gün) içinde görsel kanıtlarla birlikte doğrudan faturayı kesen satıcı tedarikçiye bildirimde bulunarak değişim veya bedel iadesi talep edebilirsiniz.</p>
<h3>5. Merter Vitrini Satıcı mıdır, Yer Sağlayıcı mıdır?</h3>
<p>Merter Vitrini 5651 sayılı Kanun kapsamında B2B Yer Sağlayıcı vitrin platformudur. Her ürün sayfasında unvanı açıkça belirtilen tedarikçi firma, ürünün doğrudan satıcısı ve içerik sağlayıcısıdır.</p>
</article>$t$,
    'Sıkça Sorulan Sorular (SSS) | Merter Vitrini Toptan B2B',
    'Merter toptan hazır giyim siparişleri, asorti seri düzeni, kargo, ödeme, ayıp ihbarı ve B2B alım hakkında sıkça sorulan sorular.'
);

SELECT pg_temp.upsert_page_tx(
    'faq', 'en',
    'Frequently Asked Questions (FAQ)',
    $t$<article>
<h2>Merter Vitrini B2B Wholesale FAQ</h2>
<h3>1. What Is the Minimum Order Quantity (MOQ)?</h3>
<p>Products on Merter Vitrini are sold in factory-standard assorted size packs (series). You can typically start with just 1 series (usually 3 or 4 pieces of a model across standard sizes).</p>
<h3>2. How Does Cargo &amp; International Shipping Work?</h3>
<p>We provide free local delivery to your preferred cargo agency in Merter, Laleli, or Osmanbey (Istanbul). International orders are dispatched via air, road, or sea cargo forwarders directly to your destination.</p>
<h3>3. What Payment Methods Are Available?</h3>
<p>Payments are settled directly with the supplying vendor via Bank Transfer / Wire (USD, EUR, TRY), international SWIFT transfer, or trade-approved B2B settlement channels.</p>
<h3>4. What Should I Do If an Item Is Defective or Missing?</h3>
<p>In accordance with commercial trade rules (Turkish Commercial Code Art. 23), please report visible defects within 2 business days (and other defects within 8 days) directly to the selling Supplier with photos and cargo documentation for exchange or refund resolution.</p>
<h3>5. Is Merter Vitrini a Direct Seller or Hosting Platform?</h3>
<p>Merter Vitrini operates as a B2B marketplace hosting platform under Law No. 5651. The verified wholesale company listed on each product page is the sole direct seller and content provider.</p>
</article>$t$,
    'Frequently Asked Questions (FAQ) | Merter Vitrini Wholesale B2B',
    'Answers about Istanbul Merter wholesale clothing MOQ, size series packs, international shipping, payment methods, and supplier warranty.'
);

SELECT pg_temp.upsert_page_tx(
    'faq', 'ru',
    'Часто задаваемые вопросы (FAQ)',
    $t$<article>
<h2>Частые вопросы по оптовым закупкам в Merter Vitrini</h2>
<h3>1. Каков минимальный объем заказа (MOQ)?</h3>
<p>Товары в Merter Vitrini продаются фабричными размерными рядами (сериями). Обычно минимальный заказ начинается всего от 1 серии (3 или 4 единицы одной модели).</p>
<h3>2. Как организована доставка и карго?</h3>
<p>Мы бесплатно передаем заказы в вашу карго-компанию в Мертере, Лалели или Османбее (Стамбул). Международная доставка выполняется авиа-, авто- или морскими карго-перевозчиками до вашего города.</p>
<h3>3. Какие способы оплаты принимаются?</h3>
<p>Расчеты производятся напрямую с поставщиком банковским переводом (USD, EUR, TRY), через международную систему SWIFT или согласованные коммерческие каналы оплаты.</p>
<h3>4. Что делать при обнаружении брака или недостачи?</h3>
<p>При обнаружении производственного дефекта или расхождений необходимо в соответствии со ст. 23 Торгового кодекса Турции (в течение 2 рабочих дней для явных дефектов и 8 дней для прочих) направить фотоподтверждение и акт карго напрямую продавцу-поставщику для замены или возврата.</p>
<h3>5. Является ли Merter Vitrini прямым продавцом?</h3>
<p>Merter Vitrini функционирует как B2B-площадка (хостинг-провайдер по Закону № 5651). Прямым продавцом и поставщиком контента выступает конкретная фабрика или оптовая компания, указанная на странице товара.</p>
</article>$t$,
    'Часто задаваемые вопросы (FAQ) | Merter Vitrini Оптовый B2B',
    'Ответы о минимальных оптовых заказах из Мертера, размерных сериях, доставке карго, оплате и порядке предъявления претензий.'
);

SELECT pg_temp.upsert_page_tx(
    'faq', 'ar',
    'الأسئلة الشائعة (FAQ)',
    $t$<article dir="rtl">
<h2>الأسئلة الشائعة حول الشراء بالجملة في Merter Vitrini</h2>
<h3>1. ما هو الحد الأدنى لكمية الطلب (MOQ)؟</h3>
<p>تُعرض المنتجات في Merter Vitrini وفق معايير المصانع على شكل طرود مقاسات متسلسلة (سيري). ويمكنكم عادةً الطلب بدءاً من سيري واحد فقط (3 أو 4 قطع من نفس الموديل).</p>
<h3>2. كيف تتم إجراءات الشحن والتسليم الدولي؟</h3>
<p>يتم التوصيل مجاناً إلى مكتب شركة الشحن الخاص بكم في مرتر أو لالالي أو عثمان بيه في إسطنبول، مع تنسيق الشحن الجوي أو البري أو البحري إلى بلدكم.</p>
<h3>3. ما هي وسائل الدفع المتاحة؟</h3>
<p>تتم تسوية المدفوعات مباشرة مع المورد البائع عبر التحويل البنكي (بالدولار أو اليورو أو الليرة التركية) أو تحويل SWIFT الدولي أو قنوات الدفع التجارية المعتمدة.</p>
<h3>4. ماذا أفعل في حال وجود عيب أو نقص في الشحنة؟</h3>
<p>وفقاً للمادة 23 من القانون التجاري التركي، يجب إبلاغ المورد البائع مباشرة بالعيوب الظاهرة خلال يومي عمل (أو خلال 8 أيام للعيوب الأخرى) مع إرفاق الصور ومحضر الشحن لطلب الاستبدال أو التسوية.</p>
<h3>5. هل Merter Vitrini بائع مباشر أم منصة استضافة تجارية؟</h3>
<p>تعمل Merter Vitrini كمنصة عرض رقمية (مزود استضافة بموجب القانون رقم 5651)، وتُعد كل شركة مورّدة مذكورة في صفحة المنتج هي البائع المباشر ومزود المحتوى المسؤول عن الصفقة.</p>
</article>$t$,
    'الأسئلة الشائعة | Merter Vitrini لتجارة الجملة B2B',
    'إجابات حول الحد الأدنى لطلب الجملة من مرتر، ونظام السيريات، والشحن الدولي، وطرق الدفع، وحقوق الإرجاع التجاري.'
);

SELECT pg_temp.upsert_page_tx(
    'faq', 'de',
    'Häufig gestellte Fragen (FAQ)',
    $t$<article>
<h2>Merter Vitrini Großhandels-FAQ (B2B)</h2>
<h3>1. Wie hoch ist die Mindestbestellmenge (MOQ)?</h3>
<p>Alle Modelle werden gemäß Werkstandard in sortierten Serienpaketen verkauft. In der Regel können Sie bereits ab 1 Serie (meist 3 oder 4 Teile je Modell in abgestuften Größen) bestellen.</p>
<h3>2. Wie funktioniert der Versand über Cargo-Agenturen?</h3>
<p>Wir liefern Bestellungen kostenlos an Ihre gewünschte Cargo-Agentur in Merter, Laleli oder Osmanbey (Istanbul). Für den Export stehen Luft-, LKW- und Seefracht bis an Ihr Ziel zur Verfügung.</p>
<h3>3. Welche Zahlungsmethoden werden akzeptiert?</h3>
<p>Die Bezahlung erfolgt direkt mit dem jeweiligen Lieferanten per Banküberweisung (EUR, USD, TRY), internationaler SWIFT-Überweisung oder vereinbarten B2B-Zahlungswegen.</p>
<h3>4. Was tun bei Mängeln oder Fehlmengen?</h3>
<p>Bitte melden Sie offensichtliche Mängel gemäß Art. 23 des türkischen Handelsgesetzbuches (TTK) innerhalb von 2 Werktagen (sonstige Mängel innerhalb von 8 Tagen) mit Fotos und Transportprotokoll direkt dem verkaufenden Lieferanten.</p>
<h3>5. Ist Merter Vitrini selbst Verkäufer oder Plattformbetreiber?</h3>
<p>Merter Vitrini ist ein B2B-Hosting-Anbieter im Sinne des Gesetzes Nr. 5651. Alleiniger Direktverkäufer und Inhaltsanbieter ist stets das auf der Produktseite angegebene Lieferantenunternehmen.</p>
</article>$t$,
    'Häufig gestellte Fragen (FAQ) | Merter Vitrini Großhandel',
    'Fragen und Antworten zu Mindestbestellmengen, Serienpaketen, Cargo-Versand ab Istanbul-Merter, Zahlungsarten und Mängelrügen im B2B-Handel.'
);

SELECT pg_temp.upsert_page_tx(
    'faq', 'fr',
    'Foire aux Questions (FAQ)',
    $t$<article>
<h2>Questions fréquentes sur les achats en gros B2B Merter Vitrini</h2>
<h3>1. Quelle est la quantité minimale de commande (MOQ) ?</h3>
<p>Les articles sont vendus en séries complètes de tailles selon les standards des fabricants. Le minimum démarre généralement à 1 série (3 ou 4 pièces par modèle).</p>
<h3>2. Comment fonctionne la livraison et le cargo international ?</h3>
<p>La remise auprès de votre agence cargo à Merter, Laleli ou Osmanbey (Istanbul) est gratuite. Les expéditions internationales s'effectuent par fret aérien, routier ou maritime.</p>
<h3>3. Quels sont les moyens de paiement ?</h3>
<p>Les paiements sont réglés directement avec le fournisseur vendeur par virement bancaire (EUR, USD, TRY), transfert SWIFT international ou modalités B2B convenues.</p>
<h3>4. Que faire en cas de défaut ou de colis manquant ?</h3>
<p>Conformément à l'article 23 du Code de commerce turc (TTK), signalez tout défaut apparent sous 2 jours ouvrables (ou 8 jours pour les autres défauts) avec preuves photo directement au fournisseur émetteur de la facture.</p>
<h3>5. Merter Vitrini est-il vendeur direct ou hébergeur B2B ?</h3>
<p>Merter Vitrini opère en tant qu'hébergeur B2B (Loi n° 5651). Le fournisseur clairement identifié sur chaque fiche produit est l'unique vendeur direct et fournisseur de contenu.</p>
</article>$t$,
    'Foire aux Questions (FAQ) | Merter Vitrini B2B Gros',
    'Réponses aux questions fréquentes sur les achats en gros à Istanbul-Merter : séries de tailles, MOQ, transport cargo et garanties B2B.'
);

SELECT pg_temp.upsert_page_tx(
    'faq', 'pl',
    'Najczęściej Zadawane Pytania (FAQ)',
    $t$<article>
<h2>Najczęściej zadawane pytania – Hurtownia B2B Merter Vitrini</h2>
<h3>1. Jaka jest minimalna wielkość zamówienia (MOQ)?</h3>
<p>Odzież sprzedawana jest w fabrycznych kompletach rozmiarowych (seriach). Zazwyczaj minimalne zamówienie wynosi zaledwie 1 serię (najczęściej 3 lub 4 sztuki w różnych rozmiarach).</p>
<h3>2. Jak przebiega wysyłka i obsługa cargo?</h3>
<p>Zapewniamy bezpłatne dostarczenie paczek do wybranej agencji cargo w Merter, Laleli lub Osmanbey w Stambule. Transport międzynarodowy realizowany jest drogą lotniczą, lądową lub morską.</p>
<h3>3. Jakie formy płatności są akceptowane?</h3>
<p>Rozliczenia odbywają się bezpośrednio z dostawcą sprzedającym poprzez przelew bankowy (EUR, USD, TRY), międzynarodowy przelew SWIFT lub uzgodnione kanały płatności B2B.</p>
<h3>4. Co zrobić w przypadku wady produktu lub braków?</h3>
<p>Zgodnie z art. 23 Tureckiego Kodeksu Handlowego (TTK) wady jawne należy zgłosić bezpośrednio sprzedającemu dostawcy w ciągu 2 dni roboczych (pozostałe w ciągu 8 dni), dołączając zdjęcia i protokół przewoźnika.</p>
<h3>5. Czy Merter Vitrini jest bezpośrednim sprzedawcą?</h3>
<p>Merter Vitrini działa jako platforma hostingowa B2B w rozumieniu ustawy nr 5651. Bezpośrednim sprzedawcą oraz dostawcą treści jest zawsze firma wskazana na karcie danego produktu.</p>
</article>$t$,
    'FAQ – Najczęściej Zadawane Pytania | Merter Vitrini B2B',
    'Odpowiedzi na pytania o minimalne zamówienia hurtowe z Merter, serie rozmiarowe, agencje cargo, płatności oraz reklamacje B2B.'
);

SELECT pg_temp.upsert_page_tx(
    'faq', 'bg',
    'Често задавани въпроси (ЧЗВ)',
    $t$<article>
<h2>Често задавани въпроси за покупки на едро в Merter Vitrini</h2>
<h3>1. Какво е минималното количество за поръчка (MOQ)?</h3>
<p>Продуктите в Merter Vitrini се продават във фабрични серийни пакети (размерни редици). Обикновено можете да поръчате минимум 1 серия (3 или 4 броя от модел).</p>
<h3>2. Как протича доставката с карго?</h3>
<p>Извършваме безплатна доставка до вашата карго агенция в Мертер, Лалели или Османбей (Истанбул), а международният превоз се осъществява с въздушно, сухопътно или морско карго.</p>
<h3>3. Какви начини на плащане се приемат?</h3>
<p>Плащанията се уреждат директно с продаващия доставчик чрез банков превод (EUR, USD, TRY), международен SWIFT превод или договорени B2B методи.</p>
<h3>4. Какво да направя при дефектен или липсващ артикул?</h3>
<p>Съгласно чл. 23 от Турския търговски закон (TTK) явните несъответствия трябва да бъдат съобщени директно на доставчика в срок от 2 работни дни (останалите – до 8 дни) със снимки и карго протокол.</p>
<h3>5. Merter Vitrini директен продавач ли е или хостинг платформа?</h3>
<p>Merter Vitrini е B2B хостинг платформа по Закон № 5651. Единственият директен продавач и доставчик на съдържание е конкретната фирма, посочена в страницата на продукта.</p>
</article>$t$,
    'Често задавани въпроси | Merter Vitrini B2B на едро',
    'Отговори за минимални поръчки на едро от Мертер, серийни размери, карго доставки, плащане и рекламации в B2B търговията.'
);

-- ============================================================================
-- SECTION 2: LEGAL CMS PAGES — FULL MULTI-SECTION PARITY (ALL 8 LANGUAGES)
-- Part 1 covers: kullanici-sozlesmesi, tedarikci-sozlesmesi,
--                yer-saglayici-bildirimi, telif-hakki-ve-uyar-kaldir
-- ============================================================================

-- 2.1 kullanici-sozlesmesi (tr preserved from 0042, en..bg upgraded to full 4-section clause parity)
SELECT pg_temp.upsert_page_tx(
    'kullanici-sozlesmesi', 'tr',
    'Üyelik, Kullanım ve Yer Sağlayıcı Çerçeve Sözleşmesi',
    $t$<article>
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
</article>$t$,
    'Üyelik Sözleşmesi ve Yer Sağlayıcı Bildirimi | Merter Vitrini',
    'Merter Vitrini B2B üyelik sözleşmesi: Platform 5651 sayılı Kanun kapsamında yer sağlayıcıdır; doğrudan satıcı bağımsız tedarikçilerdir.'
);

SELECT pg_temp.upsert_page_tx(
    'kullanici-sozlesmesi', 'en',
    'Membership Agreement & Hosting Provider Legal Framework',
    $t$<article>
<h2>1. Legal Status of the Platform (Law No. 5651 Article 5)</h2>
<p><strong>mertervitrini.com.tr</strong> (the "Platform") operates strictly as a B2B wholesale apparel digital showcase and neutral <strong>"Hosting Provider" (Yer Sağlayıcı)</strong> under Article 5 of Turkish Law No. 5651. Merter Vitrini is neither the owner, manufacturer, importer, authorized dealer, direct seller, escrow/payment collector, nor carrier of any product listed on the Platform.</p>
<h2>2. Independent Suppliers Are the Sole Direct Sellers</h2>
<p>The sole <strong>"Direct Seller"</strong> and legal <strong>"Content Provider"</strong> under Law No. 5651 for every product displayed on the Platform is the independent wholesale Supplier whose trade name and contact details appear on the product listing and cart summary. Buyers coordinate pricing confirmation, wire/payment settlement, commercial invoicing, cargo logistics, and customs clearance directly with that Supplier.</p>
<h2>3. Dispute Resolution &amp; Disclaimer of Platform Liability</h2>
<ul>
<li>All commercial, financial, or quality claims—including defective goods, missing boxes, late delivery, color/size discrepancies, returns, refunds, or counterfeit claims—must be addressed <strong>solely and directly to the selling Supplier</strong>.</li>
<li>Merter Vitrini is not a party to any commercial sales contract formed between Buyer and Supplier and bears no direct or indirect liability for supplier performance, product defects, or fulfillment disputes.</li>
<li>In accordance with Turkish Law No. 6563 on Electronic Commerce and Law No. 5651, Merter Vitrini has no general obligation to pre-monitor Supplier content, while promptly processing substantiated Notice-and-Takedown requests.</li>
</ul>
<h2>4. Governing Law &amp; Jurisdiction</h2>
<p>By clicking acceptance during registration (logged with IP address and timestamp), the Member agrees to this Framework Agreement. Turkish Law governs, and the Courts and Enforcement Offices of Istanbul (Çağlayan) hold exclusive jurisdiction.</p>
</article>$t$,
    'Membership Agreement & Hosting Provider Notice | Merter Vitrini',
    'Merter Vitrini B2B membership framework: Hosting Provider status under Law No. 5651 and direct seller liability of independent suppliers.'
);

SELECT pg_temp.upsert_page_tx(
    'kullanici-sozlesmesi', 'ru',
    'Пользовательское соглашение и статус хостинг-провайдера (Закон № 5651)',
    $t$<article>
<h2>1. Правовой статус платформы (ст. 5 Закона № 5651)</h2>
<p>Платформа <strong>mertervitrini.com.tr</strong> («Платформа») действует исключительно в статусе <strong>«Хостинг-провайдера» (Yer Sağlayıcı)</strong> согласно статье 5 Закона Турецкой Республики № 5651. Merter Vitrini не является производителем, собственником, импортером, прямым продавцом, платежным агентом, гарантом эскроу или перевозчиком каких-либо товаров, представленных на Платформе.</p>
<h2>2. Независимые поставщики — единственные прямые продавцы</h2>
<p>Единственным <strong>«Прямым продавцом»</strong> и юридическим <strong>«Поставщиком контента»</strong> для каждого товара выступает независимая оптовая компания («Поставщик»), чье фирменное наименование и контакты указаны в карточке товара и корзине. Покупатели напрямую согласовывают с Поставщиком цену, оплату, выставление счета, отгрузку карго и таможенное оформление.</p>
<h2>3. Сторона по претензиям и отказ от ответственности платформы</h2>
<ul>
<li>Все коммерческие, финансовые и претензионные требования — включая брак, недостачу, задержку доставки, несоответствие размеров/цветов, возвраты, обмен, счета и претензии по оригинальности — предъявляются <strong>исключительно и напрямую соответствующему Поставщику</strong>.</li>
<li>Merter Vitrini не является стороной договора купли-продажи между Покупателем и Поставщиком и не несет ответственности за исполнение обязательств или качество товара.</li>
<li>Согласно Закону № 6563 и Закону № 5651 платформа не обязана предварительно проверять контент Поставщиков, но оперативно рассматривает обоснованные уведомления о нарушениях.</li>
</ul>
<h2>4. Применимое право и подсудность</h2>
<p>Электронное согласие Пользователя фиксируется с IP-адресом и временной меткой. К настоящему Соглашению применяется право Турецкой Республики; исключительная подсудность принадлежит судам Стамбула (Чаглаян).</p>
</article>$t$,
    'Пользовательское соглашение B2B | Merter Vitrini',
    'Рамочное соглашение пользователя B2B Merter Vitrini: статус хостинг-провайдера по Закону № 5651 и ответственность прямых поставщиков.'
);

SELECT pg_temp.upsert_page_tx(
    'kullanici-sozlesmesi', 'ar',
    'اتفاقية العضوية وإطار مزود الاستضافة القانوني (القانون رقم 5651)',
    $t$<article dir="rtl">
<h2>1. الوضع القانوني للمنصة (المادة 5 من القانون رقم 5651)</h2>
<p>تعمل منصة <strong>mertervitrini.com.tr</strong> («المنصة») حصراً بصفتها <strong>«مزود استضافة» (Yer Sağlayıcı)</strong> بموجب المادة 5 من القانون التركي رقم 5651. ولا تُعد Merter Vitrini منتجاً أو مالكاً أو مستورداً أو بائعاً مباشراً أو محصل أموال أو ضامناً أو شركة شحن لأي منتج معروض على المنصة.</p>
<h2>2. الموردون المستقلون هم البائعون المباشرون الوحيدون</h2>
<p>يُعد المورد المستقل المذكور اسمه وبياناته التجارية في صفحة المنتج وملخص السلة هو <strong>«البائع المباشر»</strong> الوحيد و<strong>«مزود المحتوى»</strong> القانوني. ويتم تنسيق الأسعار، والتحويلات البنكية، وإصدار الفواتير، والشحن، والتخليص الجمركي مباشرة بين المشتري والمورد المعني.</p>
<h2>3. جهة المخاطبة في النزاعات وإخلاء مسؤولية المنصة</h2>
<ul>
<li>تُوجه كافة المطالبات المتعلقة بالبضائع المعيبة أو النقص أو تأخير التسليم أو اختلاف المقاسات والألوان أو طلبات الإرجاع واسترداد المبالغ أو حقوق الملكية الفكرية <strong>حصراً وبشكل مباشر إلى المورد البائع</strong>.</li>
<li>لا تُعد Merter Vitrini طرفاً في عقود البيع المبرمة بين المشتري والمورد ولا تتحمل أي مسؤولية قانونية أو مالية ناشئة عن تلك الصفقات.</li>
<li>بموجب القانون التركي رقم 6563 والقانون رقم 5651، لا تلتزم المنصة بالرقابة المسبقة على محتوى الموردين، مع معالجتها الفورية لإشعارات الإزالة المستوفية للشروط القانونية.</li>
</ul>
<h2>4. القانون الواجب التطبيق والاختصاص القضائي</h2>
<p>تُعد موافقة العضو عند التسجيل ملزمة قانوناً ويتم توثيقها بعنوان IP والطابع الزمني. يخضع هذا العقد للقانون التركي وتختص محاكم إسطنبول (تشاغلايان) ودوائر التنفيذ فيها بالنظر في أي نزاع.</p>
</article>$t$,
    'اتفاقية العضوية ومزود الاستضافة | Merter Vitrini B2B',
    'اتفاقية العضوية التجارية لـ Merter Vitrini: صفة مزود الاستضافة وفق القانون 5651 ومسؤولية الموردين المباشرين.'
);

SELECT pg_temp.upsert_page_tx(
    'kullanici-sozlesmesi', 'de',
    'Nutzungsvereinbarung & Hosting-Provider-Rahmenvertrag (Gesetz Nr. 5651)',
    $t$<article>
<h2>1. Rechtsstatus der Plattform (Art. 5 Gesetz Nr. 5651)</h2>
<p><strong>mertervitrini.com.tr</strong> („Plattform“) handelt ausschließlich als neutraler B2B-Digitalshowroom und <strong>„Hosting-Provider“ (Yer Sağlayıcı)</strong> gemäß Artikel 5 des türkischen Gesetzes Nr. 5651. Merter Vitrini ist weder Eigentümer, Hersteller, Importeur, Direktverkäufer, Zahlungseinzugsstelle noch Frachtführer der angebotenen Waren.</p>
<h2>2. Unabhängige Lieferanten als alleinige Direktverkäufer</h2>
<p>Der jeweilige Großhändler („Lieferant“), dessen Firmenname auf der Produktseite und im Warenkorb offen ausgewiesen ist, ist alleiniger <strong>„Direktverkäufer“</strong> und <strong>„Inhaltsanbieter“ (İçerik Sağlayıcı)</strong>. Preisbestätigung, Zahlungsabwicklung, Rechnungsstellung, Transport und Zollabfertigung erfolgen unmittelbar zwischen Käufer und Lieferant.</p>
<h2>3. Ansprechpartner bei Streitigkeiten &amp; Haftungsausschluss</h2>
<ul>
<li>Sämtliche Ansprüche wegen Produktmängeln, Minder- oder Spätlieferung, Abweichungen bei Farbe/Größe, Rückgabe, Umtausch, Erstattung oder Markenrechten sind <strong>ausschließlich direkt an den verkaufenden Lieferanten</strong> zu richten.</li>
<li>Merter Vitrini wird nicht Vertragspartei der B2B-Kaufverträge zwischen Käufer und Lieferant und haftet nicht für Vertragspflichten oder Produktschäden Dritter.</li>
<li>Nach Gesetz Nr. 6563 und Nr. 5651 besteht keine Pflicht zur Vorabkontrolle von Lieferanteninhalten; begründete Takedown-Meldungen werden jedoch umgehend bearbeitet.</li>
</ul>
<h2>4. Anwendbares Recht &amp; Gerichtsstand</h2>
<p>Die elektronische Zustimmung wird samt IP-Adresse und Zeitstempel protokolliert. Es gilt türkisches Recht; ausschließlicher Gerichtsstand sind die Gerichte Istanbul (Çağlayan).</p>
</article>$t$,
    'Nutzungsvereinbarung & Hosting-Hinweis | Merter Vitrini',
    'B2B-Nutzungsvereinbarung für Merter Vitrini: Hosting-Provider-Status nach Gesetz Nr. 5651 und direkte Lieferantenverantwortung.'
);

SELECT pg_temp.upsert_page_tx(
    'kullanici-sozlesmesi', 'fr',
    'Contrat d''Utilisation, d''Adhésion et Statut d''Hébergeur (Loi n° 5651)',
    $t$<article>
<h2>1. Statut juridique de la Plateforme (Article 5 de la Loi n° 5651)</h2>
<p><strong>mertervitrini.com.tr</strong> (« Plateforme ») agit exclusivement en qualité de vitrine B2B et d'<strong>« Hébergeur » (Yer Sağlayıcı)</strong> au sens de l'article 5 de la loi turque n° 5651. Merter Vitrini n'est ni propriétaire, ni fabricant, ni importateur, ni vendeur direct, ni intermédiaire financier, ni transporteur des produits exposés.</p>
<h2>2. Les fournisseurs indépendants sont les seuls vendeurs directs</h2>
<p>Pour chaque article affiché, le grossiste ou fabricant (« Fournisseur ») dont la dénomination commerciale figure sur la fiche produit est l'unique <strong>« Vendeur direct »</strong> et <strong>« Fournisseur de contenu »</strong>. Les paiements, factures, transports cargo et formalités douanières sont directement gérés entre l'Acheteur et le Fournisseur.</p>
<h2>3. Réclamations, litiges et exclusion de responsabilité</h2>
<ul>
<li>Toute réclamation relative à un produit défectueux, manquant, retard de livraison, erreur de taille/couleur, retour, remboursement ou contrefaçon doit être adressée <strong>directement et exclusivement au Fournisseur vendeur</strong>.</li>
<li>Merter Vitrini n'est pas partie au contrat de vente commercial conclu entre l'Acheteur et le Fournisseur et décline toute responsabilité à ce titre.</li>
<li>Conformément aux lois n° 6563 et n° 5651, Merter Vitrini n'est pas tenue de contrôler préalablement les contenus publiés, mais traite sans délai toute notification motivée de retrait.</li>
</ul>
<h2>4. Droit applicable et juridiction compétente</h2>
<p>L'acceptation électronique est journalisée avec l'adresse IP et l'horodatage. Le droit turc s'applique ; les tribunaux d'Istanbul (Çağlayan) sont seuls compétents.</p>
</article>$t$,
    'Contrat d''Adhésion & Statut d''Hébergeur | Merter Vitrini',
    'Conditions générales d''adhésion B2B Merter Vitrini : statut d''hébergeur au titre de la loi 5651 et responsabilité directe des fournisseurs.'
);

SELECT pg_temp.upsert_page_tx(
    'kullanici-sozlesmesi', 'pl',
    'Umowa Członkowska i Ramy Prawne Dostawcy Hostingu (Ustawa nr 5651)',
    $t$<article>
<h2>1. Status prawny Platformy (Art. 5 Ustawy nr 5651)</h2>
<p>Serwis <strong>mertervitrini.com.tr</strong> („Platforma”) działa wyłącznie jako hurtowa witryna B2B oraz <strong>„Dostawca Usług Hostingu” (Yer Sağlayıcı)</strong> w rozumieniu art. 5 tureckiej ustawy nr 5651. Merter Vitrini nie jest właścicielem, producentem, importerem, bezpośrednim sprzedawcą, pośrednikiem płatniczym ani przewoźnikiem towarów.</p>
<h2>2. Niezależni dostawcy jako wyłączni sprzedawcy bezpośredni</h2>
<p>Jedynym <strong>„Sprzedawcą Bezpośrednim”</strong> i <strong>„Dostawcą Treści”</strong> dla każdego produktu jest niezależny hurtownik lub producent („Dostawca”) wskazany z nazwy na stronie produktu i w koszyku. Kupujący ustala ceny, płatności, faktury, wysyłkę i cło bezpośrednio z tym Dostawcą.</p>
<h2>3. Rozstrzyganie sporów i wyłączenie odpowiedzialności Platformy</h2>
<ul>
<li>Wszelkie roszczenia handlowe – dotyczące wad towaru, braków, opóźnień dostawy, rozbieżności rozmiarów/kolorów, zwrotów, wymian, zwrotu środków czy naruszeń praw własności intelektualnej – należy kierować <strong>wyłącznie i bezpośrednio do sprzedającego Dostawcy</strong>.</li>
<li>Merter Vitrini nie jest stroną umów sprzedaży zawieranych między Kupującym a Dostawcą i nie ponosi odpowiedzialności za wykonanie umowy ani wady towarów.</li>
<li>Zgodnie z ustawami nr 6563 i 5651 Platforma nie ma obowiązku uprzedniej weryfikacji treści Dostawców, natomiast niezwłocznie reaguje na uzasadnione zgłoszenia naruszeń.</li>
</ul>
<h2>4. Prawo właściwe i sąd</h2>
<p>Akceptacja umowy rejestrowana jest z adresem IP i znacznikiem czasu. Prawem właściwym jest prawo tureckie, a spory rozstrzygają sądy w Stambule (Çağlayan).</p>
</article>$t$,
    'Umowa Członkowska i Status Hostingu B2B | Merter Vitrini',
    'Umowa ramowa B2B Merter Vitrini: status dostawcy hostingu według ustawy 5651 oraz bezpośrednia odpowiedzialność niezależnych sprzedawców.'
);

SELECT pg_temp.upsert_page_tx(
    'kullanici-sozlesmesi', 'bg',
    'Рамков договор за членство, ползване и хостинг доставчик (Закон № 5651)',
    $t$<article>
<h2>1. Правен статут на платформата (Чл. 5 от Закон № 5651)</h2>
<p><strong>mertervitrini.com.tr</strong> („Платформата“) функционира единствено като дигитална B2B витрина за търговия на едро и неутрален <strong>„Хостинг доставчик“ (Yer Sağlayıcı)</strong> по чл. 5 от Закон № 5651 на Република Турция. Merter Vitrini не е производител, собственик, вносител, директен продавач, платежен посредник или превозвач на предлаганите стоки.</p>
<h2>2. Независимите доставчици са единствените директни продавачи</h2>
<p>Единственият <strong>„Директен продавач“</strong> и <strong>„Доставчик на съдържание“</strong> за всеки продукт е независимият търговец на едро или производител („Доставчик“), чието фирмено име е посочено в страницата на продукта. Потвърждаването на цени, банкови плащания, фактуриране, карго транспорт и митническо оформяне се извършват директно с този Доставчик.</p>
<h2>3. Адресат при спорове и освобождаване от отговорност</h2>
<ul>
<li>Всички рекламации за дефектна стока, липси, забавена доставка, несъответствие в цвят или размер, връщане, замяна, възстановяване на суми и фактуриране се насочват <strong>единствено и директно към продаващия Доставчик</strong>.</li>
<li>Merter Vitrini не е страна по търговските сделки между Купувача и Доставчика и не носи отговорност за изпълнението им или за недостатъци на стоките.</li>
<li>Съгласно Закон № 6563 и Закон № 5651 платформата няма задължение за предварителен контрол на съдържанието, но незабавно разглежда обосновани сигнали за нарушения.</li>
</ul>
<h2>4. Приложимо право и компетентен съд</h2>
<p>Електронното съгласие се записва с IP адрес и времеви печат. Прилага се турското право; компетентни са съдилищата и изпълнителните служби в Истанбул (Чаглаян).</p>
</article>$t$,
    'Договор за ползване и хостинг доставчик B2B | Merter Vitrini',
    'Рамков договор B2B на Merter Vitrini: статут на хостинг доставчик по Закон № 5651 и пряка отговорност на независимите търговци.'
);

-- 2.2 tedarikci-sozlesmesi
SELECT pg_temp.upsert_page_tx(
    'tedarikci-sozlesmesi', 'tr',
    'Tedarikçi Üyelik, İçerik Sağlayıcı ve Fikri Mülkiyet Sorumluluk Sözleşmesi',
    $t$<article>
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
</article>$t$,
    'Tedarikçi Üyelik ve Sorumluluk Sözleşmesi | Merter Vitrini',
    'Tedarikçilerin telif, marka, hukuka uygunluk ve doğrudan satıcı sorumluluklarını düzenleyen resmi sözleşme.'
);

SELECT pg_temp.upsert_page_tx(
    'tedarikci-sozlesmesi', 'en',
    'Supplier Membership, Content Provider & IP Indemnification Agreement',
    $t$<article>
<h2>1. Supplier's Role as Sole Direct Seller &amp; Content Provider</h2>
<p>Every manufacturer, wholesaler, or commercial seller opening a showroom, applying, or publishing listings via any channel (manual form, bulk draft, Excel, or XML feed) (the <strong>"Supplier"</strong>) agrees that it is the sole <strong>"Direct Seller"</strong> of those goods and the sole <strong>"Content Provider"</strong> under Turkish Law No. 5651. Merter Vitrini acts purely as a technical <strong>"Hosting Provider"</strong>.</p>
<h2>2. Copyright, Trademark &amp; Design Representation (Laws No. 5846 FSEK &amp; 6769 SMK)</h2>
<ul>
<li>The Supplier irrevocably warrants that it owns or holds valid commercial publication licenses for all photographs, lookbooks, model images, videos, product descriptions, brand names, and logos uploaded or synced to the Platform.</li>
<li>Publishing third-party copyrighted photos, watermarked/copied brand imagery, infringing industrial designs, or any <strong>counterfeit/replica goods (including "1:1" or "A-grade" replicas)</strong> is strictly prohibited.</li>
<li>Smuggled, untaxed, prohibited, or otherwise unlawful products may never be uploaded to the Platform.</li>
</ul>
<h2>3. Full Civil, Criminal &amp; Financial Liability and Right of Recourse</h2>
<p>The Supplier bears <strong>sole and exclusive civil, criminal, fiscal, and administrative liability</strong> for all lawsuits, prosecutorial inquiries, administrative fines, buyer disputes (defective goods, returns, shipping, invoicing, taxes), and IP claims arising from its uploaded content or goods. If Merter Vitrini is held liable for any penalty, judgment, or legal cost, Merter Vitrini reserves the unconditional right of <strong>full financial recourse</strong> (including statutory interest and attorneys' fees) against the Supplier.</p>
<h2>4. Immediate Takedown &amp; Account Termination</h2>
<p>Upon any valid Notice-and-Takedown submission or suspected infringement, Merter Vitrini may remove affected products/images or suspend/terminate the Supplier's account immediately without prior notice. Electronic acceptances are archived with IP address and timestamp as legal evidence; Istanbul (Çağlayan) Courts hold jurisdiction.</p>
</article>$t$,
    'Supplier Agreement & IP Responsibility | Merter Vitrini',
    'Official Supplier contract governing copyright, trademark compliance (FSEK/SMK), anti-counterfeit rules, and direct seller indemnification.'
);

SELECT pg_temp.upsert_page_tx(
    'tedarikci-sozlesmesi', 'ru',
    'Договор поставщика: статус поставщика контента и ответственность за ИС',
    $t$<article>
<h2>1. Статус Поставщика как прямого продавца и поставщика контента</h2>
<p>Каждая фабрика или оптовая компания («Поставщик»), открывающая витрину или загружающая товары вручную, пакетами, через Excel или XML, признает себя единственным <strong>«Прямым продавцом»</strong> и <strong>«Поставщиком контента»</strong> по Закону № 5651. Merter Vitrini является исключительно техническим <strong>«Хостинг-провайдером»</strong>.</p>
<h2>2. Гарантии авторских, товарных и дизайнерских прав (Законы № 5846 FSEK и № 6769 SMK)</h2>
<ul>
<li>Поставщик безоговорочно гарантирует наличие прав собственности или действующей лицензии на все загружаемые фотографии, лукбуки, изображения моделей, видео и описания.</li>
<li>Строго запрещена публикация чужих фотографий, несанкционированных логотипов/товарных знаков, а также любых <strong>подделок и реплик (включая «1:1» и «А-качество»)</strong>.</li>
<li>Запрещено размещение контрабандной, безналоговой или запрещенной законодательством продукции.</li>
</ul>
<h2>3. Полная юридическая и финансовая ответственность, право регресса</h2>
<p>Поставщик несет <strong>единоличную гражданскую, уголовную, налоговую и административную ответственность</strong> по любым искам, проверкам, штрафам и коммерческим спорам с покупателями (брак, возврат, карго, счета). В случае предъявления санкций или ущерба к Merter Vitrini платформа сохраняет право полного <strong>регрессного взыскания</strong> всех убытков, госпошлин и юридических расходов с Поставщика.</p>
<h2>4. Немедленное удаление и блокировка аккаунта</h2>
<p>При получении уведомления о нарушении или подозрении на контрафакт Merter Vitrini вправе без предварительного уведомления удалить контент или закрыть аккаунт Поставщика. Все электронные согласия сохраняются с IP и временной меткой; подсудность — суды Стамбула (Чаглаян).</p>
</article>$t$,
    'Соглашение с поставщиком и ответственность за ИС | Merter Vitrini',
    'Официальное соглашение поставщика B2B: авторские права (FSEK/SMK), запрет контрафакта и прямая ответственность продавца.'
);

SELECT pg_temp.upsert_page_tx(
    'tedarikci-sozlesmesi', 'ar',
    'عقد المورد، مزود المحتوى، وإقرار المسؤولية عن الملكية الفكرية',
    $t$<article dir="rtl">
<h2>1. صفة المورد كبائع مباشر ومزود محتوى وحيد</h2>
<p>تقر كل شركة مصنّعة أو تاجر جملة يفتح متجراً أو ينشر منتجات عبر المنصة يدوياً أو عبر Excel أو XML («المورد») بأنه <strong>«البائع المباشر»</strong> الوحيد و<strong>«مزود المحتوى»</strong> الوحيد بموجب القانون رقم 5651، بينما تقتصر صفة Merter Vitrini على تقديم الاستضافة التقنية (<strong>«مزود استضافة»</strong>).</p>
<h2>2. التعهد بملكية الصور وحقوق النشر والعلامات التجارية (القانونان 5846 و6769)</h2>
<ul>
<li>يتعهد المورد بشكل غير قابل للنقض بملكيته أو حصوله على تراخيص تجارية سارية لكافة الصور ومقاطع الفيديو وصور العارضات والأوصاف والشعارات المرفوعة.</li>
<li>يُحظر تماماً نشر صور محمية بحقوق نشر الغير، أو استخدام علامات تجارية غير مصرح بها، أو عرض أي <strong>منتجات مقلدة (بما في ذلك درجة 1:1 أو AAA)</strong>.</li>
<li>يُمنع رفع أي سلع مهربة أو مخالفة للأنظمة الضريبية أو القانونية.</li>
</ul>
<h2>3. المسؤولية القانونية والجنائية والمالية الكاملة وحق الرجوع</h2>
<p>يتحمل المورد <strong>منفرداً المسؤولية المدنية والجنائية والمالية والإدارية الكاملة</strong> عن أي دعاوى قضائية أو تحقيقات أو غرامات أو نزاعات تجارية مع المشترين (العيوب، الإرجاع، الشحن، الفواتير والضرائب). وإذا تكبدت Merter Vitrini أي تعويض أو غرامة، فيحق لها <strong>الرجوع مالياً بالكامل</strong> على المورد مع الفوائد وأتعاب المحاماة.</p>
<h2>4. الإزالة الفورية وإنهاء الحساب</h2>
<p>يحق للمنصة إزالة المنتجات المخالفة أو تعليق حساب المورد فوراً دون إنذار مسبق عند ورود بلاغ موثق أو الاشتباه بانتهاك. تُحفظ سجلات الموافقة بعنوان IP والطابع الزمني كدليل قانوني؛ وتختص محاكم إسطنبول (تشاغلايان) بالنظر في المنازعات.</p>
</article>$t$,
    'اتفاقية المورد والملكية الفكرية | Merter Vitrini B2B',
    'الاتفاقية الرسمية للموردين بشأن حقوق النشر والعلامات التجارية وحظر السلع المقلدة والمسؤولية المباشرة.'
);

SELECT pg_temp.upsert_page_tx(
    'tedarikci-sozlesmesi', 'de',
    'Lieferantenvertrag, Urheberrecht & Freistellungsvereinbarung',
    $t$<article>
<h2>1. Status als Direktverkäufer und Inhaltsanbieter</h2>
<p>Jeder Hersteller oder Großhändler („Lieferant“), der auf der Plattform einen Showroom eröffnet oder Produkte manuell, im Bulk, per Excel oder XML einstellt, erkennt an, alleiniger <strong>„Direktverkäufer“</strong> sowie <strong>„Inhaltsanbieter“ (İçerik Sağlayıcı)</strong> nach Gesetz Nr. 5651 zu sein. Merter Vitrini stellt lediglich Speicherplatz als technischer <strong>„Hosting-Provider“</strong> bereit.</p>
<h2>2. Urheber-, Marken- und Designrechtsgarantie (Gesetze Nr. 5846 FSEK &amp; 6769 SMK)</h2>
<ul>
<li>Der Lieferant versichert unwiderruflich, über volle Eigentums- oder gültige kommerzielle Nutzungsrechte an allen hochgeladenen Fotos, Lookbooks, Model-Aufnahmen, Videos, Texten und Logos zu verfügen.</li>
<li>Das Veröffentlichen fremder urheberrechtlich geschützter Fotos, unbefugter Markenlogos sowie jeglicher <strong>Fälschungen oder Repliken (einschließlich „1:1“- oder „A-Qualität“-Kopien)</strong> ist strengstens untersagt.</li>
<li>Unverzollte, geschmuggelte oder rechtswidrige Waren dürfen niemals hochgeladen werden.</li>
</ul>
<h2>3. Volle Haftung des Lieferanten &amp; Regressrecht</h2>
<p>Der Lieferant trägt die <strong>alleinige zivil-, straf-, steuer- und verwaltungsrechtliche Haftung</strong> für alle Klagen, behördlichen Verfahren, Bußgelder, IP-Ansprüche und Käuferreklamationen (Mängel, Rückgaben, Transport, Rechnungen). Wird Merter Vitrini wegen Inhalten oder Produkten des Lieferanten in Anspruch genommen, steht Merter Vitrini ein uneingeschränktes <strong>Regressrecht</strong> (inklusive Anwalts- und Verfahrenskosten) gegen den Lieferanten zu.</p>
<h2>4. Sofortige Entfernung &amp; Kontokündigung</h2>
<p>Bei berechtigten Takedown-Meldungen oder Rechtsverstößen kann Merter Vitrini Produkte oder Lieferantenkonten unverzüglich und ohne Vorankündigung sperren. Zustimmungen werden mit IP-Adresse und Zeitstempel beweissicher gespeichert; Gerichtsstand ist Istanbul (Çağlayan).</p>
</article>$t$,
    'Lieferantenvertrag & Urheberrecht | Merter Vitrini',
    'Verbindliche Lieferantenbedingungen für Urheberrecht (FSEK/SMK), Markenschutz, Fälschungsverbot und Haftungsfreistellung.'
);

SELECT pg_temp.upsert_page_tx(
    'tedarikci-sozlesmesi', 'fr',
    'Contrat Fournisseur, Fournisseur de Contenu & Garantie de Propriété Intellectuelle',
    $t$<article>
<h2>1. Qualité de Vendeur Direct et de Fournisseur de Contenu</h2>
<p>Tout fabricant ou grossiste (« Fournisseur ») ouvrant une vitrine ou publiant des articles manuellement, par lot, via Excel ou flux XML reconnaît être l'unique <strong>« Vendeur direct »</strong> et l'unique <strong>« Fournisseur de contenu »</strong> au sens de la loi n° 5651. Merter Vitrini intervient exclusivement comme <strong>« Hébergeur »</strong> technique.</p>
<h2>2. Garantie relative aux droits d'auteur, marques et modèles (Lois n° 5846 FSEK &amp; 6769 SMK)</h2>
<ul>
<li>Le Fournisseur garantit irrévocablement détenir les droits de propriété ou des licences commerciales valides pour toutes les photographies, lookbooks, images de mannequins, vidéos et descriptions publiés.</li>
<li>L'utilisation de photos tierces protégées, de marques non autorisées et la mise en ligne de toute <strong>contrefaçon ou réplique (y compris « 1:1 » ou « qualité A »)</strong> sont formellement interdites.</li>
<li>Tout produit de contrebande, non dédouané ou illégal est strictement proscrit.</li>
</ul>
<h2>3. Responsabilité intégrale et droit de recours (action récursoire)</h2>
<p>Le Fournisseur assume l'<strong>entière et exclusive responsabilité civile, pénale, fiscale et administrative</strong> pour tout litige commercial (défaut, retour, fret, facturation) ou action en contrefaçon. Si Merter Vitrini devait supporter une condamnation ou amende de ce fait, elle disposera d'un <strong>recours intégral</strong> contre le Fournisseur (frais d'avocat et intérêts inclus).</p>
<h2>4. Retrait immédiat et résiliation de compte</h2>
<p>En cas de notification fondée ou de suspicion de violation, Merter Vitrini peut retirer le contenu ou suspendre le compte Fournisseur sans préavis. Les validations électroniques sont conservées avec IP et horodatage ; compétence exclusive des tribunaux d'Istanbul (Çağlayan).</p>
</article>$t$,
    'Contrat Fournisseur & Propriété Intellectuelle | Merter Vitrini',
    'Contrat officiel régissant les droits d''auteur (FSEK/SMK), l''interdiction des contrefaçons et la garantie du fournisseur vendeur.'
);

SELECT pg_temp.upsert_page_tx(
    'tedarikci-sozlesmesi', 'pl',
    'Umowa Dostawcy, Dostawcy Treści i Odpowiedzialności za Własność Intelektualną',
    $t$<article>
<h2>1. Status Dostawcy jako Sprzedawcy Bezpośredniego i Dostawcy Treści</h2>
<p>Każdy producent lub hurtownik („Dostawca”) zakładający profil lub publikujący produkty (ręcznie, masowo, przez Excel lub XML) oświadcza, że jest wyłącznym <strong>„Sprzedawcą Bezpośrednim”</strong> oraz <strong>„Dostawcą Treści”</strong> w rozumieniu ustawy nr 5651. Merter Vitrini pełni wyłącznie rolę technicznego <strong>„Dostawcy Hostingu”</strong>.</p>
<h2>2. Gwarancja praw autorskich, znaków towarowych i wzorów (Ustawy nr 5846 i 6769)</h2>
<ul>
<li>Dostawca nieodwołalnie gwarantuje, że posiada pełne prawa własności lub ważne licencje komercyjne do wszystkich przesyłanych zdjęć, lookbooków, wizerunków modelek, filmów i opisów.</li>
<li>Publikowanie cudzych zdjęć chronionych prawem autorskim, bezprawne użycie znaków towarowych oraz oferowanie jakichkolwiek <strong>podróbek i replik (w tym „1:1” lub „klasy A”)</strong> jest surowo zabronione.</li>
<li>Zabrania się wystawiania towarów z przemytu, bez dokumentacji podatkowej lub prawnie zakazanych.</li>
</ul>
<h2>3. Pełna odpowiedzialność prawna i finansowa oraz prawo regresu</h2>
<p>Dostawca ponosi <strong>wyłączną odpowiedzialność cywilną, karną, skarbową i administracyjną</strong> za wszelkie spory z kupującymi (wady, zwroty, logistyka, faktury) oraz roszczenia z tytułu naruszenia własności intelektualnej. W razie obciążenia Merter Vitrini karą lub odszkodowaniem Platformie przysługuje pełne <strong>prawo regresu</strong> wobec Dostawcy.</p>
<h2>4. Natychmiastowe usunięcie i zamknięcie konta</h2>
<p>W przypadku zgłoszenia naruszenia Merter Vitrini może bez uprzedzenia usunąć oferty lub zablokować konto Dostawcy. Zgody zapisywane są z adresem IP i znacznikiem czasu; właściwy sąd to sąd w Stambule (Çağlayan).</p>
</article>$t$,
    'Umowa Dostawcy i Prawa Autorskie B2B | Merter Vitrini',
    'Umowa dostawcy B2B: odpowiedzialność za prawa autorskie (FSEK/SMK), zakaz podróbek oraz pełne prawo regresu sprzedawcy.'
);

SELECT pg_temp.upsert_page_tx(
    'tedarikci-sozlesmesi', 'bg',
    'Договор с доставчик, доставчик на съдържание и отговорност за интелектуална собственост',
    $t$<article>
<h2>1. Статут на Доставчика като директен продавач и доставчик на съдържание</h2>
<p>Всеки производител или търговец на едро („Доставчик“), който създава фирмена витрина или публикува артикули ръчно, групово, чрез Excel или XML, приема, че е единственият <strong>„Директен продавач“</strong> и <strong>„Доставчик на съдържание“</strong> по Закон № 5651. Merter Vitrini е само технически <strong>„Хостинг доставчик“</strong>.</p>
<h2>2. Декларация за авторски права, марки и дизайн (Закони № 5846 FSEK и № 6769 SMK)</h2>
<ul>
<li>Доставчикът гарантира неотменимо, че притежава авторските права или валиден търговски лиценз за всички качени снимки, лукбукове, изображения на модели, видеа, описания и лога.</li>
<li>Строго е забранено публикуването на чужди снимки без разрешение, неправомерно използване на марки, както и на всякакви <strong>фалшификати и реплики (вкл. „1:1“ или „А качество“)</strong>.</li>
<li>Забранява се качването на контрабандни, необмитени или незаконни стоки.</li>
</ul>
<h2>3. Пълна гражданска, наказателна и финансова отговорност и право на регрес</h2>
<p>Доставчикът носи <strong>изключителна гражданска, наказателна, данъчна и административна отговорност</strong> за всички съдебни искове, глоби и търговски спорове (дефекти, връщане, карго, фактури). При наложени санкции или обезщетения срещу Merter Vitrini платформата има пълно <strong>право на регресен иск</strong> към Доставчика.</p>
<h2>4. Незабавно сваляне и прекратяване на профила</h2>
<p>При сигнал за нарушение Merter Vitrini може без предизвестие да премахне продукти или да блокира профила на Доставчика. Електронните потвърждения се пазят с IP адрес и времеви печат; компетентен е съдът в Истанбул (Чаглаян).</p>
</article>$t$,
    'Договор с доставчик и интелектуална собственост | Merter Vitrini',
    'Официален договор за доставчици относно авторски права (FSEK/SMK), забрана на реплики и директна отговорност.'
);

-- 2.3 yer-saglayici-bildirimi
SELECT pg_temp.upsert_page_tx(
    'yer-saglayici-bildirimi', 'tr',
    '5651 Sayılı Kanun Yer Sağlayıcı Bildirimi ve Muafiyet Beyanı',
    $t$<article>
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
</article>$t$,
    '5651 Sayılı Kanun Yer Sağlayıcı Bildirimi | Merter Vitrini',
    'Merter Vitrini 5651 sayılı Kanun madde 5 kapsamında Yer Sağlayıcıdır; ürün içeriklerinden ve satışlardan bağımsız tedarikçiler sorumludur.'
);

SELECT pg_temp.upsert_page_tx(
    'yer-saglayici-bildirimi', 'en',
    'Law No. 5651 Hosting Provider Legal Disclosure',
    $t$<article>
<h2>1. Hosting Provider Status Under Turkish Law No. 5651 Article 5</h2>
<p>Pursuant to Articles 2/1-m and 5 of Law No. 5651 on Regulation of Publications on the Internet, <strong>mertervitrini.com.tr</strong> operates strictly as a B2B <strong>"Hosting Provider" (Yer Sağlayıcı)</strong>.</p>
<ul>
<li>Under Article 5/1 of Law No. 5651, a Hosting Provider is not legally obliged to verify uploaded product listings, photographs, prices, stock counts, or commercial texts in advance, nor to investigate unlawful activity independently.</li>
<li>Full legal and commercial liability for all listings and ensuing sales transactions lies solely with the respective <strong>independent Supplier ("Content Provider" and "Direct Seller")</strong>.</li>
</ul>
<h2>2. Strict Neutrality in Buyer–Supplier Transactions</h2>
<p>Merter Vitrini is not a party to purchase agreements, never collects product payments on behalf of vendors, never issues merchandise invoices, and provides no carrier warranty. Buyers experiencing commercial disputes must contact the direct selling Supplier.</p>
<h2>3. Notice-and-Takedown Channel for Unlawful Content</h2>
<p>Substantiated notices regarding unlawful content or intellectual property infringement under Law No. 5651, FSEK (Law No. 5846), or SMK (Law No. 6769) may be submitted with documentary proof to <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Law No. 5651 Hosting Provider Notice | Merter Vitrini',
    'Legal disclosure under Turkish Law No. 5651 Art. 5: Merter Vitrini is a neutral Hosting Provider; suppliers act as independent direct sellers.'
);

SELECT pg_temp.upsert_page_tx(
    'yer-saglayici-bildirimi', 'ru',
    'Уведомление о статусе хостинг-провайдера (Закон № 5651)',
    $t$<article>
<h2>1. Статус хостинг-провайдера согласно ст. 5 Закона № 5651</h2>
<p>В соответствии со статьями 2/1-m и 5 Закона Турецкой Республики № 5651 платформа <strong>mertervitrini.com.tr</strong> осуществляет деятельность исключительно как B2B <strong>«Хостинг-провайдер» (Yer Sağlayıcı)</strong>.</p>
<ul>
<li>Согласно ч. 1 ст. 5 Закона № 5651 хостинг-провайдер не обязан предварительно проверять загружаемые поставщиками товары, фотографии, цены и описания или вести самостоятельный поиск правонарушений.</li>
<li>Всю ответственность за размещаемый контент и заключенные сделки купли-продажи несет конкретный <strong>независимый Поставщик («Поставщик контента» и «Прямой продавец»)</strong>.</li>
</ul>
<h2>2. Нейтралитет платформы в расчетах и поставках</h2>
<p>Merter Vitrini не является стороной сделок, не принимает оплату за товары, не выставляет товарные накладные и не гарантирует сроки перевозки. Все коммерческие претензии предъявляются напрямую Поставщику.</p>
<h2>3. Сообщения о неправомерном контенте</h2>
<p>Документально подтвержденные уведомления о нарушениях прав по Закону № 5651, FSEK № 5846 и SMK № 6769 направляются на официальный адрес <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Уведомление хостинг-провайдера (Закон № 5651) | Merter Vitrini',
    'Правовое уведомление по Закону № 5651 ст. 5: Merter Vitrini — хостинг-провайдер, прямыми продавцами выступают независимые поставщики.'
);

SELECT pg_temp.upsert_page_tx(
    'yer-saglayici-bildirimi', 'ar',
    'إفصاح مزود الاستضافة والإعفاء القانوني (القانون رقم 5651)',
    $t$<article dir="rtl">
<h2>1. صفة مزود الاستضافة بموجب المادة 5 من القانون رقم 5651</h2>
<p>عملاً بالمادتين 2/1-م و5 من القانون التركي رقم 5651 لتنظيم النشر على الإنترنت، تعمل منصة <strong>mertervitrini.com.tr</strong> بصفتها <strong>«مزود استضافة» (Yer Sağlayıcı)</strong>.</p>
<ul>
<li>لا يلتزم مزود الاستضافة قانوناً بالرقابة المسبقة على المنتجات أو الصور أو الأسعار أو المخزون أو المحتوى التجاري الذي يرفعه الموردون، ولا بالتحري الاستباقي عن أي نشاط مخالف (المادة 5/1).</li>
<li>يتحمل <strong>المورد المستقل («مزود المحتوى» و«البائع المباشر»)</strong> المسؤولية القانونية والتجارية الكاملة عن المحتوى والصفقات الناتجة عنه.</li>
</ul>
<h2>2. الحياد التجاري بين المشتري والمورد</h2>
<p>ليست Merter Vitrini طرفاً في عقود البيع، ولا تحصل أثمان المنتجات، ولا تصدر فواتير البضائع، ولا تقدم ضمانات نقل؛ لذا يتواصل المشتري في أي نزاع تجاري مباشرة مع المورد المعني.</p>
<h2>3. الإبلاغ عن المحتوى المخالف (الإشعار والإزالة)</h2>
<p>يمكن إرسال البلاغات المدعومة بالمستندات بخصوص انتهاكات حقوق النشر والعلامات التجارية وفق القوانين 5651 و5846 و6769 إلى البريد الرسمي <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'إشعار مزود الاستضافة القانوني 5651 | Merter Vitrini',
    'الإفصاح القانوني بموجب المادة 5 من القانون 5651: Merter Vitrini مزود استضافة محايد والموردون المستقلون هم البائعون المباشرون.'
);

SELECT pg_temp.upsert_page_tx(
    'yer-saglayici-bildirimi', 'de',
    'Hosting-Provider-Hinweis gemäß Gesetz Nr. 5651',
    $t$<article>
<h2>1. Rechtsstatus als Hosting-Provider nach Artikel 5 des Gesetzes Nr. 5651</h2>
<p>Gemäß Art. 2/1-m und Art. 5 des türkischen Internetgesetzes Nr. 5651 fungiert <strong>mertervitrini.com.tr</strong> ausschließlich als B2B-<strong>„Hosting-Provider“ (Yer Sağlayıcı)</strong>.</p>
<ul>
<li>Der Hosting-Provider ist nach Art. 5/1 Gesetz Nr. 5651 nicht verpflichtet, die von Lieferanten eingestellten Artikel, Fotos, Preise oder Produkttexte vorab auf Rechtswidrigkeit zu prüfen.</li>
<li>Verantwortlich für sämtliche Inhalte sowie daraus resultierende Kaufgeschäfte ist allein der jeweilige <strong>unabhängige Lieferant („Inhaltsanbieter“ und „Direktverkäufer“)</strong>.</li>
</ul>
<h2>2. Neutralität im Verhältnis zwischen Käufer und Lieferant</h2>
<p>Merter Vitrini wird nicht Vertragspartei, zieht keine Kaufpreise ein, stellt keine Warenrechnungen aus und übernimmt keine Versandgarantie. Käufer wenden sich bei Streitfällen direkt an den jeweiligen Lieferanten.</p>
<h2>3. Meldung rechtswidriger Inhalte</h2>
<p>Begründete Takedown-Anträge nach Gesetz Nr. 5651, FSEK (Nr. 5846) oder SMK (Nr. 6769) richten Sie bitte mit Nachweisen an <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Hosting-Provider-Hinweis 5651 | Merter Vitrini',
    'Gesetzlicher Hinweis gemäß Gesetz Nr. 5651 Art. 5: Merter Vitrini ist neutraler B2B-Hosting-Provider ohne Vorabprüfungspflicht.'
);

SELECT pg_temp.upsert_page_tx(
    'yer-saglayici-bildirimi', 'fr',
    'Déclaration d''Hébergeur & Exonération au titre de la Loi n° 5651',
    $t$<article>
<h2>1. Statut d'Hébergeur conformément à l'article 5 de la Loi n° 5651</h2>
<p>En vertu des articles 2/1-m et 5 de la loi turque n° 5651, la plateforme <strong>mertervitrini.com.tr</strong> opère exclusivement en qualité d'<strong>« Hébergeur » (Yer Sağlayıcı)</strong>.</p>
<ul>
<li>Conformément à l'article 5/1, l'Hébergeur n'est pas légalement tenu de contrôler a priori les articles, photos, tarifs, stocks ou contenus commerciaux mis en ligne par les Fournisseurs.</li>
<li>L'entière responsabilité des contenus et des ventes incombe au seul <strong>Fournisseur indépendant (« Fournisseur de contenu » et « Vendeur direct »)</strong>.</li>
</ul>
<h2>2. Neutralité dans les relations Acheteur–Fournisseur</h2>
<p>Merter Vitrini n'est ni partie aux contrats de vente, ni encaisseur des prix, ni émetteur des factures marchandises. En cas de litige commercial, l'Acheteur traite directement avec le Fournisseur concerné.</p>
<h2>3. Notification de contenu illicite</h2>
<p>Tout signalement documenté portant sur un contenu illicite ou une atteinte aux droits (Lois 5651, 5846 FSEK et 6769 SMK) doit être envoyé à <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Déclaration d''Hébergeur Loi 5651 | Merter Vitrini',
    'Information légale selon l''article 5 de la loi n° 5651 : Merter Vitrini est un hébergeur B2B ; les fournisseurs sont les vendeurs directs.'
);

SELECT pg_temp.upsert_page_tx(
    'yer-saglayici-bildirimi', 'pl',
    'Informacja o Dostawcy Hostingu zgodnie z Ustawą nr 5651',
    $t$<article>
<h2>1. Status Dostawcy Hostingu na mocy art. 5 Ustawy nr 5651</h2>
<p>Na podstawie art. 2 ust. 1 lit. m oraz art. 5 tureckiej ustawy nr 5651 serwis <strong>mertervitrini.com.tr</strong> działa wyłącznie jako platforma B2B i <strong>„Dostawca Hostingu” (Yer Sağlayıcı)</strong>.</p>
<ul>
<li>Zgodnie z art. 5 ust. 1 Dostawca Hostingu nie jest zobowiązany do uprzedniej weryfikacji produktów, zdjęć, cen i stanów magazynowych zamieszczanych przez Dostawców.</li>
<li>Wyłączną odpowiedzialność za publikowane treści oraz umowy sprzedaży ponosi niezależny <strong>Dostawca („Dostawca Treści” i „Sprzedawca Bezpośredni”)</strong>.</li>
</ul>
<h2>2. Neutralność w relacjach Kupujący–Dostawca</h2>
<p>Merter Vitrini nie jest stroną umów sprzedaży, nie pobiera płatności za towar, nie wystawia faktur handlowych ani nie gwarantuje dostawy. Wszelkie spory rozstrzygane są bezpośrednio z danym Dostawcą.</p>
<h2>3. Zgłaszanie treści bezprawnych</h2>
<p>Udokumentowane zgłoszenia naruszeń (Ustawa 5651, FSEK 5846, SMK 6769) należy kierować na adres <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Informacja o Dostawcy Hostingu 5651 | Merter Vitrini',
    'Nota prawna na mocy art. 5 ustawy nr 5651: Merter Vitrini pełni rolę dostawcy hostingu, a sprzedawcami są niezależne firmy.'
);

SELECT pg_temp.upsert_page_tx(
    'yer-saglayici-bildirimi', 'bg',
    'Декларация за хостинг доставчик по Закон № 5651',
    $t$<article>
<h2>1. Статут на хостинг доставчик по чл. 5 от Закон № 5651</h2>
<p>Съгласно чл. 2, ал. 1, б. „м“ и чл. 5 от Закон № 5651 <strong>mertervitrini.com.tr</strong> осъществява дейност единствено като B2B <strong>„Хостинг доставчик“ (Yer Sağlayıcı)</strong>.</p>
<ul>
<li>По чл. 5/1 хостинг доставчикът няма задължение предварително да проверява качените от Доставчиците артикули, снимки, цени и описания или да издирва нарушения.</li>
<li>Пълната отговорност за търговското съдържание и продажбите принадлежи на съответния <strong>независим Доставчик („Доставчик на съдържание“ и „Директен продавач“)</strong>.</li>
</ul>
<h2>2. Неутралитет в отношенията Купувач–Доставчик</h2>
<p>Merter Vitrini не е страна по договорите за продажба, не инкасира плащания за стоки и не издава стокови фактури. При спорове купувачът се обръща директно към Доставчика.</p>
<h2>3. Сигнали за неправомерно съдържание</h2>
<p>Мотивирани сигнали с доказателства по Закон № 5651, FSEK № 5846 и SMK № 6769 се подават на имейл <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Уведомление за хостинг доставчик 5651 | Merter Vitrini',
    'Правно уведомление по чл. 5 от Закон № 5651: Merter Vitrini е неутрален хостинг доставчик, а директните продажби са на доставчиците.'
);

-- 2.4 telif-hakki-ve-uyar-kaldir
SELECT pg_temp.upsert_page_tx(
    'telif-hakki-ve-uyar-kaldir', 'tr',
    'Telif Hakkı, Marka İhlali ve Uyar-Kaldır Bildirim Prosedürü',
    $t$<article>
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
</article>$t$,
    'Telif Hakkı ve Uyar-Kaldır Prosedürü | Merter Vitrini',
    '5846 sayılı FSEK, 6769 sayılı SMK ve 5651 sayılı Kanun kapsamında fikri mülkiyet ve uyar-kaldır bildirim prosedürü.'
);

SELECT pg_temp.upsert_page_tx(
    'telif-hakki-ve-uyar-kaldir', 'en',
    'Copyright, Trademark & Notice-and-Takedown Policy',
    $t$<article>
<h2>1. Legal Framework &amp; Zero-Tolerance IP Policy</h2>
<p>Operating as a Hosting Provider under Law No. 5651 Art. 5, Merter Vitrini strictly respects copyrights, designs, and trademark rights protected under Turkish Law No. 5846 (FSEK) and Industrial Property Law No. 6769 (SMK). All Suppliers assume exclusive legal, criminal, and financial responsibility for ensuring uploaded media and products are original or licensed.</p>
<h2>2. Mandatory Elements of a Notice-and-Takedown Request</h2>
<p>Rightsholders or authorized counsel may submit written takedown notices to <strong>info@mertervitrini.com.tr</strong> containing all four required items:</p>
<ul>
<li>Full legal name, title, ID/tax number, service address, phone, and email of the rightsholder or representative (plus power of attorney if acting as counsel),</li>
<li>Documentary ownership proof (TURKPATENT or international trademark certificate, copyright certificate, or raw/original photography timestamps),</li>
<li>Exact Merter Vitrini product URL(s) and SKU code(s) of the allegedly infringing content,</li>
<li>Signed declaration of accuracy and legal responsibility for good-faith enforcement.</li>
</ul>
<h2>3. 48-Hour Review &amp; Enforcement SLA</h2>
<p>Complete, documented notices are reviewed within <strong>48 hours</strong>. Validated infringing items are immediately taken down, the notice is forwarded to the Supplier, and repeat offenders face permanent termination. Bad-faith or false takedown filers remain liable for resulting commercial damages.</p>
</article>$t$,
    'Copyright & Notice-and-Takedown Policy | Merter Vitrini',
    'Notice-and-Takedown procedure under Laws No. 5651, 5846 (FSEK), and 6769 (SMK): required documents and 48-hour takedown review.'
);

SELECT pg_temp.upsert_page_tx(
    'telif-hakki-ve-uyar-kaldir', 'ru',
    'Авторское право, товарные знаки и процедура удаления (Notice & Takedown)',
    $t$<article>
<h2>1. Нулевая терпимость к нарушениям интеллектуальной собственности</h2>
<p>Действуя как хостинг-провайдер по ст. 5 Закона № 5651, Merter Vitrini защищает авторские и промышленные права согласно законам № 5846 (FSEK) и № 6769 (SMK). Поставщики несут полную юридическую и финансовую ответственность за оригинальность и наличие лицензий на загружаемый контент.</p>
<h2>2. Обязательные сведения для жалобы (Notice &amp; Takedown)</h2>
<p>Правообладатели могут направить письменное обращение на адрес <strong>info@mertervitrini.com.tr</strong> со следующими 4 обязательными элементами:</p>
<ul>
<li>ФИО, должность/наименование, ИНН/паспортные данные, адрес, телефон и e-mail заявителя (и доверенность для представителя),</li>
<li>Документальные доказательства права (свидетельство на товарный знак TURKPATENT/WIPO или доказательства авторства оригинальных фото),</li>
<li>Точный URL товара на Merter Vitrini и артикул (SKU) спорной позиции,</li>
<li>Подписанное заявление об ответственности за достоверность жалобы.</li>
</ul>
<h2>3. Рассмотрение в течение 48 часов</h2>
<p>Полные, документально обоснованные обращения рассматриваются не позднее <strong>48 часов</strong>. При подтверждении нарушения товар/фото удаляются, поставщику направляется уведомление, а при повторных нарушениях аккаунт блокируется бессрочно.</p>
</article>$t$,
    'Авторские права и Notice-and-Takedown | Merter Vitrini',
    'Порядок подачи жалоб на нарушение авторских прав и товарных знаков (Законы № 5846 FSEK и № 6769 SMK) и удаление в течение 48 часов.'
);

SELECT pg_temp.upsert_page_tx(
    'telif-hakki-ve-uyar-kaldir', 'ar',
    'سياسة حقوق النشر والعلامات التجارية وإجراءات الإشعار والإزالة',
    $t$<article dir="rtl">
<h2>1. الإطار القانوني وسياسة عدم التسامح مع انتهاك الملكية الفكرية</h2>
<p>تعمل Merter Vitrini كمزود استضافة بموجب المادة 5 من القانون رقم 5651 وتلتزم بحماية حقوق المؤلف والتصاميم والعلامات التجارية وفق القانونين التركيين رقم 5846 (FSEK) ورقم 6769 (SMK). ويتحمل الموردون وحدهم المسؤولية الكاملة عن ملكية أو ترخيص كافة المواد المنشورة.</p>
<h2>2. العناصر الإلزامية في طلب الإزالة (Notice &amp; Takedown)</h2>
<p>يمكن لأصحاب الحقوق إرسال طلب كتابي إلى <strong>info@mertervitrini.com.tr</strong> متضمناً البنود الأربعة التالية:</p>
<ul>
<li>الاسم الكامل والصفة التجارية والرقم الضريبي وعنوان التبليغ والهاتف والبريد الإلكتروني (مع سند الوكالة إن وُجد وكيل)،</li>
<li>مستندات إثبات الملكية (شهادة تسجيل العلامة التجارية لدى TURKPATENT أو الأدلة الأصلية لتصوير وتأليف العمل)،</li>
<li>الرابط الدقيق (URL) ورمز المنتج (SKU) محل الشكوى على المنصة،</li>
<li>إقرار موقّع بصحة البلاغ وتحمّل المسؤولية القانونية عن دقته.</li>
</ul>
<h2>3. المراجعة والإزالة خلال 48 ساعة</h2>
<p>تتم مراجعة البلاغات المستوفية للمستندات خلال <strong>48 ساعة</strong> كحد أقصى؛ وتُزال المحتويات المخالفة فوراً ويُبلغ المورد، مع إلغاء حساب المخالفين بشكل دائم عند التكرار.</p>
</article>$t$,
    'حقوق النشر وإجراءات الإزالة | Merter Vitrini',
    'سياسة حماية الملكية الفكرية وإجراءات الإبلاغ والإزالة خلال 48 ساعة بموجب القوانين 5651 و5846 و6769.'
);

SELECT pg_temp.upsert_page_tx(
    'telif-hakki-ve-uyar-kaldir', 'de',
    'Urheberrecht, Markenschutz & Notice-and-Takedown-Verfahren',
    $t$<article>
<h2>1. Rechtlicher Rahmen &amp; Null-Toleranz bei Schutzrechtsverletzungen</h2>
<p>Als Hosting-Provider nach Gesetz Nr. 5651 Art. 5 achtet Merter Vitrini sämtliche Urheber-, Design- und Markenrechte nach dem türkischen Urheberrechtsgesetz (Nr. 5846 FSEK) und dem Gesetz über gewerblichen Rechtsschutz (Nr. 6769 SMK). Die Lieferanten haften allein für Originalität und Lizenzen ihrer Inhalte.</p>
<h2>2. Erforderliche Angaben für eine Takedown-Meldung</h2>
<p>Rechteinhaber können schriftliche Meldungen an <strong>info@mertervitrini.com.tr</strong> mit folgenden vier Pflichtbestandteilen einreichen:</p>
<ul>
<li>Vollständiger Name, Firma, Ausweis-/Steuernummer, ladungsfähige Anschrift, Telefon und E-Mail (bei Bevollmächtigten inkl. Vollmacht),</li>
<li>Rechtsnachweise (Markenurkunde von TURKPATENT/EUIPO oder Original-Erstellungsnachweise der Fotografien),</li>
<li>Genaue URL der beanstandeten Seite auf Merter Vitrini sowie vorhandene Artikel-SKU,</li>
<li>Unterschriebene Richtigkeitserklärung unter Übernahme der rechtlichen Verantwortung.</li>
</ul>
<h2>3. Prüfung &amp; Entfernung innerhalb von 48 Stunden</h2>
<p>Vollständige und belegte Meldungen werden binnen <strong>48 Stunden</strong> durch unsere Rechtsabteilung geprüft. Rechtsverletzende Inhalte werden umgehend entfernt; wiederholte Verstöße führen zur dauerhaften Kontosperrung. Missbräuchliche Falschmeldungen lösen Schadensersatzhaftung aus.</p>
</article>$t$,
    'Urheberrecht & Notice-and-Takedown | Merter Vitrini',
    'Verfahren zur Meldung von Marken- und Urheberrechtsverletzungen (FSEK/SMK) und verbindliche 48-Stunden-Prüfung.'
);

SELECT pg_temp.upsert_page_tx(
    'telif-hakki-ve-uyar-kaldir', 'fr',
    'Droits d''Auteur, Marques & Procédure de Retrait (Notice & Takedown)',
    $t$<article>
<h2>1. Cadre légal &amp; Tolérance zéro envers la contrefaçon</h2>
<p>Hébergeur au sens de l'article 5 de la loi n° 5651, Merter Vitrini respecte les droits protégés par les lois turques n° 5846 (FSEK) et n° 6769 (SMK). Chaque Fournisseur garantit la licéité de ses visuels et produits et en assume seul la responsabilité.</p>
<h2>2. Éléments obligatoires d'une notification de retrait</h2>
<p>Les titulaires de droits peuvent adresser une notification écrite à <strong>info@mertervitrini.com.tr</strong> comportant ces quatre éléments obligatoires :</p>
<ul>
<li>Identité complète, dénomination, numéro fiscal, adresse de notification, téléphone et e-mail du titulaire ou mandataire (avec mandat),</li>
<li>Justificatifs de propriété intellectuelle (certificat de marque TURKPATENT/INPI ou preuves d'origine des clichés),</li>
<li>URL exacte de la fiche produit incriminée sur Merter Vitrini et code SKU,</li>
<li>Déclaration signée attestant de l'exactitude de la demande et engageant la responsabilité du requérant.</li>
</ul>
<h2>3. Traitement et retrait sous 48 heures</h2>
<p>Les notifications complètes et documentées sont évaluées sous <strong>48 heures</strong> maximum. En cas de violation avérée, le contenu est retiré sans délai, le Fournisseur est notifié et les récidivistes sont bannis définitivement.</p>
</article>$t$,
    'Droits d''Auteur & Procédure Takedown | Merter Vitrini',
    'Procédure Notice-and-Takedown au titre des lois 5651, 5846 et 6769 : pièces justificatives requises et retrait sous 48 heures.'
);

SELECT pg_temp.upsert_page_tx(
    'telif-hakki-ve-uyar-kaldir', 'pl',
    'Prawa Autorskie, Znaki Towarowe i Procedura Notice-and-Takedown',
    $t$<article>
<h2>1. Ochrona własności intelektualnej i brak tolerancji dla naruszeń</h2>
<p>Jako dostawca hostingu (Ustawa nr 5651 art. 5) Merter Vitrini respektuje prawa chronione ustawami nr 5846 (FSEK) oraz nr 6769 (SMK). Wyłączną odpowiedzialność prawną i finansową za oryginalność zdjęć, projektów i marek ponoszą publikujący je Dostawcy.</p>
<h2>2. Wymagane elementy zgłoszenia naruszenia (Notice &amp; Takedown)</h2>
<p>Właściciele praw mogą przesyłać zgłoszenia na adres <strong>info@mertervitrini.com.tr</strong> wraz z czterema obowiązkowymi elementami:</p>
<ul>
<li>Dane identyfikacyjne, nazwa firmy, NIP/PESEL, adres doręczeń, telefon i e-mail uprawnionego lub pełnomocnika (wraz z pełnomocnictwem),</li>
<li>Dowody przysługujących praw (świadectwo ochronne znaku TURKPATENT/EUIPO lub pierwotne dowody autorstwa zdjęć),</li>
<li>Dokładny adres URL produktu w serwisie Merter Vitrini oraz kod SKU,</li>
<li>Podpisane oświadczenie o prawdziwości zgłoszenia i odpowiedzialności prawnej.</li>
</ul>
<h2>3. Rozpatrzenie w ciągu 48 godzin</h2>
<p>Kompletne zgłoszenia rozpatrywane są maksymalnie w ciągu <strong>48 godzin</strong>. Naruszające prawo treści są niezwłocznie usuwane, a ponowne naruszenia skutkują trwałym usunięciem konta Dostawcy.</p>
</article>$t$,
    'Prawa Autorskie i Notice-and-Takedown | Merter Vitrini',
    'Procedura zgłaszania naruszeń praw autorskich i znaków towarowych (FSEK/SMK) oraz usunięcie treści w 48 godzin.'
);

SELECT pg_temp.upsert_page_tx(
    'telif-hakki-ve-uyar-kaldir', 'bg',
    'Авторски права, търговски марки и процедура за сваляне (Notice & Takedown)',
    $t$<article>
<h2>1. Правна рамка и нулева толерантност към нарушения</h2>
<p>Като хостинг доставчик по чл. 5 от Закон № 5651 Merter Vitrini спазва законите № 5846 (FSEK) и № 6769 (SMK). Доставчиците носят изключителна правна и имуществена отговорност за лицензите и оригиналността на публикуваните снимки и артикули.</p>
<h2>2. Задължителни реквизити на уведомлението за сваляне</h2>
<p>Носителите на права могат да изпратят писмен сигнал на <strong>info@mertervitrini.com.tr</strong>, съдържащ четирите задължителни елемента:</p>
<ul>
<li>Име, фирма, данъчен/личен номер, адрес за призоваване, телефон и имейл на правоносителя или пълномощника (с пълномощно),</li>
<li>Доказателства за правото (свидетелство за търговска марка от TURKPATENT или оригинални доказателства за авторство на снимките),</li>
<li>Точният URL адрес на продукта в Merter Vitrini и SKU код,</li>
<li>Подписана декларация за верността на данните и правна отговорност.</li>
</ul>
<h2>3. Разглеждане в срок до 48 часа</h2>
<p>Пълните и документирани искания се разглеждат в срок до <strong>48 часа</strong>. При установено нарушение съдържанието се премахва незабавно, а при повторни нарушения профилът на доставчика се прекратява окончателно.</p>
</article>$t$,
    'Авторски права и Notice-and-Takedown | Merter Vitrini',
    'Процедура при нарушени авторски права и марки по закони № 5651, 5846 и 6769 с обработка до 48 часа.'
);

-- ============================================================================
-- SECTION 2 (PART 2): iptal-iade-kosullari, gizlilik-politikasi,
--                     mesafeli-satis-sozlesmesi (ALL 8 LANGUAGES)
-- ============================================================================

-- 2.5 iptal-iade-kosullari
SELECT pg_temp.upsert_page_tx(
    'iptal-iade-kosullari', 'tr',
    'B2B İptal, İade, Değişim ve Doğrudan Tedarikçi Koşulları',
    $t$<article>
<h2>1. B2B Ticari Satış Niteliği ve Tüketici Mevzuatı İstisnası</h2>
<p><strong>mertervitrini.com.tr</strong> üzerinde sergilenen tüm ürünler tacirler, işletmeler, toptancılar ve perakende mağazalar arasındaki toptan (seri/paket bazlı B2B) ticari alışverişlere yöneliktir. 6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamındaki tüketici cayma hakkı B2B ticari işlemlerde uygulanmaz; işlemler 6102 sayılı Türk Ticaret Kanunu (TTK) ve 6098 sayılı Türk Borçlar Kanunu (TBK) hükümlerine tabidir.</p>
<h2>2. Muhatap Yalnızca Doğrudan Satıcı Olan Tedarikçidir</h2>
<ul>
<li>Merter Vitrini 5651 sayılı Kanun kapsamında yalnızca <strong>"Yer Sağlayıcı"</strong>dır; doğrudan satıcı, ödeme tahsildarı veya kargo taşıyıcısı değildir.</li>
<li>İptal, değişim, ayıplı/hasarlı ürün bildirimi, eksik ürün telafisi ve bedel iadesi süreçlerinin tamamı <strong>doğrudan faturayı kesen ve satışı yapan Tedarikçi firma</strong> ile Alıcı arasında yürütülür.</li>
</ul>
<h2>3. Ayıp İhbarı Süreleri ve Genel B2B Prosedürü (TTK m. 23)</h2>
<ul>
<li>6102 sayılı TTK m. 23/1-c uyarınca Alıcı; teslim aldığı paketlerdeki <strong>açık ayıpları 2 (iki) iş günü içinde</strong>, olağan muayene ile fark edilebilecek ayıpları ise <strong>8 (sekiz) gün içinde</strong> kargo tutanağı ve görsel kanıtlarla birlikte doğrudan satıcı Tedarikçiye bildirmelidir.</li>
<li>Özel üretim (Private Label / Fason), renk-beden asortisi bozulmuş veya kullanılmış/yıkanmış/etiketi sökülmüş toptan serilerde iade koşulları ilgili Tedarikçinin yazılı onayına tabidir.</li>
<li>İade onaylandığında geri gönderim adresi, kargo sorumluluğu ve bedel iadesi veya cari mahsup takvimi doğrudan ilgili Tedarikçi tarafından sağlanır.</li>
</ul>
</article>$t$,
    'B2B İptal, İade ve Doğrudan Tedarikçi Koşulları | Merter Vitrini',
    'Toptan B2B satışlarda iptal, iade, TTK ayıp ihbarı süreleri (2 iş günü / 8 gün) ve doğrudan tedarikçi muhataplık koşulları.'
);

SELECT pg_temp.upsert_page_tx(
    'iptal-iade-kosullari', 'en',
    'B2B Cancellation, Return & Direct Supplier Procedure',
    $t$<article>
<h2>1. Commercial B2B Nature &amp; Exclusion of Consumer Withdrawal Rights</h2>
<p>All listings on <strong>mertervitrini.com.tr</strong> address commercial wholesale trade (assorted series/lots) between merchants, wholesalers, boutiques, and corporate buyers. Consumer statutory withdrawal rights under Turkish Consumer Law No. 6502 do not apply to B2B transactions; all contracts are governed by Turkish Commercial Code No. 6102 (TTK) and Turkish Code of Obligations No. 6098 (TBK).</p>
<h2>2. Only the Direct Selling Supplier Is the Legal Counterparty</h2>
<ul>
<li>Merter Vitrini acts strictly as a <strong>"Hosting Provider"</strong> under Law No. 5651 and never sells goods directly, collects product payments, carries freight, or warehouses returns.</li>
<li>All cancellation requests, exchanges, damaged/defective item claims, short-shipment notices, and refunds are handled exclusively between the Buyer and the <strong>direct selling, invoicing Supplier</strong>.</li>
</ul>
<h2>3. Defect Notice Deadlines (TTK Art. 23) &amp; Return Conditions</h2>
<ul>
<li>Under Article 23/1-c of Law No. 6102 (TTK), Buyers must notify the selling Supplier in writing with cargo reports and photographic evidence within <strong>2 (two) business days for apparent defects</strong> and within <strong>8 (eight) days for defects discoverable on ordinary inspection</strong>.</li>
<li>Returns on Private Label / custom orders, broken size assortments, or washed/worn/detagged wholesale goods require the Supplier's explicit written approval.</li>
<li>Once approved, return shipping instructions, freight cost allocation, and refund or account credit schedules are provided directly by that Supplier.</li>
</ul>
</article>$t$,
    'B2B Cancellation & Return Policy | Merter Vitrini',
    'B2B wholesale return procedure, TTK Art. 23 inspection windows (2 business days / 8 days), and direct supplier settlement rules.'
);

SELECT pg_temp.upsert_page_tx(
    'iptal-iade-kosullari', 'ru',
    'Условия отмены, возврата и обмена B2B с прямым поставщиком',
    $t$<article>
<h2>1. Коммерческий характер B2B-сделок и исключение потребительского права</h2>
<p>Все позиции на <strong>mertervitrini.com.tr</strong> предназначены для оптовой B2B-торговли сериями между коммерческими субъектами и бутиками. Положения Закона № 6502 о защите прав потребителей (право потребительского отказа) на B2B-сделки не распространяются; действуют Торговый кодекс Турции № 6102 (TTK) и Обязательственный кодекс № 6098 (TBK).</p>
<h2>2. Прямой продавец — единственный адресат претензий</h2>
<ul>
<li>Merter Vitrini имеет статус <strong>«Хостинг-провайдера»</strong> (Закон № 5651) и не является продавцом, перевозчиком или держателем возвратов.</li>
<li>Все вопросы отмены заказов, обмена, брака, недостачи и возврата денежных средств решаются исключительно с <strong>непосредственным Поставщиком</strong>, оформившим продажу и инвойс.</li>
</ul>
<h2>3. Сроки претензий по качеству (ст. 23 TTK) и общие правила возврата</h2>
<ul>
<li>Согласно ст. 23/1-c TTK № 6102 покупатель обязан направить продавцу-поставщику письменное уведомление с актом карго и фотофиксацией в течение <strong>2 (двух) рабочих дней при явных дефектах</strong> и в течение <strong>8 (восьми) дней при прочих недостатках</strong>.</li>
<li>Возврат заказов Private Label (под брендом заказчика), разукомплектованных серий, а также ношеных/стираных/без бирок изделий возможен только с письменного согласия Поставщика.</li>
<li>При одобрении возврата адрес обратной отправки, оплата доставки и порядок возврата или взаимозачета определяются Поставщиком напрямую.</li>
</ul>
</article>$t$,
    'Условия отмены и возврата B2B | Merter Vitrini',
    'Правила отмены, обмена и рекламаций при оптовых B2B-закупках (сроки по ст. 23 TTK: 2 рабочих дня / 8 дней) и расчет с поставщиками.'
);

SELECT pg_temp.upsert_page_tx(
    'iptal-iade-kosullari', 'ar',
    'سياسة الإلغاء والاسترجاع والاستبدال التجاري (B2B) مع المورد المباشر',
    $t$<article dir="rtl">
<h2>1. الطبيعة التجارية للصفقات (B2B) واستثناء قوانين المستهلك</h2>
<p>تُخصص جميع المنتجات على <strong>mertervitrini.com.tr</strong> للتجارة التجارية بالجملة (نظام السيريات) بين التجار والشركات والبوتيكات. لا ينطبق حق العدول الاستهلاكي (القانون رقم 6502) على المعاملات التجارية، بل تخضع الصفقات للقانون التجاري التركي رقم 6102 (TTK) وقانون الالتزامات رقم 6098 (TBK).</p>
<h2>2. المورد البائع هو الجهة المباشرة الوحيدة</h2>
<ul>
<li>تقتصر صفة Merter Vitrini على كونها <strong>«مزود استضافة»</strong> وفق القانون 5651 ولا تقوم بالبيع المباشر أو تحصيل المدفوعات أو الشحن أو استلام المرتجعات.</li>
<li>تُدار جميع طلبات الإلغاء والاستبدال وبلاغات العيوب والنقص واسترداد المبالغ حصراً ومباشرة بين المشتري و<strong>المورد البائع مُصدر الفاتورة</strong>.</li>
</ul>
<h2>3. مهل الإخطار بالعيوب (المادة 23 TTK) وإجراءات الإرجاع</h2>
<ul>
<li>وفقاً للمادة 23/1-ج من القانون التجاري التركي، يجب على المشتري إخطار المورد البائع كتابياً مع تقرير شركة الشحن والصور التوثيقية خلال <strong>يومي (2) عمل للعيوب الظاهرة</strong> وخلال <strong>8 (ثمانية) أيام للعيوب الأخرى</strong> القابلة للاكتشاف بالفحص المعتاد.</li>
<li>تخضع طلبات الإرجاع الخاصة بالتصنيع الخاص (Private Label) أو السيريات المفتوحة غير المكتملة أو القطع المغسولة/المنزوعة البطاقات لموافقة كتابية مسبقة من المورد.</li>
<li>عند قبول الإرجاع، يحدد المورد مباشرة عنوان الإعادة وتحمّل تكاليف الشحن وجدولة الاسترداد أو المقاصة المالية.</li>
</ul>
</article>$t$,
    'شروط الإلغاء والاسترجاع B2B | Merter Vitrini',
    'إجراءات الإلغاء والاستبدال في مبيعات الجملة B2B والمهل التجارية للإخطار بالعيوب (يومي عمل / 8 أيام) مع المورد المباشر.'
);

SELECT pg_temp.upsert_page_tx(
    'iptal-iade-kosullari', 'de',
    'B2B-Stornierungs-, Rückgabe- & Direktlieferantenbedingungen',
    $t$<article>
<h2>1. Gewerblicher B2B-Charakter &amp; Ausschluss des Verbraucherwiderrufs</h2>
<p>Sämtliche Angebote auf <strong>mertervitrini.com.tr</strong> richten sich ausschließlich an Kaufleute, Großhändler und Boutiquen (Serien-/Paketkauf). Verbraucherrechtliche Widerrufsrechte (Gesetz Nr. 6502) gelten im B2B-Handel nicht; maßgeblich sind das türkische Handelsgesetzbuch Nr. 6102 (TTK) und das Obligationenrecht Nr. 6098 (TBK).</p>
<h2>2. Ausschließliche Zuständigkeit des Direktlieferanten</h2>
<ul>
<li>Merter Vitrini ist bloßer <strong>„Hosting-Provider“</strong> (Gesetz Nr. 5651), kein Direktverkäufer, Zahlungseinzugsbeauftragter oder Lagerhalter für Retouren.</li>
<li>Stornierungen, Umtausch, Mängel- oder Schadensmeldungen, Fehlmengen sowie Erstattungen sind unmittelbar zwischen Käufer und dem <strong>rechnungsstellenden Direktlieferanten</strong> abzuwickeln.</li>
</ul>
<h2>3. Rügefristen (TTK Art. 23) &amp; B2B-Rückgaberegeln</h2>
<ul>
<li>Nach Art. 23/1-c TTK (Nr. 6102) müssen Käufer <strong>offensichtliche Mängel binnen 2 Werktagen</strong> und sonstige bei ordnungsgemäßer Prüfung erkennbare Mängel binnen <strong>8 Tagen</strong> unter Beifügung von Transportprotokoll und Fotobelegen beim Lieferanten rügen.</li>
<li>Rückgaben von Sonderanfertigungen (Private Label), angebrochenen Serien oder gewaschenen/etikettlosen Artikeln bedürfen der schriftlichen Zustimmung des Lieferanten.</li>
<li>Bei Freigabe teilt der Lieferant Rücksendeadresse, Frachtkostentragung sowie Erstattungs- bzw. Gutschriftstermine direkt mit.</li>
</ul>
</article>$t$,
    'B2B Stornierung, Rückgabe & Lieferantenbedingungen | Merter Vitrini',
    'B2B-Großhandelsregeln zu Stornierung, Umtausch, Rügefristen nach Art. 23 TTK (2 Werktage / 8 Tage) und direkter Abwicklung.'
);

SELECT pg_temp.upsert_page_tx(
    'iptal-iade-kosullari', 'fr',
    'Conditions B2B d''Annulation, Retour, Échange & Fournisseur Direct',
    $t$<article>
<h2>1. Nature commerciale B2B et exclusion du droit de rétractation</h2>
<p>Toutes les offres publiées sur <strong>mertervitrini.com.tr</strong> visent exclusivement des transactions B2B en gros par séries de tailles entre professionnels. Le droit de rétractation des consommateurs (Loi n° 6502) ne s'applique pas ; les ventes relèvent du Code de commerce turc n° 6102 (TTK) et du Code des obligations n° 6098 (TBK).</p>
<h2>2. Le Fournisseur Vendeur Direct est votre seul interlocuteur</h2>
<ul>
<li>Merter Vitrini agit uniquement comme <strong>« Hébergeur »</strong> (Loi n° 5651) et n'encaisse pas les prix, n'expédie aucun colis et ne traite aucun retour physique.</li>
<li>Toute demande d'annulation, d'échange, de produit défectueux, de manquant ou de remboursement doit être adressée exclusivement au <strong>Fournisseur direct émetteur de la facture</strong>.</li>
</ul>
<h2>3. Délais de dénonciation des défauts (Art. 23 TTK) et retours</h2>
<ul>
<li>Conformément à l'art. 23/1-c du TTK (n° 6102), l'Acheteur doit signaler par écrit au Fournisseur tout <strong>vice apparent sous 2 jours ouvrables</strong> et tout défaut décelable lors d'un contrôle normal sous <strong>8 jours</strong>, avec procès-verbal transporteur et photos.</li>
<li>Les retours sur commandes Private Label, séries dépareillées ou articles portés, lavés ou sans étiquettes nécessitent l'accord écrit exprès du Fournisseur.</li>
<li>Après validation, le Fournisseur communique directement l'adresse de retour, la prise en charge du port et le calendrier de remboursement ou d'avoir.</li>
</ul>
</article>$t$,
    'Conditions d''Annulation et Retour B2B | Merter Vitrini',
    'Procédure B2B d''annulation et de retour : délais légaux de réclamation TTK art. 23 (2 jours ouvrés / 8 jours) et règlement direct.'
);

SELECT pg_temp.upsert_page_tx(
    'iptal-iade-kosullari', 'pl',
    'Zasady Anulowania, Zwrotów i Wymian B2B u Bezpośredniego Dostawcy',
    $t$<article>
<h2>1. Charakter handlowy B2B i wyłączenie prawa odstąpienia konsumenta</h2>
<p>Oferta <strong>mertervitrini.com.tr</strong> skierowana jest wyłącznie do przedsiębiorców, butików i hurtowników kupujących w pakietach seryjnych. Przepisy konsumenckie o odstąpieniu od umowy (Ustawa nr 6502) nie mają zastosowania w relacjach B2B; obowiązują Turecki Kodeks Handlowy nr 6102 (TTK) oraz Kodeks Zobowiązań nr 6098 (TBK).</p>
<h2>2. Wyłącznym partnerem rozliczeniowym jest Sprzedający Dostawca</h2>
<ul>
<li>Merter Vitrini działa jako <strong>„Dostawca Hostingu”</strong> (Ustawa nr 5651) – nie sprzedaje towarów, nie inkasuje należności i nie prowadzi magazynu zwrotów.</li>
<li>Wszystkie zgłoszenia anulowania zamówienia, wymiany, uszkodzeń, braków w paczkach oraz zwroty należności rozstrzygane są wyłącznie między Kupującym a <strong>Dostawcą wystawiającym fakturę</strong>.</li>
</ul>
<h2>3. Terminy zgłaszania wad (Art. 23 TTK) i warunki zwrotu</h2>
<ul>
<li>Zgodnie z art. 23 ust. 1 lit. c TTK Kupujący zobowiązany jest zgłosić Dostawcy na piśmie wraz z protokołem przewoźnika i zdjęciami <strong>wady jawne w ciągu 2 dni roboczych</strong>, a pozostałe wady wykrywalne przy zwykłym badaniu – w ciągu <strong>8 dni</strong>.</li>
<li>Zwroty towarów szytych pod marką własną (Private Label), zdekompletowanych serii lub odzieży pranej, noszonej bądź pozbawionej metek wymagają pisemnej zgody Dostawcy.</li>
<li>Po zatwierdzeniu zwrotu adres odsyłki, koszty transportu oraz harmonogram zwrotu środków lub korekty salda ustala bezpośrednio Dostawca.</li>
</ul>
</article>$t$,
    'Zasady Anulowania i Zwrotów B2B | Merter Vitrini',
    'Procedura zwrotów i reklamacji w handlu hurtowym B2B: terminy zgłaszania wad wg TTK art. 23 (2 dni robocze / 8 dni) u dostawcy.'
);

SELECT pg_temp.upsert_page_tx(
    'iptal-iade-kosullari', 'bg',
    'Условия за анулиране, връщане и замяна B2B с директния доставчик',
    $t$<article>
<h2>1. Търговски характер на B2B продажбите и изключване на потребителски отказ</h2>
<p>Всички артикули в <strong>mertervitrini.com.tr</strong> са предназначени за търговия на едро в серии между търговци, фирми и бутици. Правото на потребителски отказ (Закон № 6502) не се прилага за B2B сделки; действат Турският търговски закон № 6102 (TTK) и Законът за задълженията № 6098 (TBK).</p>
<h2>2. Единствен насрещен партньор е продаващият Доставчик</h2>
<ul>
<li>Merter Vitrini е единствено <strong>„Хостинг доставчик“</strong> по Закон № 5651 и не продава стоки, не събира плащания и не приема връщания в свой склад.</li>
<li>Всички искания за анулиране, замяна, дефектна/повредена стока, липси и възстановяване на суми се уреждат директно с <strong>Доставчика, издал фактурата</strong>.</li>
</ul>
<h2>3. Срокове за рекламация на недостатъци (Чл. 23 TTK) и ред за връщане</h2>
<ul>
<li>По чл. 23/1-c от TTK (№ 6102) купувачът трябва да уведоми писмено Доставчика с карго протокол и снимки в срок до <strong>2 работни дни за явни недостатъци</strong> и до <strong>8 дни за други недостатъци</strong>, откриваеми при обичаен преглед.</li>
<li>Връщането на специални поръчки (Private Label), нарушени серии или носени, прани и без етикети изделия изисква писмено съгласие на Доставчика.</li>
<li>При одобрено връщане адресът за обратно изпращане, транспортните разходи и срокът за възстановяване или прихващане се уточняват директно с Доставчика.</li>
</ul>
</article>$t$,
    'Условия за анулиране и връщане B2B | Merter Vitrini',
    'Правила за анулиране, замяна и рекламация в B2B търговията на едро (срокове 2 работни дни / 8 дни по чл. 23 TTK).'
);

-- 2.6 gizlilik-politikasi
SELECT pg_temp.upsert_page_tx(
    'gizlilik-politikasi', 'tr',
    'Gizlilik Politikası ve 6698 Sayılı KVKK Aydınlatma Metni',
    $t$<article>
<h2>1. Veri Sorumlusu ve Bağımsız Veri Sorumlusu Tedarikçiler</h2>
<p>Platform üyeliği, ziyaretçi analitiği, sistem güvenliği ve hukuki onay kayıtları kapsamındaki kişisel verileriniz 6698 sayılı Kişisel Verilerin Korunması Kanunu (<strong>"KVKK"</strong>) uyarınca veri sorumlusu sıfatıyla Merter Vitrini tarafından işlenmektedir. Bir Tedarikçi ile ürün sayfası, WhatsApp hattı, B2B canlı sohbet veya doğrudan sipariş formu aracılığıyla paylaştığınız ticari talep, fatura ve iletişim verileri bakımından ilgili <strong>Tedarikçi firma bağımsız veri sorumlusudur</strong>.</p>
<h2>2. İşlenen Kişisel Veriler, Hukuki Onay ve İspat Kayıtları</h2>
<p>Kimlik ve iletişim bilgileri (ad, soyad, unvan, e-posta, telefon), firma/adres/vergi bilgileri, işlem güvenliği kayıtları ile 5651 sayılı Kanun ve 6098 sayılı TBK ispat yükümlülükleri kapsamında elektronik sözleşme ve telif beyanı onay logları (IP adresi, tarih/saat damgası, metin sürümü, tarayıcı bilgisi) işlenmektedir.</p>
<h2>3. İşleme Amaçları ve Saklama Güvenliği</h2>
<p>Verileriniz; B2B üyelik ve tedarikçi portalı erişiminin sağlanması, alıcı-tedarikçi iletişiminin teknik olarak yürütülmesi, bilgi güvenliği ve kötüye kullanımın önlenmesi ile yasal saklama ve yetkili makamlara bildirim yükümlülüklerinin yerine getirilmesi amaçlarıyla işlenir.</p>
<h2>4. KVKK Madde 11 Hakları</h2>
<p>Kişisel verilerinizin işlenip işlenmediğini öğrenme, düzeltilmesini veya silinmesini/hesap kapatılmasını talep etme haklarınızı Platformdaki <strong>/account-deletion</strong> sayfası veya <strong>info@mertervitrini.com.tr</strong> adresi üzerinden kullanabilirsiniz.</p>
</article>$t$,
    'Gizlilik Politikası ve KVKK Aydınlatma Metni | Merter Vitrini',
    'Merter Vitrini B2B gizlilik politikası, 6698 sayılı KVKK aydınlatma metni, bağımsız veri sorumlusu tedarikçiler ve yasal onay logları.'
);

SELECT pg_temp.upsert_page_tx(
    'gizlilik-politikasi', 'en',
    'Privacy Policy & Data Protection Notice (KVKK Law No. 6698)',
    $t$<article>
<h2>1. Data Controller &amp; Suppliers as Independent Data Controllers</h2>
<p>Personal data processed for platform registration, visitor analytics, system security, and legal acceptance logging are controlled by Merter Vitrini pursuant to Turkish Personal Data Protection Law No. 6698 (<strong>"KVKK"</strong>). Commercial order inquiries, invoicing records, and contact information shared directly with a Supplier via WhatsApp, B2B live chat, or order forms are processed by that <strong>Supplier acting as an independent data controller</strong>.</p>
<h2>2. Categories of Processed Data &amp; Legal Audit Logs</h2>
<p>We process identity and contact details (name, company trade name, email, phone), business billing/tax and delivery addresses, security logs, and statutory electronic consent records under Law No. 5651 and Code of Obligations No. 6098 (IP address, cryptographic timestamp, exact text version, and browser metadata).</p>
<h2>3. Purposes of Processing &amp; Legal Retention</h2>
<p>Data is processed strictly to operate B2B member and supplier portals, technically enable buyer–supplier communication, prevent fraud and abuse, and satisfy statutory retention and regulatory reporting duties.</p>
<h2>4. Data Subject Rights Under KVKK Article 11</h2>
<p>You may request access, rectification, account closure, or personal data erasure at any time via our dedicated Self-Service Deletion Center at <strong>/account-deletion</strong> or by emailing <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Privacy Policy & Data Protection (KVKK) | Merter Vitrini',
    'Merter Vitrini privacy policy under Law No. 6698 (KVKK): data controllers, independent suppliers, consent logs, and deletion rights.'
);

SELECT pg_temp.upsert_page_tx(
    'gizlilik-politikasi', 'ru',
    'Политика конфиденциальности и уведомление KVKK (Закон № 6698)',
    $t$<article>
<h2>1. Оператор данных и независимые операторы-поставщики</h2>
<p>Персональные данные в рамках регистрации на платформе, аналитики, безопасности и юридических согласий обрабатываются компанией Merter Vitrini согласно Закону Турецкой Республики № 6698 (<strong>«KVKK»</strong>). Коммерческие запросы, реквизиты счетов и контакты, передаваемые Поставщику через WhatsApp, B2B-чат или форму заказа, обрабатываются этим <strong>Поставщиком как самостоятельным оператором данных</strong>.</p>
<h2>2. Обрабатываемые данные и журналы юридического подтверждения</h2>
<p>Обрабатываются идентификационные и контактные данные (имя, компания, e-mail, телефон), юридический/налоговый адрес, данные безопасности, а также доказательные логи электронных согласий по Закону № 5651 и № 6098 TBK (IP-адрес, метка времени, версия документа, user-agent).</p>
<h2>3. Цели обработки и хранение</h2>
<p>Данные используются для обеспечения работы личного кабинета и портала поставщиков, технической связи между покупателем и продавцом, защиты от мошенничества и исполнения требований законодательства о хранении записей.</p>
<h2>4. Права субъектов данных по ст. 11 KVKK</h2>
<p>Вы можете запросить доступ, исправление, удаление данных или закрытие аккаунта на странице <strong>/account-deletion</strong> либо по адресу <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Политика конфиденциальности и KVKK | Merter Vitrini',
    'Политика защиты персональных данных Merter Vitrini по Закону № 6698 (KVKK), статус поставщиков и порядок удаления аккаунта.'
);

SELECT pg_temp.upsert_page_tx(
    'gizlilik-politikasi', 'ar',
    'سياسة الخصوصية وإشعار حماية البيانات الشخصية (القانون رقم 6698 KVKK)',
    $t$<article dir="rtl">
<h2>1. مراقب البيانات والموردون كمراقبي بيانات مستقلين</h2>
<p>تتولى Merter Vitrini معالجة البيانات الشخصية المتعلقة بالعضوية والأمن السيبراني وسجلات الموافقة القانونية بصفتها مراقب البيانات وفق قانون حماية البيانات الشخصية التركي رقم 6698 (<strong>«KVKK»</strong>). أما بيانات الطلبات والفواتير والتواصل المرسلة إلى مورد عبر الواتساب أو الدردشة الفورية أو نماذج الطلب، فيعالجها <strong>المورد المعني بصفته مراقب بيانات مستقلاً</strong>.</p>
<h2>2. البيانات المعالجة وسجلات الإثبات القانونية</h2>
<p>نعالج بيانات الهوية والاتصال (الاسم، اسم الشركة، البريد الإلكتروني، الهاتف)، والعناوين التجارية والضريبية، وسجلات الأمان، وسجلات الموافقات الإلكترونية المحفوظة وفق القانونين 5651 و6098 (عنوان IP والطابع الزمني ورقم إصدار النص ومعلومات المتصفح).</p>
<h2>3. أغراض المعالجة والاحتفاظ القانوني</h2>
<p>تُستخدم البيانات لتشغيل حسابات المشترين وبوابة الموردين، وتيسير التواصل التجاري تقنياً، ومنع إساءة الاستخدام، والوفاء بمتطلبات الحفظ والإبلاغ القانونية.</p>
<h2>4. حقوقكم بموجب المادة 11 من قانون KVKK</h2>
<p>يمكنكم طلب الاطلاع على بياناتكم أو تصحيحها أو مسحها وإغلاق الحساب في أي وقت عبر صفحة <strong>/account-deletion</strong> أو عبر البريد الإلكتروني <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'سياسة الخصوصية وحماية البيانات KVKK | Merter Vitrini',
    'سياسة الخصوصية وفق القانون التركي 6698 (KVKK)، ومسؤولية الموردين المستقلين عن البيانات، وحقوق حذف الحساب.'
);

SELECT pg_temp.upsert_page_tx(
    'gizlilik-politikasi', 'de',
    'Datenschutzerklärung & Informationspflicht gemäß Gesetz Nr. 6698 (KVKK)',
    $t$<article>
<h2>1. Verantwortlicher &amp; Lieferanten als eigenständige Verantwortliche</h2>
<p>Personenbezogene Daten im Rahmen von Plattform-Registrierung, Systemsicherheit, Analyse und gesetzlichen Einwilligungsprotokollen werden von Merter Vitrini gemäß dem türkischen Datenschutzgesetz Nr. 6698 (<strong>„KVKK“</strong>) verarbeitet. Geschäfts-, Rechnungs- und Kontaktdaten, die Sie per WhatsApp, B2B-Chat oder Bestellformular direkt an einen Lieferanten übermitteln, verantwortet der jeweilige <strong>Lieferant als eigenständiger Datenverantwortlicher</strong>.</p>
<h2>2. Verarbeitete Daten &amp; elektronische Nachweisprotokolle</h2>
<p>Wir verarbeiten Stamm- und Kontaktdaten (Name, Firmenname, E-Mail, Telefon), Geschäfts-/Steuer- und Lieferanschriften, Sicherheitslogs sowie gesetzlich vorgeschriebene Zustimmungsnachweise nach Gesetz Nr. 5651 und TBK Nr. 6098 (IP-Adresse, Zeitstempel, Textversion, Browser-Metadaten).</p>
<h2>3. Verarbeitungszwecke &amp; Aufbewahrung</h2>
<p>Die Verarbeitung dient dem Betrieb von B2B-Kunden- und Lieferantenkonten, der technischen Kontaktanbahnung, Betrugsprävention und der Erfüllung gesetzlicher Aufbewahrungspflichten.</p>
<h2>4. Betroffenenrechte nach Art. 11 KVKK</h2>
<p>Auskunfts-, Berichtigungs- sowie Lösch- und Kontoschließungsanträge können jederzeit über <strong>/account-deletion</strong> oder per E-Mail an <strong>info@mertervitrini.com.tr</strong> gestellt werden.</p>
</article>$t$,
    'Datenschutzerklärung (KVKK Nr. 6698) | Merter Vitrini',
    'Datenschutzhinweise von Merter Vitrini nach Gesetz Nr. 6698 (KVKK), unabhängige Lieferantenverantwortung und Kontolöschung.'
);

SELECT pg_temp.upsert_page_tx(
    'gizlilik-politikasi', 'fr',
    'Politique de Confidentialité & Information RGPD / KVKK (Loi n° 6698)',
    $t$<article>
<h2>1. Responsable du traitement &amp; Fournisseurs responsables indépendants</h2>
<p>Les données personnelles collectées pour l'inscription B2B, la sécurité système, l'analyse et la journalisation des consentements sont traitées par Merter Vitrini conformément à la loi turque n° 6698 (<strong>« KVKK »</strong>). Pour les demandes commerciales, facturations et coordonnées transmises directement à un Fournisseur via WhatsApp, chat B2B ou bon de commande, le <strong>Fournisseur agit comme responsable de traitement indépendant</strong>.</p>
<h2>2. Catégories de données et journaux de preuve électronique</h2>
<p>Nous traitons l'identité et les coordonnées (nom, raison sociale, e-mail, téléphone), les adresses fiscales et de livraison, les logs de sécurité et les preuves légales d'acceptation électronique au titre des lois 5651 et 6098 (adresse IP, horodatage, version du texte, navigateur).</p>
<h2>3. Finalités et conservation légale</h2>
<p>Ces traitements assurent l'accès aux espaces B2B, la mise en relation technique acheteur–fournisseur, la lutte contre la fraude et le respect des obligations légales d'archivage.</p>
<h2>4. Vos droits au titre de l'article 11 de la loi KVKK</h2>
<p>Vous pouvez demander l'accès, la rectification ou la suppression de votre compte et de vos données via la page <strong>/account-deletion</strong> ou par écrit à <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Politique de Confidentialité KVKK | Merter Vitrini',
    'Politique de protection des données Merter Vitrini (Loi 6698 KVKK) : fournisseurs responsables distincts et droits de suppression.'
);

SELECT pg_temp.upsert_page_tx(
    'gizlilik-politikasi', 'pl',
    'Polityka Prywatności i Obowiązek Informacyjny KVKK (Ustawa nr 6698)',
    $t$<article>
<h2>1. Administrator danych oraz Dostawcy jako niezależni administratorzy</h2>
<p>Dane osobowe przetwarzane na potrzeby konta B2B, bezpieczeństwa systemu, analityki i rejestracji zgód prawnych podlegają kontroli Merter Vitrini na mocy tureckiej Ustawy nr 6698 o ochronie danych osobowych (<strong>„KVKK”</strong>). W zakresie zapytań handlowych, danych fakturowych i kontaktowych przekazywanych Dostawcy przez WhatsApp, czat B2B lub formularz zamówienia <strong>Dostawca jest niezależnym administratorem danych</strong>.</p>
<h2>2. Zakres przetwarzanych danych i logi dowodowe</h2>
<p>Przetwarzamy dane identyfikacyjne i kontaktowe (imię, nazwisko, firma, e-mail, telefon), adresy podatkowe i dostawy, logi bezpieczeństwa oraz ustawowe rejestry akceptacji umów wg ustaw nr 5651 i 6098 (adres IP, znacznik czasu, wersja dokumentu, przeglądarka).</p>
<h2>3. Cele przetwarzania i przechowywanie</h2>
<p>Dane przetwarzane są wyłącznie w celu obsługi kont B2B, technicznej komunikacji między kupującym a dostawcą, przeciwdziałania nadużyciom oraz realizacji obowiązków archiwizacyjnych.</p>
<h2>4. Prawa podmiotów danych z art. 11 KVKK</h2>
<p>Wniosek o dostęp, sprostowanie, zamknięcie konta lub usunięcie danych można złożyć na stronie <strong>/account-deletion</strong> albo pisząc na <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Polityka Prywatności KVKK 6698 | Merter Vitrini',
    'Zasady prywatności Merter Vitrini na mocy ustawy 6698 (KVKK), niezależność dostawców oraz procedura usuwania konta.'
);

SELECT pg_temp.upsert_page_tx(
    'gizlilik-politikasi', 'bg',
    'Политика за поверителност и уведомление по KVKK (Закон № 6698)',
    $t$<article>
<h2>1. Администратор на данни и Доставчиците като самостоятелни администратори</h2>
<p>Личните данни за B2B регистрация, сигурност, аналитика и правни съгласия се обработват от Merter Vitrini съгласно турския Закон № 6698 за защита на личните данни (<strong>„KVKK“</strong>). За търговски запитвания, данни за фактуриране и контакти, споделени директно с Доставчик чрез WhatsApp, B2B чат или форма за поръчка, съответният <strong>Доставчик е самостоятелен администратор</strong>.</p>
<h2>2. Обработвани данни и доказателствени логове</h2>
<p>Обработваме идентификационни и контактни данни (име, фирма, имейл, телефон), данъчни и карго адреси, логове за сигурност и електронни потвърждения по Закон № 5651 и TBK № 6098 (IP адрес, времеви печат, версия на текста, браузър).</p>
<h2>3. Цели и законово съхранение</h2>
<p>Данните се обработват за управление на клиентски и доставчески B2B профили, техническа комуникация между купувач и доставчик, превенция на злоупотреби и спазване на законовите срокове.</p>
<h2>4. Права по чл. 11 от KVKK</h2>
<p>Искания за достъп, корекция, закриване на профил или изтриване на данни се подават чрез <strong>/account-deletion</strong> или на имейл <strong>info@mertervitrini.com.tr</strong>.</p>
</article>$t$,
    'Политика за поверителност KVKK | Merter Vitrini',
    'Политика за защита на личните данни на Merter Vitrini по Закон № 6698 (KVKK), самостоятелни доставчици и изтриване на профил.'
);

-- 2.7 mesafeli-satis-sozlesmesi
SELECT pg_temp.upsert_page_tx(
    'mesafeli-satis-sozlesmesi', 'tr',
    'B2B Doğrudan Tedarikçi Sipariş ve Bilgilendirme Metni',
    $t$<article>
<h2>1. Merter Vitrini Satıcı Taraf Değildir (5651 s.K. Madde 5)</h2>
<p><strong>mertervitrini.com.tr</strong> yalnızca 5651 sayılı Kanun kapsamında <strong>"Yer Sağlayıcı"</strong>dır. Platform üzerinden iletilen sepet, sipariş talebi, B2B canlı sohbet veya WhatsApp yönlendirmelerinde alım-satım ilişkisi doğrudan <strong>Alıcı</strong> ile ilgili ürünün sahibi olan <strong>bağımsız Tedarikçi ("Doğrudan Satıcı")</strong> arasında kurulur.</p>
<h2>2. Ticari Satış (B2B) ve Tüketici Mevzuatı İstisnası</h2>
<p>Platformda yalnızca tacirler, butikler ve toptancılar arası (B2B) seri bazlı ticari satış yapıldığından 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği uygulanmaz; kurulan ticari sözleşmeler 6102 sayılı TTK ve 6098 sayılı TBK hükümlerine tabidir.</p>
<h2>3. Ödeme, Fatura, Teslimat ve Uyuşmazlık Muhatabı</h2>
<p>Birim/seri fiyatı teyidi, banka/IBAN veya SWIFT ödemeleri, e-Fatura/ihracat faturası düzenlenmesi, kargo acentesine teslim, gümrükleme ve olası ayıplı mal/iade ihtilaflarında <strong>tek muhatap ve sorumlu doğrudan ilgili Tedarikçi firmadır</strong>. Merter Vitrini aleyhine bu ticari işlemlerden kaynaklı hiçbir mali veya hukuki talep yöneltilemez.</p>
</article>$t$,
    'B2B Doğrudan Tedarikçi Sipariş Çerçeve Metni | Merter Vitrini',
    'B2B doğrudan tedarikçi sipariş esasları: Merter Vitrini satıcı değildir; tüm ticari sözleşmeler alıcı ile tedarikçi arasındadır.'
);

SELECT pg_temp.upsert_page_tx(
    'mesafeli-satis-sozlesmesi', 'en',
    'B2B Direct-Supplier Order & Non-Seller Legal Notice',
    $t$<article>
<h2>1. Merter Vitrini Is Not a Selling Party (Law No. 5651 Art. 5)</h2>
<p><strong>mertervitrini.com.tr</strong> serves strictly as a <strong>"Hosting Provider"</strong> under Turkish Law No. 5651. Whenever an order request, B2B chat message, or WhatsApp inquiry is initiated on the Platform, the commercial sale relationship is established solely between the <strong>Buyer</strong> and the independent <strong>Supplier ("Direct Seller")</strong> identified on the product listing.</p>
<h2>2. Commercial B2B Transactions &amp; Consumer Law Exemption</h2>
<p>Because the Platform strictly facilitates wholesale series transactions between businesses and merchants (B2B), Consumer Protection Law No. 6502 and the Distance Contracts Regulation for retail consumers do not apply; agreements are governed by Turkish Commercial Code No. 6102 (TTK) and Code of Obligations No. 6098 (TBK).</p>
<h2>3. Sole Responsibility for Payment, Invoicing &amp; Fulfillment</h2>
<p>Price confirmation, IBAN/SWIFT bank settlement, export or domestic commercial invoicing, cargo dispatch, customs clearance, and any defect/return dispute rest <strong>exclusively with the direct Supplier</strong>. No financial or contractual claim arising from such trade may be directed against Merter Vitrini.</p>
</article>$t$,
    'B2B Direct-Supplier Order Terms | Merter Vitrini',
    'Legal framework for B2B wholesale orders on Merter Vitrini: direct contracts are strictly between Buyer and independent Supplier.'
);

SELECT pg_temp.upsert_page_tx(
    'mesafeli-satis-sozlesmesi', 'ru',
    'Условия прямого B2B-заказа у поставщика и статус платформы',
    $t$<article>
<h2>1. Merter Vitrini не является продавцом (ст. 5 Закона № 5651)</h2>
<p>Платформа <strong>mertervitrini.com.tr</strong> выступает исключительно как <strong>«Хостинг-провайдер»</strong> по Закону № 5651. При отправке заявки из корзины, через B2B-чат или WhatsApp сделка купли-продажи заключается напрямую между <strong>Покупателем</strong> и независимым <strong>Поставщиком («Прямым продавцом»)</strong>, указанным в карточке товара.</p>
<h2>2. Оптовый B2B-характер и неприменимость Закона № 6502</h2>
<p>Поскольку Платформа предназначена только для оптовых сделок между субъектами предпринимательства, Закон № 6502 о защите прав потребителей и Положение о дистанционной торговле не применяются; действуют Торговый кодекс № 6102 (TTK) и Обязательственный кодекс № 6098 (TBK).</p>
<h2>3. Ответственность по оплате, инвойсам, доставке и спорам</h2>
<p>Подтверждение цены, банковские переводы (IBAN/SWIFT), оформление инвойсов, передача карго, таможня и рассмотрение претензий по браку или возврату возлагаются <strong>исключительно на прямого Поставщика</strong>. Претензии по данным сделкам к Merter Vitrini не применяются.</p>
</article>$t$,
    'Условия прямого заказа B2B | Merter Vitrini',
    'Правовой порядок B2B-заказов: все договоры купли-продажи заключаются напрямую между покупателем и независимым поставщиком.'
);

SELECT pg_temp.upsert_page_tx(
    'mesafeli-satis-sozlesmesi', 'ar',
    'بيان الطلبات المباشرة مع المورد (B2B) وإخلاء صفة البائع',
    $t$<article dir="rtl">
<h2>1. Merter Vitrini ليست طرفاً بائعاً (المادة 5 من القانون 5651)</h2>
<p>تعمل منصة <strong>mertervitrini.com.tr</strong> بصفتها <strong>«مزود استضافة»</strong> فقط بموجب القانون رقم 5651. وعند إرسال طلب سلة أو بدء محادثة B2B أو التواصل عبر واتساب، تنشأ علاقة البيع والشراء مباشرة بين <strong>المشتري</strong> و<strong>المورد المستقل («البائع المباشر»)</strong> المذكور في صفحة المنتج.</p>
<h2>2. الصفقات التجارية (B2B) واستثناء قانون حماية المستهلك</h2>
<p>نظراً لاقتصار المنصة على المبيعات التجارية بالجملة بين الشركات والتجار، لا يسري قانون حماية المستهلك رقم 6502 ولائحة العقود عن بُعد، بل تخضع العقود للقانون التجاري التركي رقم 6102 (TTK) وقانون الالتزامات رقم 6098 (TBK).</p>
<h2>3. المسؤولية الحصرية عن السداد والفوترة والشحن والنزاعات</h2>
<p>تقع مسؤولية تأكيد الأسعار، والتحويل البنكي (IBAN/SWIFT)، وإصدار الفواتير، والتسليم لشركات الشحن، والتخليص الجمركي، وتسوية نزاعات العيوب والإرجاع <strong>حصراً على عاتق المورد المباشر</strong> دون أي مسؤولية على Merter Vitrini.</p>
</article>$t$,
    'بيان طلبات B2B المباشرة مع المورد | Merter Vitrini',
    'الأسس القانونية لطلبات الجملة B2B: جميع عقود البيع تُبرم مباشرة بين المشتري والمورد المستقل.'
);

SELECT pg_temp.upsert_page_tx(
    'mesafeli-satis-sozlesmesi', 'de',
    'B2B-Bestellhinweis & Direktvertrag mit Lieferanten (Nicht-Verkäufer-Erklärung)',
    $t$<article>
<h2>1. Merter Vitrini ist nicht Vertragspartei (Art. 5 Gesetz Nr. 5651)</h2>
<p><strong>mertervitrini.com.tr</strong> handelt ausschließlich als <strong>„Hosting-Provider“</strong> nach Gesetz Nr. 5651. Bei Warenkorbanfragen, B2B-Chats oder WhatsApp-Kontakten entsteht ein Kaufvertrag ausschließlich unmittelbar zwischen dem <strong>Käufer</strong> und dem auf dem Produkt genannten unabhängigen <strong>Lieferanten („Direktverkäufer“)</strong>.</p>
<h2>2. Gewerblicher B2B-Kauf &amp; Ausschluss des Fernabsatz-Verbraucherrechts</h2>
<p>Da ausschließlich gewerblicher Großhandel (Serienpakete) zwischen Unternehmern stattfindet, finden das Verbraucherschutzgesetz Nr. 6502 und die Fernabsatzverordnung keine Anwendung; maßgeblich sind die Art. des türkischen Handelsgesetzbuches Nr. 6102 (TTK) und Nr. 6098 (TBK).</p>
<h2>3. Zahlung, Rechnungsstellung, Lieferung &amp; Mängelansprüche</h2>
<p>Preisbestätigung, IBAN/SWIFT-Zahlungen, Export- und Handelsrechnungen, Frachtübergabe, Verzollung sowie eventuelle Mängel- oder Rückgabestreitigkeiten liegen <strong>allein in der Verantwortung des jeweiligen Direktlieferanten</strong>. Ansprüche gegen Merter Vitrini sind ausgeschlossen.</p>
</article>$t$,
    'B2B-Bestellhinweis & Direktvertrag | Merter Vitrini',
    'Rechtlicher Rahmen für B2B-Bestellungen: Kaufverträge kommen ausschließlich direkt zwischen Käufer und Lieferant zustande.'
);

SELECT pg_temp.upsert_page_tx(
    'mesafeli-satis-sozlesmesi', 'fr',
    'Notice de Commande B2B Directe Fournisseur & Absence de Qualité de Vendeur',
    $t$<article>
<h2>1. Merter Vitrini n'est pas partie vendeuse (Loi n° 5651 art. 5)</h2>
<p>La plateforme <strong>mertervitrini.com.tr</strong> agit exclusivement en qualité d'<strong>« Hébergeur »</strong> au sens de la loi n° 5651. Lors de l'envoi d'une demande de commande, d'un chat B2B ou d'un message WhatsApp, la vente est conclue directement entre l'<strong>Acheteur</strong> et le <strong>Fournisseur indépendant (« Vendeur direct »)</strong> mentionné sur l'article.</p>
<h2>2. Vente commerciale B2B et exclusion du droit de la consommation</h2>
<p>L'activité portant uniquement sur des séries de gros entre commerçants et professionnels, la loi turque n° 6502 sur la protection des consommateurs et la réglementation des contrats à distance ne s'appliquent pas ; les contrats relèvent du TTK n° 6102 et du TBK n° 6098.</p>
<h2>3. Interlocuteur unique pour paiement, facturation et livraison</h2>
<p>La confirmation des tarifs, règlements bancaires (IBAN/SWIFT), facturation, remise au transporteur cargo, dédouanement et réclamations pour défaut ou retour incombent <strong>exclusivement au Fournisseur direct</strong>, à l'exclusion de toute responsabilité de Merter Vitrini.</p>
</article>$t$,
    'Notice de Commande Directe B2B | Merter Vitrini',
    'Cadre juridique des commandes B2B sur Merter Vitrini : les contrats de vente sont conclus directement entre acheteur et fournisseur.'
);

SELECT pg_temp.upsert_page_tx(
    'mesafeli-satis-sozlesmesi', 'pl',
    'Nota Prawna Zamówień B2B i Bezpośrednich Umów z Dostawcą',
    $t$<article>
<h2>1. Merter Vitrini nie jest stroną sprzedającą (Ustawa nr 5651 art. 5)</h2>
<p>Serwis <strong>mertervitrini.com.tr</strong> działa wyłącznie jako <strong>„Dostawca Hostingu”</strong> w rozumieniu ustawy nr 5651. Złożenie zapytania z koszyka, czat B2B lub kontakt przez WhatsApp tworzy relację sprzedaży wyłącznie pomiędzy <strong>Kupującym</strong> a niezależnym <strong>Dostawcą („Sprzedawcą Bezpośrednim”)</strong> wskazanym przy produkcie.</p>
<h2>2. Obrót profesjonalny B2B i wyłączenie ustawy konsumenckiej</h2>
<p>Ponieważ Platforma służy wyłącznie hurtowemu handlowi B2B w seriach między przedsiębiorcami, ustawa nr 6502 o ochronie konsumentów oraz przepisy o umowach konsumenckich zawieranych na odległość nie mają zastosowania; obowiązują TTK nr 6102 i TBK nr 6098.</p>
<h2>3. Wyłączna odpowiedzialność za płatności, faktury i dostawę</h2>
<p>Potwierdzanie cen, przelewy IBAN/SWIFT, wystawianie faktur handlowych, wysyłka cargo, odprawa celna oraz spory reklamacyjne leżą <strong>wyłącznie po stronie sprzedającego Dostawcy</strong>, z wyłączeniem odpowiedzialności Merter Vitrini.</p>
</article>$t$,
    'Warunki Zamówień Bezpośrednich B2B | Merter Vitrini',
    'Podstawy prawne zamówień hurtowych B2B: umowy sprzedaży zawierane są bezpośrednio pomiędzy kupującym a niezależnym dostawcą.'
);

SELECT pg_temp.upsert_page_tx(
    'mesafeli-satis-sozlesmesi', 'bg',
    'Уведомление за директна B2B поръчка към доставчик и липса на качество на продавач',
    $t$<article>
<h2>1. Merter Vitrini не е продавач по сделката (Чл. 5 от Закон № 5651)</h2>
<p><strong>mertervitrini.com.tr</strong> е единствено <strong>„Хостинг доставчик“</strong> по Закон № 5651. При изпращане на поръчка, B2B чат или запитване по WhatsApp договорът за покупко-продажба се сключва директно между <strong>Купувача</strong> и независимия <strong>Доставчик („Директен продавач“)</strong>, посочен към продукта.</p>
<h2>2. Търговска B2B сделка и изключване на потребителските разпоредби</h2>
<p>Тъй като платформата обслужва само търговия на едро в серии между търговци, Закон № 6502 за защита на потребителите и наредбата за дистанционни продажби не се прилагат; договорите се уреждат от TTK № 6102 и TBK № 6098.</p>
<h2>3. Единствена отговорност за плащане, фактури и доставка</h2>
<p>Потвърждаването на цени, банковите преводи (IBAN/SWIFT), фактурирането, карго предаването, митническото оформяне и рекламациите са <strong>изключителна отговорност на директния Доставчик</strong> без отговорност за Merter Vitrini.</p>
</article>$t$,
    'Условия за директни B2B поръчки | Merter Vitrini',
    'Правна рамка за B2B поръчки в Merter Vitrini: договорите за продажба са директно между купувача и независимия доставчик.'
);

-- ============================================================================
-- SECTION 3: BLOG TRANSLATION FIXES (ayzi-tekstil & big-fashion)
-- Fixes raw Turkish fallback rows and machine-translation artifacts across
-- en, ru, ar, de, fr, pl, bg (preserving Markdown structure & localized slugs)
-- ============================================================================

-- 3.1 ayzi-tekstil (en, ru, ar, de, fr, pl, bg)
SELECT pg_temp.upsert_blog_tx(
    'ayzi-tekstil', 'en',
    'AYZI TEKSTİL - Merter Wholesale Women''s Apparel & Textile Manufacturer',
    'Discover the latest wholesale women''s apparel collections, standard size series advantages, and factory-direct B2B ordering opportunities from AYZI TEKSTİL on Merter Vitrini.',
    $t$# AYZI TEKSTİL - Merter Wholesale Women's Apparel & Textile Manufacturer

**Istanbul Merter**, one of the premier ready-to-wear manufacturing hubs in Turkey and globally, is home to established producers shaping seasonal wholesale women's fashion trends. Distinguished by original collections, refined fabric selection, and attentive tailoring, **AYZI TEKSTİL** serves as a dependable supply partner for boutiques, multi-store retailers, and e-commerce brands.

Through **Merter Vitrini**, **AYZI TEKSTİL** connects its current wholesale lineups directly with professional B2B buyers at manufacturer-direct terms.

---

## 1. AYZI TEKSTİL Brand Profile & Production Strength

**AYZI TEKSTİL** combines contemporary international fashion direction with the agile manufacturing capacity of Merter. Quality standards are monitored at every stage from fabric sourcing and pattern ergonomics to final pressing and assortment packaging.

* **Design Direction:** A versatile portfolio covering both everyday urban chic and occasion wear.
* **Fabric & Material Quality:** Breathable viscose, cotton, fluid satin, chiffon, and premium knitwear yarns for autumn/winter drops.
* **Rapid Collection Cycle:** Weekly capsule releases throughout the season help boutiques keep store displays fresh and competitive.

---

## 2. Featured Wholesale Product Categories

Core fast-moving women's wholesale lines in the **AYZI TEKSTİL** catalog include:

1. **Dress Collections:** Everyday midi/maxi dresses, belted shirt dresses, summer linen styles, and evening occasion dresses.
2. **Two-Piece Sets & Blazer Co-ords:** High-demand blazer-and-trouser sets alongside relaxed matched knit/woven sets.
3. **Tops (Blouses, Shirts & Bustiers):** Crisp poplin shirts, detailed blouses, and year-round layering tops.
4. **Knitwear & Cardigan Lines:** Draped autumn-winter cardigans and ribbed knitwear silhouettes.
5. **Bottoms (Skirts & Trousers):** Tailored-fit fabric trousers, pleated skirts, and seasonal palette essentials.

---

## 3. Wholesale Assorted Series (Lots) & Margin Benefits

Maximizing boutique profitability starts with sourcing first-hand inventory without middlemen markups. **AYZI TEKSTİL** supplies factory-direct wholesale conditions on **Merter Vitrini**:

* **Original Series Packing:** Models ship in factory-assorted size packs such as S-M-L or S-M-L-XL.
* **Strong Retail Margins:** Direct manufacturer sourcing supports healthy retail gross margins ranging from 100% to 180%.
* **Accessible Minimum Orders (MOQ):** Flexible series-based ordering lets boutiques test new capsules efficiently while widening assortment variety.

---

## 4. Direct B2B Sourcing via Merter Vitrini

Avoid days of walking crowded wholesale streets or juggling unverified intermediaries. **Merter Vitrini** streamlines wholesale discovery and supplier connection:

* **Verified Manufacturer Identity:** Every participating Merter brand is verified for production continuity and open B2B identity.
* **Insured Door-to-Door Export Support:** Fast domestic dispatch plus customs-supported international cargo delivery across Europe, the Balkans, CIS, Gulf markets, and Africa.
* **Protected Wholesale Pricing:** B2B-gated pricing keeps your wholesale unit cost confidential from retail shoppers.
* **Corporate Invoicing & Flexible Settlement:** Coordinate commercial invoices, bank/SWIFT transfers, and agreed B2B settlement directly with the supplier.

---

## 5. How to Order AYZI TEKSTİL Collections

1. **Browse the Catalog:** Explore the latest **AYZI TEKSTİL** arrivals in the Merter Vitrini wholesale women's apparel section.
2. **Select Your Size Series:** Add assorted size packs matching your customer demographic to your B2B order request.
3. **Confirm Directly with the Supplier:** Complete order confirmation and cargo instructions directly with the supplier's Merter desk for swift dispatch.

Bring **AYZI TEKSTİL** quality to your boutique shelves today by browsing the Merter Vitrini wholesale catalog!$t$,
    'AYZI TEKSTİL Wholesale | Merter Vitrini B2B Collection',
    'AYZI TEKSTİL wholesale women''s apparel collections on Merter Vitrini. Factory-direct pricing, assorted size series, and global B2B delivery.'
);

SELECT pg_temp.upsert_blog_tx(
    'ayzi-tekstil', 'ru',
    'AYZI TEKSTİL — оптовый производитель женской одежды в Мертере',
    'Актуальные коллекции женской одежды AYZI TEKSTİL на оптовом рынке Мертер, закупки размерными рядами и прямые заказы у производителя через Merter Vitrini.',
    $t$# AYZI TEKSTİL — оптовый производитель женской одежды в Мертере

**Стамбул (район Мертер)** — один из ведущих мировых центров производства готовой одежды, где формируются ключевые тренды женской моды. Среди фабрик выделяется бренд **AYZI TEKSTİL**, известный оригинальными лекалами, тщательным подбором тканей и стабильным качеством пошива для бутиков, розничных сетей и онлайн-магазинов.

Через B2B-платформу **Merter Vitrini** коллекции **AYZI TEKSTİL** доступны оптовым покупателям напрямую на фабричных условиях.

---

## 1. Профиль бренда AYZI TEKSTİL и производственные стандарты

**AYZI TEKSTİL** объединяет актуальные мировые тенденции женской моды с гибкими производственными мощностями Мертера. Качество контролируется на каждом этапе — от выбора полотна и точности посадки лекал до влажно-тепловой обработки и упаковки серий.

* **Дизайн и стиль:** Широкий модельный ряд как для повседневного городского гардероба, так и для особых случаев.
* **Ткани и материалы:** Дышащая вискоза, натуральный хлопок, струящийся сатин, шифон и плотный премиальный трикотаж для осенне-зимнего сезона.
* **Быстрое обновление ассортимента:** Регулярные еженедельные капсулы позволяют витринам бутиков оставаться актуальными круглый год.

---

## 2. Ключевые оптовые категории

Наиболее востребованные направления в каталоге **AYZI TEKSTİL**:

1. **Коллекции платьев:** Повседневные миди и макси платья, платья-рубашки с поясом, летние льняные фасоны и нарядные вечерние модели.
2. **Костюмы-двойки и жакеты:** Популярные костюмы с блейзером и брюками, а также комфортные комплекты из трикотажа и ткани.
3. **Верхняя линейка (блузы, рубашки, топы):** Поплиновые рубашки, нарядные блузы и базовые модели на каждый сезон.
4. **Трикотаж и кардиганы:** Струящиеся кардиганы и джемперы в рубчик для прохладных сезонов.
5. **Юбки и брюки:** Брюки комфортной посадки, плиссированные юбки и трендовые оттенки сезона.

---

## 3. Оптовые размерные ряды (серии) и рентабельность

Высокая маржинальность розничной торговли начинается с прямых поставок от производителя без посредников. На **Merter Vitrini** продукция **AYZI TEKSTİL** предлагается на прямых фабричных условиях:

* **Оригинальная серийная упаковка:** Модели поставляются в стандартных размерных рядах (S-M-L или S-M-L-XL).
* **Высокая наценка в рознице:** Закупка напрямую у фабрики обеспечивает потенциальную розничную маржу от 100% до 180%.
* **Удобный минимальный заказ (MOQ):** Гибкая закупка по сериям помогает эффективно распределять бюджет и регулярно обновлять ассортимент.

---

## 4. Безопасные B2B-закупки через Merter Vitrini

Вам больше не нужно тратить дни на поиски оптовиков в Стамбуле или решать логистические сложности в одиночку — **Merter Vitrini** систематизирует весь процесс:

* **Проверенный производитель:** Открытый профиль фабрики с подтвержденным статусом и прямыми контактами.
* **Застрахованная карго-доставка:** Быстрая передача в карго в Стамбуле и международная отправка в страны СНГ, Европы, Балкан, Ближнего Востока и Африки.
* **Конфиденциальность закупочных цен:** Оптовые цены видны только B2B-клиентам, защищая вашу розничную маржу.
* **Официальные инвойсы и оплата:** Прямое согласование коммерческого инвойса, банковского перевода или SWIFT с поставщиком.

---

## 5. Как оформить оптовый заказ AYZI TEKSTİL?

1. **Изучите каталог:** Просмотрите актуальные модели **AYZI TEKSTİL** в разделе оптовой женской одежды на Merter Vitrini.
2. **Выберите размерные серии:** Добавьте нужные линейки в запрос заказа с учетом предпочтений ваших покупателей.
3. **Подтвердите отправку с поставщиком:** Согласуйте оплату и карго-агентство напрямую с представителем бренда для оперативной отгрузки из Мертера.

Откройте каталог **AYZI TEKSTİL** на Merter Vitrini и пополните витрину востребованными моделями уже сегодня!$t$,
    'AYZI TEKSTİL оптом | Merter Vitrini B2B каталог',
    'Оптовые коллекции женской одежды AYZI TEKSTİL из Мертера. Фабричные цены, размерные серии и доставка карго.'
);

SELECT pg_temp.upsert_blog_tx(
    'ayzi-tekstil', 'ar',
    'AYZI TEKSTİL - مُصنّع وتاجر جملة للملابس النسائية في مرتر إسطنبول',
    'استكشف أحدث موديلات الملابس النسائية بالجملة من علامة AYZI TEKSTİL في سوق مرتر، مع مزايا الشراء بنظام السيريات والطلب المباشر من المصنع عبر Merter Vitrini.',
    $t$<div dir="rtl">

# AYZI TEKSTİL - مُصنّع وتاجر جملة للملابس النسائية في مرتر

تُعد منطقة **مرتر في إسطنبول** من أبرز مراكز تصنيع الملابس الجاهزة في تركيا والعالم، وتحتضن نخبة المصانع التي ترسم توجهات الموضة النسائية بالجملة. وتبرز علامة **AYZI TEKSTİL** بتصاميمها المتجددة وخاماتها المختارة بعناية وإتقان خياطتها، لتكون شريك توريد موثوقاً لأصحاب البوتيكات وسلاسل المتاجر ومتاجر التجارة الإلكترونية.

عبر منصة **Merter Vitrini**، نربط تشكيلات **AYZI TEKSTİL** مباشرة بمشتري الجملة حول العالم بشروط المصنع الأصلية.

---

## 1. نبذة عن العلامة التجارية وقوة الإنتاج

تجمع **AYZI TEKSTİL** بين أحدث خطوط الموضة العالمية والقدرة الإنتاجية المرنة لمصانع مرتر، مع مراقبة صارمة للجودة بدءاً من اختيار الأقمشة ودقة القوالب وحتى مراحل الكيّ والتغليف النهائية.

* **خط التصميم:** تشكيلة واسعة تلائم الأناقة اليومية العصرية والمناسبات الخاصة.
* **جودة الأقمشة والخامات:** أقمشة الفسكوز المسامية، والقطن الطبيعي، والساتان الانسيابي، والشيفون، إضافة إلى خيوط التريكو الفاخرة لمواسم الخريف والشتاء.
* **تجدد مستمر للمجموعات:** إطلاق موديلات أسبوعية متجددة يحافظ على جاذبية واجهات البوتيكات طوال الموسم.

---

## 2. أبرز مجموعات المنتجات المتوفرة

أكثر الفئات طلباً وسرعةً في الدوران التجاري ضمن كتالوج **AYZI TEKSTİL**:

1. **مجموعات الفساتين:** فساتين ميدي وماكسي يومية، وفساتين القميص بحزام، وموديلات الكتان الصيفية، وفساتين السهرة والمناسبات.
2. **الأطقم الثنائية والبدلات النسائية:** أطقم البليزر والبنطلون عالية الطلب، والأطقم المنسقة ذات القصّات المريحة.
3. **القطع العلوية (بلوزات وقمصان):** قمصان البوبلين المتقنة، والبلوزات المزخرفة، والتصاميم العملية لجميع الفصول.
4. **مجموعات التريكو والكارديغان:** كارديغانات خريفية وشتوية انسيابية وموديلات تريكو مضلعة فاخرة.
5. **القطع السفلية (بناطيل وتنانير):** بناطيل قماشية بقصات مريحة وتنانير بليسيه بألوان الموسم الرائجة.

---

## 3. نظام السيريات بالجملة ومزايا الربحية للبوتيكات

يرتكز نجاح مبيعات التجزئة على التوريد المباشر من المصدر دون عمولات وسطاء. تُعرض منتجات **AYZI TEKSTİL** عبر **Merter Vitrini** بشروط المصنع مباشرة:

* **تغليف السيري الأصلي:** تُشحن الموديلات داخل طرود مقاسات قياسية مثل S-M-L أو S-M-L-XL.
* **هامش ربح مرتفع:** يتيح التوريد المباشر من المصنع تحقيق هوامش ربح تجزئة مجزية تتراوح بين %100 و%180.
* **مرونة الحد الأدنى للطلب (MOQ):** إمكانية الطلب بعدد سيري مرن لتنويع المعروضات وإدارة ميزانية المتجر بكفاءة.

---

## 4. توريد B2B آمن ومباشر عبر Merter Vitrini

لا داعي لإهدار أيام في البحث الميداني بين متاجر الجملة في مرتر؛ تمنحك منصة **Merter Vitrini** تجربة توريد رقمية متكاملة:

* **هوية مصنّع موثوقة:** تعرض المنصة البيانات التجارية المباشرة للمصنعين المعتمدين بشفافية كاملة.
* **دعم الشحن المؤمّن والتخليص:** توصيل سريع داخل تركيا وشحن دولي عبر شركات الشحن الجوي والبري إلى أوروبا والبلقان ودول الكومنولث والخليج وأفريقيا.
* **حماية أسعار الجملة:** تبقى تكلفة الجملة محمية ضمن بيئة B2B بعيداً عن متناول مستهلكي التجزئة.
* **فوترة تجارية ودفع آمن:** تنسيق الفواتير التجارية والتحويلات البنكية المباشرة أو SWIFT مع المورد.

---

## 5. كيف تطلب منتجات AYZI TEKSTİL بالجملة؟

1. **تصفح الكتالوج:** استعرض أحدث موديلات **AYZI TEKSTİL** في قسم الملابس النسائية بالجملة على Merter Vitrini.
2. **حدد السيريات المطلوبة:** أضف باقات المقاسات المناسبة لجمهور متجرك إلى طلبك.
3. **أكمل التنسيق مباشرة مع المورد:** أكد تفاصيل الدفع وعنوان شركة الشحن مباشرة مع فريق المورد في مرتر للشحن السريع.

ابدأ الآن باستكشاف كتالوج **AYZI TEKSTİL** على Merter Vitrini وارتقِ بتشكيلة متجرك!

</div>$t$,
    'AYZI TEKSTİL بالجملة | كتالوج Merter Vitrini B2B',
    'تشكيلات الملابس النسائية بالجملة من AYZI TEKSTİL عبر Merter Vitrini بأسعار المصنع ونظام السيريات والشحن الدولي.'
);

SELECT pg_temp.upsert_blog_tx(
    'ayzi-tekstil', 'de',
    'AYZI TEKSTİL – Großhandel Damenbekleidung & Textilhersteller in Merter',
    'Entdecken Sie die aktuellen Damenmode-Kollektionen von AYZI TEKSTİL aus Istanbul-Merter: Serienpakete für Boutiquen und Direktbezug vom Hersteller über Merter Vitrini.',
    $t$# AYZI TEKSTİL – Großhandel Damenbekleidung & Textilhersteller in Merter

**Istanbul-Merter** gehört zu den bedeutendsten Bekleidungsproduktionszentren Europas und prägt saisonale Trends im Damenmode-Großhandel. Mit eigenständigen Kollektionen, hochwertiger Stoffauswahl und präziser Verarbeitung gilt **AYZI TEKSTİL** als zuverlässiger Beschaffungspartner für Boutiquen, Modeketten und Onlinehändler.

Über **Merter Vitrini** gelangen die Kollektionen von **AYZI TEKSTİL** ohne Zwischenhändler direkt zu gewerblichen B2B-Einkäufern.

---

## 1. Markenprofil & Produktionskompetenz von AYZI TEKSTİL

**AYZI TEKSTİL** verbindet internationale Modetrends mit der flexiblen Fertigungskraft am Standort Merter. Jeder Arbeitsschritt — von der Stoffprüfung über passgenaue Schnitte bis zur Endkontrolle und Serienverpackung — folgt strengen Qualitätsstandards.

* **Designlinie:** Vielseitige Schnitte für urbanen Alltagslook ebenso wie gehobene Anlassmode.
* **Stoff- & Materialqualität:** Atmungsaktive Viskose, Baumwolle, fließender Satin, Chiffon sowie hochwertige Strickgarne für Herbst und Winter.
* **Schnelle Kollektionszyklen:** Laufend neue Wochenkapseln halten Boutique-Schaufenster stets aktuell.

---

## 2. Gefragte Produktgruppen im Überblick

Zu den umsatzstärksten Warengruppen im Sortiment von **AYZI TEKSTİL** zählen:

1. **Kleiderkollektionen:** Midi- und Maxikleider für den Alltag, gegürtete Hemdblusenkleider, sommerliche Leinenkleider und elegante Abendmodelle.
2. **Zweiteiler & Blazer-Kombinationen:** Stark nachgefragte Blazer-Hosen-Anzüge sowie bequem geschnittene Zweiteiler-Sets.
3. **Oberteile (Blusen, Hemden & Tops):** Sauber verarbeitete Popeline-Hemden und modische Blusen für jede Jahreszeit.
4. **Strick- & Cardigan-Linien:** Fließende Strickjacken und gerippte Pullovermodelle für kühlere Monate.
5. **Unterteile (Röcke & Hosen):** Gut sitzende Stoffhosen und Plisseeröcke in den aktuellen Trendfarben.

---

## 3. Großhandels-Serien (Lots) & Margenvorteile für Boutiquen

Nachhaltige Profitabilität im Modeeinzelhandel entsteht durch den Direktbezug ab Werk. Auf **Merter Vitrini** bietet **AYZI TEKSTİL** transparente B2B-Herstellerkonditionen:

* **Original-Serienverpackung:** Lieferung in sortierten Werksserien (z. B. S-M-L oder S-M-L-XL).
* **Attraktive Handelsspannen:** Durch den direkten Fabrikbezug lassen sich im Einzelhandel Margen von 100 % bis 180 % erzielen.
* **Niedrige Mindestbestellmengen (MOQ):** Flexible Serienbestellungen erleichtern Budgetsteuerung und Sortimentsbreite.

---

## 4. Sicherer B2B-Direkteinkauf über Merter Vitrini

Statt tagelang vor Ort Großhändler abzugehen, steuern Sie Ihren Einkauf digital und effizient über **Merter Vitrini**:

* **Verifizierte Herstellerprofile:** Jede Marke ist mit klarer Unternehmensidentität und direktem Fachkontakt hinterlegt.
* **Cargo- & Exportlogistik:** Schnelle Übergabe an Cargo-Agenturen in Merter sowie zollbegleiteter Versand nach Deutschland, Österreich, in die Schweiz und weltweit.
* **Geschützte B2B-Konditionen:** Großhandelspreise bleiben für Endverbraucher unsichtbar.
* **Ordnungsgemäße Rechnungsstellung:** Direkte Abstimmung von Handelsrechnungen, Bank- oder SWIFT-Überweisungen mit dem Lieferanten.

---

## 5. So bestellen Sie AYZI TEKSTİL im Großhandel

1. **Katalog ansehen:** Entdecken Sie die neuesten Modelle von **AYZI TEKSTİL** in der Damenmode-Großhandelskategorie auf Merter Vitrini.
2. **Serien auswählen:** Legen Sie die zu Ihrer Zielgruppe passenden Größensortimente in Ihre Anfrage.
3. **Direkt mit dem Lieferanten abschließen:** Klären Sie Zahlungs- und Cargo-Details direkt mit dem Ansprechpartner in Merter für den schnellen Versand.

Entdecken Sie jetzt das Sortiment von **AYZI TEKSTİL** im B2B-Showroom von Merter Vitrini!$t$,
    'AYZI TEKSTİL Großhandel | Merter Vitrini B2B Kollektion',
    'Damenmode-Großhandel von AYZI TEKSTİL über Merter Vitrini: Werkspreise, Größensortimente (Serien) und internationaler B2B-Versand.'
);

SELECT pg_temp.upsert_blog_tx(
    'ayzi-tekstil', 'fr',
    'AYZI TEKSTİL – Fabricant & Grossiste Prêt-à-Porter Femme à Merter',
    'Découvrez les dernières collections de prêt-à-porter femme en gros d''AYZI TEKSTİL à Istanbul-Merter : séries de tailles et commandes directes B2B sur Merter Vitrini.',
    $t$# AYZI TEKSTİL – Fabricant & Grossiste Prêt-à-Porter Femme à Merter

**Istanbul-Merter**, l'un des plus importants pôles mondiaux de confection textile, rassemble des fabricants majeurs qui dictent les tendances du prêt-à-porter féminin en gros. Reconnu pour ses créations originales, ses étoffes soigneusement sélectionnées et la qualité de ses finitions, **AYZI TEKSTİL** constitue un partenaire fiable pour les boutiques, chaînes de magasins et sites e-commerce.

Via la plateforme **Merter Vitrini**, **AYZI TEKSTİL** propose ses collections directement aux acheteurs professionnels aux conditions fabricant.

---

## 1. Profil de la marque AYZI TEKSTİL et savoir-faire

**AYZI TEKSTİL** allie tendances internationales actuelles et forte capacité de production à Merter. Chaque détail — choix des matières, ergonomie des coupes, repassage et conditionnement final — répond à des standards rigoureux.

* **Ligne stylistique :** Des modèles variés couvrant le chic urbain quotidien comme les tenues de cérémonie.
* **Qualité des tissus :** Viscose respirante, coton naturel, satin fluide, mousseline et mailles haut de gamme pour l'automne-hiver.
* **Renouvellement rapide :** Des capsules hebdomadaires régulières garantissent une vitrine toujours renouvelée.

---

## 2. Catégories phares du catalogue

Les gammes les plus demandées par les boutiques chez **AYZI TEKSTİL** comprennent :

1. **Collections de robes :** Robes midi et maxi du quotidien, robes chemises ceinturées, modèles d'été en lin et robes habillées.
2. **Ensembles deux pièces & tailleurs :** Ensembles blazer-pantalon très demandés et tenues coordonnées à coupe confortable.
3. **Hauts (blouses, chemises & tops) :** Chemises en popeline soignées et blouses tendance adaptées à chaque saison.
4. **Mailles & cardigans :** Gilets fluides et pulls côtelés incontournables pour la saison froide.
5. **Bas (jupes & pantalons) :** Pantalons en tissu bien coupés et jupes plissées aux coloris de la saison.

---

## 3. Séries de gros (lots) et avantages tarifaires

La rentabilité d'une boutique repose sur l'approvisionnement direct à la source sans intermédiaires. Sur **Merter Vitrini**, **AYZI TEKSTİL** vend aux conditions sortie d'usine :

* **Conditionnement en séries d'origine :** Envoi par lots complets de tailles (par ex. S-M-L ou S-M-L-XL).
* **Marges commerciales élevées :** L'achat direct fabricant offre un potentiel de marge brute au détail compris entre 100 % et 180 %.
* **Seuils minimums flexibles (MOQ) :** Achats par séries permettant de diversifier la boutique tout en maîtrisant la trésorerie.

---

## 4. Approvisionnement B2B sécurisé avec Merter Vitrini

Évitez les déplacements longs et les circuits opaques : **Merter Vitrini** simplifie votre sourcing textile depuis Merter :

* **Fabricant vérifié :** Identité commerciale ouverte et contact direct avec la maison mère à Merter.
* **Logistique cargo & export :** Remise gratuite aux transporteurs de Merter et expédition vers la France, l'Europe, l'Afrique, le Golfe et la CEI.
* **Protection tarifaire B2B :** Vos prix d'achat en gros restent strictement confidentiels vis-à-vis du grand public.
* **Facturation export & virements :** Règlement direct convenu avec le fournisseur par virement bancaire ou SWIFT.

---

## 5. Comment commander les produits AYZI TEKSTİL ?

1. **Parcourez le catalogue :** Consultez les nouveautés **AYZI TEKSTİL** dans la catégorie prêt-à-porter femme en gros sur Merter Vitrini.
2. **Sélectionnez vos séries :** Ajoutez les assortiments de tailles adaptés à votre clientèle.
3. **Finalisez avec le fournisseur :** Confirmez le règlement et votre agence cargo directement avec l'équipe du fournisseur pour une expédition rapide.

Explorez dès maintenant la collection **AYZI TEKSTİL** sur Merter Vitrini pour dynamiser vos ventes !$t$,
    'AYZI TEKSTİL Vente en Gros | Catalogue Merter Vitrini B2B',
    'Prêt-à-porter femme en gros AYZI TEKSTİL à Merter : tarifs directs usine, séries assorties et expédition B2B internationale.'
);

SELECT pg_temp.upsert_blog_tx(
    'ayzi-tekstil', 'pl',
    'AYZI TEKSTİL – Producent i Hurtownia Odzieży Damskiej w Merter',
    'Poznaj najnowsze kolekcje odzieży damskiej marki AYZI TEKSTİL z dzielnicy Merter w Stambule: sprzedaż w seriach rozmiarowych i zamówienia bezpośrednio od producenta na Merter Vitrini.',
    $t$# AYZI TEKSTİL – Producent i Hurtownia Odzieży Damskiej w Merter

**Stambuł (dzielnica Merter)** to jedno z głównych centrów produkcji odzieży gotowej na świecie, wyznaczające trendy w hurcie mody damskiej. Wyróżniająca się autorskimi kolekcjami, starannym doborem tkanin oraz precyzyjnym szyciem marka **AYZI TEKSTİL** stanowi pewnego partnera dla butików, sieci handlowych i sklepów internetowych.

Za pośrednictwem platformy **Merter Vitrini** kolekcje **AYZI TEKSTİL** trafiają bezpośrednio do profesjonalnych kupców B2B na warunkach producenta.

---

## 1. Profil marki AYZI TEKSTİL i standard produkcji

**AYZI TEKSTİL** łączy aktualne światowe trendy w modzie damskiej z nowoczesnym zapleczem produkcyjnym w Merter. Wysoka jakość jest kontrolowana na każdym etapie — od wyboru dzianin i konstrukcji szablonów po prasowanie i pakowanie seryjne.

* **Linia stylistyczna:** Bogaty przekrój fasonów na co dzień, do miasta oraz na wyjątkowe okazje.
* **Jakość tkanin:** Przewiewna wiskoza, bawełna, lejąca satyna, szyfon oraz wysokogatunkowe przędze dzianinowe na sezon jesienno-zimowy.
* **Szybka rotacja kolekcji:** Cotygodniowe minikolekcje sprawiają, że witryna Twojego butiku zawsze wygląda świeżo i atrakcyjnie.

---

## 2. Najpopularniejsze grupy produktowe

Najchętniej zamawiane linie odzieży damskiej w ofercie **AYZI TEKSTİL**:

1. **Kolekcje sukienek:** Sukienki midi i maxi na co dzień, szmizjerki z paskiem, letnie modele lniane oraz sukienki wizytowe.
2. **Komplety dwuczęściowe i garnitury:** Modne zestawy marynarka + spodnie oraz wygodne komplety dzianinowe i tkaninowe.
3. **Góry (bluzki, koszule, topy):** Dopracowane koszule popelinowe oraz modne bluzki na każdą porę roku.
4. **Swetry i kardigany (Triko):** Zwiewne kardigany oraz prążkowane dzianiny na chłodniejsze miesiące.
5. **Doły (spódnice i spodnie):** Spodnie materiałowe o sprawdzonym kroju i plisowane spódnice w kolorach sezonu.

---

## 3. Pakiety seryjne (loty) i korzyści marżowe dla butików

Wysoka rentowność sprzedaży detalicznej opiera się na zakupach z pierwszej ręki bez pośredników. Na **Merter Vitrini** produkty **AYZI TEKSTİL** oferowane są na warunkach fabrycznych:

* **Oryginalne pakowanie seryjne:** Modele wysyłane są w pełnych paczkach rozmiarowych (np. S-M-L lub S-M-L-XL).
* **Wysoka marża detaliczna:** Bezpośrednie zaopatrzenie u producenta pozwala osiągać w detalu marże na poziomie od 100% do 180%.
* **Niskie minimum zamówienia (MOQ):** Elastyczny zakup na serie ułatwia zarządzanie budżetem i poszerzanie asortymentu.

---

## 4. Bezpieczne zaopatrzenie B2B z Merter Vitrini

Nie musisz spędzać wielu dni na szukaniu hurtowników na ulicach Stambułu — **Merter Vitrini** porządkuje zakupy hurtowe online:

* **Zweryfikowany producent:** Jawne dane firmy produkcyjnej oraz bezpośredni kanał komunikacji.
* **Sprawdzona logistyka cargo:** Bezpłatne przekazanie paczek do agencji cargo w Merter i bezpieczny eksport do Polski, Europy, krajów WNP, Zatoki Perskiej i Afryki.
* **Ochrona cen hurtowych:** Ceny B2B pozostają ukryte przed klientami detalicznymi.
* **Faktury i bezpieczne rozliczenia:** Bezpośrednie uzgodnienie faktury handlowej oraz przelewu bankowego lub SWIFT z dostawcą.

---

## 5. Jak zamówić kolekcję AYZI TEKSTİL?

1. **Przejrzyj katalog:** Zobacz najnowsze modele **AYZI TEKSTİL** w kategorii hurtowej odzieży damskiej na Merter Vitrini.
2. **Dobierz serie rozmiarowe:** Dodaj do zapytania komplety dopasowane do profilu klientów Twojego sklepu.
3. **Potwierdź z dostawcą:** Uzgodnij formę płatności oraz agencję cargo bezpośrednio z przedstawicielem marki w Merter w celu sprawnej wysyłki.

Odkryj katalog **AYZI TEKSTİL** na Merter Vitrini i wprowadź do swojej oferty sprawdzone tureckie kolekcje!$t$,
    'AYZI TEKSTİL Hurtownia | Katalog Merter Vitrini B2B',
    'Hurtowe kolekcje odzieży damskiej AYZI TEKSTİL z Merter na Merter Vitrini. Ceny producenta, pakiety seryjne i eksport B2B.'
);

SELECT pg_temp.upsert_blog_tx(
    'ayzi-tekstil', 'bg',
    'AYZI TEKSTİL — производител на дамско облекло на едро в Мертер',
    'Открийте най-новите дамски колекции на едро от AYZI TEKSTİL на текстилния пазар Мертер, предимствата на серийните пакети и директните поръчки в Merter Vitrini.',
    $t$# AYZI TEKSTİL — производител на дамско облекло на едро в Мертер

**Истанбул (квартал Мертер)** е един от водещите световни центрове за производство на готово облекло, където се определят тенденциите в дамската мода на едро. С авторски колекции, прецизно подбрани материи и отлична изработка, **AYZI TEKSTİL** е надежден партньор за бутици, магазинни вериги и онлайн търговци.

Чрез платформата **Merter Vitrini** колекциите на **AYZI TEKSTİL** достигат до професионалните B2B купувачи директно на фабрични условия.

---

## 1. Профил на марката AYZI TEKSTİL и производствен капацитет

**AYZI TEKSTİL** съчетава актуалните световни модни тенденции с гъвкавото производство в Мертер. Качеството се контролира на всяка стъпка — от избора на платове и ергономията на кройките до финалното гладене и серийното пакетиране.

* **Дизайнерска линия:** Богато разнообразие от модели за градското ежедневие и специални поводи.
* **Качество на платовете:** Дишаща вискоза, памук, падащ сатен, шифон и висококачествено трико за есенно-зимния сезон.
* **Бързо обновяване:** Редовни седмични капсулни модели поддържат витрините на бутиците винаги актуални.

---

## 2. Водещи продуктови категории

Най-търсените дамски линии в каталога на **AYZI TEKSTİL**:

1. **Колекции рокли:** Ежедневни миди и макси рокли, рокли-ризи с колан, летни ленени модели и елегантни вечерни рокли.
2. **Комплекти от две части и сака:** Популярни костюми от блейзър и панталон и удобни ежедневни сетове.
3. **Горно облекло (блузи, ризи, топове):** Поплинени ризи с фина изработка и модерни блузи за всеки сезон.
4. **Трико и жилетки:** Меки есенно-зимни жилетки и рипсени трикотажни модели.
5. **Поли и панталони:** Панталони с удобна кройка и плисирани поли в актуалните цветове на сезона.

---

## 3. Серийни пакети на едро и висока рентабилност

Печалбата в търговията на дребно започва с директни доставки от производителя без излишни посредници. В **Merter Vitrini** моделите на **AYZI TEKSTİL** се предлагат директно от фабриката:

* **Оригинални серийни опаковки:** Доставка в стандартни размерни редици (напр. S-M-L или S-M-L-XL).
* **Отличен марж на печалба:** Директното зареждане от производителя позволява търговска надценка на дребно от 100% до 180%.
* **Гъвкав минимален обем (MOQ):** Удобните серийни пакети позволяват прецизно управление на бюджета и богато разнообразие.

---

## 4. Сигурно B2B зареждане с Merter Vitrini

Вече не е нужно да губите дни в обикаляне по улиците на Мертер — **Merter Vitrini** организира целия процес онлайн:

* **Проверен производител:** Открита фирмена информация и директна комуникация с производителя.
* **Карго и международен износ:** Безплатно предаване до карго агенция в Истанбул и доставки към България, Европа, Балканите, ОНД, Близкия изток и Африка.
* **Поверителност на цените:** Цените на едро остават видими само за B2B клиенти.
* **Търговско фактуриране:** Директно уточняване на фактура, банков превод или SWIFT с доставчика.

---

## 5. Как да поръчате от AYZI TEKSTİL?

1. **Разгледайте каталога:** Прегледайте новите модели на **AYZI TEKSTİL** в категорията дамско облекло на едро в Merter Vitrini.
2. **Изберете серии:** Добавете желаните размерни редици към вашата B2B заявка.
3. **Потвърдете с доставчика:** Уточнете плащането и карго адреса директно с екипа на марката в Мертер за бързо изпращане.

Разгледайте каталога на **AYZI TEKSTİL** в Merter Vitrini и обновете магазина си още днес!$t$,
    'AYZI TEKSTİL на едро | B2B каталог Merter Vitrini',
    'Колекции дамско облекло на едро от AYZI TEKSTİL в Мертер чрез Merter Vitrini. Фабрични цени, серийни пакети и карго износ.'
);

-- 3.2 big-fashion (en, ru, ar, de, fr, pl, bg)
SELECT pg_temp.upsert_blog_tx(
    'big-fashion', 'en',
    'BIG FASHION - Merter Wholesale Women''s Apparel & Textile Manufacturer',
    'Explore the latest BIG FASHION wholesale women''s apparel models in Istanbul Merter, standard size series advantages, and factory-direct B2B ordering on Merter Vitrini.',
    $t$# BIG FASHION - Merter Wholesale Women's Apparel & Textile Manufacturer

**Istanbul Merter**, one of the world's leading centers for ready-to-wear garment manufacturing, hosts trendsetting producers driving the wholesale women's fashion sector. Standing out with original styling, selective fabrics, and disciplined tailoring, **BIG FASHION** is a strong and reliable sourcing partner for boutiques, store chains, and online retailers.

On **Merter Vitrini**, **BIG FASHION** collections are presented to wholesale buyers directly with manufacturer advantages and enterprise B2B convenience.

> **Active Collection Note:** BIG FASHION's current seasonal models are actively listed in the Merter Vitrini wholesale catalog with rapid stock dispatch.

---

## 1. BIG FASHION Brand Profile & Production Power

**BIG FASHION** is a dynamic Merter manufacturer blending international women's wear trends with high production agility. Strict quality standards are applied from fabric sourcing and pattern comfort to final steam pressing and assortment packaging.

* **Design Vision:** Broad assortments spanning casual city wear and standout occasion silhouettes.
* **Fabric & Material Standards:** Breathable viscose, cotton, fluid satin, chiffon, and premium knitwear yarns for autumn/winter.
* **Frequent Capsule Drops:** Continuous weekly releases keep boutique displays current throughout the season.

---

## 2. Highlighted Wholesale Product Groups

Fast-selling women's wholesale categories featured in **BIG FASHION** collections include:

1. **Dress Collections:** Daily midi/maxi silhouettes, belted shirt dresses, summer linen lines, and invitation dresses.
2. **Two-Piece Sets & Blazer Outfits:** Best-selling blazer trouser suits alongside relaxed matching two-piece sets.
3. **Tops (Blouses, Shirts & Bustiers):** Refined stitching details, crisp poplin shirts, and multi-season fashion tops.
4. **Knitwear & Cardigan Collections:** Draped cardigans and ribbed knitwear essentials for cooler months.
5. **Bottoms (Skirts & Trousers):** Tailored fabric trousers, pleated skirts, and seasonal trend colors.

---

## 3. Wholesale Size Series (Lots) & Profit Advantages

Sustainable boutique profitability starts with sourcing directly from manufacturers without broker commissions. **BIG FASHION** offers factory-direct B2B conditions via **Merter Vitrini**:

* **Factory Series Packaging:** Shipped in original assorted size packs such as S-M-L or S-M-L-XL.
* **High Retail Profitability:** Manufacturer-direct purchasing unlocks retail margins between 100% and 180%.
* **Flexible Minimum Order (MOQ):** Balanced lot options allow smart inventory budgeting and wide model variety.

---

## 4. Streamlined B2B Supply on Merter Vitrini

Skip days of navigating physical wholesale streets and complex cash logistics. **Merter Vitrini** digitizes your Merter sourcing workflow:

* **Verified Producer Profile:** Participating Merter brands feature open company identities and verified production standing.
* **Insured Export & Door Delivery:** Fast Turkey-wide shipping plus customs-supported international cargo across Europe, the Balkans, CIS, MENA, and Africa.
* **Wholesale Price Confidentiality:** Protected B2B trade infrastructure keeps wholesale prices private from end consumers.
* **Commercial Invoicing & Direct Settlement:** Clear proforma invoicing, wire/SWIFT transfers, and agreed payment schedules directly with the vendor.

---

## 5. How to Order BIG FASHION Collections

1. **Explore the Catalog:** Browse the latest **BIG FASHION** models inside the Merter Vitrini wholesale women's catalog.
2. **Choose Size Assortments:** Add series packs tailored to your store's customer base to your basket request.
3. **Finalize Directly with the Supplier:** Confirm settlement and cargo instructions directly with the supplier's Merter desk for swift dispatch.

Bring **BIG FASHION** craftsmanship into your store today by exploring the Merter Vitrini catalog!$t$,
    'BIG FASHION Wholesale | Merter Vitrini B2B Collection',
    'BIG FASHION wholesale women''s clothing collections from Istanbul Merter on Merter Vitrini. Factory pricing, assorted series, and rapid dispatch.'
);

SELECT pg_temp.upsert_blog_tx(
    'big-fashion', 'ru',
    'BIG FASHION — оптовый производитель женской одежды в Мертере',
    'Актуальные оптовые коллекции женской одежды BIG FASHION в стамбульском Мертере, преимущества серийных закупок и прямые заказы у фабрики на Merter Vitrini.',
    $t$# BIG FASHION — оптовый производитель женской одежды в Мертере

**Стамбул (район Мертер)** — один из главных мировых центров швейного производства, где ведущие фабрики задают тон оптовой женской моде. Выделяющийся актуальными моделями, качественными тканями и точностью кроя бренд **BIG FASHION** служит надежным поставщиком для бутиков, торговых сетей и интернет-магазинов.

Платформа **Merter Vitrini** открывает оптовым закупщикам прямой доступ к коллекциям **BIG FASHION** на фабричных условиях.

> **Актуальное наличие:** Новая сезонная коллекция BIG FASHION уже представлена в каталоге Merter Vitrini с оперативной отгрузкой со склада.

---

## 1. Профиль бренда BIG FASHION и производственная база

**BIG FASHION** — динамичный производитель из Мертера, сочетающий мировые модные тренды с высокой производственной гибкостью. Контроль качества охватывает все этапы: от подбора полотна и эргономики лекал до финальной утюжки и упаковки.

* **Стилевая концепция:** Широкий выбор фасонов для повседневного городского стиля и торжественных выходов.
* **Ткани и материалы:** Дышащая вискоза, хлопок, струящийся сатин, шифон и первоклассный трикотаж для осенне-зимнего сезона.
* **Регулярное обновление:** Еженедельные новинки позволяют бутикам постоянно поддерживать интерес покупателей.

---

## 2. Основные товарные группы

Самые популярные категории женской одежды в каталоге **BIG FASHION**:

1. **Коллекции платьев:** Повседневные платья миди и макси, платья-рубашки с поясом, летние льняные модели и вечерние наряды.
2. **Костюмы-двойки и жакеты:** Востребованные костюмы с блейзерами и брюками, а также стильные комплекты свободного кроя.
3. **Блузы, рубашки и топы:** Поплиновые рубашки, выразительные блузы и базовый верх на любой сезон.
4. **Трикотаж и кардиганы:** Свободные кардиганы и модели в рубчик для прохладной погоды.
5. **Юбки и брюки:** Тканевые брюки комфортной посадки и плиссированные юбки в модной палитре сезона.

---

## 3. Оптовые серии (лоты) и коммерческая выгода

Основа прибыли в ритейле — закупки напрямую у фабрики без посреднических наценок. На **Merter Vitrini** одежда **BIG FASHION** поставляется по прямым заводским ценам:

* **Фабричные размерные ряды:** Отгрузка в оригинальной серийной упаковке S-M-L или S-M-L-XL.
* **Высокая наценка:** Прямые закупки позволяют получать от 100% до 180% розничной наценки.
* **Гибкий минимальный заказ (MOQ):** Возможность формировать заказы сериями под бюджет конкретного бутика.

---

## 4. Удобное B2B-снабжение через Merter Vitrini

Больше не нужно терять время на поиски поставщиков на улицах Мертера — **Merter Vitrini** делает оптовые закупки прозрачными и быстрыми:

* **Проверенный производитель:** Прозрачные профили фабрик с подтвержденным качеством производства.
* **Карго и международная логистика:** Быстрая доставка по Турции и карго-отправка в страны СНГ, Европы, Балкан, Ближнего Востока и Африки.
* **Защита оптовых цен:** Оптовая стоимость скрыта от розничных посетителей.
* **Официальные документы и расчеты:** Прямые инвойсы, банковские и SWIFT-переводы непосредственно поставщику.

---

## 5. Как заказать коллекции BIG FASHION?

1. **Просмотрите каталог:** Изучите свежие модели **BIG FASHION** в женском оптовом разделе на Merter Vitrini.
2. **Выберите серии:** Добавьте нужные размерные линейки в ваш оптовый запрос.
3. **Подтвердите заказ с поставщиком:** Согласуйте оплату и карго-отправку напрямую с отделом продаж в Мертере.

Откройте каталог **BIG FASHION** на Merter Vitrini и обновите ассортимент вашего магазина прямо сейчас!$t$,
    'BIG FASHION оптом | B2B каталог Merter Vitrini',
    'Оптовые коллекции женской одежды BIG FASHION из Мертера на Merter Vitrini. Фабричные цены, размерные серии и быстрая отгрузка.'
);

SELECT pg_temp.upsert_blog_tx(
    'big-fashion', 'ar',
    'BIG FASHION - مُصنّع وتاجر جملة للملابس النسائية في مرتر إسطنبول',
    'أحدث موديلات الملابس النسائية بالجملة من علامة BIG FASHION في سوق مرتر عبر Merter Vitrini، مع مزايا السيريات والشحن السريع مباشرة من المصنع.',
    $t$<div dir="rtl">

# BIG FASHION - مُصنّع وتاجر جملة للملابس النسائية في مرتر

تُعد منطقة **مرتر في إسطنبول** من أهم مراكز إنتاج الملابس الجاهزة في العالم، وتضم أبرز المصانع التي تحدد توجهات الموضة النسائية بالجملة. وتتميز علامة **BIG FASHION** بتصاميمها العصرية وجودة أقمشتها ودقة خياطتها لتكون مصدراً موثوقاً للبوتيكات وسلاسل المتاجر ومتاجر التجارة الإلكترونية.

عبر منصة **Merter Vitrini**، نضع مجموعات **BIG FASHION** بين يدي مشتري الجملة مباشرة بشروط المصنع وبنية B2B احترافية.

> **ملاحظة التشكيلة النشطة:** تتوفر موديلات الموسم الحالية من BIG FASHION بشكل نشط في كتالوج Merter Vitrini بالجملة مع شحن فوري من المخزون.

---

## 1. نبذة عن علامة BIG FASHION وقدراتها الإنتاجية

تجمع **BIG FASHION** بين خطوط الموضة العالمية والقدرة الإنتاجية المتطورة في مرتر، مع تطبيق معايير جودة صارمة في اختيار الأقمشة ودقة القوالب والكي والتغليف النهائي.

* **رؤية التصميم:** تنوع واسع يغطي إطلالات المدينة اليومية وأزياء المناسبات الراقية.
* **جودة الأقمشة:** الفسكوز، والقطن، والساتان الانسيابي، والشيفون، وخيوط التريكو الفاخرة لمواسم الشتاء.
* **تجدد دوري مستمر:** موديلات كبسول أسبوعية تبقي معروضات البوتيك متجددة وجاذبة للعملاء.

---

## 2. الفئات الأكثر طلباً في الكتالوج

1. **الفساتين:** فساتين ميدي وماكسي، وفساتين القميص، وموديلات الكتان الصيفية، وفساتين السهرة.
2. **الأطقم الثنائية والبليزر:** أطقم البليزر والبنطلون عالية الطلب وأطقم متناسقة مريحة.
3. **البلوزات والقمصان:** قمصان بوبلين متقنة وبلوزات أنيقة تلائم كل الفصول.
4. **التريكو والكارديغان:** كارديغانات انسيابية وموديلات تريكو مضلعة للخريف والشتاء.
5. **البناطيل والتنانير:** بناطيل قماشية مريحة وتنانير بليسيه بألوان الموسم الرائجة.

---

## 3. نظام السيريات بالجملة ومزايا الربح

تبدأ ربحية المتاجر من التوريد المباشر من المصانع بدون وسطاء، حيث تقدم **BIG FASHION** عبر **Merter Vitrini**:

* **باقات السيري الأصلية:** شحن في طرود مقاسات قياسية مثل S-M-L أو S-M-L-XL.
* **هوامش ربح مجزية:** إمكانية تحقيق هوامش ربح تجزئة تتراوح بين %100 و%180.
* **حد أدنى مرن للطلب (MOQ):** خيارات شراء سيري تناسب ميزانية وتنوع كل متجر.

---

## 4. توريد B2B آمن عبر Merter Vitrini

* **هوية مصنّع معتمد:** علامات مرتر الموثوقة بهوية تجارية مفتوحة وتواصل مباشر.
* **شحن وتخليص دولي مؤمّن:** توصيل سريع داخل تركيا وشحن دولي نحو الخليج العربي والشرق الأوسط وأوروبا وأفريقيا.
* **حماية أسعار الجملة:** سرية الأسعار التجارية بعيداً عن مستهلكي التجزئة.
* **فواتير رسمية وتحويلات بنكية:** تنسيق الدفع المباشر بالتحويل البنكي أو SWIFT مع المورد.

---

## 5. خطوات الطلب من BIG FASHION

1. **تصفح الكتالوج:** استعرض موديلات **BIG FASHION** في قسم الملابس النسائية بالجملة على Merter Vitrini.
2. **اختر السيريات:** أضف باقات المقاسات المناسبة إلى طلبك.
3. **أكد الطلب مباشرة مع المورد:** نسّق الدفع وشركة الشحن مباشرة مع فريق المورد في مرتر للشحن السريع.

ابدأ الآن باستكشاف تشكيلة **BIG FASHION** في كتالوج Merter Vitrini!

</div>$t$,
    'BIG FASHION بالجملة | كتالوج Merter Vitrini B2B',
    'تشكيلات الملابس النسائية بالجملة من BIG FASHION على Merter Vitrini بأسعار المصنع ونظام السيريات والشحن الفوري.'
);

SELECT pg_temp.upsert_blog_tx(
    'big-fashion', 'de',
    'BIG FASHION – Großhandel Damenbekleidung & Textilhersteller in Merter',
    'Aktuelle Damenmode-Großhandelskollektionen von BIG FASHION in Istanbul-Merter: Serienpakete, attraktive Handelsspannen und schnelle Lieferung über Merter Vitrini.',
    $t$# BIG FASHION – Großhandel Damenbekleidung & Textilhersteller in Merter

**Istanbul-Merter** gehört zu den wichtigsten Zentren der Konfektionsfertigung und vereint führende Hersteller der Damenmodebranche. Durch zeitgemäße Schnitte, sorgfältig gewählte Stoffe und saubere Verarbeitung zählt **BIG FASHION** zu den verlässlichen Großhandelspartnern für Boutiquen, Modeketten und Online-Shops.

Auf **Merter Vitrini** präsentiert **BIG FASHION** seine Kollektionen direkt ab Werk für gewerbliche B2B-Einkäufer.

> **Aktiver Kollektionshinweis:** Die aktuellen Saisonmodelle von BIG FASHION sind live im B2B-Katalog von Merter Vitrini gelistet und kurzfristig ab Lager versandfertig.

---

## 1. Markenprofil & Produktionsstärke von BIG FASHION

**BIG FASHION** verbindet internationale Modeströmungen mit der Leistungsfähigkeit der Merter-Textilproduktion. Vom Stoffeinkauf über die Passform bis zur Endverpackung gelten hohe Qualitätsmaßstäbe.

* **Designprofil:** Breite Auswahl für urbane Alltagsmode und festliche Anlässe.
* **Materialkompetenz:** Atmungsaktive Viskose, Baumwolle, fließender Satin, Chiffon sowie hochwertige Strickwaren für Herbst/Winter.
* **Schnelle Kollektionsfolge:** Laufende Wochenneuheiten halten Boutique-Sortimente stets aktuell.

---

## 2. Gefragte Warengruppen

1. **Kleider:** Midi- und Maxikleider, gegürtete Hemdblusenkleider, Leinenmodelle für den Sommer und festliche Kleider.
2. **Zweiteiler & Blazer-Ensembles:** Beliebte Blazer-Hosen-Kombinationen sowie komfortabel geschnittene Sets.
3. **Oberteile:** Hochwertige Popeline-Hemden und modische Blusen für jede Saison.
4. **Strick & Cardigans:** Fließende Strickjacken und gerippte Pullover für die kühleren Monate.
5. **Röcke & Hosen:** Bequem geschnittene Stoffhosen und Plisseeröcke in Saisonfarben.

---

## 3. Großhandels-Serien & Margenvorteile

* **Original-Serienpakete:** Versand in Werkssortimenten wie S-M-L oder S-M-L-XL.
* **Starke Einzelhandelsmargen:** Direktbezug ermöglicht im Handel Bruttospannen von 100 % bis 180 %.
* **Flexible Mindestabnahme (MOQ):** Serienbasierte Einkaufseinheiten für wirtschaftliche Sortimentsplanung.

---

## 4. Zuverlässiger B2B-Einkauf über Merter Vitrini

* **Verifizierte Herstelleridentität:** Offene Unternehmensprofile und direkter Fachkontakt.
* **Cargo- & Exportversand:** Kostenlose Übergabe an Merter-Cargo-Agenturen und Exportversand nach Europa und weltweit.
* **Geschützte Einkaufspreise:** B2B-Preiskonditionen bleiben für Endkunden verborgen.
* **Handelsrechnung & Überweisung:** Direkte Abstimmung von Proforma, Bank- oder SWIFT-Zahlung mit dem Lieferanten.

---

## 5. So bestellen Sie BIG FASHION im Großhandel

1. **Katalog durchsuchen:** Entdecken Sie **BIG FASHION** in der Damenmode-Kategorie auf Merter Vitrini.
2. **Serien wählen:** Fügen Sie passende Größensortimente Ihrer B2B-Anfrage hinzu.
3. **Direkt abschließen:** Stimmen Sie Zahlung und Versandweg direkt mit dem Lieferanten in Merter ab.

Entdecken Sie jetzt die aktuelle Kollektion von **BIG FASHION** im Katalog von Merter Vitrini!$t$,
    'BIG FASHION Großhandel | Merter Vitrini B2B Kollektion',
    'Damenmode-Großhandel BIG FASHION ab Werk Merter auf Merter Vitrini: Serienpakete, schnelle Lagerlieferung und Exportservice.'
);

SELECT pg_temp.upsert_blog_tx(
    'big-fashion', 'fr',
    'BIG FASHION – Fabricant & Grossiste Prêt-à-Porter Femme à Merter',
    'Découvrez les collections de prêt-à-porter femme en gros BIG FASHION à Istanbul-Merter sur Merter Vitrini : séries assorties, prix usine et expédition rapide.',
    $t$# BIG FASHION – Fabricant & Grossiste Prêt-à-Porter Femme à Merter

**Istanbul-Merter**, haut lieu international de la confection textile, rassemble des fabricants reconnus qui orientent la mode féminine en gros. Appréciée pour ses collections soignées, la qualité de ses tissus et ses finitions précises, la marque **BIG FASHION** accompagne efficacement boutiques, enseignes et vendeurs e-commerce.

Sur **Merter Vitrini**, **BIG FASHION** met ses gammes à disposition des acheteurs B2B directement aux conditions fabricant.

> **Disponibilité active :** Les nouveautés saisonnières de BIG FASHION sont activement référencées sur Merter Vitrini avec préparation rapide depuis le stock.

---

## 1. Profil de BIG FASHION et capacité de production

**BIG FASHION** conjugue tendances internationales et réactivité de production à Merter, avec un contrôle qualité strict à chaque étape de confection.

* **Style :** Une gamme complète pensée pour le prêt-à-porter urbain quotidien comme pour les événements.
* **Matières :** Viscose respirante, coton, satin fluide, mousseline et maille premium pour l'automne-hiver.
* **Nouveautés régulières :** Des lancements hebdomadaires pour dynamiser vos vitrines tout au long de l'année.

---

## 2. Catégories phares

1. **Robes :** Robes midi/maxi, robes chemises ceinturées, lin d'été et modèles de soirée.
2. **Ensembles deux pièces & tailleurs :** Tailleurs blazer-pantalon très demandés et tenues assorties confortables.
3. **Hauts :** Chemises en popeline et blouses actuelles adaptées à toutes les saisons.
4. **Mailles & gilets :** Cardigans fluides et pulls côtelés incontournables en saison fraîche.
5. **Pantalons & jupes :** Pantalons en tissu coupe confort et jupes plissées aux nuances du moment.

---

## 3. Séries en gros & rentabilité boutique

* **Conditionnement en séries d'usine :** Assortiments standards tels que S-M-L ou S-M-L-XL.
* **Marges attractives :** L'achat direct fabricant favorise des marges au détail de 100 % à 180 %.
* **Seuils accessibles (MOQ) :** Souplesse d'achat par série pour optimiser votre budget et diversifier votre offre.

---

## 4. Approvisionnement B2B sur Merter Vitrini

* **Fournisseur identifié :** Profil transparent avec accès direct au fournisseur de Merter.
* **Expédition cargo & export :** Remise au transporteur à Merter et acheminement vers la France, l'Europe et le monde entier.
* **Tarifs B2B confidentiels :** Vos coûts d'achat en gros restent protégés du public.
* **Facturation & règlement direct :** Coordination claire des factures commerciales et virements IBAN/SWIFT avec le fournisseur.

---

## 5. Comment commander BIG FASHION ?

1. **Consultez le catalogue :** Parcourez les modèles **BIG FASHION** sur Merter Vitrini.
2. **Sélectionnez vos séries :** Ajoutez les lots de tailles souhaités à votre demande.
3. **Confirmez avec le fournisseur :** Validez le paiement et l'agence cargo directement auprès du fournisseur à Merter.

Découvrez sans attendre la collection **BIG FASHION** sur Merter Vitrini !$t$,
    'BIG FASHION Vente en Gros | Catalogue Merter Vitrini B2B',
    'Prêt-à-porter femme en gros BIG FASHION à Merter sur Merter Vitrini : prix directs fabricant, séries assorties et envoi rapide.'
);

SELECT pg_temp.upsert_blog_tx(
    'big-fashion', 'pl',
    'BIG FASHION – Producent i Hurtownia Odzieży Damskiej w Merter',
    'Najnowsze hurtowe kolekcje odzieży damskiej BIG FASHION z centrum Merter w Stambule na Merter Vitrini: pakiety seryjne, ceny fabryczne i szybka wysyłka.',
    $t$# BIG FASHION – Producent i Hurtownia Odzieży Damskiej w Merter

**Stambuł (Merter)** to jeden z kluczowych ośrodków produkcji konfekcji na świecie, w którym powstają wiodące kolekcje damskie. Ceniona za autorskie fasony, dobór tkanin i staranne odszycie marka **BIG FASHION** jest solidnym partnerem dla butików, sieci sklepów oraz sprzedawców e-commerce.

Na platformie **Merter Vitrini** oferta **BIG FASHION** dostępna jest bezpośrednio na warunkach producenta B2B.

> **Aktywna kolekcja:** Bieżące modele sezonowe BIG FASHION są stale aktualizowane w katalogu Merter Vitrini z szybką wysyłką z magazynu.

---

## 1. Profil marki BIG FASHION i jakość produkcji

**BIG FASHION** łączy światowe trendy mody damskiej z wysoką wydajnością szwalni w Merter, zachowując kontrolę jakości na każdym etapie szycia i pakowania.

* **Stylistyka:** Szeroka gama modeli miejskich na co dzień oraz fasonów wizytowych.
* **Tkaniny:** Oddychająca wiskoza, bawełna, lejąca satyna, szyfon i wysokogatunkowe dzianiny jesienno-zimowe.
* **Szybka rotacja nowości:** Regularnie wprowadzane kapsuły tygodniowe odświeżają ekspozycję butiku.

---

## 2. Główne grupy produktów

1. **Sukienki:** Codzienne midi i maxi, szmizjerki z paskiem, letnie modele lniane i kreacje okazjonalne.
2. **Komplety dwuczęściowe i garnitury:** Poszukiwane zestawy marynarka ze spodniami oraz wygodne komplety.
3. **Góry:** Popelinowe koszule i modne bluzki dopasowane do każdej pory roku.
4. **Dzianiny i kardigany:** Miękkie narzutki i prążkowane swetry na chłodniejsze sezony.
5. **Spodnie i spódnice:** Dopracowane kroje spodni materiałowych i plisowane spódnice w kolorach sezonu.

---

## 3. Pakiety seryjne i przewaga marżowa

* **Oryginalne pakiety rozmiarowe:** Wysyłka w seriach fabrycznych takich jak S-M-L lub S-M-L-XL.
* **Wysoka marża detaliczna:** Zakup bezpośrednio od producenta zapewnia marżę detaliczną od 100% do 180%.
* **Elastyczne minimum (MOQ):** Możliwość zamawiania całych serii dopasowanych do potrzeb sklepu.

---

## 4. Zakupy B2B na platformie Merter Vitrini

* **Zweryfikowany producent:** Przejrzyste dane firmy i bezpośredni kontakt z dostawcą.
* **Szybkie cargo i eksport:** Dostawa do agencji cargo w Merter oraz wysyłka do Polski, Europy i na rynki międzynarodowe.
* **Ochrona cen hurtowych:** Stawki B2B nie są widoczne dla klientów detalicznych.
* **Faktury eksportowe i rozliczenia:** Bezpośrednie uzgodnienie płatności przelewem lub SWIFT z dostawcą.

---

## 5. Jak zamówić kolekcję BIG FASHION?

1. **Przejrzyj katalog:** Wybierz najnowsze modele **BIG FASHION** w dziale hurtowej odzieży damskiej Merter Vitrini.
2. **Dobierz serie:** Dodaj komplety rozmiarów do swojego zapytania B2B.
3. **Sfinalizuj z dostawcą:** Uzgodnij rozliczenie i wysyłkę cargo bezpośrednio z biurem dostawcy w Merter.

Sprawdź aktualny katalog **BIG FASHION** na Merter Vitrini i poszerz ofertę swojego sklepu!$t$,
    'BIG FASHION Hurtownia | Katalog Merter Vitrini B2B',
    'Hurtowa odzież damska BIG FASHION prosto od producenta z Merter na Merter Vitrini: pakiety seryjne i szybki eksport B2B.'
);

SELECT pg_temp.upsert_blog_tx(
    'big-fashion', 'bg',
    'BIG FASHION — производител на дамско облекло на едро в Мертер',
    'Открийте актуалните дамски колекции на едро от BIG FASHION в Мертер, Истанбул, предимствата на серийните пакети и директните поръчки в Merter Vitrini.',
    $t$# BIG FASHION — производител на дамско облекло на едро в Мертер

**Истанбул (Мертер)** е сред водещите световни центрове за производство на облекло, където се създават тенденциите в дамската мода на едро. Отличаваща се с авторски модели, качествени платове и прецизна изработка, марката **BIG FASHION** е сигурен партньор за бутици, магазинни вериги и онлайн магазини.

В **Merter Vitrini** колекциите на **BIG FASHION** се представят директно от производителя при B2B условия на едро.

> **Актуална колекция:** Новите сезонни модели на BIG FASHION са активни в каталога на Merter Vitrini с бързо изпращане от склад.

---

## 1. Профил на BIG FASHION и производствен капацитет

**BIG FASHION** обединява актуалните световни тенденции в дамската мода с висока производствена дисциплина и строг контрол на качеството на всяка стъпка.

* **Дизайн:** Богат избор от модели за ежедневието и специални поводи.
* **Платове и материали:** Дишаща вискоза, памук, падащ сатен, шифон и висококачествено трико за есен и зима.
* **Редовно обновяване:** Седмични нови попълнения, поддържащи интереса на клиентите.

---

## 2. Водещи продуктови групи

1. **Колекции рокли:** Ежедневни миди и макси рокли, рокли-ризи, летни ленени модели и вечерни рокли.
2. **Комплекти от две части и сака:** Търсени сетове от сако и панталон и удобни ежедневни комбинации.
3. **Горнища (блузи и ризи):** Поплинени ризи и модерни блузи за всички сезони.
4. **Трико и жилетки:** Елегантни жилетки и рипсени трикотажни модели.
5. **Поли и панталони:** Удобни кройки панталони и плисирани поли в актуални цветове.

---

## 3. Серийни пакети и търговска печалба

* **Фабрично пакетиране в серии:** Моделите се доставят в размерни редици като S-M-L или S-M-L-XL.
* **Висока надценка:** Директното зареждане от производителя подпомага търговски марж от 100% до 180%.
* **Гъвкав минимален обем (MOQ):** Удобно поръчване на серии според бюджета на бутика.

---

## 4. Сигурно B2B зареждане през Merter Vitrini

* **Проверен производител:** Прозрачни профили с директни контакти.
* **Международно карго:** Бърза доставка в Турция и износ към България, Европа, ОНД, Близкия изток и Африка.
* **Защитени цени на едро:** B2B тарифите остават поверителни.
* **Търговско фактуриране:** Директно уточняване на фактура, банков превод или SWIFT с доставчика.

---

## 5. Как да поръчате от BIG FASHION?

1. **Разгледайте каталога:** Отворете моделите на **BIG FASHION** в дамската секция на Merter Vitrini.
2. **Изберете серии:** Добавете желаните размерни пакети към вашата заявка.
3. **Потвърдете с доставчика:** Уточнете плащането и карго адреса директно с екипа на производителя в Мертер.

Разгледайте каталога на **BIG FASHION** в Merter Vitrini още днес!$t$,
    'BIG FASHION на едро | B2B каталог Merter Vitrini',
    'Дамско облекло на едро BIG FASHION от Мертер в Merter Vitrini: фабрични цени, серийни пакети и бързо изпращане.'
);

COMMIT;
