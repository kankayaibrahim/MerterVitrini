import os
import sys
from pathlib import Path
import paramiko
import json

scripts_dir = Path(__file__).resolve().parent
from unified_deployer import SERVER_CONFIG, PROJECTS_CONFIG


def get_translations_data():
    return {
        "en": {
            "title": "Merter Wholesale Women's Clothing Sourcing Guide for Boutique Owners",
            "meta_title": "Merter Wholesale Women's Clothing Guide for Boutiques",
            "meta_description": "Comprehensive guide to sourcing wholesale women's clothing from Merter Istanbul for boutiques and e-commerce stores. Factory prices, sizing series, and B2B tips.",
            "summary": "A complete guide for boutique and e-commerce owners on sourcing wholesale women's fashion directly from Istanbul Merter manufacturers, managing sizing series, and maximizing profit margins.",
            "content": """# Merter Wholesale Women's Clothing Sourcing Guide for Boutique Owners

Launching a new women's fashion boutique or expanding your online store on Instagram and e-commerce platforms is one of today's most lucrative business models. However, 80% of success in fashion retail comes down to **"sourcing the right products from the right manufacturers at the most competitive wholesale prices."**

When it comes to wholesale apparel and textiles across Europe and the Middle East, the first manufacturing hub that comes to mind is **Istanbul Merter**. Merter is a global B2B fashion capital housing hundreds of clothing factories, design studios, and direct wholesale manufacturers.

How can a boutique owner start sourcing from Merter? What is the sizing series (pack/lot) system? How do you secure direct factory prices without middlemen while maintaining high profit margins?

In this comprehensive guide, we cover everything you need to transform your boutique into a profitable and sustainable retail business.

---

## 1. Why Source from Merter? The Textile Engine of Europe and the Silk Road

While Istanbul hosts several wholesale districts—such as Osmanbey (high-end formal and evening wear) and Laleli (Eastern Europe and CIS export)—**Merter is the undisputed leader for fast-fashion women's apparel, weekly collection turnovers, and broad styling diversity.**

### Key Advantages of Sourcing from Merter:
* **Rapid Collection Turnover:** Merter factories release fresh collections every week, allowing your boutique to continuously feature the latest trends.
* **Direct Factory Pricing:** By sourcing directly from manufacturers without intermediaries, you obtain primary wholesale prices.
* **Export-Grade Quality Standards:** Factories producing for European, Balkan, and Gulf markets enforce strict fabric selection and stitching quality.

---

## 2. Essential Wholesale Textile Terminology You Must Know

Mastering basic industry terms will help you communicate professionally with suppliers and negotiate efficiently:

### A. What is a Sizing Series (Pack / Lot)?
In wholesale apparel, clothing is sold in pre-packaged **"series"** rather than individual pieces. A series contains the same model and color across a specific size breakdown.
* **Standard 3-Piece Series:** 1x Small, 1x Medium, 1x Large.
* **Standard 4-Piece Series:** 1x Small, 2x Medium, 1x Large (or S-M-L-XL).
* **Plus Size (Battal) Series:** 1x XL, 1x 2XL, 1x 3XL.

> **Pro Tip:** Tailor your series purchases to your audience. If targeting younger demographics, focus on S-M heavy packs; for mature customers, prioritize generous L-XL cuts.

### B. Minimum Order Quantity (MOQ)
The minimum order value or pack count required by a manufacturer. Merter Vitrini keeps MOQ thresholds low and flexible so boutique owners can test diverse collections without freezing large capital.

---

## 3. Top-Selling High-Margin Women's Fashion Categories

Diversifying your inventory minimizes risk and accelerates cash flow. A well-balanced opening collection should include:

### 1. Dresses & Evening Gowns (Highest Profit Margin)
Dresses are the fastest-converting category in women's retail. Viscose summer dresses, satin midi styles, and chiffon gowns serve as your boutique's flagship revenue drivers.
* *Expected Retail Markup:* 100% – 180%

### 2. Knitwear, Sweaters & Cardigans (Fall & Winter Staples)
Lightweight knitwear excels in spring and autumn, while chunky turtlenecks and plush cardigans dominate winter sales. Premium knitwear drives strong repeat-customer loyalty.
* *Expected Retail Markup:* 80% – 130%

### 3. Two-Piece Sets & Blazer Suits (Trend-Driven Favorites)
Coordinated sets (blazer-trouser or knit sets) are bestsellers on Instagram and TikTok because customers love effortless, pre-styled outfits.
* *Expected Retail Markup:* 90% – 150%

### 4. Plus Size (Curvy) Fashion (High Customer Retention)
Finding chic, well-cut plus-size clothing is a frequent customer struggle. Boutiques offering premium plus-size selections build dedicated, long-term buyer communities.
* *Expected Retail Markup:* 100% – 160%

---

## 4. Traditional Physical Market Trips vs. Digital B2B Sourcing

Historically, boutique owners had to travel to Istanbul, spend days navigating crowded wholesale alleys, and transport luggage back home. Today, digital B2B sourcing offers a modern alternative:

* **Time Efficiency:** 15 minutes of online ordering versus 2-3 full days navigating physical markets.
* **Zero Travel Expense:** Eliminates flight, hotel, and meal costs entirely.
* **Price Transparency:** Transparent, standardized B2B prices across thousands of styles.
* **Insured Door-to-Door Delivery:** Tracked international freight directly to your doorstep.
* **Real-Time Catalog:** Browse new factory arrivals daily rather than updating inventory once a month.

---

## 5. How to Avoid Pitfalls and Protect Your Supply Chain

1. **Avoid Low-Quality Middlemen:** Work exclusively with registered B2B platforms that guarantee fabric composition, provide commercial invoices, and verify manufacturer authenticity.
2. **Inspect Fabric Specifications:** Prioritize breathable, comfortable fabrics such as viscose, cotton, linen, and fine knitwear blends over 100% cheap synthetics.
3. **Supply Confidentiality:** Ensure your platform masks supplier identities with private SKU codes, preventing retail customers from bypassing your boutique.

---

## 6. Frequently Asked Questions (B2B FAQ)

### Q1: How much starting capital is needed to open a boutique?
**A:** A small online boutique can launch with $1,000 to $2,500 in wholesale inventory (approx. 12-18 distinct series). For physical brick-and-mortar storefronts, a starting inventory budget of $4,000 to $8,000 is recommended.

### Q2: Can I order single sample pieces from Merter Vitrini?
**A:** Wholesale pricing applies to pre-packed series. However, buyers can order a single pack (e.g. 3-4 pieces) to evaluate fabric, fit, and craftsmanship before placing volume orders.

### Q3: Can I use your product photography on my website and social media?
**A:** Yes. Boutiques ordering through Merter Vitrini receive full rights to use our high-resolution, studio-shot product and model imagery across their own channels.

### Q4: Do you ship internationally across Europe, North America, and the Middle East?
**A:** Absolutely. Merter Vitrini operates global door-to-door express and cargo shipping via DHL, FedEx, UPS, and freight partners with multi-currency checkout.

---

## Grow Your Fashion Boutique with a Trusted Sourcing Partner

In modern fashion retail, success belongs to those who showcase the latest trends first at direct manufacturer prices. Merter Vitrini connects you to Istanbul's top apparel producers under one digital roof.

👉 **Start Today:** [Explore Merter Vitrini Wholesale Women's Clothing Collection](https://mertervitrini.com.tr/en/kadin-giyim)"""
        },
        "ru": {
            "title": "Гид по Оптовым Закупкам Женской Одежды в Мертер для Владельцев Бутиков",
            "meta_title": "Оптовые Закупки Женской Одежды в Мертер Стамбул: Гид для Бутиков",
            "meta_description": "Руководство по оптовым закупкам женской одежды из Мертер Стамбул для бутиков и интернет-магазинов. Фабричные цены, размерные серии, доставка и советы B2B.",
            "summary": "Полное руководство для владельцев бутиков и интернет-магазинов по оптовым закупкам женской одежды напрямую с фабрик Мертер Стамбул, работе с сериями и расчету маржинальности.",
            "content": """# Гид по Оптовым Закупкам Женской Одежды в Мертер для Владельцев Бутиков

Открытие женского бутика или запуск продаж в Instagram и онлайн-магазине — одна из наиболее доходных сфер в современном ритейле. Однако 80% успеха зависит от **"правильного выбора товара, надежного производителя и максимально выгодной оптовой цены."**

Главным центром оптового производства текстиля и одежды в Турции и близлежащих регионах является **Мертер (Стамбул)**. Это крупнейший международный B2B хаб, объединяющий сотни швейных фабрик, дизайн-бюро и прямых поставщиков.

Как начать оптовые закупки в Мертер? Что такое серия (размерный ряд)? Как закупать одежду напрямую от фабрик без посредников и с высокой маржой?

В этом практическом руководстве мы собрали все ключевые шаги для успешного и прибыльного модного бизнеса.

---

## 1. Почему Мертер? Текстильное Сердце Стамбула

В то время как Османбей ориентирован на премиальные вечерние платья, а Лалели — на специфические экспортные партии, **Мертер лидирует по скорости обновления женских коллекций, трендовым фасонам и доступным фабричным ценам.**

### Преимущества поставок из Мертер:
* **Еженедельные Новинки:** Фабрики выпускают свежие модели каждую неделю, позволяя вашему бутику опережать конкурентов.
* **Цены из Первых Рук:** Прямые оптовые цены без комиссий посредников.
* **Экспортное Качество:** Фабрики, поставляющие продукцию в Европу и страны СНГ, придерживаются строгих стандартов кроя и материалов.

---

## 2. Основные Термины Оптовых Закупок

Знание базовых терминов поможет вам свободно и уверенно вести переговоры с турецкими фабриками:

### А. Что Такое Серия (Размерный Ряд / Пачка)?
В оптовой торговле одежда продается не поштучно, а **сериями (упаковками)**. Серия содержит одну и ту же модель одного цвета в разных размерах.
* **Стандартная серия (3 шт.):** 1x S, 1x M, 1x L.
* **Серия из 4 шт.:** 1x S, 2x M, 1x L (или S-M-L-XL).
* **Серия Батал (Большие размеры):** 1x XL, 1x 2XL, 1x 3XL.

> **Совет эксперта:** Выбирайте серии под вашу целевую аудиторию. Для молодежных бутиков оптимальны линейки S-M, для взрослой аудитории — свободные лекала L-XL.

### Б. Минимальный Заказ (MOQ)
Минимальный объем закупки. Merter Vitrini держит порог входа минимальным, чтобы байеры могли тестировать ассортимент без заморозки оборотного капитала.

---

## 3. Самые Прибыльные Категории Женской Одежды

* **Платья и Вечерние Наряды:** Самый быстро продаваемый сегмент с наценкой от 100% до 180%.
* **Трикотаж, Свитера и Кардиганы:** Базовый объем продаж в осенне-зимний период. Качественная вязка гарантирует возвраты покупателей. Наценка: 80% – 130%.
* **Костюмы Двойки и Брючные Комплекты:** Лидеры продаж в соцсетях благодаря готовому образу. Наценка: 90% – 150%.
* **Женская Одежда Больших Размеров (Батал):** Дефицитная и очень лояльная ниша. Наценка: 100% – 160%.

---

## 4. Поездки на Рынок vs Онлайн B2B Закупки

Традиционные закупки с чемоданами и перелетами в Стамбул уходят в прошлое. Merter Vitrini предоставляет:
* Заказ за 15 минут вместо 3 дней поездок.
* Экономия на авиабилетах и гостиницах.
* Прозрачные фиксированные фабричные цены.
* Быстрая доставка карго прямо до дверей с отслеживанием.

---

## 5. Защита от Ошибок при Оптовых Закупках

1. **Проверяйте Состав Ткани:** Отдавайте предпочтение вискозе, хлопку, льну и качественному трикотажу. Избегайте 100% грубой синтетики.
2. **Конфиденциальность Поставщиков:** Работайте через платформы с маскировкой фабрик и защищенными артикулами (SKU), чтобы клиенты не уходили напрямую к производителям.

---

## 6. Частые Вопросы (FAQ)

### Сколько капитала нужно для старта бутика?
Для онлайн-бутика достаточно от $1,000 до $2,500 на закупку первой коллекции (10-15 серий).

### Можно ли заказать образец?
Минимальный заказ — 1 серия (3-4 единицы), что позволяет оценить крой и качество ткани перед крупной партией.

### Предоставляются ли фото для каталога?
Да, все покупатели Merter Vitrini получают право использовать студийные фотосессии в своих магазинах и аккаунтах.

👉 **Начните прямо сейчас:** [Смотреть оптовую коллекцию женской одежды Merter Vitrini](https://mertervitrini.com.tr/ru/kadin-giyim)"""
        },
        "ar": {
            "title": "دليل شراء الملابس النسائية بالجملة من مارتر لأصحاب البوتيكات والمتاجر الإلكترونية",
            "meta_title": "دليل شراء الملابس النسائية بالجملة من مارتر اسطنبول | ميرتر فيتريني",
            "meta_description": "دليل شامل لأصحاب البوتيكات والمتاجر الإلكترونية لشراء الملابس النسائية بالجملة من مارتر اسطنبول مباشرة من المصانع بأسعار الجملة وسيريات المقاسات.",
            "summary": "دليل متكامل لأصحاب البوتيكات حول كيفية استيراد وشراء الملابس النسائية بالجملة مباشرة من مصانع مارتر في اسطنبول، فهم نظام السيريات، وإدارة هوامش الربح.",
            "content": """# دليل شراء الملابس النسائية بالجملة من مارتر لأصحاب البوتيكات والمتاجر الإلكترونية

يُعد إطلاق بوتيك أزياء نسائية أو متجر إلكتروني عبر إنستغرام وتيك توك من أكثر المشاريع ربحية في قطاع التجزئة اليوم. ومع ذلك، فإن 80% من نجاح هذا المشروع يعتمد على **"اختيار المنتجات المناسبة من المصنع المناسب وبأفضل سعر جملة تنافسي."**

وعند الحديث عن صناعة وتجارة الملابس والمنسوجات في تركيا والشرق الأوسط، تتصدر **منطقة مارتر في اسطنبول (Merter)** المشهد كأكبر مركز تجاري B2B يضم مئات المصانع وورش التصميم وموردي الجملة المباشرين.

كيف تبدأ الشراء من مارتر؟ ما هو نظام السيريات (Series / Pack)؟ وكيف تضمن الحصول على أسعار المصنع مباشرة مع تحقيق هوامش ربح مرتفعة؟

في هذا الدليل العملي، نستعرض كل ما تحتاج لمعرفته لإدارة وتطوير بوتيكك بنجاح.

---

## 1. لماذا مارتر اسطنبول؟ قلب صناعة الأزياء الجاهزة

بينما يشتهر حي عثمان بيه بفساتين السهرة الراقية ولالي بأسواق الصادرات المحددة، يُعد **مارتر الخيار الأول والأقوى للأزياء النسائية العصرية وتجدد الموديلات السريع والأسعار المصنعية المنافسة عالمياً.**

### مزايا التوريد من مارتر:
* **تجدد أسبوعي للتشكيلات:** تطرح المصانع موديلات حديثة أسبوعياً لضمان مواكبة متجرك لأحدث صيحات الموضة.
* **أسعار المصنع مباشرة:** بدون وسطاء أو سماسرة، تحصل على السعر الحقيقي الأول.
* **جودة تصديرية قياسية:** تصاميم مخصصة للأسواق الخليجية والأوروبية مع معايير دقيقة في الخياطة ونوعية الأقمشة.

---

## 2. مصطلحات أساسية في تجارة الملابس بالجملة

### أ. ما هو نظام السيرية (Pack / Series)؟
في تجارة الجملة، لا تباع القطع مفردة بل بنظام **"السيرية"**، وهي حزمة تحتوي على نفس الموديل ونفس اللون بتوزيع مقاسات مختلف.
* **سيرية ثلاثية:** 1 سمول، 1 ميديم، 1 لارج.
* **سيرية رباعية:** 1 سمول، 2 ميديم، 1 لارج (أو S-M-L-XL).
* **سيرية المقاسات الكبيرة (بلاس سايز):** 1 XL، 1 2XL، 1 3XL.

### ب. الحد الأدنى للطلب (MOQ)
أقل كمية مقبولة لتنفيذ الطلب. تتيح منصة ميرتر فيتريني إمكانية الشراء بسيريات مرنة تناسب المتاجر الناشئة دون تجميد رؤوس أموال ضخمة.

---

## 3. أكثر أقسام الأزياء النسائية مبيعاً وربحية

* **الفساتين وأزياء السهرة:** أعلى هامش ربح في الأزياء (100% – 180%).
* **التريكو والكنزات الشتوية:** الأساس في موسمي الخريف والشتاء بخامات ناعمة ونسب صوف متوازنة (ربح: 80% – 130%).
* **الأطقم والبدلات النسائية (قطعتين):** الأكثر طلباً في المتاجر الرقمية نظراً لسهولة تنسيقها (ربح: 90% – 150%).
* **المقاسات الكبيرة (Plus Size):** فئة نادرة ومطلوبة جداً تضمن ولاءً مستمراً للزبائن (ربح: 100% – 160%).

---

## 4. السفر التقليدي للتسوق مقابل الشراء الرقمي B2B

توفر لك منصة Merter Vitrini عناء السفر وتكاليف الطيران والفنادق:
* طلب بضائعك خلال دقائق بدلاً من 3 أيام من التجول في الأسواق.
* أسعار جملة شفافة وموحدة من المصانع.
* شحن سريع وباب إلى باب لجميع دول الخليج والدول العربية مع التخليص الجمركي.

---

## 5. الأسئلة الشائعة (FAQ)

### كم رأس المال المطلوب لبدء بوتيك؟
لبوتيك أونلاين يكفي ما بين 1,000 إلى 2,500 دولار أمريكي لتجهيز التشكيلة الأولى (10 إلى 15 سيرية متنوعة).

### هل يمكنني طلب عينة؟
البيع بالجملة يتم بالسيريات، ويمكنك طلب سيرية واحدة فقط (3-4 قطع) لمعاينة الجودة والخامة قبل طلب كميات كبرى.

### هل تتوفر صور احترافية للمنتجات؟
نعم، يحصل جميع عملاء ميرتر فيتريني على حق استخدام صور الموديلات الاحترافية المصورة في الاستوديو مباشرة في متاجرهم.

👉 **ابدأ الآن:** [تصفح تشكيلة الملابس النسائية بالجملة في ميرتر فيتريني](https://mertervitrini.com.tr/ar/kadin-giyim)"""
        },
        "de": {
            "title": "Einkaufsratgeber für Boutiquen: Großhandel Damenbekleidung aus Merter Istanbul",
            "meta_title": "Großhandel Damenmode aus Merter: Ratgeber für Boutiquen | Merter Vitrini",
            "meta_description": "Leitfaden für Boutiquen und Online-Shops zum Einkauf von Großhandel-Damenbekleidung direkt aus Merter Istanbul. Fabrikpreise, Größenserien und B2B-Tipps.",
            "summary": "Ein umfassender Ratgeber für Boutique-Inhaber zum Großeinkauf von Damenmode direkt bei Herstellern in Merter Istanbul, Größenaufteilung und Margenoptimierung.",
            "content": """# Einkaufsratgeber für Boutiquen: Großhandel Damenbekleidung aus Merter Istanbul

Die Eröffnung einer Modeboutique oder der Start eines Online-Shops über Instagram und Web-Plattformen zählt heute zu den rentabelsten Geschäftsmodellen im Einzelhandel. Doch 80 % des Erfolgs hängen von der **"Auswahl der richtigen Produkte beim richtigen Hersteller zu wettbewerbsfähigen Großhandelspreisen"** ab.

Wenn es um Textilproduktion und Damenmode im Großhandel geht, ist **Istanbul Merter** die unangefochtene Drehscheibe Europas. Merter vereint hunderte Fabriken, Designateliers und Direkthersteller unter einem globalen B2B-Dach.

Wie kaufen Boutique-Besitzer in Merter ein? Was bedeutet das Seriensystem (Pack/Lot)? Und wie erzielt man maximale Gewinnspannen ohne Zwischenhändler?

In diesem Leitfaden erfahren Sie alles Wissenswerte für Ihren erfolgreichen Textileinkauf.

---

## 1. Warum Merter? Das textile Herz Istanbuls

Während Stadtteile wie Osmanbey für Haute Couture und Abendkleider bekannt sind, ist **Merter der europäische Marktführer für Fast-Fashion-Damenbekleidung, wöchentlich neue Kollektionen und attraktive Fabrikpreise.**

* **Wöchentliche Kollektionswechsel:** Wöchentlich frische Styles halten Ihr Sortiment stets aktuell.
* **Herstellerpreise aus erster Hand:** Keine Zwischenhändler-Margen, direkte Werkskonditionen.
* **Exportqualität nach EU-Standards:** Hochwertige Verarbeitung und geprüfte Stoffe.

---

## 2. Wichtige Begriffe im B2B-Textilgroßhandel

### A. Was ist eine Größenserie (Pack / Serie)?
Im Textilgroßhandel wird Kleidung nicht einzeln, sondern in **Größenserien** verkauft. Eine Serie umfasst dasselbe Modell in derselben Farbe über verschiedene Konfektionsgrößen hinweg.
* **3er-Serie:** 1x S, 1x M, 1x L.
* **4er-Serie:** 1x S, 2x M, 1x L (oder S-M-L-XL).
* **Plus-Size-Serie:** 1x XL, 1x 2XL, 1x 3XL.

### B. Mindestbestellmenge (MOQ)
Merter Vitrini hält die Mindestbestellwerte flexibel und gering, damit Händler Kollektionen ohne hohes Kapitalrisiko testen können.

---

## 3. Die lukrativsten Produktgruppen für Boutiquen

* **Kleider & Abendmode:** Schnellste Kaufentscheidungen bei Margen von 100 % bis 180 %.
* **Strickwaren & Pullover:** Der Umsatztreiber im Herbst und Winter mit 80 % bis 130 % Spanne.
* **Zweiteiler & Hosenanzüge:** Perfekt für Social-Media-Käufer, da direkt als Gesamtoutfit kombinierbar (Spanne: 90 % bis 150 %).
* **Übergrößen (Plus Size):** Hohe Kundentreue und stark nachgefragte Passformen (Spanne: 100 % bis 160 %).

---

## 4. Häufig gestellte Fragen (FAQ)

### Wie viel Startkapital benötigt man für eine Boutique?
Für einen Online-Shop genügen bereits 1.000 € bis 2.500 € Wareneinsatz für die Erstkollektion.

### Kann man Muster bestellen?
Der Mindestkauf beträgt 1 Serie (3-4 Stück), womit Sie Stoff und Schnitt vor größeren Aufträgen prüfen können.

### Werden professionelle Produktfotos bereitgestellt?
Ja, Kunden von Merter Vitrini dürfen die Studio- und Modelbilder frei für ihren Shop nutzen.

👉 **Jetzt starten:** [Damenbekleidung Kollektion bei Merter Vitrini entdecken](https://mertervitrini.com.tr/de/kadin-giyim)"""
        },
        "fr": {
            "title": "Guide d'Achat en Gros Merter Istanbul : Vêtements Femme pour Boutiques",
            "meta_title": "Guide d'Achat Vêtements Femme en Gros Merter | Merter Vitrini B2B",
            "meta_description": "Guide pour boutiques et e-commerçants : achat de vêtements femme en gros à Merter Istanbul. Prix fabricant, séries de tailles, expédition et astuces B2B.",
            "summary": "Guide complet pour ouvrir ou approvisionner une boutique de mode féminine directement auprès des fabricants de Merter Istanbul : gestion des séries et marges.",
            "content": """# Guide d'Achat en Gros Merter Istanbul : Vêtements Femme pour Boutiques

Ouvrir une boutique de prêt-à-porter féminin ou lancer sa boutique en ligne sur Instagram et le web est une formidable opportunité. Néanmoins, 80 % du succès repose sur **"le choix des bons produits, auprès des bons fabricants, aux prix de gros les plus compétitifs."**

En Turquie et sur le marché international du textile, **Merter (Istanbul)** est la référence absolue. Ce quartier concentre des centaines d'usines textiles, d'ateliers de création et de grossistes directs.

Comment s'approvisionner à Merter ? Que signifie le système de séries de tailles ? Comment sécuriser ses marges sans intermédiaires ?

Découvrez toutes les clés pour réussir vos achats de gros.

---

## 1. Pourquoi choisir Merter Istanbul ?

Tandis qu'Osmanbey est réputé pour les robes de soirée haut de gamme, **Merter domine le marché européen du prêt-à-porter féminin tendance grâce à ses collections renouvelées chaque semaine et ses prix d'usine directs.**

* **Renouvellement hebdomadaire :** De nouveaux modèles chaque semaine pour dynamiser vos ventes.
* **Prix direct usine :** Aucun intermédiaire pour maximiser votre rentabilité.
* **Conformité aux normes européennes :** Finitions soignées et matières sélectionnées avec rigueur.

---

## 2. Le vocabulaire essentiel de la vente en gros

### Qu'est-ce qu'une Série de Tailles (Lot / Pack) ?
En gros, les vêtements sont vendus par **séries** contenant un même modèle et coloris dans différentes tailles (ex. 1x S, 1x M, 1x L).
* **Série 3 pièces :** S - M - L.
* **Série 4 pièces :** S - M - L - XL.
* **Série Grandes Tailles :** XL - 2XL - 3XL.

---

## 3. Les catégories les plus rentables

* **Robes & Tenues de Soirée :** Marge brute de 100 % à 180 %.
* **Pulls & Tricots :** Indispensables en saison automne-hiver (marge 80 % à 130 %).
* **Ensembles 2 pièces & Tailleurs :** Meilleures ventes sur les réseaux sociaux (marge 90 % à 150 %).
* **Grandes Tailles (Plus Size) :** Clientèle très fidèle (marge 100 % à 160 %).

---

## 4. Foire Aux Questions (FAQ)

### Quel budget pour démarrer une boutique ?
Entre 1 000 € et 2 500 € suffisent pour constituer un premier stock de 10 à 15 séries variées.

### Peut-on commander un échantillon ?
Vous pouvez commander une seule série (3-4 pièces) pour tester la qualité avant de passer des commandes en volume.

### Les photos professionnelles sont-elles incluses ?
Oui, vous avez le droit d'utiliser gratuitement l'ensemble des photos studio et mannequins sur vos plateformes de vente.

👉 **Découvrir la collection :** [Vêtements Femme en Gros Merter Vitrini](https://mertervitrini.com.tr/fr/kadin-giyim)"""
        },
        "pl": {
            "title": "Przewodnik Zakupowy w Merter: Hurtownia Odzieży Damskiej dla Właścicieli Butików",
            "meta_title": "Hurtownia Odzieży Damskiej Merter: Przewodnik dla Butików | Merter Vitrini",
            "meta_description": "Przewodnik dla butików i sklepów online po zakupach odzieży damskiej w hurcie z Merter Stambuł. Ceny fabryczne, serie rozmiarowe i porady B2B.",
            "summary": "Kompleksowy poradnik dla właścicieli butików o zaopatrywaniu się w modną odzież damską bezpośrednio u producentów w Merter Stambuł, seriach i marżach.",
            "content": """# Przewodnik Zakupowy w Merter: Hurtownia Odzieży Damskiej dla Właścicieli Butików

Otwarcie butiku z odzieżą damską lub sklepu internetowego na Instagramie to jeden z najbardziej dochodowych pomysłów biznesowych. Kluczem do sukcesu jest **"zakup właściwych ubrań bezpośrednio od producenta w najlepszej cenie hurtowej."**

Europejską i światową stolicą mody hurtowej jest **Merter w Stambule**. To centrum setek fabryk odzieżowych i bezpośrednich producentów.

Jak kupować w Merter? Czym jest seria rozmiarowa? Jak uzyskać najwyższe marże handlowe?

---

## 1. Dlaczego Merter w Stambule?

Merter to bezapelacyjny lider w dziedzinie mody damskiej fast-fashion. Fabryki wprowadzają nowe modele co tydzień, a bezpośrednie ceny producenta eliminują marże pośredników.

---

## 2. Kluczowe pojęcia hurtowe: Czym jest Seria (Paczka)?

Ubrania w hurcie sprzedawane są w **seriach rozmiarowych** (ten sam kolor i model w różnych rozmiarach, np. S-M-L lub S-M-L-XL).

---

## 3. Najbardziej zyskowne kategorie

* **Sukienki:** Marża od 100% do 180%.
* **Swetry i Dzianiny:** Baza sprzedaży jesienno-zimowej (marża 80% - 130%).
* **Komplety i Garnitury:** Hity sprzedaży w mediach społecznościowych (marża 90% - 150%).
* **Plus Size (Duże Rozmiary):** Bardzo lojalna grupa klientek (marża 100% - 160%).

---

## 4. FAQ – Często zadawane pytania

### Jaki kapitał jest potrzebny na start?
Dla butiku online wystarczy od 4 000 zł do 10 000 zł na pierwszą kolekcję.

### Czy mogę zamówić próbkę?
Minimalne zamówienie to 1 seria (3-4 sztuki), co pozwala sprawdzić jakość materiału.

### Czy otrzymam zdjęcia do sklepu?
Tak, wszyscy klienci Merter Vitrini otrzymują prawo do korzystania z profesjonalnych zdjęć studyjnych.

👉 **Sprawdź ofertę:** [Hurtownia Odzieży Damskiej Merter Vitrini](https://mertervitrini.com.tr/pl/kadin-giyim)"""
        },
        "bg": {
            "title": "Наръчник за Закупуване на Едро в Мертер: Дамски Дрехи за Собственици на Бутици",
            "meta_title": "Дамски Дрехи на Едро от Мертер: Наръчник за Бутици | Merter Vitrini",
            "meta_description": "Пълен наръчник за бутици и онлайн магазини за покупка на дамски дрехи на едро от Мертер Истанбул. Фабрични цени, серии размери и B2B съвети.",
            "summary": "Пълен наръчник за собственици на бутици за зареждане на дамска мода на едро директно от производители в Мертер Истанбул, серии и печеливши маржове.",
            "content": """# Наръчник за Закупуване на Едро в Мертер: Дамски Дрехи за Собственици на Бутици

Отварянето на моден дамски бутик или онлайн магазин в Instagram и TikTok е един от най-печелившите бизнеси. 80% от успеха се крие в **"набавянето на правилните модели директно от фабриките на най-конкурентни цени на едро."**

В Турция и региона безспорната столица на текстила на едро е **Мертер (Истанбул)**. Мертер обединява стотици фабрики и директни производители.

---

## 1. Защо Мертер Истанбул?

Мертер предлага най-бързата смяна на колекции, модерни кройки и директни заводски цени без посредници.

---

## 2. Какво представлява Серията (Пакетът)?

На едро дрехите се продават в **серии** (един модел и цвят в различни размери: S-M-L или S-M-L-XL).

---

## 3. Най-продаваните и печеливши категории

* **Рокли и Официални Модели:** Марж от 100% до 180%.
* **Плетива и Жилетки:** Топ категория за есен и зима (марж 80% - 130%).
* **Дамски Комплекти и Костюми:** Любим продукт за онлайн продажби (марж 90% - 150%).
* **Макси Мода (Големи Размери):** Много лоялни клиенти (марж 100% - 160%).

---

## 4. Често задавани въпроси (FAQ)

### Какъв начален капитал е необходим?
За онлайн бутик са достатъчни между 2 000 и 4 000 лв. за първа колекция.

### Мога ли да поръчам мостра?
Минималната поръчка е 1 серия (3-4 броя) за проверка на качеството.

### Предоставяте ли снимки за сайта?
Да, получавате пълни права да ползвате нашите студийни снимки с модели.

👉 **Разгледайте колекцията:** [Дамски Дрехи на Едро в Merter Vitrini](https://mertervitrini.com.tr/bg/kadin-giyim)"""
        }
    }


def publish_all_translations():
    hostname = SERVER_CONFIG.get("hostname", "")
    port = SERVER_CONFIG.get("port", 22)
    username = SERVER_CONFIG.get("username", "root")
    auth_secret = SERVER_CONFIG.get("password", "")
    db_password = os.environ.get("DB_PASSWORD") or PROJECTS_CONFIG.get("unified", {}).get("backend", {}).get("config_template", {}).get("db_password", "DHMwK0Qzyox7")

    slug = "butik-acacaklar-icin-merter-toptan-kadin-giyim-rehberi"
    translations = get_translations_data()

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(hostname, port=port, username=username, password=auth_secret)

    remote_script = "/root/.insert_all_translations.py"
    sftp = ssh.open_sftp()

    # Pass translations as clean json to remote python script
    payload = {
        "slug": slug,
        "db_password": db_password,
        "translations": translations
    }
    remote_data_file = "/root/.translations_payload.json"
    with sftp.file(remote_data_file, "wb") as f:
        f.write(json.dumps(payload, ensure_ascii=False).encode("utf-8"))

    remote_python_code = """# -*- coding: utf-8 -*-
import json
import psycopg2

with open('/root/.translations_payload.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

conn = psycopg2.connect(
    dbname="merterdevdb",
    user="postgres",
    password=data['db_password'],
    host="127.0.0.1",
    port=5432
)
conn.set_client_encoding('UTF8')
cur = conn.cursor()

# Get post ID
cur.execute("SELECT id FROM catalog.blog_posts WHERE slug = %s;", (data['slug'],))
row = cur.fetchone()
if not row:
    print("ERROR: Post slug not found!")
    exit(1)
post_id = row[0]

# Insert all translations
for lang_code, t in data['translations'].items():
    cur.execute('''
        INSERT INTO catalog.blog_post_translations (post_id, language_code, title, summary, content, meta_title, meta_description)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (post_id, language_code) DO UPDATE
        SET title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            content = EXCLUDED.content,
            meta_title = EXCLUDED.meta_title,
            meta_description = EXCLUDED.meta_description;
    ''', (post_id, lang_code, t['title'], t['summary'], t['content'], t['meta_title'], t['meta_description']))
    print(f"Upserted {lang_code}: {t['title'][:40]}...")

conn.commit()

# Verify all languages
cur.execute("SELECT language_code, title FROM catalog.blog_post_translations WHERE post_id = %s ORDER BY language_code;", (post_id,))
rows = cur.fetchall()
print(f"\\nTotal translations in DB for post {post_id}: {len(rows)}")
for r in rows:
    print(f" - [{r[0]}] {r[1]}")

cur.close()
conn.close()
"""
    with sftp.file(remote_script, "wb") as f:
        f.write(remote_python_code.encode("utf-8"))
    sftp.close()

    _, stdout, stderr = ssh.exec_command(f"python3 {remote_script}")
    out = stdout.read().decode("utf-8")
    err = stderr.read().decode("utf-8")
    print("Execution output:\n", out.encode("ascii", "replace").decode("ascii"))
    if err:
        print("Execution stderr:\n", err.encode("ascii", "replace").decode("ascii"))

    ssh.exec_command(f"rm -f {remote_script} {remote_data_file}")
    ssh.close()


if __name__ == "__main__":
    publish_all_translations()
