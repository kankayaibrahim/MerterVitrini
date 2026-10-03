import paramiko
import sys

sys.stdout.reconfigure(encoding='utf-8')

from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts.unified_deployer import SERVER_CONFIG


ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(
    hostname=SERVER_CONFIG['hostname'],
    port=SERVER_CONFIG['port'],
    username=SERVER_CONFIG['username'],
    password=SERVER_CONFIG['password'],
    timeout=15
)

batch_3_articles = [
    {
        "slug": "toptan-tekstilde-seri-ve-asorti-kirma-hatalari",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/seri-asorti.webp",
        "tr": {
            "title": "Seri ve Asorti Kırma: Toptan Giyimde Beden Seçimi Hataları ve Zarardan Korunma",
            "summary": "Toptan tekstilde 'seri bozma' neden yapılmaz? Butiklerin sık yaptığı beden hataları, paket oranlarının önemi ve stok dengeleme formülleri.",
            "meta_title": "Toptan Tekstilde Seri ve Asorti Kırma Hataları | B2B Rehber",
            "meta_description": "Toptan giyimde seri kırma nedir? Toptancılar neden tek beden satmaz? Butikler için seri oranlarını anlama ve beden planlama rehberi.",
            "content": """
<h2>Toptan Ticaretin Temel Kuralı: Seri Bütünlüğü</h2>
<p>Hazır giyim toptancılığında en çok sorulan sorulardan biri şudur: 'Neden sadece S ve M bedenleri alamıyorum da seriyi komple almak zorundayım?' Bu kuralın arkasında tekstil pastal kesim matematiği ve üretim dengesi yatar.</p>

<h3>1. İmalatçı Neden Seri Bozulmasına İzin Vermez?</h3>
<p>Kumaş masaya serildiğinde pastal planı S-M-L-XL beden kalıpları yan yana yerleştirilerek aynı anda motorla kesilir. Üreticiye kalan tekil bedenler satılamaz ve atıl maliyet yaratır.</p>

<h3>2. Butik Beden Planlama Stratejisi</h3>
<ul>
  <li>Müşteri kitleniz genç kadınlar ise S-M ağırlıklı serileri seçin.</li>
  <li>Daha olgun ve anne segmentine hitap ediyorsanız L-XL-XXL oranlı battal serilere yönelin.</li>
</ul>
"""
        },
        "en": {
            "title": "Why Wholesale Apparel is Sold in Series: Size Ratios & Pack Integrity Explained",
            "summary": "Understand apparel manufacturing pack ratios: Why wholesale suppliers sell in pre-packed series and how to optimize retail size allocation.",
            "meta_title": "Wholesale Series & Size Packs Explained | Fashion Sourcing B2B",
            "meta_description": "Why is wholesale clothing sold in packs? Learn the textile manufacturing logic behind size series and how to choose the right ratios for your boutique.",
            "content": """
<h2>The Textile Math Behind Size Packs and Series Ratios</h2>
<p>Wholesale clothing is cut in bulk layers using nested CAD pattern layouts. This standard industry approach ensures the lowest factory manufacturing costs for retailers.</p>
"""
        }
    },
    {
        "slug": "tekstilde-kumas-turleri-ve-kalite-rehberi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/kumas-turleri.webp",
        "tr": {
            "title": "Tekstilde Kumaş Türleri Rehberi: Viskon, Poplin, Tensel, Gabardin ve Scuba Farkları",
            "summary": "Butik sahipleri için kumaş sözlüğü: Doğal lifler, sentetik karışımlar, gramajlar ve hangi modelde hangi kumaşın tercih edilmesi gerektiği.",
            "meta_title": "Kumaş Türleri ve Kalite Rehberi | Tekstil B2B Terimleri",
            "meta_description": "Viskon, poplin, tensel, scuba ve krep kumaşların özellikleri nelerdir? Butik sahipleri için toptan kıyafet alırken dikkat edilecek kumaş rehberi.",
            "content": """
<h2>Kumaşı Bilen Butik Asla Yanılmaz</h2>
<p>Kıyafetin kalitesini belirleyen en kritik unsur dikişten önce kumaştır. Kumaşın tuşesi, dökümü, kırışma direnci ve hava geçirgenliği müşterinin ürünü satın almasında %80 belirleyicidir.</p>

<h3>Temel Kumaş Çeşitleri ve Kullanım Alanları</h3>
<ul>
  <li><strong>Viskon:</strong> Ağaç selülozundan üretilen, pamuktan daha dökümlü ve ipeksi bir dokunuşa sahip doğal lif. Yazlık elbise ve bluzların vazgeçilmezidir.</li>
  <li><strong>Poplin (%100 Pamuk):</strong> Sıkı dokunmuş, tok ve pürüzsüz yapısıyla klasik gömlek ve hacimli elbiselerin ana kumaşıdır.</li>
  <li><strong>Tensel (Lyocell):</strong> Çevre dostu okaliptüs liflerinden üretilen, serinletici etkili, dökümlü ve lüks tuşeli premium kumaş.</li>
  <li><strong>Scuba (Dalgıç Kumaş):</strong> Çift katlı elastik yapısıyla vücudu toparlayan, kırışmayan ve ütü istemeyen modern etek-ceket kumaşı.</li>
  <li><strong>Krep:</strong> Dökümlü ve hafif pürüzlü dokusuyla abiye, palazzo pantolon ve ikili takımların lüks tamamlayıcısı.</li>
</ul>
"""
        },
        "en": {
            "title": "Boutique Fabric Guide: Viscose, Cotton Poplin, Tencel, Scuba & Crepe Differences",
            "summary": "Master clothing fabrics: Natural vs synthetic fibers, weights, drape qualities, and selecting the best textiles for your boutique collections.",
            "meta_title": "Boutique Fabric Types & Textile Guide | Merter Vitrini B2B",
            "meta_description": "Comprehensive fabric guide for clothing retailers: Understand viscose, poplin, tencel, crepe, and scuba fabrics when sourcing wholesale from Turkey.",
            "content": """
<h2>Become a Fabric Expert to Boost Retail Credibility</h2>
<p>Knowing your textiles allows boutique owners to justify price points, accurately answer customer questions, and choose garments that offer superior longevity.</p>
"""
        }
    },
    {
        "slug": "e-ticaret-giyim-magazasi-acma-ve-tedarik-yonetimi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/eticaret-tedarik.webp",
        "tr": {
            "title": "E-Ticaret Giyim Mağazası Açmak: Tedarik, Hızlı Kargo ve Müşteri Sadakati",
            "summary": "Kendi e-ticaret sitesini veya pazar yeri mağazasını (Trendyol, Hepsiburada, Amazon) açmak isteyenler için toptan ürün tedarik stratejisi.",
            "meta_title": "E-Ticaret Giyim Mağazası Açma ve Tedarik Yönetimi | B2B",
            "meta_description": "Online giyim mağazası nasıl açılır? Pazar yerlerinde giyim satışı, Merter'den toptan stok tedariği, kargo entegrasyonu ve iade yönetimi.",
            "content": """
<h2>Dijitalde Büyüyen Moda Perakendeciliği</h2>
<p>E-ticarette giyim kategorisi, Türkiye ve dünyada hacim olarak 1 numaradır. Ancak rekabette öne geçmenin tek yolu hızlı ürün listeleme, doğru beden tablosu ve aynı gün kargolamadır.</p>

<h3>E-Ticaret Başarısının 3 Sacayağı</h3>
<ol>
  <li><strong>Görsel Kalitesi:</strong> Müşteri ürüne dokunamadığı için stüdyo ortamında çekilmiş net manken fotoğrafları ve kumaş detay çekimleri olmazsa olmazdır.</li>
  <li><strong>Hızlı Tedarik ve Stok Senkronizasyonu:</strong> Sattığınız ürünün toptancıda anında bulunabilir olması iptal oranlarını düşürür.</li>
  <li><strong>Şeffaf Beden Ölçüleri:</strong> Göğüs, bel, basen ve boy ölçülerini ürün açıklamasına yazmak e-ticaret iade oranını %40'tan %12'ye düşürür.</li>
</ol>
"""
        },
        "en": {
            "title": "Launching an Online Fashion Store: Inventory Sourcing, Shipping & Retention",
            "summary": "Blueprint for opening a profitable online fashion boutique: Sourcing apparel, high-converting product pages, and returns management.",
            "meta_title": "How to Launch an Online Clothing Store | E-Commerce B2B",
            "meta_description": "Step-by-step guide to starting an e-commerce clothing brand: Direct apparel sourcing from Turkey, fast fulfillment, and reducing fashion returns.",
            "content": """
<h2>Win at Online Fashion E-Commerce</h2>
<p>Scaling a fashion e-commerce storefront requires high-conversion photography, transparent sizing charts, and agile B2B restocking from reliable suppliers.</p>
"""
        }
    },
    {
        "slug": "turkiyeden-avrupaya-toptan-giyim-ihracati-atr",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/avrupa-ihracat.webp",
        "tr": {
            "title": "Türkiye'den Avrupa'ya Toptan Giyim İhracatı: ATR Dolaşım Belgesi ve Gümrüksüz İthalat",
            "summary": "Almanya, Fransa, Hollanda ve tüm AB ülkelerine tekstil ihracatı: ATR belgesiyle sıfır gümrük vergisi, mikro ihracat (ETGB) ve B2B kargo süreçleri.",
            "meta_title": "Türkiye'den Avrupa'ya Toptan Giyim İhracatı ve ATR Belgesi | B2B",
            "meta_description": "Türkiye'den AB ülkelerine toptan giyim ihracatı nasıl yapılır? ATR dolaşım belgesi ile %0 gümrük vergisi avantajı ve kapıya teslim kargo rehberi.",
            "content": """
<h2>Avrupa Birliği ile Türkiye Arasındaki Gümrük Birliği Avantajı</h2>
<p>Türkiye ile Avrupa Birliği arasındaki Gümrük Birliği anlaşması sayesinde Türk menşeli sanayi ve tekstil ürünleri Avrupa'ya <strong>gümrük vergisiz (%0 gümrük)</strong> giriş yapar. Bu durum Türk tekstilini Çin ve Bangladeş'e karşı rakipsiz bir lojistik ve maliyet avantajına taşır.</p>

<h3>1. ATR Dolaşım Belgesi Nedir?</h3>
<p>ATR belgesi, ürünün Türkiye'de serbest dolaşımda olduğunu kanıtlayan ve Avrupalı alıcının gümrük vergisi ödemesini engelleyen resmi belgedir. Merter Vitrini üzerinden verilen toptan ihracat siparişlerinde ATR ve ihracat faturası eksiksiz hazırlanır.</p>

<h3>2. Mikro İhracat (ETGB) ile Kolay Gönderim</h3>
<p>15.000 Euro ve 300 kg'a kadar olan toptan siparişler, gümrük müşavirliği masrafı olmadan Elektronik Ticaret Gümrük Beyannamesi (ETGB) ile 48-72 saatte kapıya teslim edilir.</p>
"""
        },
        "en": {
            "title": "Wholesale Clothing Export from Turkey to Europe: ATR Certificate & Duty-Free Access",
            "summary": "How European boutiques import wholesale Turkish fashion duty-free under the EU-Turkey Customs Union using ATR certificates.",
            "meta_title": "Export Wholesale Clothing Turkey to EU | ATR Certificate B2B",
            "meta_description": "Import wholesale apparel from Turkey to Germany, France, and the EU with 0% customs duty. Complete guide on ATR certificates, VAT, and express transit.",
            "content": """
<h2>0% Customs Duty Advantage Under the EU-Turkey Customs Union</h2>
<p>Thanks to the longstanding Customs Union between Turkey and the European Union, industrial manufactured garments enter the EU with 0% customs import duty when accompanied by an ATR Movement Certificate.</p>
"""
        }
    },
    {
        "slug": "rusya-ve-bdt-ulkelerine-toptan-tekstil-kargo",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/rusya-kargo.webp",
        "tr": {
            "title": "Rusya, Kazakistan ve BDT Ülkelerine Toptan Tekstil Gönderimi: Beyaz Kargo ve Gümrükleme",
            "summary": "Rusya ve Bağımsız Devletler Topluluğu pazarına hazır giyim ihracatı: Anlaşmalı karayolu/havayolu kargo firmaları, EAC sertifikası ve güvenli teslimat.",
            "meta_title": "Rusya ve BDT Ülkelerine Toptan Tekstil Kargo | B2B Lojistik",
            "meta_description": "Türkiye'den Rusya, Kazakistan, Özbekistan ve Azerbaycan'a toptan tekstil gönderimi nasıl yapılır? Güvenilir kargo firmaları ve gümrükleme rehberi.",
            "content": """
<h2>Geleneksel ve Güçlü Pazar: Rusya ve BDT Coğrafyası</h2>
<p>İstanbul tekstil piyasasının onlarca yıllık en büyük ticari partnerlerinden biri Rusya, Kazakistan, Kırgızistan, Özbekistan ve Azerbaycan'dır. Türk giyim tarzı, kalıpları ve kumaş kalitesi bu ülkelerdeki tüketiciler için bir prestij simgesidir.</p>

<h3>1. Kargo ve Lojistik Kanalları</h3>
<ul>
  <li><strong>Karayolu Kargo (TIR):</strong> 10-14 gün teslim süresi, uygun tonaj maliyeti ve gümrük dahil kapıya teslim seçeneği.</li>
  <li><strong>Havayolu Express Kargo:</strong> 3-5 iş günü içinde Moskova, Almatı veya Taşkent havalimanı teslimi.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Clothing Shipping to Russia, Kazakhstan & CIS Countries",
            "summary": "B2B shipping and customs clearance guide for exporting Turkish wholesale apparel to Russia, Kazakhstan, Uzbekistan, and CIS markets.",
            "meta_title": "Shipping Wholesale Apparel Turkey to Russia & CIS | B2B Cargo",
            "meta_description": "How to ship wholesale clothes from Istanbul to Russia, Kazakhstan, and CIS countries. Door-to-door cargo services, documentation, and transit times.",
            "content": """
<h2>Decades of Trust: Turkish Textile Dominance in the CIS</h2>
<p>Russian and Central Asian fashion consumers revere Turkish apparel for its superior cotton knitwear, contemporary European styling, and durable fabrication.</p>
"""
        }
    },
    {
        "slug": "korfez-ve-arap-ulkelerine-toptan-giyim-ihracati",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/korfez-ihracat.webp",
        "tr": {
            "title": "Körfez Ülkelerine (Suudi Arabistan, BAE, Kuveyt) Toptan Giyim İhracatı Rehberi",
            "summary": "Orta Doğu pazarına toptan kadın giyim satışı: SASO ve SABER sertifikaları, hafif nefes alan kumaş talebi ve ekspres hava kargo süreçleri.",
            "meta_title": "Körfez ve Arap Ülkelerine Toptan Giyim İhracatı | B2B Rehber",
            "meta_description": "Suudi Arabistan, Dubai (BAE), Kuveyt ve Katar'a toptan tekstil ihracatı: SABER platformu, menşe şahadetnamesi ve Körfez pazarının en çok satan modelleri.",
            "content": """
<h2>Yüksek Alım Gücüne Sahip Pazar: Körfez Ülkeleri</h2>
<p>Suudi Arabistan, Birleşik Arap Emirlikleri (Dubai), Kuveyt, Katar ve Umman; Türk hazır giyim üreticileri için yüksek sepet ortalamasına sahip en karlı pazarlardandır.</p>

<h3>1. Körfez Pazarında En Çok Satan Ürünler</h3>
<ul>
  <li>Sıcak iklim nedeniyle nefes alan, dökümlü krinkle şifon ve keten ikili takımlar.</li>
  <li>Taş, dantel ve altın varak işlemeli şık abiyeler ve feraceler.</li>
  <li>Zarif renklerde dökümlü maksi elbiseler.</li>
</ul>
"""
        },
        "en": {
            "title": "Exporting Wholesale Fashion to the Gulf: Saudi Arabia, UAE & Kuwait",
            "summary": "Comprehensive guide for shipping wholesale apparel from Istanbul to GCC markets: SABER compliance, lightweight fabrics, and air cargo.",
            "meta_title": "Export Wholesale Clothes Turkey to Gulf & Middle East | B2B",
            "meta_description": "How to export wholesale clothing from Turkey to Saudi Arabia, UAE, Kuwait, and Qatar. SABER compliance, Certificates of Origin, and top-selling styles.",
            "content": """
<h2>Lucrative Sourcing for the High-Income Middle East Market</h2>
<p>Boutiques and retail department stores across Riyadh, Dubai, and Kuwait rely heavily on Turkish fashion producers for premium lightweight fabrics and elegant modest designs.</p>
"""
        }
    },
    {
        "slug": "balkan-ulkelerine-toptan-tekstil-ihracati",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/balkan-ihracat.webp",
        "tr": {
            "title": "Balkan Ülkelerine (Romanya, Bulgaristan, Sırbistan) Toptan Tekstil Tedariği",
            "summary": "Karayoluyla 24-48 saat mesafede olan Balkanlar'a toptan hazır giyim satışı: Hızlı transit süreleri, düşük navlun maliyetleri ve serili sipariş kolaylığı.",
            "meta_title": "Balkan Ülkelerine Toptan Tekstil İhracatı | Merter B2B",
            "meta_description": "Romanya, Bulgaristan, Yunanistan ve Sırbistan'a toptan giyim ihracatı nasıl yapılır? Karayolu ile 24 saatte hızlı teslimat ve gümrüksüz ticaret fırsatları.",
            "content": """
<h2>Türkiye'nin Kapı Komşuları: Balkanlar Pazarı</h2>
<p>Balkan ülkeleri (Bulgaristan, Romanya, Yunanistan, Sırbistan, Bosna-Hersek, Kuzey Makedonya), coğrafi yakınlıkları sayesinde Türk hazır giyimini iç piyasa hızında temin edebilmektedir. İstanbul'dan çıkan bir kargo ertesi gün Bükreş veya Sofya'da teslim edilebilmektedir.</p>

<h3>Balkan Pazarının Avantajları</h3>
<ul>
  <li>Çok düşük kargo/navlun maliyetleri.</li>
  <li>Avrupa Birliği üyesi ülkelere (Bulgaristan, Romanya, Yunanistan) ATR belgesiyle gümrüksüz giriş.</li>
  <li>Türk beden ölçüleri ve moda zevkinin Balkan tüketicisiyle %100 örtüşmesi.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Clothing Supply to the Balkans: Romania, Bulgaria & Serbia",
            "summary": "Next-day road transit and zero-customs trading for wholesale fashion buyers across Romania, Bulgaria, Greece, and Serbia.",
            "meta_title": "Wholesale Clothing Turkey to Balkans | Fast Road Transit B2B",
            "meta_description": "Source wholesale apparel from Istanbul to the Balkans with 24 to 48-hour road freight. Duty-free trading under ATR documentation for EU members.",
            "content": """
<h2>Fast-Track Sourcing for Southeastern European Boutiques</h2>
<p>Balkan fashion retailers benefit from unbeatable geographic proximity to Istanbul, receiving weekly new season drops with freight costs dramatically lower than air transit.</p>
"""
        }
    },
    {
        "slug": "afrika-pazarina-toptan-hazir-giyim-tedarigi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/afrika-ihracat.webp",
        "tr": {
            "title": "Afrika Pazarına Toptan Hazır Giyim Satışı: Nijerya, Kenya ve Gana İhracat Taktikleri",
            "summary": "Dünyanın en hızlı büyüyen genç nüfusuna sahip Afrika pazarına tekstil ihracatı: Canlı renkler, dayanıklı pamuklu kumaşlar ve konsolidasyon kargoları.",
            "meta_title": "Afrika Pazarına Toptan Hazır Giyim Satışı | Merter Vitrini B2B",
            "meta_description": "Nijerya, Kenya, Gana ve Güney Afrika'ya toptan Türk tekstili ihracatı: En çok satan renk ve modeller, havayolu kargo ve B2B ödeme yöntemleri.",
            "content": """
<h2>Geleceğin Dev Pazarı: Afrika Kıtası</h2>
<p>Nijerya, Kenya, Gana, Senegal ve Güney Afrika gibi dinamik ekonomilerde orta sınıfın büyümesiyle birlikte kaliteli Türk giyimine olan talep patlama yaşamaktadır. Çin mallarının düşük kalitesinden uzaklaşan Afrikalı tüccarlar, kalitesiyle tanınan Merter giyimini tercih etmektedir.</p>

<h3>Öne Çıkan Nitelikler</h3>
<ul>
  <li>Canlı renkler: Fuşya, saks mavisi, zümrüt yeşili ve sarı tonları.</li>
  <li>Hava alan dayanıklı pamuklu ve likralı dokumalar.</li>
  <li>İstanbul Atatürk ve Sabiha Gökçen havalimanlarından doğrudan kargo uçuşları.</li>
</ul>
"""
        },
        "en": {
            "title": "Exporting Wholesale Turkish Apparel to Africa: Nigeria, Kenya & Ghana",
            "summary": "How African fashion retailers source high-quality ready-to-wear clothing from Istanbul with consolidated air cargo and secure payment options.",
            "meta_title": "Export Wholesale Apparel to Africa | Nigeria, Kenya & Ghana B2B",
            "meta_description": "Source wholesale fashion from Turkey to Africa. Door-to-door cargo to Lagos, Nairobi, and Accra with premium Turkish cotton fabrication.",
            "content": """
<h2>Why African Boutiques are Switching to Turkish Fashion</h2>
<p>Retailers across Lagos, Nairobi, and Accra are increasingly turning away from disposable fast fashion in favor of durable, vibrant, and premium Turkish garments.</p>
"""
        }
    },
    {
        "slug": "toptan-giyimde-guvenli-b2b-odeme-yontemleri",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/guvenli-odeme.webp",
        "tr": {
            "title": "Toptan Giyimde Güvenli B2B Ödeme Yöntemleri: Akreditif, Kredi Kartı ve SWIFT",
            "summary": "Uluslararası ve yerli toptan alışverişlerde finansal güvenliği sağlama: 3D Secure kredi kartı, banka havalesi (SWIFT), akreditif ve emanet hesap güvencesi.",
            "meta_title": "Toptan Giyimde Güvenli B2B Ödeme Yöntemleri | Merter B2B",
            "meta_description": "Toptan giyim alırken dolandırıcılıktan nasıl korunulur? B2B kredi kartı ile taksitli ödeme, uluslararası SWIFT havale ve akreditif prosedürleri.",
            "content": """
<h2>B2B Ticarette Finansal Güvenliğin Önemi</h2>
<p>Büyük tutarlı toptan alımlarda en büyük endişe parayı gönderdikten sonra ürünlerin gelmemesi veya taahhüt edilen kalitede olmamasıdır. Merter Vitrini, kurumsal altyapısıyla her iki tarafı da güvenceye alan modern ödeme sistemleri sunar.</p>

<h3>Güvenli Ödeme Seçenekleri</h3>
<ul>
  <li><strong>3D Secure B2B Kredi Kartı:</strong> Kurumsal kredi kartlarıyla anında, güvenli ve taksit imkanıyla sipariş verme rahatlığı.</li>
  <li><strong>Banka Havalesi / EFT / SWIFT:</strong> Resmi şirket hesapları üzerinden doğrudan faturalı ödeme.</li>
  <li><strong>Akreditif (Letter of Credit - L/C):</strong> Büyük hacimli konteyner bazlı siparişlerde banka garantili ödeme yöntemi.</li>
</ul>
"""
        },
        "en": {
            "title": "Secure B2B Payment Methods for Wholesale Apparel: Cards, SWIFT & L/C",
            "summary": "Safeguard your capital when buying wholesale fashion internationally: Corporate credit cards, SWIFT wire transfers, and Letters of Credit.",
            "meta_title": "Secure B2B Payment Methods for Wholesale Fashion | Merter B2B",
            "meta_description": "Protect your capital in wholesale textile trading: 3D Secure corporate card payments, international SWIFT bank transfers, and verified invoicing.",
            "content": """
<h2>Financial Security in Cross-Border Fashion Sourcing</h2>
<p>Merter Vitrini utilizes enterprise-grade payment gateways, encrypted escrow handling, and transparent commercial invoicing so global buyers can purchase with absolute confidence.</p>
"""
        }
    },
    {
        "slug": "b2b-e-ticaret-ile-fiziksel-alisveris-karsilastirmasi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/dijital-b2b.webp",
        "tr": {
            "title": "Toptan Giyimde Online B2B Platformları vs Fiziksel Toptancı Gezisi: Zaman ve Maliyet Analizi",
            "summary": "Uçak bileti, otel ve bavul taşıma derdi olmadan dijitalden toptan alım yapmanın butik sahiplerine sağladığı maliyet ve hız avantajları.",
            "meta_title": "Online B2B vs Fiziksel Toptancı Gezisi | Zaman ve Maliyet Analizi",
            "meta_description": "Merter'e fiziksel gitmek mi, Merter Vitrini'nden online toptan sipariş vermek mi daha karlı? Uçak, otel, zaman ve nakit akışı maliyet kıyaslaması.",
            "content": """
<h2>Geleneksel Alışveriş Tarihe Karışıyor</h2>
<p>Eskiden bir butik sahibi her 3 haftada bir İstanbul'a gelmek, otel rezervasyonu yapmak, Merter sokaklarında saatlerce yürüyüp nakit parayla koli taşımak zorundaydı. Bu süreç mağazayı günlerce sahipsiz bırakırken binlerce liralık seyahat masrafı yaratıyordu.</p>

<h3>Rakamlarla Karşılaştırma</h3>
<table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
  <thead>
    <tr style="background: #f4f4f4;">
      <th>Kriter</th>
      <th>Fiziksel Toptancı Ziyareti</th>
      <th>Merter Vitrini Online B2B</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td><strong>Ulaşım & Konaklama Masrafı</strong></td>
      <td>15.000 TL - 30.000 TL (Uçak + Otel + Yemek)</td>
      <td><strong>0 TL</strong></td>
    </tr>
    <tr>
      <td><strong>Harcanan Zaman</strong></td>
      <td>2 - 4 tam iş günü</td>
      <td><strong>15 dakika</strong></td>
    </tr>
    <tr>
      <td><strong>Fiyat Şeffaflığı</strong></td>
      <td>Yüze göre pazarlık, değişken fiyat</td>
      <td><strong>Sabit, doğrudan fabrika fiyatı</strong></td>
    </tr>
    <tr>
      <td><strong>Ödeme Kolaylığı</strong></td>
      <td>Genellikle sadece nakit</td>
      <td><strong>Kredi kartı, taksit, havale, fatura</strong></td>
    </tr>
  </tbody>
</table>
"""
        },
        "en": {
            "title": "Online B2B Wholesale Platforms vs Physical Sourcing Trips: Cost & ROI Analysis",
            "summary": "Detailed ROI analysis: How boutique owners save thousands in flights and hotels by ordering directly through verified digital B2B portals.",
            "meta_title": "Digital B2B vs Physical Sourcing Trips | Fashion ROI Analysis",
            "meta_description": "Compare physical showroom shopping in Istanbul with digital B2B sourcing via Merter Vitrini. Eliminate travel costs, save time, and restock weekly.",
            "content": """
<h2>The Modern Boutique Playbook: Digital-First Sourcing</h2>
<p>By cutting unnecessary flight, hotel, and showroom transit expenses, fashion retail entrepreneurs can reinvest thousands of dollars directly into fast-selling inventory.</p>
"""
        }
    }
]

# Insert batch 3
print(f"Inserting Batch 3 ({len(batch_3_articles)} articles)...")
for art in batch_3_articles:
    slug = art["slug"]
    cover = art["cover_image"]
    
    post_sql = f"""
    INSERT INTO catalog.blog_posts (id, slug, cover_image, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), '{slug}', '{cover}', true, NOW(), NOW())
    ON CONFLICT (slug) DO UPDATE 
    SET cover_image = EXCLUDED.cover_image, is_active = true, updated_at = NOW()
    RETURNING id;
    """
    
    stdin, stdout, stderr = ssh.exec_command(f'sudo -u postgres psql -d merterdevdb -t -c "{post_sql}"')
    post_id = stdout.read().decode('utf-8').strip()
    if not post_id:
        stdin, stdout, stderr = ssh.exec_command(f"sudo -u postgres psql -d merterdevdb -t -c \"SELECT id FROM catalog.blog_posts WHERE slug = '{slug}';\"")
        post_id = stdout.read().decode('utf-8').strip()
    
    print(f"Post [{slug}] ID: {post_id}")
    
    for lang, trans in [("tr", art["tr"]), ("en", art["en"])]:
        title = trans["title"].replace("'", "''")
        summary = trans["summary"].replace("'", "''")
        meta_title = trans["meta_title"].replace("'", "''")
        meta_desc = trans["meta_description"].replace("'", "''")
        content = trans["content"].replace("'", "''").strip()
        
        t_sql = f"""
        INSERT INTO catalog.blog_post_translations (post_id, language_code, title, summary, content, meta_title, meta_description)
        VALUES ('{post_id}', '{lang}', '{title}', '{summary}', '{content}', '{meta_title}', '{meta_desc}')
        ON CONFLICT (post_id, language_code) DO UPDATE
        SET title = EXCLUDED.title,
            summary = EXCLUDED.summary,
            content = EXCLUDED.content,
            meta_title = EXCLUDED.meta_title,
            meta_description = EXCLUDED.meta_description;
        """
        ssh.exec_command(f'sudo -u postgres psql -d merterdevdb -c "{t_sql}"')
    print(f"  -> Translations saved for {slug}")

ssh.close()
print("Batch 3 completed successfully!")