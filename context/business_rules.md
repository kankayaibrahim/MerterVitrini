# Kritik İş Mantığı ve Güvenlik Kuralları (Business & Security Rules)

## 1. Açık Firma Profili ve Doğrudan Tedarikçi Kimliği Kuralı

Merter Vitrini, İstanbul Merter'deki tekstil üreticilerini ve toptancı firmaları küresel alıcılarla doğrudan buluşturan açık bir B2B ticaret ve tanıtım platformudur. Bu nedenle:
1. **Gerçek Firma Adları ve Profilleri Vitrinde Açıkça Gösterilir:**
   - Veritabanındaki `catalog.brands.brand_name` (örn: *Lustrin Toptan Tekstil*, *Etika Fashion*, *Jane's Toptan*) müşteri arayüzünde (Storefront, Mobil Uygulama) ve dışa açık katalog API'lerinde **gizlenmeden, gerçek ticari isimleriyle** sunulur.
   - `catalog.mv_products` Materialized View ve tüm katalog sorguları doğrudan `b.brand_name` alanını döner:
     ```sql
     b.brand_name AS brand_name
     ```
2. **Açık Firma İletişimi, Self-Servis Profil ve Entegrasyon Kaynağı Ayrımı:**
   - Tedarikçiler kendi Tedarikçi Portalı (`/supplier` -> `PUT /api/v1/supplier/profile`) üzerinden firma tanıtım yazısı, faaliyet türü, üretim yetenekleri (`supports_private_label`, `supports_fason`, `export_countries`), doğrudan iletişim kanalları (`whatsapp_phone`, `phone`, `public_email`, `website`, `instagram_handle`, `location_address`) ve doğrudan tahsilat banka/IBAN (`bank_name`, `bank_account_holder`, `iban`) bilgilerini self-servis olarak ekleyip güncelleyebilirler.
   - Firmanın vitrinde paylaştığı iletişim ve banka/IBAN bilgileri ürün detaylarında (`SupplierDirectCard`) alıcılara açıkça gösterilir.
   - `alias_code` (`MIMOZA`, `FLORA`, `EDUSA` vb.) yalnızca otomatik üretilen benzersiz ürün stok kodlarında (`custom_sku`) kısa ön ek olarak kullanılır; firma adını gizlemek için **kullanılmaz**.
   - Yalnızca tedarikçiye ait arka plan XML entegrasyon adresi (`integration.xml_feeds.feed_url`) ve tedarikçi iç alış maliyeti (`buying_price`) dışa açık (public) API çıktılarından gizlenir.

---

## 2. SKU ve Benzersiz Tanımlayıcı Formatları

Ürünlerin stok kodları (SKU), depo ve entegrasyon süreçlerinin hatasız yürümesi için sıkı bir standarda bağlıdır:
1. **Ana Ürün SKU Kuralı:**
   - Format: `[ALIAS_CODE]-[BASE36_SLUG_ID]`
   - Örnek: `MIMOZA-255S`, `FLORA-10A4`
   - Tetikleyici: `catalog.trig_product_custom_sku_before` tarafından otomatik oluşturulur.
2. **Varyant SKU Kuralı (Beden / Seri):**
   - Format: `[ÜRÜN_SKU]-[BEDEN_SLUG]`
   - Örnek: `MIMOZA-255S-S`, `MIMOZA-255S-M`, `MIMOZA-255S-38`
3. **Tekli Satış Varyant SKU Kuralı:**
   - Eğer ürün toptan seri yerine tekli parçalar halinde satılıyorsa sonuna `-single` eklenir:
   - Örnek: `MIMOZA-255S-S-single`
   - Tetikleyici: `catalog.trig_variant_custom_sku_before` tarafından otomatik oluşturulur.

---

## 3. B2B Toptan Satış, Seri ve Paketleme Kuralları

1. **Seri Oranı (`series_ratio`) ve Koli Oranı (`packing_ratio`):**
   - Toptan hazır giyimde ürünler seriler halinde (örn: `1-2-2-1` -> 1 Adet S, 2 Adet M, 2 Adet L, 1 Adet XL) satılır.
   - Sepet ve sipariş süreçlerinde minimum sipariş miktarı (`minimum_order_quantity`) denetlenir.
   - Müşterinin sepetine eklediği adetler, serinin katları olmak zorundadır (tekli satış istisnası hariç).
2. **Tekli Fiyat Gösterimi (`show_single_price`):**
   - Sistem ayarlarında (`catalog.settings.show_single_price`) açık ise seriye ek olarak tek parça birim fiyatı vitrinde hesaplanarak gösterilir.
3. **Doğrudan Tedarikçi Fiyatı Kuralı (%0 Platform Fiyat Marjı):**
   - Tedarikçilerin XML entegrasyonlarından (`etika.py`, `janes.py`, Go XML Sync) veya Tedarikçi Portalı'ndan girilen fiyatlar, üzerine herhangi bir komisyon veya kâr marjı (`PROFIT_RATE = 0.0`) eklenmeden **birebir tedarikçinin kendi fiyatı** olarak vitrinde gösterilir (`price = buying_price`).
4. **Sadece Üyelere Özel Toptan Fiyat Gösterimi (Members-Only Pricing Guard):**
   - B2B ticari gizliliği korumak amacıyla **üye olmayan (giriş yapmamış) ziyaretçiler** web vitrininde (`ProductCard`, `ProductDetailsModal`, `ProductSpecs`, `OrderCalculator`, `WishlistDrawer`, `CartDrawer`) ve mobil uygulamada (`SessionProvider.canViewPrices`, `B2BProductCard`, `ProductDetailScreen`) ürün birim fiyatlarını, seri paket fiyatlarını, indirim oranlarını ve sipariş toplam tutarlarını **göremez**.
   - Giriş yapmamış kullanıcılara fiyat alanlarında **"🔒 Üyelere Özel Fiyat (Giriş Yap)"** / **"🔒 Fiyatları Görmek İçin Giriş Yapın / Üye Olun"** butonu gösterilir ve tıklandığında doğrudan Üye Giriş / Kayıt ekranı (`openStoreAuthModal("login")` / `AuthScreen`) açılır.

---

## 4. Çoklu Para Birimi ve TCMB Döviz Entegrasyonu

1. **Temel Muhasebe Para Birimi:** `TRY` (Türk Lirası).
2. **Döviz Kurları Arka Plan İşçisi:**
   - Storefront Backend servisi ayağa kalktığında `db.StartRatesWorker` arka planda çalışmaya başlar.
   - Türkiye Cumhuriyet Merkez Bankası (TCMB) günlük XML kur servisini sorgular ve `catalog.exchange_rates` tablosuna yazar.
   - Vitrin arayüzünde kullanıcı USD, EUR, RUB vb. para birimlerini seçtiğinde fiyatlar TCMB efektif satış/alış kurlarıyla anlık dönüştürülür.

---

## 5. Çok Dillilik (i18n) ve SEO Standartları

1. **Desteklenen Diller:** Türkçe (`tr`), İngilizce (`en`), Rusça (`ru`), Arapça (`ar` - Sağdan Sola RTL).
2. **SEO Uyumlu Slug Standardı:**
   - Başlıklar URL formatına dönüştürülürken `catalog.fn_slugify` fonksiyonu Türkçe karakterleri uluslararası standartta temizler (`ı->i`, `ş->s`, `ğ->g`, `ü->u`, `ö->o`, `ç->c`).
   - Benzersizliği garanti etmek için slug'ın sonuna Base36 kimliği eklenir: `[temiz-baslik]-[slug_id]`.
3. **IndexNow Arama Motoru Entegrasyonu:**
   - Yeni ürün eklendiğinde, güncellendiğinde veya blog yazısı yayımlandığında IndexNow API (`/api/v1/indexnow/submit`) üzerinden Yandex, Bing ve arama motorlarına anında bildirim gönderilir.
4. **Google Merchant XML Feed:**
   - Canlı ürün kataloğu Google Merchant formatında `/api/v1/store/feeds/google-merchant.xml` rotasından dinamik XML olarak üretilir.

---

## 6. Doğrudan Tedarikçiye Sipariş Yönlendirme (%0 Komisyon) ve Sipariş Yaşam Döngüsü

1. **Doğrudan Tedarikçiye Sipariş ve Tahsilat Kuralı (`%0.00` Komisyon):**
   - Merter Vitrini üzerinden oluşturulan tüm siparişler (`POST /api/v1/store/orders`) ve sepet/teklif talepleri (`POST /api/v1/store/inquiries`), içindeki ürünlerin ait olduğu tedarikçi firmalara göre otomatik olarak ayrıştırılır (`catalog.supplier_sub_orders`, `%0.00` komisyon).
   - Alıcının tüm iletişim bilgileri (`customer_name`, `customer_company`, `customer_phone`, `customer_email`) ve teslimat adresi (`delivery_address`) doğrudan ilgili tedarikçinin **Tedarikçi Portalı -> Gelen Siparişlerim** ekranına düşer ve tedarikçiye anında bildirim gönderilir.
   - Sipariş yanıtında alıcıya her tedarikçinin doğrudan WhatsApp sipariş bağlantısı (`whatsapp_url`) ve doğrudan banka/IBAN bilgileri (`supplier_orders`) döner; alıcı ödemeyi ve sevkiyat iletişimini doğrudan tedarikçi firmayla yürütür.

```mermaid
stateDiagram-v2
    [*] --> PENDING_PAYMENT: Müşteri Siparişi Oluşturur
    PENDING_PAYMENT --> PAYMENT_NOTIFICATION: Müşteri Havale Dekontu/Bildirimi Gönderir
    PAYMENT_NOTIFICATION --> PAYMENT_RECEIVED: Yönetici Ödemeyi Onaylar
    PENDING_PAYMENT --> CANCELLED: Müşteri İptal Eder / Süre Aşımı
    PAYMENT_RECEIVED --> PREPARING: Depo Hazırlamaya Başlar
    PREPARING --> SHIPPED: Kargoya / Sevkiyata Verildi
    SHIPPED --> DELIVERED: Müşteriye Teslim Edildi
    DELIVERED --> REFUND_REQUESTED: İade Talebi Açıldı
    REFUND_REQUESTED --> REFUNDED: Yönetici İadeyi Kabul Etti
```

1. **`PENDING_PAYMENT`:** Sipariş açıldı, stok bloke edildi, havale bekleniyor.
2. **`PAYMENT_NOTIFICATION`:** Müşteri banka adı, tutar ve dekont bilgisini girdi (`catalog.payment_notifications`).
3. **`PAYMENT_RECEIVED`:** Satış/Muhasebe yöneticisi banka hesabını teyit edip ödemeyi onayladı.
4. **`PREPARING`:** Depo sipariş kalemlerini toplamaya başladı.
5. **`SHIPPED`:** Taşıma/Kargo takip kodu girildi.
6. **`DELIVERED`:** Teslimat tamamlandı.

---

## 7. Görsel İşleme ve WebP Optimizasyonu

1. **Dinamik Yeniden Boyutlandırma:**
   - `/api/v1/store/images/resize?url=...&w=400&h=600&q=80`
   - Orijinal yüksek çözünürlüklü görseller sunucu kaynaklarını tüketmemek için WebP formatına sıkıştırılır.
2. **Toplu Önceden Üretim (Bulk Pre-generation):**
   - Yeni XML entegrasyonu tamamlandığında binlerce görselin mağaza açılışını yavaşlatmaması için `StartBulkResize` ile arka planda toplu optimizasyon başlatılır ve `bulk-status` üzerinden takip edilir.


---

## 8. Tedarikçi Üyelik Paketleri, Sınırsız Ürün Kotası, Muhasebe ve Faturalandırma (`0021`)

1. **Sınırsız Ürün Yükleme Kuralı (`max_products = -1`):**
   - Platformda hiçbir tedarikçi için ürün yükleme sınırı (kota) uygulanmaz (`catalog.subscription_plans.max_products = -1`). Ücretsiz, Profesyonel ve Premium paketlerin tamamında ürün yükleme sınırsızdır.
2. **Şimdilik Ücretsiz (`is_complimentary = true`) & Aylık Ödeme Altyapısı:**
   - Tedarikçiler varsayılan olarak **Ücretsiz Vitrin (`FREE`, `is_complimentary = true`)** statüsünde başlar.
   - Dileyen tedarikçiler **Profesyonel Vitrin (`PRO` - 990 TL/Ay)** veya **Premium & Sponsorlu Vitrin (`PREMIUM` - 2.490 TL/Ay)** paketleri ya da reklam alanları için aylık/yıllık ödeme yapabilir.
3. **Muhasebe, Tahsilat ve Faturalandırma Tabloları:**
   - `catalog.subscription_plans`: Paket tanımları ve fiyatları (`max_products = -1`).
   - `catalog.supplier_subscriptions`: Tedarikçinin aktif paketi, `total_paid_amount` (bugüne kadar ödediği toplam tutar), `total_invoiced_amount` (kesilen toplam fatura), `outstanding_balance` (kalan cari bakiye) ve resmi vergi/fatura bilgileri (`billing_company_title`, `tax_office`, `tax_number`, `billing_address`, `billing_email`).
   - `catalog.supplier_invoices`: Kesilen resmi fatura kayıtları (`MV-FAT-...`, KDV %20 hesaplamalı).
   - `catalog.supplier_subscription_payments`: Tedarikçinin Merter Vitrini'ne yaptığı aylık ödeme/tahsilat kayıtları (`MV-THS-...`).
   - `catalog.supplier_accounting_ledger`: Çift taraflı cari hesap ekstresi (`INVOICE_DEBIT` borç tahakkuku ve `PAYMENT_CREDIT` ödeme alacağı).
