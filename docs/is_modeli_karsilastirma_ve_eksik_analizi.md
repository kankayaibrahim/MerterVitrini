# MERTER VİTRİNİ — İş Modeli & Büyüme Stratejisi Karşılaştırma ve Eksik Analizi (Gap Analysis)

> **Rapor Tarihi:** 09.11.2026 (Son Güncelleme: Açık Üretici Kimliği, %0 Marj Doğrudan Fiyat ve Doğrudan Tedarikçiye Sipariş Mimarisi Sonrası)  
> **Kapsam:** Paylaşılan *"Merter Vitrini Dijital B2B Tekstil Platformu – İş Modeli ve Büyüme Stratejisi"* (12 Bölüm) dokümanı ile mevcut `mertervitrini.com.tr` (Backend Go API + Next.js SSR Web + Flutter Mobil + PostgreSQL 18) sisteminin birebir karşılaştırılması, tamamlanan dönüşümler ve kalan geliştirmelerin tespiti.

---

## 1. Yönetici Özeti: Temel Mimari Uyum Tablosu

Strateji belgesindeki **1. Bölüm (Vizyon)** ve **12. Bölüm (Stratejik Kararlar)** doğrultusunda platformumuzda gerçekleştirilen mimari dönüşümler ve güncel uyum durumu aşağıdadır:

| Kriter | Strateji Belgesindeki Hedef Model | Mevcut Sistemimiz (`mertervitrini.com.tr`) | Uyum / Fark Durumu |
| :--- | :--- | :--- | :--- |
| **Platformun Rolü & Sipariş Akışı** | **B2B Firma Vitrini & Doğrudan Ticaret Platformu** (Her firma kendi ürününü, fiyatını, siparişini, tahsilatını ve teslimatını yönetir). | **Doğrudan Tedarikçiye Sipariş & Self-Servis Vitrin:** Siparişler ve sepet teklifleri **%0.00 komisyonla** doğrudan ilgili tedarikçiye (`catalog.supplier_sub_orders`) düşer; alıcı bilgileri ve tedarikçi IBAN/WhatsApp bilgileri doğrudan paylaşılır. | 🟢 **Tamamlandı & Aktif** (`context/business_rules.md` Kural #6) |
| **Üretici Kimliği** | **Açık Firma Profili:** Firmanın gerçek adı, adresi, telefonu, WhatsApp hattı ve web sitesi vitrinde açıktır. | **Açık Firma Kimliği (`brand_name` & `brand_profile`):** Firmaların gerçek ticari adları, doğrulanmış rozeti, Merter adresi, telefon/WhatsApp ve IBAN bilgileri vitrinde, filtrelerde ve mobilde açıkça gösterilir (`alias_code` yalnızca SKU ön ekidir). | 🟢 **Tamamlandı & Aktif** (`context/business_rules.md` Kural #1) |
| **Fiyatlandırma Politikası** | Firmaların kendi belirlediği doğrudan toptan fabrika çıkış fiyatları. | **%0 Platform Marjı (`PROFIT_RATE = 0.0`) & Üyelere Özel B2B Fiyat Koruması:** Tüm ürünler (`8.727` ürün) birebir tedarikçi fiyatıyla yayınlanır. Üye olmayan (giriş yapmamış) ziyaretçiler web ve mobilde fiyatları göremez; **"🔒 Üyelere Özel Fiyat (Giriş Yap)"** uyarısıyla üyeliğe yönlendirilir. | 🟢 **Tamamlandı & Aktif** (`context/business_rules.md` Kural #3.3 & #3.4) |
| **Doğrudan İletişim Kanalı** | Alıcı doğrudan üreticinin **WhatsApp**, telefon, e-posta veya iletişim formuna ulaşır. | Ürün detayında açık **Üretici İletişim & Doğrudan WhatsApp Sipariş Kartı (`SupplierDirectCard`)** + platform içi **Canlı B2B Sohbet (WebSocket Chat)** + Tedarikçi Portalı'ndan **Alıcıya 1-Tıkla WhatsApp** bağlantısı aktif. | 🟢 **Tamamlandı & Aktif** |
| **Gelir Modeli & Muhasebe** | **Aylık Üyelik Paketi (0 TL / 990 TL / 2.490 TL)** + **Sponsorlu Reklam Alanları** (Bizde Ürün Sınırı Yok). | **Şimdilik Ücretsiz + Tam SaaS Muhasebe, Ödeme & Faturalandırma Altyapısı (`0021`):** Tüm paketlerde ürün yükleme **sınırsızdır (`max_products = -1`)**. Tedarikçilerin aylık ödemeleri (`supplier_subscription_payments`), faturaları (`supplier_invoices`) ve cari borç/alacak defteri (`supplier_accounting_ledger`) hem `/supplier` hem `/admin` panelinde aktiftir. | 🟢 **Tamamlandı & Aktif** (`context/business_rules.md` Kural #7) |

---

## 2. Bölüm Bazlı Detaylı Karşılaştırma Tablosu (12 Bölüm)

| Bölüm & Özellik | Strateji Belgesindeki İster | Mevcut Sistemdeki Durum | Durum | Eksik / Yapılması Gerekenler |
| :--- | :--- | :--- | :---: | :--- |
| **1. Vizyon & Konumlandırma** | Açık firma vitrini + doğrudan üretici-alıcı bağlantısı + sıfır komisyonlu doğrudan sipariş | Tedarikçiler kendi vitrin/iletişim/IBAN bilgilerini yönetebiliyor; siparişler %0 komisyonla doğrudan tedarikçiye gidiyor; bağımsız **Merter Doğrulanmış Üretici Firma Rehberi (`/ureticiler`)** ve **Firma Özel Vitrin & Koleksiyon Sayfası (`/ureticiler/[slug]`)** yayında | 🟢 **%100 Tamamlandı** | Tamamlandı (`GET /api/v1/store/brands/{slug}`, `/ureticiler`, `/ureticiler/[slug]`). |
| **2.A. Üretici & Toptancı Grupları** | Kadın/Erkek/Çocuk giyim, Kumaş, Fason Atölye, Private Label, Aksesuar | `catalog.brands.company_type` (`uretici_toptanci`, `private_label`, `fason_atolye`, `kumas_tedarikcisi`, `aksesuar`) Tedarikçi Portalı'nda, Firma Rehberi'nde (`/ureticiler`) ve Katalog Sol Filtre Panelinde (`FilterSidebar.tsx` & Mobil) aktif | 🟢 **%100 Tamamlandı** | Tamamlandı (`store_catalog.go`, `FilterSidebar.tsx`, `/ureticiler`). |
| **2.C. Sektörel Hizmet Sağlayıcılar** | Kargo/Lojistik, Fotoğraf Stüdyosu, Ambalaj/Etiket, Modelist, İhracat Danışmanı | `catalog.service_providers` tablosu, 5 ana hizmet kategorisiyle (`kargo_lojistik`, `fotograf_studyo`, `ambalaj_etiket`, `modelist_kalip`, `ihracat_danismanlik`) açık **Sektörel Hizmet Sağlayıcılar Rehberi (`/hizmet-saglayicilar`)**, başvuru formu ve Admin yönetim ekranı (`/admin/service-providers`) yayında | 🟢 **%100 Tamamlandı** | Tamamlandı (`0026_add_service_providers_directory.sql`, `service_providers.go`, `/hizmet-saglayicilar`, `/admin/service-providers`). |
| **3. Firma ROI & Ziyaretçi Raporları** | Profil ziyaret sayısı, ürün görüntülenme, kaç alıcı iletişime geçti, ülke dağılımı, en çok ilgi gören ürünler | `analytics.brand_events` tablosu, vitrin tıklama/görüntülenme telemetrisi (`POST /api/v1/store/brand-events`), `GET /api/v1/supplier/analytics` ucu ve Tedarikçi Portalı **Ziyaretçi & ROI Analitiği (`SupplierAnalyticsPanel`)** sekmesi aktif (Ülke dağılımı, WhatsApp/Telefon/Sipariş/Sohbet sayacı, En çok ilgi gören 10 ürün) | 🟢 **%100 Tamamlandı** | Tamamlandı (`0022_add_brand_analytics_events.sql`, `brand_analytics.go`, `SupplierAnalyticsPanel.tsx`). |
| **4. Üyelik Paketleri, Muhasebe & Faturalandırma** | **Ücretsiz (0 TL)**, **Profesyonel (990 TL/Ay)**, **Premium (2.490 TL/Ay)** — **Ürün Sınırı Yok (`Sınırsız`)** | `subscription_plans`, `supplier_subscriptions`, `supplier_invoices` (`MV-FAT`), `supplier_subscription_payments` (`MV-THS`) ve `supplier_accounting_ledger` cari muhasebe tabloları kuruldu; **ürün sınırı yoktur (`max_products = -1`)**; şimdilik ücretsiz (`is_complimentary = true`) olup aylık ödeme ve faturalandırma ekranları hem `/supplier` hem `/admin` üzerinde aktiftir | 🟢 **Tamamlandı** | İleride kredi kartı sanal POS (iyzico/PayTR) ile otomatik aylık çekim bağlanabilir. |
| **5.A. Alıcı Talep Panosu (RFQ)** | Alıcıların *"500 adet kadın kabanı arıyoruz"* ilanı açması ve üreticilerin teklif vermesi | `catalog.buyer_rfqs` ve `catalog.buyer_rfq_offers` tabloları, açık **Alıcı Talep Panosu (`/alim-talepleri`)**, Tedarikçi Portalı **Alıcı Talepleri & Teklif Verme (`SupplierRfqPanel`)** sekmesi ve Admin RFQ moderasyon ekranı (`/admin/rfq`) yayında | 🟢 **%100 Tamamlandı** | Tamamlandı (`0023_add_buyer_rfq_tables.sql`, `rfq.go`, `/alim-talepleri`, `SupplierRfqPanel.tsx`, `/admin/rfq`). |
| **5.B. Doğrulanmış Firma Sistemi** | Ticari bilgileri kontrol edilmiş işletmelere **Doğrulanmış Firma** statüsü | `catalog.brands.is_verified` alanı, web ürün detayında ve mobil uygulamada **Doğrulanmış Üretici Rozeti (`Verified Badge`)** aktif | 🟢 **Tamamlandı** | Doğrulama kriterlerini açıklayan bilgilendirme sayfası eklenebilir. |
| **5.C. Çok Dilli Platform (TR/EN/AR/RU)** | 4 dil + otomatik çeviri + **firmaların çeviriyi düzenleyebilmesi** | TR, EN, AR (RTL), RU ve LibreTranslate otomatik çeviri motoru tam çalışıyor; ayrıca Tedarikçi Portalı (`/supplier` Ürün & Profil Düzenleme) ve Mobil Tedarikçi Stüdyosu (`WizardTranslationsCard`) üzerinde **4 dilde manuel çeviri düzenleme ve tek tıkla otomatik çeviri (`POST /api/v1/supplier/translate`)** aktif | 🟢 **%100 Tamamlandı** | Tamamlandı (`0024_add_supplier_translations_support.sql`, `SupplierProductModal.tsx`, `SupplierProfilePanel.tsx`, `wizard_translations_card.dart`). |
| **5.D. Doğrudan Firma İletişimi** | Firma profilinde WhatsApp, Telefon, E-posta, İletişim Formu, Web Sitesi, Açık Adres | Tedarikçi Portalı'nda (`SupplierProfilePanel`) self-servis düzenleme, ürün sayfasında (`SupplierDirectCard` + Mobil) doğrudan WhatsApp/Telefon/E-posta/Adres/IBAN gösterimi ve tıklama analitiği (`analytics.brand_events`) aktif | 🟢 **%100 Tamamlandı** | Tamamlandı (`SupplierDirectCard.tsx`, `SupplierShowcaseClient.tsx`, `brand_analytics.go`). |
| **5.E. Gelişmiş B2B Arama & Filtreleme** | Kategori, Üretici/Toptancı, MOQ, Fason, Private Label, Üretim Kapasitesi, İhracat Ülkeleri, Konum | Kategori (`ltree`), renk/beden, fiyat, stok ve açık firma adı (`brand.name`) filtrelerine ek olarak **Private Label, Fason Üretim, Tedarikçi Faaliyet Türü, Maksimum MOQ (`max_moq`) ve İhracat Ülkesi (`export_country`)** filtreleri Web (`FilterSidebar.tsx`) ve Mobil (`CustomerCatalogScreen`) üzerinde tam entegre çalışıyor | 🟢 **%100 Tamamlandı** | Tamamlandı (`appendCatalogB2BFilters` in `store_catalog.go`, `FilterSidebar.tsx`, `catalog_screen.dart`). |
| **5.F. Kolay Ürün Yükleme & AI** | Tekli/Toplu fotoğraf, **Excel ile yükleme**, **AI başlık/açıklama**, Aktif/Pasif, **Arşivleme** | Tekli/Toplu fotoğraf, Mobil Kamera Stüdyosu, XML entegrasyonu ve Aktif/Pasif mevcut | 🟡 **%70 Hazır** | **Excel/CSV ile Toplu Ürün Yükleme**, **Yapay Zekâ (AI) ile Ürün Başlığı/Açıklaması Üretme** ve **Eski Koleksiyon Arşivleme** eksik. |
| **6. Reklam & Ek Gelir Alanları** | Ana sayfa reklamı, Kategori sponsorluğu, Öne çıkan üreticiler, Yeni koleksiyon, Sektörel reklam, E-bülten | `catalog.sponsored_slots`, `catalog.newsletter_subscribers` ve `catalog.newsletter_campaigns` tabloları, Ana sayfa **Öne Çıkan Sponsorlu Üreticiler (`PortalSponsoredSuppliersSection`)**, Kategori sayfası **Kategori Sponsoru (`CategorySponsorBanner`)**, Footer **İzinli B2B E-Bülten (`NewsletterSubscriptionBox`)** ve Admin **Sponsorlu Vitrin & E-Bülten Yönetimi (`/admin/marketing`)** yayında | 🟢 **%100 Tamamlandı** | Tamamlandı (`0025_add_sponsored_slots_and_newsletter.sql`, `sponsored_and_newsletter.go`, `/admin/marketing`). |
| **9. Hukuki & Operasyonel Yapı** | Sorumluluk sınırları, firma üyelik sözleşmesi, KVKK ve ticari ileti izinleri | Versiyonlu Yasal Politikalar (`PoliciesHandler`) ve Hesap Silme Merkezi mevcut | 🟡 **Kısmen** | Tedarikçi kayıt/ilan anında **Üyelik ve İçerik Sorumluluk Sözleşmesi** dijital onay kaydı ve ticari ileti izin kutuları eklenmeli. |

---

## 3. Tamamlanan Mimari Dönüşümler ve Güçlü Rekabet Avantajlarımız

Son güncellemelerle birlikte `mertervitrini.com.tr` üzerinde **%100 tamamlanmış ve aktif olan** özellikler:

1. **Açık Üretici Kimliği ve Doğrulanmış Merter İşletmesi Vitrini (`0020` Migration):**
   - Eski üretici maskeleme kuralı tamamen kaldırıldı. Tüm ürün kartlarında, filtrelerde, ürün detay sayfalarında ve mobil uygulamada üreticilerin gerçek ticari unvanları (`Lustrin Toptan Tekstil`, `Etika Fashion Toptan`, `Jane's Toptan Tekstil` vb.) ve **Doğrulanmış Üretici** rozeti yer alır.
2. **Sıfır Komisyonlu (`%0.00`) Doğrudan Tedarikçi Fiyatı ve Doğrudan Sipariş Yönlendirme:**
   - Tüm XML entegrasyonlarında ve katalogdaki 8.727 üründe fiyatlar birebir tedarikçinin kendi fabrika çıkış fiyatıdır (`price = buying_price`).
   - Alıcı sipariş verdiğinde (`POST /api/v1/store/orders` veya `POST /api/v1/store/inquiries`), sipariş doğrudan ilgili tedarikçinin paneline (`Gelen Siparişlerim` sekmesi) alıcının ad, firma, telefon, e-posta ve açık teslimat adresiyle düşer; alıcıya da tedarikçinin doğrudan WhatsApp sipariş bağlantısı ve IBAN bilgileri sunulur.
3. **Self-Servis Tedarikçi Vitrin, İletişim ve IBAN Yönetimi (`/supplier`):**
   - Tedarikçiler kendi panellerinden firma tanıtım yazısını, faaliyet türünü, Private Label / Fason üretim yeteneklerini, ihracat ülkelerini, doğrudan WhatsApp/telefon numaralarını, Merter mağaza adreslerini ve doğrudan ödeme alacakları Banka/IBAN bilgilerini kendileri ekleyip güncelleyebilir.
4. **Çok Dilli (TR, EN, RU, AR) & Çok Para Birimli (TRY, USD, EUR, RUB) Altyapı:**
   - TCMB günlük kur entegrasyonu ve LibreTranslate otomatik katalog/blog çeviri motoru hazır.
5. **Toptan Seri (`series_ratio` 2-2-2 vb.), Canlı B2B Sohbet ve Mobil Kamera Stüdyosu:**
   - Web ve mobilde seri/paket hesaplama motoru, WebSocket canlı pazarlık/özel teklif sistemi ve tedarikçilerin telefon kamerasıyla ürün yükleyebildiği Android uygulama hazır.

---

## 4. Kalan Eksiklerin Detaylı Teknik Dökümü (Sıradaki Adımlar)

### Eksik #1: Üyelik Paketleri ve Kota Sistemi (Bölüm 4)
- **Veritabanı:** `catalog.subscription_plans` ve `catalog.brand_subscriptions` tabloları oluşturulmalı.
  - `FREE` (0 TL/Ay — `max_products: 10`, temel arama görünürlüğü)
  - `PRO` (990 TL/Ay — `max_products: 100`, WhatsApp bağlantısı, alıcı taleplerini görüntüleme, ziyaretçi istatistikleri)
  - `PREMIUM` (2.490 TL/Ay — `max_products: 500`, sponsorlu kategori ve ana sayfa görünürlüğü, gelişmiş istatistikler, öncelikli alıcı talepleri)
- **Backend (`SupplierPortalHandler`):** Tedarikçi yeni ürün eklerken mevcut aktif ürün sayısı paket limitini (`10 / 100 / 500`) aşıyorsa paket yükseltme uyarısı dönülmeli.

### Eksik #2: Bağımsız Firma Rehber Sayfaları ve Üretim Yetkinlik Filtreleri (Bölüm 1 & 5.E)
- **Frontend & Mobil:**
  - `/ureticiler` (Tüm Doğrulanmış Merter Firmaları Rehberi) ve `/ureticiler/[slug]` (Firma Özel Vitrin Sayfası: Hakkımızda, üretim kapasitesi, ihracat ülkeleri, doğrudan WhatsApp/IBAN ve firmanın tüm koleksiyonu).
  - Katalog filtre yan menüsüne (`FilterSidebar.tsx`) `supports_fason`, `supports_private_label` ve `company_type` filtre seçeneklerinin eklenmesi.

### Eksik #3: Firma Bazlı Ölçülebilir Ticari Analitik Paneli (Bölüm 3 & 10.5)
- **Veritabanı (`analytics.brand_events`):**
  - `event_type`: `profile_view` | `product_view` | `whatsapp_click` | `phone_click` | `inquiry_submit` | `chat_start`
  - `brand_id`, `product_id`, `visitor_country_code`, `created_at`
- **Tedarikçi Paneli (`/supplier` & Mobil):**
  - *"Profilimi kaç kişi ziyaret etti, ürünlerim kaç kez görüntülendi, kaç alıcı WhatsApp/Sohbet üzerinden iletişime geçti, hangi ülkelerden ilgi gördüm?"* sorularını yanıtlayan grafikli rapor sekmesi.

### Eksik #4: Alıcı Talep Panosu — RFQ / Alım İlanları (Bölüm 5.A)
- **Veritabanı (`catalog.buyer_rfqs` & `catalog.buyer_rfq_offers`):**
  - Alıcının ülke, aradığı kategori, hedef adet (örn. *"Almanya'daki mağazamız için 500 adet kadın kabanı"*), özel etiket/fason talebi bırakabildiği ve üreticilerin doğrudan teklif verebildiği pano.

### Eksik #5: Kolay Ürün Yükleme — Excel Import, AI Asistan ve Koleksiyon Arşivi (Bölüm 5.F)
- **Excel ile Toplu Ürün Ekleme (`POST /api/v1/supplier/products/import-excel`)**
- **Yapay Zekâ (AI) Destekli Ürün Başlığı ve Açıklama Üretici (`POST /api/v1/supplier/ai/generate-copy`)**
- **Eski Koleksiyonları Arşivleme (`is_archived BOOLEAN`)**

### Eksik #6: Sponsorlu Alanlar ve Sektörel Hizmet Sağlayıcılar Dizini (Bölüm 2.C & 6)
- **Sponsorlu Görünürlük:** Ana sayfa ve kategori sayfalarında `SPONSORLU ÜRETİCİ / KOLEKSİYON` alanları.
- **Sektörel Hizmet Sağlayıcılar Dizini (`/hizmet-saglayicilar`):** Uluslararası kargo/lojistik, fotoğraf çekim stüdyoları, ambalaj/etiket ve modelistlik firmaları rehberi.
