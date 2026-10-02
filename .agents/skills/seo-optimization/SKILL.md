---
name: seo-optimization
description: Merter Vitrini B2B mağazasında Google/Yandex zirve sıralamaları için teknik SEO, Schema.org JSON-LD, Hreflang, IndexNow, Sitemap, AI içerik optimizasyonu ve Core Web Vitals denetim iş akışı.
---

# Merter Vitrini B2B E-Ticaret SEO & Büyüme Uzmanı Rehberi (SEO Optimization Skill)

Bu rehber, `@seo` (Kıdemli B2B & E-Ticaret SEO / Büyüme Uzmanı) rolünün Merter Vitrini storefront ve katalog sayfalarında Google, Yandex ve Bing arama motorlarında 1. sıra hedefiyle yürüteceği teknik ve içerik optimizasyon süreçlerini tanımlar.

---

## 1. Storefront 6 Temel Teknik SEO Direği (Core Pillars)

```text
               ┌────────────────────────────────────────────────────────┐
               │    MERTER VİTRİNİ B2B E-TİCARET TEKNİK SEO MİMARİSİ    │
               └────────────────────────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┬───────────────┬────────────────┐
       ▼               ▼               ▼               ▼                ▼
 1. JSON-LD       2. Hreflang     3. Dinamik      4. IndexNow      5. AI SEO
 Schema.org       & Canonical     Sitemap/Robots  API Anlık Dizin  & Slug Hijyeni
 (Product, Offer) (7 Dil Desteği) (sitemap.ts)    (Yandex / Bing)  (Base36 Hash)
```

---

## 2. Yapılandırılmış Veri (JSON-LD Schema.org) Standartları

B2B toptan satışın zengin arama sonuçlarında (rich snippets) fiyat, stok ve seri bilgisiyle çıkması için sayfalara enjekte edilen JSON-LD şemaları:

### A. Ürün Detay Şeması (`Product` + `Offer`)
Storefront ürün detay sayfasında (`shop/frontend/src/app/product/[slug]/page.tsx` veya modal içinde):

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org/",
  "@type": "Product",
  "name": "Toptan Kadın Oversize Gömlek",
  "image": [
    "https://mertervitrini.com.tr/uploads/products/gomlek-cover.webp"
  ],
  "description": "Toptan kadın pamuklu oversize gömlek. Paket içi 4 adet (S-M-L-XL).",
  "sku": "MIMOZA-255S",
  "mpn": "255S",
  "brand": {
    "@type": "Brand",
    "name": "MIMOZA"
  },
  "offers": {
    "@type": "Offer",
    "url": "https://mertervitrini.com.tr/product/toptan-kadin-oversize-gomlek-255s",
    "priceCurrency": "USD",
    "price": "42.50",
    "priceValidUntil": "2027-12-31",
    "itemCondition": "https://schema.org/NewCondition",
    "availability": "https://schema.org/InStock",
    "seller": {
      "@type": "Organization",
      "name": "Merter Vitrini"
    }
  }
}
</script>
```

### B. Hiyerarşik Kategori Navigasyonu (`BreadcrumbList`)
`ltree` kategori ağacından gelen hiyerarşiyi Google'a bildiren şema:

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Ana Sayfa",
      "item": "https://mertervitrini.com.tr"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Kadın Giyim",
      "item": "https://mertervitrini.com.tr/kadin-giyim"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Gömlek & Bluz",
      "item": "https://mertervitrini.com.tr/kadin-giyim/gomlek-bluz"
    }
  ]
}
```

---

## 3. Çok Dilli SEO (Hreflang) ve Canonical URL Mimarisi

1. **Kendini Gösteren Canonical (Self-Referencing Canonical):**
   - Filtreleme veya sıralama parametrelerinin (`?color=red&sort=price_asc`) kopya içerik oluşturmasını engellemek için ana sayfa URL'si daima parametresiz canonical etiketine bağlanır:
     ```typescript
     // Next.js Metadata alternates tanımı
     alternates: {
       canonical: `https://mertervitrini.com.tr/product/${slug}`,
       languages: {
         'tr': `https://mertervitrini.com.tr/product/${slug}`,
         'en': `https://mertervitrini.com.tr/en/product/${slug}`,
         'ru': `https://mertervitrini.com.tr/ru/product/${slug}`,
         'ar': `https://mertervitrini.com.tr/ar/product/${slug}`,
         'x-default': `https://mertervitrini.com.tr/en/product/${slug}`
       }
     }
     ```
2. **`x-default` Stratejisi:** Küresel B2B kullanıcıları için varsayılan yönlendirme dili İngilizce (`en`) olarak atanır.

---

## 4. Dinamik XML Sitemap ve Robots.txt Yönetimi

1. **`shop/frontend/src/app/sitemap.ts`:**
   - Go Storefront API'den aktif tüm kategorileri, ürünleri (`catalog.mv_products`), sayfaları ve blog yazılarını çeker.
   - Her URL için `lastModified`, `changeFrequency` (`daily` / `weekly`) ve `priority` (Ürünler: `0.8`, Kategoriler: `0.9`, Ana sayfa: `1.0`) değerlerini dinamik üretir.
2. **`shop/frontend/src/app/robots.ts`:**
   - Botların `api/`, `profile/`, `admin/` dizinlerine girmesini engeller; sitemap adresini bildirir:
     ```typescript
     import { MetadataRoute } from 'next';
     export default function robots(): MetadataRoute.Robots {
       return {
         rules: [
           { userAgent: '*', allow: '/', disallow: ['/profile', '/api/', '/checkout'] }
         ],
         sitemap: 'https://mertervitrini.com.tr/sitemap.xml',
       };
     }
     ```

---

## 5. Yapay Zeka Destekli SEO ve İçerik Önbellekleme (`catalog.product_ai_content`)

Platformda `scripts/optimize_seo.py` otomasyon scripti ile binlerce ürünün başlık ve meta açıklamaları DeepSeek AI motoruyla zenginleştirilir:

1. **İçerik Parmak İzi (SHA-256 Fingerprint):**
   - `calculate_content_hash(title, desc, fabric, gender)` ile ürün içeriğinin özeti çıkarılır.
2. **Mükerrer Harcamayı Önleme (Cache Hit):**
   - Aynı parmak izine sahip ürün daha önce optimize edilmişse veritabanındaki `catalog.product_ai_content` tablosundan doğrudan çekilir; API kredisi harcanmaz.
3. **Üretilen SEO Alanları:**
   - `seo_title`: 55-60 karakter arası tıklama odaklı B2B başlık.
   - `seo_description`: 150-160 karakter arası toptan alıcıyı hedefleyen meta açıklama.
   - `tags`: Anahtar kelimeler dizisi (JSONB).
   - `highlights`: Kumaş, kalıp, toptan seri özellikleri (JSONB).

---

## 6. Arama Motorlarına Anında Dizinleme (IndexNow & Google Merchant)

1. **IndexNow Entegrasyonu:**
   - Yeni ürün eklendiğinde, güncellendiğinde veya silindiğinde Admin API üzerinden IndexNow servisine bildirim gönderilir:
     ```http
     POST /api/v1/indexnow/submit
     Content-Type: application/json
     {
       "host": "mertervitrini.com.tr",
       "key": "638d6e3eb8a743ec900269823f24ffe6",
       "urlList": [
         "https://mertervitrini.com.tr/product/toptan-elbise-10a4"
       ]
     }
     ```
   - Bing ve Yandex saniyeler içinde URL'i tarama sırasına alır.
2. **Google Merchant Feed:**
   - `/api/v1/store/feeds/google-merchant.xml` rotası Google Alışveriş ve Merchant Center için standart XML çıktısı verir (`g:id`, `g:title`, `g:description`, `g:price`, `g:availability`, `g:image_link`, `g:brand`, `g:condition`).

---

## 7. URL Hijyeni ve Türkçe Slug Standartları

- Türkçe karakter duyarlı `catalog.fn_slugify(p_text)` fonksiyonu:
  - `ı -> i`, `ş -> s`, `ğ -> g`, `ü -> u`, `ö -> o`, `ç -> c` dönüşümünü yapar.
  - Alfanümerik olmayan karakterleri tireye (`-`) çevirir.
  - Ürün başlıklarının sonuna Base36 sequence kimliğini ekler (`-255s`).
  - Tedarikçi maske kodları ile SKU formatını sabitler (`MIMOZA-255S`).

---

## 8. Core Web Vitals ve Görsel Performansı

1. **Largest Contentful Paint (LCP):**
   - Ana ürün kapak görseli WebP formatında sunulmalı ve boyutu 150KB altında tutulmalıdır.
2. **Cumulative Layout Shift (CLS):**
   - Tüm görsellerde `width` ve `height` veya `aspect-ratio: 3/4` CSS tanımları bulunmalı; sayfa yüklenirken zıplamalar önlenmelidir.
3. **Interaction to Next Paint (INP):**
   - Varyant seçimi ve filtre değişikliklerinde istemci tarafı state güncellemeleri 200ms altında tutulmalıdır.
