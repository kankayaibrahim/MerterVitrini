# Merter Vitrini - Storefront SEO Değerlendirmesi ve Yapılacaklar Listesi

Bu rapor, **mertervitrini.com.tr** storefront Next.js projesinin arama motoru optimizasyonu (SEO) durumunu analiz etmekte ve Google B2B / E-ticaret standartlarında zirveye oynamak için atılması gereken adımları listelemektedir.

---

## 📊 Mevcut Durum Analizi (Neleri Başardık?)

1. **Tamamen Statik Pre-rendering (SSG)**: Sitemizdeki tüm **1.194 sayfa** Next.js Turbopack ile statik HTML olarak derlenmektedir. Bu sayede Google botları siteyi milisaniyeler içinde tarayabilmektedir.
2. **Hiyerarşik / Ağaç Yapılı SEO URL'ler**: Kategori sayfalarını `/kategori/pantolon/` yerine, hiyerarşiyi tam gösteren `/kategori/kadin-giyim/alt-giyim/pantolon/` yapısına dönüştürdük. Bu, Google kategori indekslemesi için altın standarttır.
3. **Veritabanı Destekli Dinamik Metadata**: Tüm ürün detay (`/product/[slug]`) ve kategori (`/[categoryPrefix]/[...slug]`) sayfalarında başlıklar (`title`) ve açıklamalar (`description`) veritabanındaki tercümelere göre dinamik ve SEO uyumlu oluşturulmaktadır.

---

## 🛠️ Eksikler ve Yapılacaklar Listesi (SEO To-Do List)

Arama motorlarında (özellikle uluslararası B2B aramalarında) en üst sıralarda yer almak için storefront projemize eklememiz gereken **6 kritik SEO bileşeni** aşağıda listelenmiştir:

### 1. Dinamik XML Sitemap (Site Haritası)
Google botlarının sitedeki tüm sayfaları, kategorileri ve 1.000+ ürünü tek bir dosyada görüp hızlıca indekslemesi gerekir.
* **Ne Yapılmalı?**: `shop/frontend/src/app/sitemap.ts` adında dinamik bir sitemap dosyası oluşturulmalıdır. Bu dosya backend API'den tüm aktif ürünleri ve kategorileri çekerek tek bir `/sitemap.xml` çıktısı vermelidir.

### 2. Robots.txt Yapılandırması
Arama motoru botlarına hangi sayfaları taramaları gerektiğini söyleyen kılavuzdur.
* **Ne Yapılmalı?**: `shop/frontend/src/app/robots.ts` dosyası oluşturularak arama motorlarına izin verilmeli ve `sitemap.xml` konumu belirtilmelidir.
  ```typescript
  // Örnek Robots Yapılandırması
  import { MetadataRoute } from 'next';
  export default function robots(): MetadataRoute.Robots {
    return {
      rules: { userAgent: '*', allow: '/' },
      sitemap: 'https://mertervitrini.com.tr/sitemap.xml',
    };
  }
  ```

### 3. Zengin Arama Sonuçları İçin Yapılandırılmış Veri (JSON-LD Schema)
Google arama sonuçlarında ürünlerinizin fiyatı, stok durumu, resimleri ve yıldızlarının zengin görsel (rich snippets) olarak görünmesini sağlar. Bu, tıklanma oranını (CTR) %30 artırır.
* **Ne Yapılmalı?**: `ProductDetailClient.tsx` sayfasına Google standartlarında `Product` ve `Offer` şemalarını içeren bir JSON-LD betiği eklenmelidir:
  ```json
  {
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": "Ürün Adı",
    "image": "Ürün Görsel URL'si",
    "description": "Ürün Açıklaması",
    "sku": "Model Kodu / SKU",
    "offers": {
      "@type": "Offer",
      "priceCurrency": "USD",
      "price": "Paket Fiyatı",
      "availability": "https://schema.org/InStock"
    }
  }
  ```

### 4. Çoklu Dil SEO'su (Hreflang Etiketleri)
Sitemiz 7 dilde hizmet verdiği için, Google'a "Bu sayfa Türkçe kategori sayfasıdır, şu URL ise onun İngilizce karşılığıdır" bilgisini vermeliyiz. Aksi takdirde Google dilleri karıştırabilir veya kopya içerik (duplicate content) olarak algılayabilir.
* **Ne Yapılmalı?**: Sayfaların `<head>` alanına dil eşleştirmelerini bildiren dinamik `hreflang` alternatif etiketleri yerleştirilmelidir:
  ```html
  <link rel="alternate" hreflang="tr" href="https://mertervitrini.com.tr/kategori/pantolon/" />
  <link rel="alternate" hreflang="en" href="https://mertervitrini.com.tr/category/trousers/" />
  ```

### 5. Sosyal Medya Optimizasyonu (Open Graph & Twitter Cards)
Ürünleriniz veya siteniz WhatsApp, Telegram, Facebook veya Twitter'da paylaşıldığında zengin kart (resim, başlık ve özel açıklama) olarak görünmesini sağlar.
* **Ne Yapılmalı?**: `generateMetadata` fonksiyonlarına Open Graph özelliklerini (`og:title`, `og:description`, `og:image`, `og:url`, `og:type: "website"`) eklemeliyiz.

### 6. Kendini Gösteren Canonical (Özgün URL) Etiketleri
Aynı sayfanın filtreleme veya arama parametreleriyle (`?q=...`, `?category=...`) mükerrer indekslenmesini önlemek için her sayfanın özgün URL adresini netleştirmeliyiz.
* **Ne Yapılmalı?**: Sayfa metadatalarına dinamik `alternates: { canonical: "https://mertervitrini.com.tr/..." }` eklenmelidir.

---

## 📈 SEO Yol Haritası (Kısa & Orta Vade)

| Aşama | Yapılacak İşlem | Öncelik Derecesi | Tahmini Süre |
| :--- | :--- | :--- | :--- |
| **Aşama 1** | XML Sitemap & Robots.txt entegrasyonu | **Kritik (Yüksek)** | 1 Saat |
| **Aşama 2** | Ürün detayları için JSON-LD Rich Schema entegrasyonu | **Çok Önemli** | 1 Saat |
| **Aşama 3** | Open Graph Sosyal Medya kartları & Canonical etiketleri | **Önemli** | 30 Dk |
| **Aşama 4** | Hreflang çoklu dil SEO alternatif link bildirimleri | **Orta Vade** | 1 Saat |
