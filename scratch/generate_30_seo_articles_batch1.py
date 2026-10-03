import paramiko
import sys
import json
import uuid

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

batch_1_articles = [
    {
        "slug": "toptan-kadin-elbise-tedarigi-butik-rehberi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-elbise.webp",
        "tr": {
            "title": "Toptan Kadın Elbise Tedariği: Butikler İçin Günlük, Şifon ve Triko Elbise Alım Rehberi",
            "summary": "Butik sahipleri için en çok ciro getiren toptan kadın elbise modelleri, serili alım avantajları, doğru kumaş seçimi ve imalatçı fiyatlarıyla tedarik stratejileri.",
            "meta_title": "Toptan Kadın Elbise Tedariği | Butik Elbise Alım Rehberi B2B",
            "meta_description": "Merter imalatçılarından toptan kadın elbise tedariği: Günlük, şifon, mini ve midi elbise modellerinde serili paket alım ipuçları ve toptan B2B fiyatları.",
            "content": """
<h2>Butiklerin Lokomotif Ürünü: Toptan Kadın Elbise</h2>
<p>Kadın giyim perakendeciliğinde elbise, butiklerin ve e-ticaret sitelerinin en yüksek kar marjına sahip, sezon bağımsız en çok satan ana kategorisidir. Doğru toptan elbise tedariği yapmak, bir mağazanın müşteri sadakatini ve tekrar satın alma oranını doğrudan belirler.</p>

<h3>1. Sezonuna Göre En Çok Satan Elbise Kumaşları</h3>
<ul>
  <li><strong>Yaz Sezonu:</strong> Viskon, poplin pamuk, tensel ve nefes alan krinkle şifon kumaşlar. Sıcak havalarda terletmeyen ve dökümlü duran bu kumaşlar butiklerde hızla tükenir.</li>
  <li><strong>Kış ve Geçiş Sezonu:</strong> Ribana triko, fitilli kaşkorse, interlok ve iki iplik elbiseler. Vücudu saran esnek formlarıyla standart serilerde yüksek satış grafiği yakalar.</li>
  <li><strong>Özel Gün & Davet:</strong> Düşük omuzlu saten, jakarlı krep ve tül detaylı abiye elbiseler.</li>
</ul>

<h3>2. Seri ve Beden Dağılımında Dikkat Edilmesi Gerekenler</h3>
<p>Toptan kadın elbiselerinde standart paketleme genellikle <strong>1-S, 2-M, 2-L, 1-XL</strong> (toplam 6 adet) veya <strong>S-M-L</strong> (3 adet) şeklinde serilenir. Türkiye ve Avrupa pazarında en hızlı tükenen bedenler M ve L bedenler olduğundan, 2 adet M ve L içeren serileri tercih etmek ölü stok riskinizi sıfırlar.</p>

<h3>3. Merter Vitrini ile Doğrudan Üretici Avantajı</h3>
<p>Aracı toptancıların komisyonları yerine Merter'in birinci sınıf elbise üreticilerinin showroom koleksiyonlarına tek tıkla ulaşabilirsiniz. Minimum paket sipariş imkanı sayesinde yüksek sermaye bağlamadan haftalık yeni modellerle vitrininizi güncel tutabilirsiniz.</p>

<h3>Sıkça Sorulan Sorular</h3>
<h4>Elbiselerde minimum toptan alım adedi nedir?</h4>
<p>Merter Vitrini'nde ürünler serili paketler halinde satılmaktadır. Bir modelden minimum 1 seri (genellikle 3 ile 6 adet arası) sipariş verebilirsiniz.</p>
<h4>Toptan elbiselerde beden değişimi yapılır mı?</h4>
<p>B2B toptan ticaret kuralı gereği seriler bölünemez; ancak hatalı veya defolu ürünlerde anında birebir değişim veya iade güvencesi sunulmaktadır.</p>
"""
        },
        "en": {
            "title": "Wholesale Women's Dresses Sourcing Guide: Casual, Chiffon & Knitwear for Boutiques",
            "summary": "Essential guide for boutique owners sourcing wholesale women's dresses directly from Istanbul manufacturers at factory prices.",
            "meta_title": "Wholesale Women's Dresses Turkey | Boutique Sourcing Guide B2B",
            "meta_description": "Source wholesale women dresses directly from Merter manufacturers. Casual, maxi, chiffon, and knitwear dresses in series packs with global shipping.",
            "content": """
<h2>Why Dresses Are Every Fashion Boutique's #1 Revenue Driver</h2>
<p>In women's retail fashion, dresses offer the highest profit margins and the quickest inventory turnover. Sourcing your collections directly from verified Istanbul manufacturers ensures premium fabric quality, modern fits, and competitive wholesale pricing.</p>

<h3>Popular Wholesale Dress Fabrics</h3>
<ul>
  <li><strong>Spring/Summer:</strong> 100% Turkish cotton, airy chiffon, viscose, and breathable modal.</li>
  <li><strong>Autumn/Winter:</strong> Ribbed knitwear, heavy jersey, French terry, and Milano knit.</li>
</ul>

<h3>Packaging & Series Ratios</h3>
<p>Apparel series are standardly packaged in ratios such as 1-S, 2-M, 2-L, 1-XL (6 pieces per pack) or S-M-L (3 pieces). This ensures optimal size distribution for retail boutiques without dead inventory.</p>
"""
        }
    },
    {
        "slug": "toptan-kadin-takim-modelleri-ikili-takim",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-takim.webp",
        "tr": {
            "title": "Toptan Kadın İkili Takım Modelleri: Pantolonlu, Etekli ve Triko Takım Tedariği",
            "summary": "Son yılların en hızlı büyüyen giyim kategorisi olan kadın ikili takım modellerinde toptan alım taktikleri, kumaş alternatifleri ve butik karlılığı.",
            "meta_title": "Toptan Kadın İkili Takım Modelleri | Merter Toptan Butik Takımları",
            "meta_description": "Merter toptan kadın ikili takım modelleri: Etekli takım, pantolon-ceket takım ve triko takımlarda en uygun imalatçı fiyatları ve serili paket siparişi.",
            "content": """
<h2>Modern Kadın Modasının Zirvesi: İkili Takımlar</h2>
<p>Kombin yapma kolaylığı ve çok yönlü kullanım avantajı sayesinde ikili takımlar (alt-üst takım), kadın hazır giyim sektöründe son 3 yılın en popüler kategorisi haline gelmiştir. Butik müşterileri tek seferde komple bir kombine sahip olabildiği için ikili takımların sepet tutarı ve kar marjı oldukça yüksektir.</p>

<h3>1. En Çok Satan İkili Takım Çeşitleri</h3>
<ul>
  <li><strong>Pantolonlu İkili Takımlar:</strong> Bol paça dökümlü krep pantolon ve oversize blazer ceket veya tunik gömlek kombinasyonları. Hem ofis şıklığında hem günlük sokak modasında 1 numaradır.</li>
  <li><strong>Triko İkili Takımlar:</strong> Sonbahar ve kış sezonunun vazgeçilmezi olan yumuşak dokulu triko kazak ve triko pantolon/etek setleri.</li>
  <li><strong>Yazlık Şifon ve Keten Takımlar:</strong> Nefes alan keten gömlek-şort ve desenli şifon takımlar, sahil butiklerinde yok satmaktadır.</li>
</ul>

<h3>2. İkili Takımlarda Kalıp ve Dikiş Kalitesi Neden Önemlidir?</h3>
<p>Takımlarda alt ve üst parçanın birbiriyle uyumlu dökümü, kalıp ustalığı gerektirir. Merter üreticileri, Türk tekstilinin üstün dikiş kalitesiyle global standartlarda kalıplar çıkararak perakende müşterilerinizin tam bedenine oturmasını sağlar.</p>
"""
        },
        "en": {
            "title": "Wholesale Women's Two-Piece Sets: Pantsuits, Skirt Sets & Knitwear Outfits",
            "summary": "Maximize boutique sales with high-demand wholesale two-piece sets and coordinates direct from Turkish apparel factories.",
            "meta_title": "Wholesale Women Two-Piece Sets Turkey | B2B Boutique Outfits",
            "meta_description": "Buy wholesale women two-piece coordinate sets directly from Merter manufacturers. Tailored pantsuits, matching knitwear sets, and summer linen outfits.",
            "content": """
<h2>Two-Piece Sets: The Fast-Fashion Essential for Boutiques</h2>
<p>Coordinated two-piece outfits offer unmatched retail convenience. Sourcing women's matching sets directly from Merter Istanbul manufacturers gives your retail shop a high average order value and premium store aesthetics.</p>
"""
        }
    },
    {
        "slug": "toptan-kadin-ust-giyim-bluz-gomlek-rehberi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-ust-giyim.webp",
        "tr": {
            "title": "Toptan Kadın Üst Giyim: Bluz, Gömlek, Body ve Tişört Serili Paket Alımı",
            "summary": "Hızlı sirkülasyona sahip toptan üst giyim ürünlerinde doğru model seçimi, baskı kaliteleri, poplin gömlek trendleri ve toptan alım rehberi.",
            "meta_title": "Toptan Kadın Üst Giyim: Bluz ve Gömlek | Merter Vitrini B2B",
            "meta_description": "Merter imalatçılarından toptan kadın bluz, gömlek, crop ve tişört modelleri. En trend tasarımlar, kaliteli kumaşlar ve toptan fabrika fiyatları.",
            "content": """
<h2>Hızlı Tüketim Modasında Üst Giyimin Gücü</h2>
<p>Üst giyim (bluz, gömlek, tişört, body ve crop), bir butiğin vitrininde en sık yenilenmesi gereken, uygun birim fiyatı sayesinde perakende müşterisinin anlık satın alma kararı verdiği en dinamik gruptur.</p>

<h3>1. Butiklerin Mutlaka Bulundurması Gereken Üst Giyim Parçaları</h3>
<ul>
  <li><strong>Oversize Poplin Gömlekler:</strong> Beyaz, çizgili ve pastel tonlarda pamuk poplin gömlekler dört mevsim butiklerin demirbaşıdır.</li>
  <li><strong>Drapeli ve Şifon Bluzlar:</strong> Şık akşam yemekleri ve ofis kombinleri için kruvaze, drapeli veya boyundan bağlamalı bluzlar.</li>
  <li><strong>Likralı Ribana Bodyler:</strong> Ceket içine giyilebilen çıtçıtlı veya basic formdaki bodyler, yüksek kar marjıyla butik sepetlerini doldurur.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Women's Tops, Blouses & Shirts: High-Rotation Boutique Essentials",
            "summary": "Wholesale women blouses, shirts, crop tops, and basics direct from Istanbul textile suppliers with low minimums and fast dispatch.",
            "meta_title": "Wholesale Women Tops & Blouses Turkey | Merter B2B Sourcing",
            "meta_description": "Source trendy wholesale blouses, cotton shirts, crop tops, and basics from Turkish manufacturers at direct factory wholesale prices.",
            "content": """
<h2>High Inventory Turnover with Women's Wholesale Tops</h2>
<p>Women's tops, blouses, and shirts represent the fastest-moving inventory in any fashion boutique. Turkish textile factories in Merter produce cutting-edge European trends with rapid production cycles.</p>
"""
        }
    },
    {
        "slug": "toptan-kadin-dis-giyim-kaban-trenchkot-mont",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-dis-giyim.webp",
        "tr": {
            "title": "Toptan Kadın Dış Giyim: Kaban, Trençkot, Ceket ve Mevsimlik Mont Modelleri",
            "summary": "Sonbahar ve kış sezonunun yüksek bütçeli ana kalemi dış giyimde toptan alım taktikleri: Kaşe kabanlar, su itici trençkotlar ve deri ceketler.",
            "meta_title": "Toptan Kadın Dış Giyim: Kaban, Trençkot, Mont | Merter B2B",
            "meta_description": "Merter toptan kadın dış giyim modelleri: Kaşe kaban, trençkot, blazer ceket ve şişme montlarda kaliteli astar, su itici kumaş ve toptan fabrika fiyatları.",
            "content": """
<h2>Dış Giyimde Sezon Planlaması ve Yüksek Kar Fırsatı</h2>
<p>Dış giyim, kış aylarında butiklerin toplam cirosunun %40'ından fazlasını oluşturabilir. Yüksek birim satış fiyatına sahip olduğu için doğru kaban ve trençkot modellerini seçmek, sezon karlılığınızı garanti altına alır.</p>

<h3>1. Kumaş ve Malzeme Kalitesi</h3>
<ul>
  <li><strong>Kaşe ve Yün Karışımlı Kabanlar:</strong> Dökümlü, tüylenme yapmayan kaliteli kaşeler müşterinin ilk dokunuşta kaliteyi hissetmesini sağlar.</li>
  <li><strong>Bonding ve Gabardin Trençkotlar:</strong> Su itici kaplamalı, çift sıra düğmeli klasik bej ve haki trençkotlar her sonbaharda yok satar.</li>
  <li><strong>Astar ve Tela İşçiliği:</strong> Dış giyimde ürünün formunu koruyan iç tela ve astar kalitesi, iade oranlarını minimuma indirir.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Women's Outerwear: Coats, Trench Coats, Blazers & Puffer Jackets",
            "summary": "High-ticket winter outerwear wholesale from Istanbul: Wool coats, water-repellent trench coats, and tailored blazers.",
            "meta_title": "Wholesale Women Outerwear Turkey | Coats & Trench Coats B2B",
            "meta_description": "Source premium wholesale women's coats, trench coats, blazers, and winter jackets from Merter Istanbul manufacturers at direct factory rates.",
            "content": """
<h2>Maximize Autumn/Winter Revenue with Turkish Outerwear</h2>
<p>Turkish outerwear manufacturing is celebrated globally for impeccable tailoring, superior wool blends, and durable lining craftsmanship.</p>
"""
        }
    },
    {
        "slug": "toptan-kadin-pantolon-denim-kot-tedarigi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-pantolon.webp",
        "tr": {
            "title": "Toptan Kadın Pantolon ve Kot (Denim) Rehberi: Yüksek Bel, Mom Fit ve Kumaş Kalıpları",
            "summary": "Dünyanın denim üretim üssü Türkiye'den toptan kot ve kumaş pantolon tedariği: Yıkama kaliteleri, likra oranları ve beden dağılımı.",
            "meta_title": "Toptan Kadın Pantolon & Kot (Denim) | Merter Vitrini B2B",
            "meta_description": "Türkiye'den toptan kadın kot pantolon (denim) ve kumaş pantolon tedariği. Yüksek bel, palazzo, mom fit ve havuç kalıplarda toptan imalatçı fiyatları.",
            "content": """
<h2>Türkiye'nin Global Gücü: Denim ve Pantolon Üretimi</h2>
<p>Türkiye, dünyaca ünlü premium denim markalarının bir numaralı üretim merkezidir. Merter piyasasında satılan toptan kot pantolonlar, özel taş yıkama, enzim yıkama ve likralı dokuma kalitesiyle dünya standartlarının üzerindedir.</p>

<h3>1. En Çok Talep Gören Kalıplar</h3>
<ul>
  <li><strong>Wide Leg & Palazzo:</strong> Yüksek bel, paçaya doğru genişleyen rahat kesimler son 2 yılın en çok satan modelidir.</li>
  <li><strong>Mom Jean & Straight Cut:</strong> Vücut hatlarını zarifçe toparlayan %100 pamuk veya düşük elastanlı vintage kalıplar.</li>
  <li><strong>Kumaş Havuç ve İspanyol Paça Pantolonlar:</strong> Likralı krep veya viskon karışımlı ofis pantolonları.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Women's Denim & Trousers: High-Waisted Jeans & Tailored Pants",
            "summary": "Source premium Turkish denim and trousers directly from Istanbul Merter manufacturers. Mom jeans, wide leg, and tailored trousers.",
            "meta_title": "Wholesale Women Jeans & Pants Turkey | Turkish Denim B2B",
            "meta_description": "Buy wholesale women jeans and trousers directly from Merter manufacturers. Superior washing, high elasticity, and flattering cuts.",
            "content": """
<h2>Why Turkish Denim Dominates the Global Wholesale Market</h2>
<p>Turkey is recognized worldwide as a powerhouse in denim manufacturing. Merter producers craft high-grade jeans using premium cotton, durable washes, and precision fits.</p>
"""
        }
    },
    {
        "slug": "toptan-buyuk-beden-kadin-giyim-modelleri",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-buyuk-beden.webp",
        "tr": {
            "title": "Toptan Büyük Beden (Plus Size) Kadın Giyim: Kalıp Seçimi ve Butik Trendleri",
            "summary": "Büyük beden kadın giyim pazarındaki yüksek kar potansiyeli: 42-52 beden arası doğru kalıp seçimi, toparlayıcı kumaşlar ve seri alım ipuçları.",
            "meta_title": "Toptan Büyük Beden Kadın Giyim | Plus Size Merter B2B",
            "meta_description": "Merter imalatçılarından toptan büyük beden (plus size) kadın giyim: Elbise, tunik, pantolon ve ikili takımlarda modern kalıplar ve toptan fiyatlar.",
            "content": """
<h2>Büyük Beden Pazarındaki Yüksek Kar ve Düşük Rekabet Fırsatı</h2>
<p>Geleneksel butikler genellikle standart 36-40 beden aralığına odaklanır. Bu durum, 42-52 beden arası giyinen kadın müşterilerin şık ve kaliteli kıyafet bulmasını zorlaştırır. Büyük beden koleksiyonlarına yer veren butikler, sadık bir müşteri kitlesine ve yüksek karlılığa ulaşır.</p>

<h3>1. Büyük Bedende Kalıp ve Kumaşın Önemi</h3>
<ul>
  <li>Büyük bedende sıradan kalıpları sadece büyütmek yetersizdir; göğüs, basen ve kol evi oranlarının anatomik olarak dengelenmesi gerekir.</li>
  <li>Likralı krep, viskon dokuma ve toparlayıcı scuba kumaşlar vücudu sıkmadan zarif bir duruş sergiler.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Plus Size Women's Clothing: Modern Cuts & Premium Fabrics",
            "summary": "High-profit wholesale plus-size fashion from Turkey: Flattering dresses, tunics, trousers, and coordinates for sizes 42 to 54.",
            "meta_title": "Wholesale Plus Size Women Clothing Turkey | Merter B2B",
            "meta_description": "Source wholesale plus size women's apparel directly from Istanbul manufacturers. Modern flattering silhouettes, stretch fabrics, and direct wholesale prices.",
            "content": """
<h2>The Untapped Potential of Wholesale Plus-Size Fashion</h2>
<p>Plus-size retail has become one of the most lucrative sectors in global fashion. Turkish manufacturers excel in creating flattering, contemporary designs tailored specifically for curvy silhouettes.</p>
"""
        }
    },
    {
        "slug": "toptan-tesettur-giyim-tunik-ferace-modelleri",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-tesettur.webp",
        "tr": {
            "title": "Toptan Tesettür Giyim Tedariği: Tunik, Takım, Ferace ve Abiye Seçenekleri",
            "summary": "Global muhafazakar moda pazarının kalbi İstanbul'dan toptan tesettür giyim tedariği: Dökümlü kumaşlar, uzun elbiseler ve ihracat avantajları.",
            "meta_title": "Toptan Tesettür Giyim Tedariği | Tunik, Ferace, Elbise B2B",
            "meta_description": "Merter ve İstanbul imalatçılarından toptan tesettür giyim: Tunik, ikili takım, ferace ve abiye modellerinde zengin çeşit ve doğrudan fabrika fiyatları.",
            "content": """
<h2>Küresel Muhafazakar Modanın Başkenti: İstanbul</h2>
<p>Türkiye, modern ve estetik tesettür giyim üretiminde dünyanın tartışmasız lideridir. Avrupa'dan Orta Doğu'ya, Balkanlar'dan Kuzey Afrika'ya kadar milyonlarca tüketici Türk tesettür markalarının zarafetini ve kalitesini tercih etmektedir.</p>

<h3>1. Öne Çıkan Ürün Grupları</h3>
<ul>
  <li><strong>Uzun Tunik ve Gömlekler:</strong> İç göstermeyen pamuklu ve medine ipeği kumaşlar.</li>
  <li><strong>Geniş Paça Pantolonlu Takımlar:</strong> Konforlu, salaş ve dökümlü formlar.</li>
  <li><strong>Şık Ferace ve Kap Modelleri:</strong> Günlük ve özel davetlere uygun taş işlemeli veya sade tasarımlar.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Modest Fashion Turkey: Tunics, Abayas, Dresses & Sets",
            "summary": "Source high-quality modest clothing and Islamic fashion direct from Istanbul manufacturers for international boutiques.",
            "meta_title": "Wholesale Modest Fashion Turkey | Tunics, Abayas & Dresses B2B",
            "meta_description": "Source authentic wholesale modest fashion from Istanbul manufacturers. Premium fabrics, opaque non-see-through materials, and global shipping.",
            "content": """
<h2>Istanbul: The Global Hub for Modest & Islamic Fashion</h2>
<p>Turkey is the international epicenter of contemporary modest fashion, combining modest sensibilities with high-end European fashion design.</p>
"""
        }
    },
    {
        "slug": "toptan-bohem-otantik-giyim-butik-modasi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-bohem.webp",
        "tr": {
            "title": "Toptan Bohem ve Etnik Giyim Modası: Butiklerin En Çok Satan Yaz Koleksiyonları",
            "summary": "Boho chic tarzı, keten kumaşlar, dantel detaylar ve etnik desenlerle butiğinizi farklılaştıracak toptan bohem giyim rehberi.",
            "meta_title": "Toptan Bohem ve Etnik Giyim Modası | Butik Koleksiyonları B2B",
            "meta_description": "Merter toptan bohem giyim modelleri: Salaş keten elbiseler, dantelli bluzlar, otantik kimono ve etnik eteklerde toptan imalatçı fiyatları.",
            "content": """
<h2>Butiklere Özgünlük Katan Akım: Boho Chic</h2>
<p>Tekdüze zincir mağaza kıyafetlerinden sıkılan tüketiciler, butiklerde özgün, doğal ve salaş tasarımlar aramaktadır. Bohem (Boho Chic) tarzı, doğal pamuk, keten ve şile bezi kumaşlarıyla butiklerin en kolay sattığı ve en yüksek karı elde ettiği niş alanlardan biridir.</p>

<h3>1. Bohem Tarzın Temel Nitelikleri</h3>
<ul>
  <li>Doğal toprak tonları, hardal, kiremit ve ekru renk paletleri.</li>
  <li>Dantel, püskül, nakış ve fırfır detaylarıyla zenginleştirilmiş dökümlü kesimler.</li>
  <li>Nefes alan %100 pamuk ve keten dokumalar.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Bohemian & Ethnic Fashion: Summer Boutique Trends",
            "summary": "Wholesale boho chic dresses, linen kimonos, and ethnic tops from Turkish apparel manufacturers for resort and boutique stores.",
            "meta_title": "Wholesale Bohemian Fashion Turkey | Boho Chic Boutique B2B",
            "meta_description": "Source wholesale boho chic dresses, linen tunics, and ethnic apparel from Istanbul producers. Natural fabrics, relaxed fits, and wholesale prices.",
            "content": """
<h2>Stand Out with Authentic Turkish Bohemian Fashion</h2>
<p>Boho chic and resort-wear collections give fashion boutiques an artisanal, premium identity that chain stores simply cannot duplicate.</p>
"""
        }
    },
    {
        "slug": "toptan-triko-ve-kazak-tedarik-rehberi",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-triko.webp",
        "tr": {
            "title": "Toptan Triko ve Kazak Alımı: İplik Kaliteleri, Akrilik-Yün Oranları ve Kış Sezonu",
            "summary": "Triko kazak, hırka ve süveterlerde toptan sipariş verirken dikkat edilmesi gereken incelikler: Gramaj, iplik türü, tüylenme direnci ve sezonluk trendler.",
            "meta_title": "Toptan Triko ve Kazak Tedarik Rehberi | Merter Vitrini B2B",
            "meta_description": "Merter toptan triko kazak ve hırka alım rehberi: Akrilik, yün ve pamuk karışımlı trikolarda tüylenmeyen iplik kalitesi ve toptan fabrika fiyatları.",
            "content": """
<h2>Sonbahar ve Kışın Vazgeçilmezi: Toptan Triko Modası</h2>
<p>Triko ürünler, sonbahardan ilkbahar sonuna kadar kesintisiz satılabilen geniş bir kullanım ömrüne sahiptir. Türk triko üreticileri, yüksek teknolojili Stoll ve Shima Seiki örgü makineleriyle en karmaşık saç örgüsü ve jakar desenlerini kusursuz kalitede üretir.</p>

<h3>1. İplik Türleri ve Kalite Kriterleri</h3>
<ul>
  <li><strong>%100 Akrilik:</strong> Uygun maliyetli, canlı renklere sahip ve hafif trikolar.</li>
  <li><strong>Pamuk-Akrilik Karışımı:</strong> Terletmeyen, yumuşak tuşeli ve mevsim geçişleri için ideal form.</li>
  <li><strong>Yün ve Kaşmir Karışımı:</strong> Soğuk kış günleri için lüks butik segmentine hitap eden sıcak tutan dokular.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Knitwear & Sweaters Sourcing Guide: Yarns, Gauges & Winter Trends",
            "summary": "Source high-gauge Turkish knitwear, oversized cardigans, and sweaters directly from specialized Istanbul knit factories.",
            "meta_title": "Wholesale Knitwear Turkey | Sweaters & Cardigans B2B",
            "meta_description": "Source premium Turkish knitwear, cardigans, and pullover sweaters directly from Istanbul manufacturers at factory wholesale prices.",
            "content": """
<h2>Why Turkish Knitwear Leads European Retail Quality</h2>
<p>Utilizing high-end German and Japanese computer-knit technology, Turkish manufacturers produce knitwear that rivals Italian design at a fraction of the cost.</p>
"""
        }
    },
    {
        "slug": "toptan-kadin-etek-modelleri-pliseli-kalem",
        "cover_image": "https://mertervitrini.com.tr/uploads/blog/toptan-etek.webp",
        "tr": {
            "title": "Toptan Kadın Etek Modelleri: Pliseli, Kalem, Mini ve Şifon Etek Siparişi",
            "summary": "Her dönemin vazgeçilmez butik parçası eteklerde toptan tedarik ipuçları: Kumaş çeşitleri, astar detayları ve popüler kalıplar.",
            "meta_title": "Toptan Kadın Etek Modelleri | Merter Toptan Etek B2B",
            "meta_description": "Merter toptan kadın etek modelleri: Pliseli midi etek, deri etek, kalem etek ve mini şifon eteklerde serili paketler ve toptan imalatçı fiyatları.",
            "content": """
<h2>Kombinlerin Tamamlayıcısı: Toptan Etek Koleksiyonları</h2>
<p>Etekler, kadın gardıroplarının hem ofis hem sokak modasında vazgeçilmez temel parçalarıdır. Farklı üst giyim modelleriyle kolayca eşleştirilebildiği için butik müşterileri tarafından birden fazla adet olarak satın alınır.</p>

<h3>1. Sezonun En Çok Satan Etek Modelleri</h3>
<ul>
  <li><strong>Pliseli Midi Etekler:</strong> Saten veya süet dokulu, dökümlü ve hareketli pliseler.</li>
  <li><strong>Deri ve Süet Etekler:</strong> Sonbahar/Kış sezonunun favorisi olan mat deri mini ve midi modeller.</li>
  <li><strong>Yırtmaçlı Denim (Kot) Etekler:</strong> Günlük sokak stilinin en güçlü trendi olan uzun denim etekler.</li>
</ul>
"""
        },
        "en": {
            "title": "Wholesale Women's Skirts: Pleated, Pencil, Denim & Satin Midi Skirts",
            "summary": "Wholesale women skirts in diverse silhouettes: Pleated satins, classic pencil skirts, and trending long denim skirts from Turkey.",
            "meta_title": "Wholesale Women Skirts Turkey | Midi & Mini Skirts B2B",
            "meta_description": "Source wholesale women skirts directly from Merter Istanbul manufacturers. Pleated, satin midi, denim, and pencil skirts in series packs.",
            "content": """
<h2>Expand Your Boutique Skirt Collection with Turkish Craftsmanship</h2>
<p>From versatile pleated satin midis to classic business pencil skirts, Istanbul apparel makers supply retail boutiques with high-turnover skirt inventory.</p>
"""
        }
    }
]

# Insert batch 1
print(f"Inserting Batch 1 ({len(batch_1_articles)} articles)...")
for art in batch_1_articles:
    slug = art["slug"]
    cover = art["cover_image"]
    
    # 1. Ensure blog post exists
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
        # Fetch existing
        stdin, stdout, stderr = ssh.exec_command(f"sudo -u postgres psql -d merterdevdb -t -c \"SELECT id FROM catalog.blog_posts WHERE slug = '{slug}';\"")
        post_id = stdout.read().decode('utf-8').strip()
    
    print(f"Post [{slug}] ID: {post_id}")
    
    # 2. Insert translations
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
print("Batch 1 completed successfully!") 