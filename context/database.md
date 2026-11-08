# Veritabanı Mimarisi ve Veri Modeli Dokümanı (Database)

## 1. Veritabanı Genel Özellikleri

- **Veritabanı Motoru:** PostgreSQL 18+ (Native `uuidv7()` desteği)
- **Veritabanı Adı:** `merterdevdb` (Geliştirme & Canlı Veritabanı)
- **Karakter Seti (Encoding):** `UTF-8`
- **Karakter Sıralaması (Collation):** `tr_TR.utf8` / `C`
- **Aktif Eklentiler (Extensions):**
  - `pgcrypto` (`extensions.pgcrypto`): Kriptografik fonksiyonlar ve şifreleme.
  - `ltree` (`extensions.ltree`): Sınırsız derinlikte hiyerarşik kategori ağacı yönetimi ve hızlı alt ağaç sorguları.

---

## 2. Anahtar Standartları ve İndeksleme Stratejisi

### A. Birincil Anahtar (Primary Key) Standardı: UUIDv7
- Sistemdeki tüm ana tablolar (`categories`, `products`, `brands`, `orders`, `carts` vb.) birincil anahtar olarak **UUIDv7** (`uuid DEFAULT uuidv7()`) kullanır.
- **Neden UUIDv7?** Zaman damgası tabanlı sıralanabilir (time-ordered) olduğu için standart UUIDv4'ün B-Tree indekslerinde yarattığı sayfa parçalanmasını (page fragmentation) tamamen önler; yüksek yazma hızını ve sıralı indeks verimliliğini garanti eder.

### B. Base36 Slug ID ve Benzersiz SKU Üretimi
- Ürünlerin public URL'lerinde ve SKU kodlarında karmaşık UUID'ler yerine kısa, SEO uyumlu ve sıralı **Base36** kimlikleri kullanılır:
  - `catalog.products_slug_id_seq`: `100000` başlangıç değerine sahip sequence.
  - `catalog.to_base36(val bigint)`: Sequence sayısını 6 haneli Base36 alfanümerik dizeye dönüştürür (örn: `100000` -> `255s`).
  - **Tetikleyici (Trigger):** `catalog.trig_product_custom_sku` tetikleyicisi, tedarikçinin kısa SKU ön ek kodunu (`alias_code`) ve bu Base36 değerini birleştirerek benzersiz SKU üretir:
    $$\text{SKU} = \text{ALIAS\_CODE} + \text{"-"} + \text{SLUG\_ID} \quad (\text{Örn: } \text{MIMOZA-255S})$$

---

## 3. Şema ve Tablo Dağılımı

Veritabanı mantıksal olarak 4 ana şemaya ayrılmıştır:

```text
merterdevdb/
├── extensions          -> pgcrypto, ltree eklentileri
├── identity            -> Keycloak ile senkron kullanıcılar ve oturum geçmişi
├── catalog             -> Ürünler, kategoriler, markalar, siparişler, diller, sayfalar
└── integration         -> XML feed konfigürasyonları, senkronizasyon logları ve cronlar
```

### A. `identity` Şeması
- **`identity.users`:** Keycloak IAM'den senkronize edilen yönetici, personel ve B2B müşteri profilleri.
  - `id`: Keycloak kullanıcı UUID dizesi (`VARCHAR(255)`).
  - `user_role`: `super_admin`, `admin`, `editor`, `sales_manager`, `warehouse`, `customer`.
  - `is_blocked`, `block_reason`: Şüpheli veya yetkisiz kullanıcıların engellenmesi.
  - Fatura, teslimat adresi, vergi no/TCKN, Instagram kullanıcı adı.
- **`identity.user_login_history`:** Müşteri oturum açma tarihleri ve IP logları.

### B. `catalog` Şeması (Ana Katalog & Ticaret)
1. **Tedarikçiler ve Markalar (`catalog.brands`):**
   - Toptancı ve üretici firmaların vitrinde açıkça gösterilen gerçek isimleri (`brand_name`), iletişim bilgileri (`website`, `phone`, `addresses`) ve SKU ön eki olarak kullanılan kısa kodları (`alias_code`: MIMOZA, FLORA, EDUSA vb.).
2. **Kategori Ağacı (`catalog.categories` & `catalog.category_translations`):**
   - `node_path extensions.ltree`: Hiyerarşik kategori yolunu tutar (örn: `TopLevelId.SubLevelId`).
   - `idx_categories_node_path_gist`: GiST indeksi ile alt kategoriler milisaniyeler içinde tek sorguyla çekilir (`node_path <@ 'TopLevel'`).
   - `trig01_calculate_path` & `trig02_update_children_path`: Ebeveyn kategori değiştiğinde tüm alt ağacın yolunu otomatik günceller.
   - `catalog.category_translations`: Çok dilli başlık (`title`) ve SEO açıklaması (`seo_description`).
3. **Ürün Master ve Varyantları:**
   - **`catalog.products`:** Ana ürün kaydı, fiyatlar (`buying_price`, `price`, `discounted_price`, `single_price`), para birimi, stok, koli oranı (`packing_ratio`), seri oranı (`series_ratio`), minimum sipariş miktarı (`minimum_order_quantity`).
   - **`catalog.product_variants`:** Beden ve tekli satış kırılımları (`variant_size`, `is_single`, `custom_sku`, `barcode`, `stock`).
   - **`catalog.product_images`:** Orijinal ve optimize edilmiş WebP boyutları (`original_size_bytes`, `optimized_size_bytes`, `is_optimized`), sıralama ve kapak resmi (`is_cover`).
   - **`catalog.product_translations`:** `(product_id, language_code)` bazında çok dilli başlık, kısa açıklama ve detaylı açıklama.
4. **B2B Sepet ve Sipariş Süreci:**
   - **`catalog.carts` & `catalog.cart_items`:** Müşteriye bağlı sepet kayıtları.
   - **`catalog.orders`:** Benzersiz sipariş numarası (`order_number`), toplam tutar, `order_status` (`PENDING_PAYMENT`, `PAYMENT_RECEIVED`, `PREPARING`, `SHIPPED`, `DELIVERED`, `CANCELLED`).
   - **`catalog.order_items`:** Satın alma anındaki birim fiyatı ve görseli sabitleyen sipariş kalemleri.
   - **`catalog.payment_notifications`:** Havale/EFT bildirim formu (banka adı, gönderen, dekont/notlar).
   - **`catalog.refunds` & `catalog.refund_items`:** İade/iptal talepleri ve ürün kırılımları.
5. **Döviz, Coğrafya ve Hukuk:**
   - **`catalog.exchange_rates`:** TCMB'den otomatik çekilen günlük döviz kurları (`currency_code`, `buying_rate`, `selling_rate`, `publication_date`).
   - **`catalog.countries`, `country_states`, `country_groups`:** Lokasyon ağacı.
   - **`catalog.legal_policies`:** Versiyonlanan sözleşmeler (`cancellation_and_return`, `terms_of_service`, `privacy_policy`).
   - **`catalog.blog_posts` & `catalog.blog_post_translations`:** Çok dilli B2B içerik ve blog motoru.

### C. `integration` Şeması (XML & Otomasyon)
- **`integration.xml_feeds`:** Tedarikçi XML kaynakları, periyodik çalışma sıklığı, JSONB formatında alan eşleme kuralları (`mapping_config`) ve kategori eşleme kuralları (`category_mapping`).
- **`integration.sync_runs`:** Canlı senkronizasyon çalıştırmaları. Durumlar: `running`, `completed`, `failed`. `summary` kolonunda eklenen, güncellenen ve pasife alınan ürün sayıları JSONB olarak saklanır.
- **`integration.cron_settings` & `integration.cron_logs`:** Otomatik senkronizasyon zamanlayıcısı ve geçmiş logları.

---

## 4. Storefront Performans Optimizasyonu: Materialized View

Mağaza vitrininde binlerce ürünün kategori, marka, renk, kumaş, çeviriler ve görsellerle hızlıca listelenebilmesi için denormalize edilmiş **`catalog.mv_products`** Materialized View'ı kullanılır.

```sql
-- Storefront Materialized View Yenileme Komutu
REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products;
```

- **Eşzamanlı Yenileme (Concurrent Refresh):** `idx_mv_products_id` unique indeksi sayesinde görünüm yenilenirken mağaza sitesindeki listeleme sorguları kilitlenmez (non-blocking).
- Görünüm üzerinde `brand_id`, `category_id`, `slug`, `slug_id`, `created_at DESC` ve `node_path gist` indeksleri tanımlıdır.

---

## 5. Veritabanı Sürücüsü, ORM Yaklaşımı ve Dayanıklılık (Resilience)

1. **Sürücü Seçimi:** Go standart kütüphanesinin `database/sql` arayüzü yerine, PostgreSQL'e özel ve çok daha hızlı olan `github.com/jackc/pgx/v5` (`pgxpool.Pool`) kullanılır.
2. **Neden Saf SQL?** Ağır ORM'lerin (GORM, EF Core benzeri) getirdiği runtime overhead, bellek yükü ve kontrolsüz N+1 sorgularını engellemek için tüm sorgular optimize edilmiş saf SQL olarak yazılmıştır.
3. **Startup Kurtarma (Self-Healing Recovery):**
   - Backend servisi yeniden başladığında veya yeni sürüm deploy edildiğinde, `integration.sync_runs` tablosunda `running` durumunda kilitli kalmış süreçler otomatik olarak `failed` durumuna çekilir ve sistem kilitlenmeleri önlenir.
4. **Redis Fallback:** Redis bağlantısı kesilirse sistem çökmez; loglara uyarı bırakılarak senkronizasyon takibi Go in-memory süreçlerine devredilir.
