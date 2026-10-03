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

batch_2_articles = [
    {
        "slug": "toptan-sweatshirt-ve-esofman-takimi-butik",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-sweatshirt.webp",
        "tr": {
            "title": "Toptan Kadın Sweatshirt ve Eşofman Takımları: İki İplik ve Üç İplik Şardonlu Modeller",
            "summary": "Sokak modasının ve ev konforunun vazgeçilmezi toptan sweatshirt ve eşofman takımlarında kumaş kaliteleri, şardonlu yapılar ve oversize kalıplar.",
            "meta_title": "Toptan Sweatshirt ve Eşofman Takımı | Merter B2B",
            "meta_description": "Merter imalatçılarından toptan kadın sweatshirt, hoodie ve eşofman takımları. İki iplik, üç iplik şardonlu pamuk kumaşlar ve toptan serili paketler.",
            "content": """
<h2>Sokak Modasının ve Athleisure Trendinin Lideri: Sweatshirt & Eşofman</h2>
<p>Spor giyimin günlük şıklıkla birleştiği 'Athleisure' trendi, sweatshirt ve eşofman takımlarını dört mevsim butiklerin en çok satan ürünleri arasına sokmuştur. Merter tekstil atölyeleri, yüksek gramajlı kompakt penye ve şardonlu kumaşlarla uzun ömürlü modeller üretir.</p>

<h3>1. İki İplik mi, Üç İplik Şardonlu mu?</h3>
<ul>
  <li><strong>İki İplik Kumaş (240-260 gr/m²):</strong> İlkbahar ve sonbahar ayları için ideal, terletmeyen, hafif ve esnek dokuma.</li>
  <li><strong>Üç İplik Şardonlu Kumaş (320-360 gr/m²):</strong> İç yüzeyi yumuşacık tüylendirilmiş, kış aylarında sıcak tutan ve tok duran birinci sınıf pamuklu kumaş.</li>
</ul>

<h3>2. Oversize ve Unisex Kalıp Tercihi</h3>
<p>Butiklerde özellikle düşük omuzlu, kapüşonlu ve kanguru cepli oversize kalıplar genç ve dinamik tüketici kitlesi tarafından yoğun talep görmektedir.</p>
"""
        },
        "en": {
            "title": "Wholesale Sweatshirts & Tracksuits: French Terry & Fleece Streetwear",
            "summary": "Source premium wholesale hoodies, sweatshirts, and jogging suits directly from Turkish streetwear manufacturers.",
            "meta_title": "Wholesale Sweatshirts & Tracksuits Turkey | Streetwear B2B",
            "meta_description": "Buy wholesale women's sweatshirts, hoodies, and matching tracksuit sets directly from Merter manufacturers. Heavyweight cotton and oversized fits.",
            "content": """
<h2>Athleisure Dominance: High-Turnover Turkish Streetwear</h2>
<p>Turkish manufacturers specialize in premium knitted fabrics, offering heavyweight French terry and brushed fleece sweatshirts with superior softness and zero shrinkage.</p>
"""
        }
    },
    {
        "slug": "toptan-hamile-giyim-rahat-ve-sik-koleksiyonlar",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-hamile.webp",
        "tr": {
            "title": "Toptan Hamile Giyim Tedariği: Butikler İçin Konforlu ve Esnek Kumaş Koleksiyonları",
            "summary": "Anne adayları için özel ribana panelli pantolonlar, emzirme özellikli elbiseler ve esnek toptan hamile giyim tedarik rehberi.",
            "meta_title": "Toptan Hamile Giyim Tedariği | Butik Koleksiyonları B2B",
            "meta_description": "Merter imalatçılarından toptan hamile giyim: Esnek hamile pantolonu, ribanalı elbiseler ve emzirme kıyafetlerinde yüksek konfor ve toptan fabrika fiyatları.",
            "content": """
<h2>Sadık Müşteri Yaratan Niş Alan: Hamile Giyim</h2>
<p>Hamile giyim, kadınların konfor ve sağlık odaklı alışveriş yaptığı, fiyattan ziyade kumaş doğallığına önem verdiği karlı bir niş pazardır. Butiğinde hamile reyonu bulunduran mağazalar, doğum sonrası da devam eden güçlü bir müşteri bağı kurar.</p>

<h3>1. Hamile Kıyafetlerinde Aranan Özellikler</h3>
<ul>
  <li>Karın bölgesini sıkmayan, ayarlanabilir elastik ribana panelli hamile kot ve pantolonları.</li>
  <li>%100 pamuklu, nefes alan ve antialerjik boyalarla üretilmiş kumaş sertifikaları.</li>
  <li>Hem hamilelik hem lohusalık döneminde giyilebilen gizli fermuarlı emzirme elbiseleri.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Maternity Clothing Turkey: Comfortable & Fashionable Wear",
            "summary": "Source high-comfort wholesale maternity dresses, belly-band pants, and nursing wear directly from Turkish textile factories.",
            "meta_title": "Wholesale Maternity Wear Turkey | Boutique Sourcing B2B",
            "meta_description": "Source wholesale maternity fashion from Istanbul manufacturers. Adjustable waistbands, breathable organic cotton, and stylish nursing apparel.",
            "content": """
<h2>Lucrative Boutique Niche: High-Comfort Maternity Apparel</h2>
<p>Maternity wear provides retailers with loyal repeat buyers. Turkish manufacturers produce stretchable, skin-friendly garments designed for every stage of pregnancy.</p>
"""
        }
    },
    {
        "slug": "merter-laleli-gungoren-toptan-tekstil-kiyaslama",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/istanbul-tekstil-piyasalari.webp",
        "tr": {
            "title": "Merter mi, Laleli mi, Güngören mi? İstanbul Toptan Tekstil Piyasalarının Karşılaştırması",
            "summary": "İstanbul'un üç büyük tekstil merkezi Merter, Laleli ve Güngören arasındaki farklar: Ürün çeşitliliği, fiyat segmentleri, hedef pazarlar ve alım taktikleri.",
            "meta_title": "Merter, Laleli, Güngören Toptan Tekstil Karşılaştırması | B2B Rehber",
            "meta_description": "Merter, Laleli ve Güngören toptan tekstil piyasaları arasındaki farklar nelerdir? Hangi ürün nereden alınır? Butikler için toptan pazar karşılaştırma rehberi.",
            "content": """
<h2>İstanbul'un Tekstil Üçgeni: Merter, Laleli ve Güngören</h2>
<p>İstanbul, dünyanın en büyük hazır giyim ihracat merkezlerinden biridir ve bu ticaret üç ana bölgede toplanmıştır. Ancak her pazarın kendine has uzmanlık alanı ve hedef kitlesi bulunur.</p>

<h3>1. Merter: Modern Trendler, Genç Kadın ve Hızlı Moda</h3>
<p>Merter, Avrupa ve Türkiye iç piyasasına yönelik en son trendlerin ışık hızında üretildiği merkezdir. Butiklerin aradığı dinamik kalıplar, kaliteli kumaşlar ve orta-üst segment hazır giyim Merter'de yoğunlaşır.</p>

<h3>2. Laleli: Doğu Bloku, Rusya ve Orta Doğu İhracatı</h3>
<p>Laleli daha çok Rusya, Ukrayna, Orta Asya ve Arap ülkelerine yönelik büyük hacimli ihracat yapar. Fiyatlar genellikle dolar bazlıdır ve gösterişli abiye, kürk/deri ve klasik giyim ön plandadır.</p>

<h3>3. Güngören: Uygun Fiyatlı Temel Ürünler ve Yüksek Hacim</h3>
<p>Güngören, uygun fiyatlı basic giyim, çocuk kıyafetleri ve promosyon tekstilinde güçlüdür. Kalite seviyesi Merter'e göre daha ekonomiktir.</p>
"""
        },
        "en": {
            "title": "Merter vs Laleli vs Gungoren: Istanbul Wholesale Textile Markets Compared",
            "summary": "Compare Istanbul's top wholesale fashion districts: Merter, Laleli, and Gungoren. Find out which market best suits your boutique's budget and style.",
            "meta_title": "Merter vs Laleli vs Gungoren Wholesale Markets | Istanbul B2B",
            "meta_description": "In-depth guide comparing Merter, Laleli, and Gungoren wholesale clothing markets in Istanbul. Product specializations, price ranges, and sourcing tips.",
            "content": """
<h2>Navigating Istanbul's Famous Textile Hubs</h2>
<p>Merter specializes in contemporary fast-fashion and European boutique trends. Laleli caters primarily to Russia and Middle Eastern luxury buyers, while Gungoren focuses on mass-market affordable basics.</p>
"""
        }
    },
    {
        "slug": "dogrudan-imalatcidan-toptan-giyim-almanin-avantajlari",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/dogrudan-imalatci.webp",
        "tr": {
            "title": "Doğrudan İmalatçıdan Toptan Giyim Satın Almanın Butiklere Sağladığı 7 Avantaj",
            "summary": "Aracı komisyonlarını ortadan kaldırarak birinci el üreticiden toptan alışveriş yapmanın kar marjı, ürün orijinalliği ve teslimat hızına etkileri.",
            "meta_title": "Doğrudan İmalatçıdan Toptan Giyim Almanın 7 Avantajı | Merter B2B",
            "meta_description": "Toptan giyimde aracıları aradan çıkarıp doğrudan üreticiden almanın butiklere faydaları: %30 daha yüksek kar marjı, özel etiket imkanı ve stok güvencesi.",
            "content": """
<h2>Aracıları Kaldırın, Karınızı İkiye Katlayın</h2>
<p>Geleneksel tekstil ticaretinde bir ürün fabrikadan çıkıp perakende butiğe ulaşana kadar en az 2-3 toptancı elinden geçer. Her el değiştirme fiyatın %15-25 artmasına neden olur. Doğrudan imalatçıyla çalışmak bu gereksiz maliyetleri sıfırlar.</p>

<h3>7 Temel Avantaj</h3>
<ol>
  <li><strong>En Düşük Fabrika Çıkış Fiyatı:</strong> Ek komisyon ödemeden en yüksek perakende kar marjını yakalarsınız.</li>
  <li><strong>İlk Sizin Vitrininizde Olsun:</strong> Üretilen yeni sezon modelleri aracılara düşmeden önce ilk siz satın alırsınız.</li>
  <li><strong>Kesintisiz Stok Devamı:</strong> Çok satan bir modelin tekrar üretimini doğrudan imalatçıdan talep edebilirsiniz.</li>
  <li><strong>Hızlı Hata ve Kusur Telafisi:</strong> Olası bir defoda doğrudan fabrika ile birebir muhatap olursunuz.</li>
  <li><strong>Özel Etiket (Private Label) Fırsatı:</strong> Belirli adetlerde kendi markanızın etiketini bastırabilirsiniz.</li>
  <li><strong>Doğru Kumaş ve İçerik Bilgisi:</strong> Ürünün gerçek kumaş karışımı hakkında yanıltıcı bilgi almazsınız.</li>
  <li><strong>Nakit Akışı Esnekliği:</strong> Güven tesis edildiğinde daha avantajlı B2B ödeme şartlarına erişirsiniz.</li>
</ol>
"""
        },
        "en": {
            "title": "7 Proven Benefits of Sourcing Wholesale Clothing Directly from Manufacturers",
            "summary": "Eliminate middlemen and buy directly from Istanbul clothing factories: Higher profits, authentic quality, and rapid restocking.",
            "meta_title": "Direct Factory Sourcing Turkey | 7 Benefits for Boutiques B2B",
            "meta_description": "Why fashion boutiques should source apparel directly from Turkish manufacturers. Cut wholesale markup costs and access the latest trends first.",
            "content": """
<h2>Cut the Middleman: Boost Boutique Profits by up to 35%</h2>
<p>Buying directly from verified Istanbul factories eliminates secondary wholesaler markups, giving your retail business maximum pricing power and instant access to brand-new collections.</p>
"""
        }
    },
    {
        "slug": "osmanbey-abiye-ve-merter-hazir-giyim-farklari",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/osmanbey-merter.webp",
        "tr": {
            "title": "Osmanbey Abiye Pazarı ve Merter Günlük Giyim: Hangi Ürün Nereden Alınır?",
            "summary": "İstanbul'un lüks abiye merkezi Osmanbey ile hazır giyim devi Merter arasındaki farklar, fiyat seviyeleri ve butik satın alma stratejisi.",
            "meta_title": "Osmanbey Abiye vs Merter Hazır Giyim Karşılaştırması | B2B",
            "meta_description": "Osmanbey toptan abiye ve Merter hazır giyim pazarı karşılaştırması: Düğün, mezuniyet ve kokteyl elbiseleri nereden alınmalı? Butik tedarik rehberi.",
            "content": """
<h2>Lüks Abiyenin Adresi Osmanbey, Dinamik Modanın Kalbi Merter</h2>
<p>Osmanbey (Şişli), el işçiliği işlemeli gece elbiseleri, gelinlikler ve üst segment kokteyl kıyafetleriyle ünlüdür. Merter ise günlük sokak modası, casual elbiseler, triko ve ikili takımlarda dünyanın en hızlı ve uygun maliyetli üreticisidir.</p>

<h3>1. Hangi Durumda Osmanbey, Ne Zaman Merter?</h3>
<ul>
  <li>Butiğiniz düğün, nişan ve mezuniyet gibi özel davet elbiselerine ağırlık veriyorsa Osmanbey showroomları doğru tercihtir.</li>
  <li>Haftalık hızlı ciro, günlük giyim, ofis şıklığı ve uygun fiyatlı trend parçalar arıyorsanız Merter Vitrini doğru adrestir.</li>
</ul>
"""
        },
        "en": {
            "title": "Osmanbey Evening Wear vs Merter Ready-to-Wear: Where to Source What?",
            "summary": "Deciding between Istanbul's luxury evening-wear hub Osmanbey and fast-fashion giant Merter for your boutique inventory.",
            "meta_title": "Osmanbey Evening Wear vs Merter Fashion | Sourcing Guide B2B",
            "meta_description": "Compare Osmanbey luxury evening dresses with Merter fast fashion. Discover which Istanbul textile district fits your boutique's target customer.",
            "content": """
<h2>Specialized Sourcing: Evening Gowns vs Ready-to-Wear</h2>
<p>Osmanbey is Turkey's capital for couture-grade evening gowns and prom dresses, whereas Merter leads the world in high-volume, trendy daily ready-to-wear fashion.</p>
"""
        }
    },
    {
        "slug": "bursa-kumasi-mi-merter-hazir-giyimi-mi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/bursa-merter.webp",
        "tr": {
            "title": "Bursa Kumaş Pazarı mı, Merter Hazır Giyimi mi? Tekstil Tedarik Zinciri Rehberi",
            "summary": "Kendi kıyafetini diktirmek isteyen butikler için Bursa ham kumaş alımı ile Merter'den bitmiş hazır giyim satın almanın maliyet ve risk analizi.",
            "meta_title": "Bursa Kumaşı mı Merter Hazır Giyimi mi? | Tekstil Tedarik B2B",
            "meta_description": "Kendi koleksiyonunu üretmek mi, Merter'den bitmiş hazır giyim almak mı daha karlı? Bursa kumaş tedariği ve Merter atölye maliyet kıyaslaması.",
            "content": """
<h2>Kendi Üretimini Yapmak mı, Hazır Giyim Satın Almak mı?</h2>
<p>Pek çok yeni butik sahibi, daha fazla kar edeceği düşüncesiyle Bursa'dan top kumaş alıp fason diktirmeyi düşünür. Ancak kalıp çıkarma, pastal planı, fire oranları, dikiş işçiliği ve model riskleri hesaba katıldığında bu süreç çoğu zaman yüksek zararlarla sonuçlanır.</p>

<h3>Maliyet ve Risk Kıyaslaması</h3>
<ul>
  <li><strong>Bursa Kumaş & Fason Üretim:</strong> Minimum 500-1000 metre kumaş bağlama şartı, atölye gecikmeleri ve kalıp tutmama riski yüksektir.</li>
  <li><strong>Merter Hazır Giyim (Merter Vitrini):</strong> Sıfır üretim riski, küçük serilerle trendleri hemen deneme imkanı ve hazır profesyonel ürün fotoğrafları.</li>
</ul>
"""
        },
        "en": {
            "title": "Bursa Raw Fabrics vs Merter Finished Fashion: Sourcing Cost Analysis",
            "summary": "Cost and risk analysis for fashion retailers: Sourcing raw fabrics from Bursa to manufacture vs buying finished apparel from Merter.",
            "meta_title": "Bursa Fabric vs Merter Apparel Sourcing | Cost Analysis B2B",
            "meta_description": "Should you manufacture custom clothing with Bursa textiles or buy ready-to-wear from Merter Istanbul? Essential B2B guide for boutique owners.",
            "content": """
<h2>Custom Manufacturing vs Ready-to-Wear Wholesale Sourcing</h2>
<p>For independent fashion boutiques, purchasing finished ready-to-wear from Merter eliminates manufacturing risks, pattern errors, and heavy minimum fabric orders.</p>
"""
        }
    },
    {
        "slug": "sifirdan-giyim-butigi-nasil-acilir-maliyet-plani",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/butik-acma-rehberi.webp",
        "tr": {
            "title": "Sıfırdan Butik Nasıl Açılır? Giyim Butiği Açma Maliyeti, Vergi ve Tedarik Aşamaları",
            "summary": "Fiziksel veya online giyim butiği açmak isteyen girişimciler için adım adım rehber: Şirket kuruluşu, mağaza dekorasyonu, ilk ürün tedariği ve bütçe planı.",
            "meta_title": "Sıfırdan Giyim Butiği Nasıl Açılır? Maliyet ve Tedarik Rehberi",
            "meta_description": "Giyim butiği açmak için gerekenler: Şahıs şirketi kuruluşu, dekorasyon masrafları, Merter'den ilk toptan mal alımı ve işletme sermayesi hesabı.",
            "content": """
<h2>Kendi Moda Markanızı Yaratın: Butik Açma Yol Haritası</h2>
<p>Giyim butiği açmak, doğru lokasyon ve güçlü bir toptan tedarikçi ağıyla birleştiğinde en yüksek getiri sağlayan perakende iş modellerinden biridir.</p>

<h3>1. Butik Açmanın 5 Temel Adımı</h3>
<ol>
  <li><strong>Şirket Kurulumu ve Yasal İzinler:</strong> Genellikle bir günde kurulan şahıs şirketi ve belediye iş yeri açma ruhsatı.</li>
  <li><strong>Doğru Lokasyon Seçimi:</strong> Kadın yaya trafiğinin yoğun olduğu cadde üzeri dükkanlar veya AVM koridorları.</li>
  <li><strong>Minimalist ve Aydınlık Dekorasyon:</strong> Kıyafetlerin renklerini doğru gösteren gün ışığı LED ray spotlar ve geniş prova kabinleri.</li>
  <li><strong>Dengeli İlk Stok Alımı:</strong> Sermayenizin tamamını tek bir modele bağlamadan; %40 üst giyim, %30 elbise, %20 alt giyim ve %10 aksesuar dengesi.</li>
  <li><strong>Sosyal Medya ve Yerel Pazarlama:</strong> Açılıştan en az 2 hafta önce Instagram ve TikTok üzerinden heyecan yaratan içerikler yayınlamak.</li>
</ol>
"""
        },
        "en": {
            "title": "How to Start a Fashion Boutique: Budget, Sourcing & Step-by-Step Guide",
            "summary": "Complete roadmap to launching a successful physical or online clothing boutique: Business setup, store design, and inventory sourcing.",
            "meta_title": "How to Open a Clothing Boutique | Business Setup & Sourcing B2B",
            "meta_description": "Step-by-step guide to starting a successful clothing boutique: Legal permits, store decor, wholesale sourcing from Turkey, and marketing strategies.",
            "content": """
<h2>From Concept to Grand Opening: The Boutique Blueprint</h2>
<p>Launching a fashion boutique requires a smart balance between distinctive store aesthetics, targeted digital marketing, and reliable wholesale apparel supply.</p>
"""
        }
    },
    {
        "slug": "instagram-ve-tiktokta-butik-acip-satis-yapma",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/sosyal-medya-butik.webp",
        "tr": {
            "title": "Instagram ve TikTok'ta Butik Açarak Satış Yapma: Sosyal Medya E-Ticaret Taktikleri",
            "summary": "Fiziksel mağaza kirası ödemeden Instagram Reels ve TikTok videolarıyla ayda yüzlerce serili kıyafet satmanın sırları.",
            "meta_title": "Instagram ve TikTok'ta Butik Açma Rehberi | Sosyal Ticaret",
            "meta_description": "Instagram ve TikTok üzerinden butik nasıl açılır? Kombin videoları çekme, canlı yayın satışları, Shopier entegrasyonu ve toptan ürün tedariği.",
            "content": """
<h2>Sosyal Medya: Sıfır Kirayla Dünyaya Satış Yapın</h2>
<p>Bugün Türkiye'nin en başarılı butiklerinin birçoğu fiziksel bir dükkan yerine sadece bir Instagram sayfası ve TikTok hesabı üzerinden milyonlarca liralık ciroya ulaşmaktadır.</p>

<h3>Sosyal Medyada Çok Satan Butiklerin 4 Ortak Özelliği</h3>
<ul>
  <li><strong>Kombin ve Deneme Videoları (Reels):</strong> Kıyafetleri sadece askıda çekmek yerine hareket halinde, gün ışığında manken üzerinde göstermek dönüşümü 5 kat artırır.</li>
  <li><strong>Hızlı DM ve WhatsApp Müşteri İletişimi:</strong> Fiyat ve beden soran müşteriye ilk 3 dakika içinde samimi ve profesyonel yanıt vermek.</li>
  <li><strong>Haftalık Drop Sistemi:</strong> Her hafta belirli bir gün ve saatte 'Yeni Sezon Ürünleri Yayında' konseptiyle yapay kıtlık ve aciliyet hissi yaratmak.</li>
  <li><strong>Merter Vitrini ile Fotoğraf Kolaylığı:</strong> Profesyonel stüdyo fotoğraflarını kullanarak çekim maliyetlerinden tasarruf etmek.</li>
</ul>
"""
        },
        "en": {
            "title": "How to Sell Boutique Clothing on Instagram & TikTok: Social Commerce Guide",
            "summary": "Proven tactics for running a profitable fashion boutique on Instagram and TikTok with short-form videos and live shopping.",
            "meta_title": "Sell Boutique Clothes on Instagram & TikTok | Social Commerce B2B",
            "meta_description": "Master social media fashion retail: How to style reels, host TikTok live shopping events, and source viral trending apparel from Turkey.",
            "content": """
<h2>Scale Your Fashion Business Through Social Video</h2>
<p>Short-form video has transformed clothing retail. Boutique owners who showcase real fit videos and honest styling tips consistently outperform traditional stores.</p>
"""
        }
    },
    {
        "slug": "butiklerde-kar-marji-ve-fiyatlandirma-stratejisi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/kar-marji-hesaplama.webp",
        "tr": {
            "title": "Butiklerde Kar Marjı Nasıl Hesaplanır? Toptan Alış ve Perakende Fiyatlandırma Stratejileri",
            "summary": "Giyim butiklerinde doğru perakende fiyat belirleme formülleri: Keystone markup, kargo ve vergi maliyetleri, indirim payı ve net kar hesabı.",
            "meta_title": "Butiklerde Kar Marjı ve Fiyatlandırma Stratejisi | B2B Rehber",
            "meta_description": "Toptan giyimde perakende satış fiyatı nasıl hesaplanır? Keystone markup formülü, KDV ve işletme giderleri düşüldükten sonra net kar maksimizasyonu.",
            "content": """
<h2>Fiyatlandırma Hatası Yapan Butik Batmaya Mahkumdur</h2>
<p>Pek çok butik yüksek ciro yapmasına rağmen ay sonunda kasasında para göremez. Bunun en büyük sebebi kargo, ambalaj, KDV, POS komisyonları ve iadeleri hesaba katmadan yapılan eksik fiyatlandırmadır.</p>

<h3>1. Keystone Fiyatlandırma (2.2x - 2.5x Kuralı)</h3>
<p>Moda perakendesinde altın standart 'Keystone' yöntemidir. Toptan maliyeti 200 TL olan bir ürünü doğrudan 450 - 500 TL bandında etiketlemek gerekir. Bu çarpan; kira, personel, POS komisyonu ve sezon sonu %30 indirim payını absorbe eder.</p>

<h3>Net Kar Formülü</h3>
<code>Net Kar = Satış Fiyatı - (Toptan Alış + Kargo + Ambalaj + POS Komisyonu + KDV + İade Payı)</code>
"""
        },
        "en": {
            "title": "Fashion Boutique Pricing Strategies & Profit Margins: The Keystone Method",
            "summary": "How to calculate retail markup and profit margins in fashion: Keystone formulas, overhead costs, and maximizing boutique profitability.",
            "meta_title": "Boutique Pricing Strategies & Profit Margins | Fashion Retail B2B",
            "meta_description": "Learn how successful fashion retailers price wholesale clothing. The keystone markup formula, factoring returns, taxes, and securing 60%+ margins.",
            "content": """
<h2>Master Retail Markup to Ensure Lasting Boutique Profitability</h2>
<p>The standard fashion retail benchmark is keystone pricing (2.0x to 2.5x wholesale cost), allowing boutique owners to comfortably cover overhead, marketing, and seasonal promotions.</p>
"""
        }
    },
    {
        "slug": "butik-stok-yonetimi-ve-olu-stoktan-kacinma",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/stok-yonetimi.webp",
        "tr": {
            "title": "Butik Stok Yönetimi: Ölü Stoktan Kaçınma, Hızlı Devir ve Sezon İndirimleri",
            "summary": "Moda perakendeciliğinde sermayeyi korumanın anahtarı olan stok devir hızı, kırık serilerin eritilmesi ve sezon geçiş taktikleri.",
            "meta_title": "Butik Stok Yönetimi ve Ölü Stoktan Kaçınma | B2B İpuçları",
            "meta_description": "Giyim butiklerinde ölü stok nasıl eritilir? Stok devir hızı hesaplama, kırık bedenleri kombinle satma ve sezon sonu indirim stratejileri.",
            "content": """
<h2>Stok Yönetimi: Satılmayan Kıyafet Sermayenizi Tüketir</h2>
<p>Hazır giyimde trendler hızla eskir. 60 günden uzun süre rafta kalan bir ürün 'ölü stok' haline gelir ve yeni sezon koleksiyonları için gereken nakit akışını kilitler.</p>

<h3>Ölü Stoktan Kurtulmanın 4 Akılcı Yolu</h3>
<ul>
  <li><strong>Kırık Bedenleri Kombin Yaparak Satın:</strong> Elinizde kalan tek bir XS veya XL bedeni, çok satan bir ceket veya fularla eşleştirip 'Kombin Fırsatı' olarak satın.</li>
  <li><strong>2 Al 1 Öde veya İkinci Ürüne %50 İndirim:</strong> Müşterinin sepet ortalamasını yükselterek eski stokları hızla nakde çevirin.</li>
  <li><strong>Sürpriz Kutu (Mystery Box) Kampanyaları:</strong> Sosyal medyada büyük ilgi gören indirimli sürpriz paketlerle kalan parçaları eğlenceli şekilde eritin.</li>
  <li><strong>Just-In-Time Tedarik:</strong> Merter Vitrini'nden haftalık küçük partilerle sipariş vererek depoda yığılma yapmayın.</li>
</ul>
"""
        },
        "en": {
            "title": "Boutique Inventory Management: Avoiding Dead Stock & Increasing Turnover",
            "summary": "Proven inventory control strategies for clothing retailers: Sell-through rates, bundling orphaned sizes, and flash clearance sales.",
            "meta_title": "Boutique Inventory Management & Dead Stock Strategies | B2B",
            "meta_description": "How fashion retailers avoid dead inventory and accelerate stock turns. Practical tips for bundling single sizes and dynamic seasonal sales.",
            "content": """
<h2>Keep Your Boutique Lean: Velocity Beats Quantity</h2>
<p>Fashion inventory depreciates fast. Utilizing on-demand B2B reordering through platforms like Merter Vitrini ensures your shelves stay fresh without over-committing working capital.</p>
"""
        }
    }
]

# Insert batch 2
print(f"Inserting Batch 2 ({len(batch_2_articles)} articles)...")
for art in batch_2_articles:
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
print("Batch 2 completed successfully!")