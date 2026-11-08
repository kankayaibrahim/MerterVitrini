# MERTER VİTRİNİ — İş Modeli & Büyüme Stratejisi Karşılaştırma ve Eksik Analizi (Gap Analysis)

> **Rapor Tarihi:** 09.11.2026  
> **Kapsam:** Paylaşılan *"Merter Vitrini Dijital B2B Tekstil Platformu – İş Modeli ve Büyüme Stratejisi"* (12 Bölüm) dokümanı ile mevcut `mertervitrini.com.tr` (Backend Go API + Next.js SSR Web + Flutter Mobil + PostgreSQL 18) sisteminin birebir karşılaştırılması ve eksikliklerin tespiti.

---

## 1. Yönetici Özeti: En Kritik Mimari Fark (Stratejik Yol Ayrımı)

Paylaşılan strateji belgesindeki **1. Bölüm (Vizyon)** ve **12. Bölüm (Netleştirilmesi Gereken İki Stratejik Karar)** ile mevcut yazılım altyapımız arasında **temel bir iş modeli farkı** bulunmaktadır:

| Kriter | Strateji Belgesindeki Hedef Model | Mevcut Sistemimiz (`mertervitrini.com.tr`) | Uyum / Fark Durumu |
| :--- | :--- | :--- | :--- |
| **Platformun Rolü** | **B2B Firma Rehberi, İlan & Doğrudan İletişim Platformu** (Platform satış, stok, tahsilat ve kargo üstlenmez). | **Merkezi B2B Pazar Yeri (Marketplace)** (Sepet, sipariş, Havale/EFT dekont onayı, komisyon ve tedarikçi cüzdanı var). | ⚠️ **Mimari Karar Gerekli (Hibrit veya Dönüşüm)** |
| **Üretici Kimliği** | **Açık Firma Profili:** Firmanın gerçek adı, adresi, telefonu, WhatsApp hattı ve web sitesi vitrinde açıktır. | **Açık Firma Kimliği (`brand_name`):** Firmaların gerçek ticari adları vitrinde ve mobilde açıkça gösterilir (`alias_code` yalnızca SKU ön ekidir). | 🟢 **Kural Güncellendi & Aktif** (`context/business_rules.md` Kural #1) |
| **İletişim Kanalı** | Alıcı doğrudan üreticinin **WhatsApp**, telefon veya iletişim formuna ulaşır. | Alıcı yalnızca platform içi **Canlı B2B Sohbet (WebSocket Chat)** üzerinden maskeli markayla konuşur. | 🟡 **Kısmen Var** (WhatsApp & açık profil eksik) |
| **Gelir Modeli** | **Aylık Üyelik Paketi (0 TL / 990 TL / 2.490 TL)** + **Sponsorlu Reklam Alanları**. | **Sipariş Komisyonu (`MarketplaceHandler`)**; üyelik paketi veya ilan sınırı yok. | ❌ **Abonelik & Reklam Modülü Eksik** |

> [!IMPORTANT]
> **Mimari Öneri (Hibrit Çözüm):** Mevcut sepet, sipariş ve canlı pazarlık altyapısını çöpe atmadan; `catalog.brands` tablosuna eklenecek bir **`profile_mode` (`masked_marketplace` | `open_directory` | `hybrid`)** ayarı ile her iki modeli aynı anda destekleyebiliriz. Üyeliksiz/komisyonlu tedarikçiler maskeli kalırken, **Profesyonel (990 TL)** ve **Premium (2.490 TL)** abonelik alan firmaların açık firma profili, WhatsApp butonu ve doğrudan iletişim bilgileri açılabilir.

---

## 2. Bölüm Bazlı Detaylı Karşılaştırma Tablosu (12 Bölüm)

| Bölüm & Özellik | Strateji Belgesindeki İster | Mevcut Sistemdeki Durum | Durum | Eksik / Yapılması Gerekenler |
| :--- | :--- | :--- | :---: | :--- |
| **1. Vizyon & Konumlandırma** | Firma profil vitrini + doğrudan üretici-alıcı bağlantısı | Ürün odaklı katalog vitrini + sepet/sipariş + maskeli tedarikçi | 🟡 Kısmen | Açık **Firma Vitrin Sayfaları (`/ureticiler/[slug]`)** ve doğrudan iletişim modu eklenmeli. |
| **2.A. Üretici & Toptancı Grupları** | Kadın/Erkek/Çocuk giyim, Kumaş, Fason Atölye, Private Label, Aksesuar | Kadın/Erkek/Çocuk hazır giyim katalog yapısı mevcut | 🟡 Kısmen | Tedarikçi profilinde **Faaliyet Türü (`company_types`)** (Kumaşçı, Fason Atölye, Private Label, Aksesuar) sınıflandırması eksik. |
| **2.C. Sektörel Hizmet Sağlayıcılar** | Kargo/Lojistik, Fotoğraf Stüdyosu, Ambalaj/Etiket, Modelist, İhracat Danışmanı | Sistemde yalnızca ürün satan tedarikçiler var | ❌ Eksik | **Sektörel Hizmet Sağlayıcılar Rehberi (`/hizmet-saglayicilar`)** modülü ve hizmet kategorileri eklenmeli. |
| **3. Firma ROI & Ziyaretçi Raporları** | Profil ziyaret sayısı, ürün görüntülenme, kaç alıcı iletişime geçti, ülke dağılımı, en çok ilgi gören ürünler | Admin için genel site analitiği (`AnalyticsHandler`) var; tedarikçi için sadece sipariş/cüzdan özeti var | ❌ Eksik | Tedarikçi paneline **Firma Performans & Ziyaretçi Analitiği** (Ülke, Görüntülenme, WhatsApp/İletişim tıklama sayacı) eklenmeli. |
| **4. Üyelik Paketleri (SaaS)** | **Ücretsiz (10 ürün)**, **Profesyonel 990 TL (100 ürün)**, **Premium 2.490 TL (500 ürün)** | Tüm tedarikçiler tek tip ve sınırsız ürün yükleyebiliyor | ❌ Eksik | `subscription_plans` tablosu, **10 / 100 / 500 ürün kotası denetimi**, paket yükseltme ve abonelik yönetimi eklenmeli. |
| **5.A. Alıcı Talep Panosu (RFQ)** | Alıcıların *"500 adet kadın kabanı arıyoruz"* ilanı açması ve üreticilerin teklif vermesi | Sadece genel iletişim formu (`/store/inquiries`) ve ürün içi chat var | ❌ Eksik | **Alıcı Talep Panosu (`Buying Leads / RFQ`)** (İlan açma, admin onayı, üreticilerin paketine göre erişip teklif vermesi) kurulmalı. |
| **5.B. Doğrulanmış Firma Sistemi** | Ticari bilgileri kontrol edilmiş işletmelere **Doğrulanmış Firma** statüsü | Tedarikçi başvuru formu (`supplier_applications` - vergi no/belge) var ama vitrinde rozet yok | 🟡 Kısmen | Vitrinde ve mobil uygulamada **Doğrulanmış Üretici Rozeti (`Verified Badge`)** ve doğrulama kriterleri sayfası eklenmeli. |
| **5.C. Çok Dilli Platform (TR/EN/AR/RU)** | 4 dil + otomatik çeviri + **firmaların çeviriyi düzenleyebilmesi** | TR, EN, AR (RTL), RU ve LibreTranslate otomatik çeviri motoru **tam çalışıyor** | 🟢 %85 Hazır | Tedarikçi panelinde (`/supplier` & Mobil) firmanın otomatik çevrilen ürün/profil metinlerini **elle düzenleyebileceği ekran** eklenmeli. |
| **5.D. Doğrudan Firma İletişimi** | Firma profilinde WhatsApp, Telefon, E-posta, İletişim Formu, Web Sitesi | Platform içi canlı WebSocket sohbet var; dış iletişim bilgileri gizli | ❌ Eksik | Firma profiline **WhatsApp Tıkla-Konuş (`wa.me`)** (tıklama takipli), telefon, e-posta ve firma özel iletişim formu eklenmeli. |
| **5.E. Gelişmiş B2B Arama & Filtreleme** | Kategori, Üretici/Toptancı, MOQ, Fason, Private Label, Üretim Kapasitesi, İhracat Ülkeleri, Konum | Kategori (`ltree`), renk/beden, fiyat, stok ve marka filtreleri çalışıyor | 🟡 Kısmen | **Üretim Yetkinlik Filtreleri** (Fason, Private Label, MOQ aralığı, Üretim Kapasitesi, İhracat Ülkeleri, Merter Konum/Harita) eklenmeli. |
| **5.F. Kolay Ürün Yükleme & AI** | Tekli/Toplu fotoğraf, **Excel ile yükleme**, **AI başlık/açıklama**, Aktif/Pasif, **Arşivleme** | Tekli/Toplu fotoğraf, Mobil Kamera Stüdyosu, XML entegrasyonu ve Aktif/Pasif mevcut | 🟡 %70 Hazır | **Excel/CSV ile Toplu Ürün Yükleme**, **Yapay Zekâ (AI) ile Ürün Başlığı/Açıklaması Üretme** ve **Eski Koleksiyon Arşivleme** eksik. |
| **6. Reklam & Ek Gelir Alanları** | Ana sayfa reklamı, Kategori sponsorluğu, Öne çıkan üreticiler, Yeni koleksiyon, Sektörel reklam, E-bülten | Sabit hero banner var; dinamik reklam/sponsorluk yönetimi yok | ❌ Eksik | **Sponsorlu Vitrin & Reklam Yönetimi (`Sponsored Slots`)** ve izinli **E-Bülten (Newsletter)** modülü eklenmeli. |
| **9. Hukuki & Operasyonel Yapı** | Sorumluluk sınırları, firma üyelik sözleşmesi, KVKK ve ticari ileti izinleri | Versiyonlu Yasal Politikalar (`PoliciesHandler`) ve Hesap Silme Merkezi mevcut | 🟡 Kısmen | Tedarikçi kayıt/ilan anında **Üyelik ve İçerik Sorumluluk Sözleşmesi** dijital onay kaydı ve ticari ileti izin kutuları eklenmeli. |

---

## 3. Bizde Halihazırda Çok Güçlü Olan (Strateji Belgesinin İlerisindeki) Özellikler

Strateji belgesinde yer alan birçok temel ihtiyacın ötesinde, mevcut `mertervitrini.com.tr` altyapısında **zaten canlı ve çalışır durumda olan** rekabet avantajlarımız şunlardır:

1. **Çok Dilli (TR, EN, RU, AR) & Çok Para Birimli (TRY, USD, EUR, RUB) Altyapı:**
   - TCMB günlük kur entegrasyonu (`db.StartRatesWorker`) ve LibreTranslate otomatik katalog/blog çeviri motoru (`TranslateHandler`) hazır.
2. **Toptan Seri (`series_ratio` 2-2-2 vb.) ve Paket Hesaplama Motoru:**
   - Web ve mobil uygulamada toptan tekstil ticaretine uygun seri/paket çarpanı ve minimum sipariş paketi (`minOrderPackages`) yapısı çalışıyor.
3. **Canlı B2B Sohbet ve Sohbet İçinden Özel Fiyat Teklifi (`ChatHandler`):**
   - Alıcı ile tedarikçi temsilcisi gerçek zamanlı (WebSocket) yazışabiliyor, fotoğraf gönderebiliyor ve sohbet içinden **Özel Seri Teklifi (`Custom Offer`)** oluşturup onaylayabiliyor.
4. **Mobil Uygulama (Android OTA Kendi Kendini Güncelleyen APK + Tedarikçi Kamera Stüdyosu):**
   - Hem müşteri mağazası hem de tedarikçinin kendi dükkanında fotoğraf çekip barkod okutarak 30 saniyede ürün yükleyebildiği mobil uygulama hazır.
5. **Otomatik XML Toptancı Entegrasyonu ve Dinamik WebP Görsel Optimizasyonu:**
   - Tedarikçilerin XML kataloglarını otomatik çeken ve yüksek çözünürlüklü fotoğrafları WebP formatında optimize eden altyapı mevcut.
6. **Uluslararası Teknik SEO Altyapısı:**
   - `Schema.org` (`Product`, `Offer`, `BreadcrumbList`), çok dilli `hreflang`, dinamik `sitemap.ts`, `IndexNow` anlık arama motoru bildirimi ve `Google Merchant XML Feed` hazır.

---

## 4. Eksiklerin Detaylı Teknik Dökümü (Yapılacaklar Listesi)

### Eksik #1: Üyelik Paketleri ve Kota Sistemi (Bölüm 4)
- **Veritabanı:** `catalog.subscription_plans` ve `catalog.brand_subscriptions` tabloları oluşturulmalı.
  - `FREE` (0 TL/Ay — `max_products: 10`, `whatsapp_enabled: false`, `rfq_access: none`, `analytics_level: basic`)
  - `PRO` (990 TL/Ay — `max_products: 100`, `whatsapp_enabled: true`, `rfq_access: standard`, `analytics_level: detailed`)
  - `PREMIUM` (2.490 TL/Ay — `max_products: 500`, `whatsapp_enabled: true`, `rfq_access: priority`, `is_sponsored_category: true`, `is_featured_home: true`)
- **Backend (`SupplierPortalHandler`):** Tedarikçi yeni ürün eklerken mevcut aktif ürün sayısı paket limitini (`10 / 100 / 500`) aşıyorsa `"Paket ürün limitiniz doldu. Profesyonel veya Premium pakete geçiş yapın"` uyarısı dönülmeli.

### Eksik #2: Açık Firma Vitrin Sayfası ve Doğrudan İletişim (Bölüm 1, 5.B, 5.D)
- **Veritabanı (`catalog.brands`):**
  - `is_verified BOOLEAN` (Doğrulanmış Firma rozeti)
  - `company_type VARCHAR[]` (Üretici, Toptancı, Fason, Private Label, Kumaş, Aksesuar)
  - `whatsapp_phone`, `public_email`, `public_phone`, `website_url`, `location_address`, `map_coordinates`
  - `export_countries TEXT[]`, `monthly_capacity INT`, `supports_private_label BOOLEAN`, `supports_fason BOOLEAN`
- **Frontend & Mobil:**
  - `/ureticiler` (Tüm Doğrulanmış Merter Firmaları Rehberi) ve `/ureticiler/[slug]` (Firma Özel Vitrin Sayfası: Kapak görseli, hakkımızda, üretim kapasitesi, ihracat ülkeleri, **WhatsApp ile İletişime Geç** butonu ve firmanın koleksiyonu).

### Eksik #3: Firma Bazlı Ölçülebilir Ticari Analitik Paneli (Bölüm 3 & 10.5)
- **Veritabanı (`analytics.brand_events`):**
  - `event_type`: `profile_view` | `product_view` | `whatsapp_click` | `phone_click` | `inquiry_submit` | `chat_start` | `rfq_offer`
  - `brand_id`, `product_id`, `visitor_country_code` (IP'den veya dil/ülke bilgisinden), `created_at`
- **Tedarikçi Paneli (`/supplier` & Mobil):**
  - *"Bu ay profilinizi **1.420** alıcı ziyaret etti, ürünleriniz **8.650** kez görüntülendi, **Almanya, Rusya ve Suudi Arabistan** başta olmak üzere **34** alıcı WhatsApp/Sohbet üzerinden sizinle iletişime geçti."* rapor ekranı.
  - Ücretsiz üyelerde bu ekranın ülke ve ürün detayları bulanık (blur) gösterilerek **Profesyonel Pakete Geçiş (Upsell)** tetiklenmeli.

### Eksik #4: Alıcı Talep Panosu — RFQ / Alım İlanları (Bölüm 5.A)
- **Veritabanı (`catalog.buyer_rfqs` & `catalog.buyer_rfq_offers`):**
  - Alıcının ülke, aradığı kategori, hedef adet (örn. 500 adet), hedef fiyat aralığı, özel etiket/fason talebi ve örnek fotoğraf yükleyebildiği tablo.
- **Akış:**
  1. Yerli/yabancı alıcı `/alim-talepleri/yeni` ekranından talebini bırakır.
  2. Admin onayından sonra ilan **Alıcı Talep Panosu**'nda yayınlanır ve ilgili kategorideki üreticilere bildirim düşer.
  3. **Profesyonel ve Premium** üye üreticiler ilanın iletişim bilgilerini görür veya doğrudan sistem üzerinden teklif verir.

### Eksik #5: Kolay Ürün Yükleme — Excel Import, AI Asistan ve Koleksiyon Arşivi (Bölüm 5.F)
- **Excel ile Toplu Ürün Ekleme (`POST /api/v1/supplier/products/import-excel`):**
  - Tedarikçilerin örnek Excel şablonunu indirip tek seferde ürünlerini yükleyebilmesi.
- **Yapay Zekâ (AI) Destekli Ürün Başlığı ve Açıklama Üretici (`POST /api/v1/supplier/ai/generate-copy`):**
  - Yüklenen ürün fotoğrafından veya birkaç anahtar kelimeden ("simli abiye elbise, 2-2-2 seri, krep kumaş") 4 dilde (TR, EN, AR, RU) SEO uyumlu başlık ve açıklama üretilmesi.
- **Koleksiyon Arşivleme (`is_archived BOOLEAN`):**
  - Sezonu geçen ürünlerin silinmeden arşive kaldırılması (aktif ürün kotasından düşmesi).

### Eksik #6: Sponsorlu Alanlar, Sektörel Hizmet Sağlayıcılar ve Reklam Modülü (Bölüm 2.C & 6)
- **Sponsorlu Görünürlük:** Kategori sayfalarında ilk satırda `SPONSORLU ÜRETİCİ / ÜRÜN` rozetiyle Premium üyelerin öne çıkarılması.
- **Sektörel Hizmet Sağlayıcılar Dizini:** Lojistik/Kargo, Fotoğraf Stüdyosu, Ambalaj/Etiket ve Modelist firmaları için özel rehber ve reklam kartları.

---

## 5. Önerilen Uygulama Yol Haritası (Fazlandırma)

1. **Faz 1 — Stratejik Karar & Firma Vitrini (1. Hafta):**
   - Bölüm 12'deki kararın netleştirilmesi (Açık Firma Profili + WhatsApp iletişimi + Hibrit Sepet/Sipariş yapısı).
   - `catalog.brands` tablosuna **Doğrulanmış Firma (`is_verified`)**, **Üretim Yetkinlikleri (Fason, Private Label, Kapasite, İhracat Ülkeleri)** ve **WhatsApp/İletişim** alanlarının eklenmesi.
   - Web ve mobilde **Firma Vitrin Sayfaları (`/ureticiler/[slug]`)** ve gelişmiş B2B üretim filtrelerinin açılması.
2. **Faz 2 — Üyelik Paketleri (0 / 990 / 2.490 TL) & Firma Ziyaretçi Analitiği (2. Hafta):**
   - Ücretsiz (10 ürün), Profesyonel (100 ürün) ve Premium (500 ürün) paketlerinin ve kota kontrolünün devreye alınması.
   - Tedarikçi paneline **"Profilimi kaç kişi gördü, hangi ülkelerden ilgi var, kaç kişi WhatsApp/İletişime tıkladı?"** analitik ekranının eklenmesi.
3. **Faz 3 — Alıcı Talep Panosu (RFQ) & Sektörel Hizmet Sağlayıcılar (3. Hafta):**
   - Alıcıların üretim/toptan alım ilanı bırakabildiği **Alıcı Talep Panosu**'nun web ve mobilde açılması.
   - Kargo, çekim stüdyosu, etiket/ambalaj firmaları için **Sektörel Hizmet Sağlayıcılar** dizininin eklenmesi.
4. **Faz 4 — Excel Yükleme, AI Ürün Asistanı & Sponsorlu Reklam Alanları (4. Hafta):**
   - Tedarikçi paneline Excel ile toplu ürün yükleme, koleksiyon arşivleme ve AI başlık/açıklama oluşturucu eklenmesi.
   - Ana sayfa ve kategori sayfalarında sponsorlu üretici/koleksiyon vitrin alanlarının devreye alınması.

