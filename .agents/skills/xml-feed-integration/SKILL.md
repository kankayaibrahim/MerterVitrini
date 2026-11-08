---
name: xml-feed-integration
description: Toptancı tedarikçi XML kaynaklarının (MIMOZA, FLORA, EDUSA) sisteme tanıtılması, şema eşleme, katalog senkronizasyonu ve Materialized View yenileme iş akışı.
---

# XML Tedarikçi Entegrasyonu ve Katalog Senkronizasyon İş Akışı (XML Feed Integration Skill)

Bu rehber, Merter Vitrini platformuna yeni bir toptancı tedarikçi eklendiğinde veya mevcut XML akışlarında senkronizasyon yürütüldüğünde izlenmesi gereken standart operasyonel adımları içerir.

---

## 1. Tedarikçi ve SKU Ön Ek Kodu Kurulumu (`catalog.brands`)

Vitrinde tedarikçi firmaların gerçek ticari adları (`brand_name`) açıkça gösterilir. `alias_code` yalnızca ürün SKU kodlarında (`MIMOZA-255S` vb.) benzersiz ön ek olarak kullanılır.

Yeni bir tedarikçi eklerken:
1. `brand_name`: Tedarikçinin vitrinde görünecek gerçek firma/marka adı (örn: `Lustrin Toptan Tekstil`).
2. `alias_code`: Ürün SKU kodlarında ön ek olarak kullanılacak benzersiz kısa kod (örn: `MIMOZA`).
3. `slug`: Sistem tarafından `catalog.fn_slugify` ile otomatik türetilir.

```sql
INSERT INTO catalog.brands (id, brand_name, alias_code, is_active)
VALUES (uuidv7(), 'Yeni Toptan Tekstil Ltd', 'LOTUS', true);
```

---

## 2. XML Feed ve Alan Eşleme Yapılandırması (`integration.xml_feeds`)

Tedarikçinin XML linki ve JSON eşleme şeması kaydedilir:
- **`feed_id`:** Kısa dize tanımlayıcı (örn: `lotus`).
- **`mapping_config`:** XML etiketlerinin sistem alanlarına eşlenmesi:
  - `product_id_field`: XML'deki benzersiz ürün kodu (`product_id` vb.).
  - `title_field`: Ürün adı.
  - `price_field`: Satış fiyatı.
  - `stock_field`: Stok miktarı.
  - `images_field`: Görsel linkleri dizisi.
  - `variants_field`: Beden/varyant kırılımları.
- **`category_mapping`:** Tedarikçinin kategori ağacının sistemimizdeki `catalog.categories` (`node_path` / ltree) ID'lerine eşlenmesi.

---

## 3. Senkronizasyon Sürecini Tetikleme ve İzleme

Senkronizasyon Admin API üzerinden tetiklenir:

```http
POST /api/v1/feeds/{feed_id}/sync
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

İşlem adımları:
1. **Veri İndirme:** XML kaynağı akış (stream) olarak sunucuya çekilir.
2. **Katalog Güncelleme:**
   - Yeni ürünler için Base36 slug üretilir ve otomatik SKU atanır: `[ALIAS]-[SLUG_ID]`.
   - Mevcut ürünlerin stok, fiyat ve aktiflik durumları güncellenir.
   - XML'de artık bulunmayan ürünler güvenli şekilde pasife (`is_active = false`) çekilir.
3. **Senkronizasyon Takibi:** Durum `integration.sync_runs` tablosunda ve Redis üzerinde anlık olarak güncellenir (`running` -> `completed` / `failed`).

---

## 4. Vitrin Materialized View Yenileme (Zorunlu Adım)

Senkronizasyon bittiğinde yeni ve güncellenen ürünlerin mağaza vitrinine yansıması için `catalog.mv_products` Materialized View'ının yenilenmesi ZORUNLUDUR:

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY catalog.mv_products;
```

> **Not:** `CONCURRENTLY` ifadesi, yenileme sırasında mağaza kullanıcılarının kesintisiz alışveriş yapmasını ve veritabanı kilitlenmelerinin (table locking) önüne geçilmesini sağlar.

---

## 5. Görsel Optimizasyonunu Başlatma (WebP Pre-generation)

Yeni ürünlerin orijinal görsellerinin sıkıştırılması ve WebP formatında önbelleğe alınması için toplu işlem başlatılır:

```http
POST /api/v1/store/images/bulk-resize
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

Durum `GET /api/v1/store/images/bulk-status` rotasından canlı olarak takip edilebilir.

---

## 6. Olası Hata Durumları ve Çözümleri

1. **"Sync run stuck in running status" (Senkronizasyon Kilitlendi):**
   - Sunucu yeniden başladığında veya bağlantı koptuğunda kilitlenen kayıtlar Go backend başlangıcında otomatik olarak temizlenir.
   - Manuel temizlik için:
     ```sql
     UPDATE integration.sync_runs 
     SET status = 'failed', completed_at = CURRENT_TIMESTAMP, 
         summary = '{"error": "Manuel iptal edildi"}' 
     WHERE status = 'running';
     ```
2. **"Unknown Category Unmapped" (Eşlenmemiş Kategori):**
   - XML'den gelen yeni bir kategori varsa, Admin panelinden `integration.xml_feeds.category_mapping` JSON alanına yeni kategori ID'si eklenmeli ve sync yeniden çalıştırılmalıdır.
