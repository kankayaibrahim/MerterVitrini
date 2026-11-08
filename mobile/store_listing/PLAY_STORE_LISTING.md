# Merter Vitrini — Google Play Store Yayınlama Paketi (Release Kit)

Bu belge, `com.mertervitrini.app` paket kimliğine sahip **Merter Vitrini B2B (Müşteri + Tedarikçi Tek Uygulama)** mobil uygulamasını **Google Play Console** üzerinden doğrudan yayına almak için gereken tüm mağaza metinlerini, görsel yollarını, Veri Güvenliği (Data Safety) beyanlarını ve inceleme talimatlarını içerir.

---

## 1. Paket, İmzalı Çıktı ve Görsel Dosya Yolları

| Öğe | Değer / Dosya Yolu |
| :--- | :--- |
| **Application ID (Paket Adı)** | `com.mertervitrini.app` |
| **Sürüm (`versionName` / `versionCode`)** | `1.0.0` (`1`) |
| **Target SDK / Min SDK** | `API 36 (Android 16)` / `API 24 (Android 7.0)` |
| **Google Play App Bundle (`.aab`)** | `mobile/build/app/outputs/bundle/release/app-release.aab` |
| **Doğrudan Kurulum APK (`.apk`)** | `mobile/build/app/outputs/flutter-apk/app-release.apk` |
| **Upload Keystore (`.jks`)** | `mobile/android/keystore/mertervitrini-release.jks` *(Git dışı güvenli saklanır)* |
| **512x512 Mağaza İkonu** | `mobile/store_listing/icon_512x512.png` |
| **1024x500 Özellik Grafiği (Feature Graphic)** | `mobile/store_listing/feature_graphic_1024x500.png` |
| **1080x1920 Telefon Ekran Görselleri (4 Adet)** | `mobile/store_listing/screenshot_1_storefront_1080x1920.png` ... `screenshot_4_b2b_chat_offer_1080x1920.png` |
| **Gizlilik Politikası URL** | `https://mertervitrini.com.tr/policies/privacy_policy` |
| **Web Hesap & Veri Silme URL (Zorunlu)** | `https://mertervitrini.com.tr/account-deletion` |

---

## 2. Çok Dilli Mağaza Giriş Metinleri (Store Listing)

### A. Türkçe (`tr-TR` — Varsayılan Dil)
- **Uygulama Adı (Max 30 kr.):** `Merter Vitrini: Toptan B2B`
- **Kısa Açıklama (Max 80 kr.):** `Merter toptan giyim pazaryeri, tedarikçi kamera ürün stüdyosu ve canlı sohbet.`
- **Tam Açıklama:**
  > **Merter Vitrini**, Türkiye'nin toptan hazır giyim merkezi Merter'in seçkin üreticilerini küresel B2B alıcılarla buluşturan resmi mobil platformdur. Tek bir uygulama içinde hem **Toptan Müşteri Mağazası** hem de **Tedarikçi Üretim & Kamera Stüdyosu** bir arada sunulur.
  >
  > **MÜŞTERİLER (TOPTAN ALICILAR) İÇİN ÖZELLİKLER:**
  > - Binlerce toptan kadın, erkek ve çocuk giyim modelini seri/paket (1-2-2-1, S-M-L-XL) yapısıyla inceleyin.
  > - TCMB canlı kurlarıyla TRY, USD, EUR ve RUB para birimlerinde anlık fiyat görüntüleyin.
  > - Ürün detayından doğrudan üretici satış temsilcisine (TR, EN, RU, AR) canlı mesaj veya fotoğraf gönderin.
  > - Sohbet üzerinden gelen özel toptan fiyat tekliflerini tek dokunuşla onaylayarak indirimli fiyattan sepetinize ekleyin.
  > - Siparişlerinizi ve Havale/EFT ödeme bildirimlerinizi mobil uygulama üzerinden takip edin.
  >
  > **TEDARİKÇİLER (ÜRETİCİLER) İÇİN ÖZELLİKLER:**
  > - **Uygulama İçi Kamera Stüdyosu:** Showroom veya atölyenizde yeni modellerinizi 3:4 tekstil kadraj kılavuzuyla doğrudan kameradan çoklu çekin, kapak görselini belirleyin ve otomatik optimize ederek saniyeler içinde vitrine yükleyin.
  > - **Akıllı Seri & Stok Matrisi:** Hazır asorti şablonlarıyla (1-2-2-1, 2-2-2, 36-42 vb.) eldeki paket sayısını beden varyantlarına otomatik dağıtın.
  > - **Canlı Müşteri Sohbeti & Özel Teklif:** Müşteri sorularını anlık yanıtlayın, sohbet içinden özel birim fiyatlı paket teklifi gönderin.
  > - **Alt Sipariş, Kargo & Hakediş Cüzdanı:** Gelen siparişlerin kargo takip kodunu girin, net hakediş bakiyenizi ve IBAN ödeme taleplerinizi yönetin.

### B. English (`en-US`)
- **App Name:** `Merter Vitrini: Wholesale B2B`
- **Short Description:** `Wholesale fashion marketplace, supplier camera product studio & live B2B chat.`
- **Full Description:**
  > **Merter Vitrini** connects global wholesale fashion buyers directly with verified textile manufacturers in Merter, Istanbul. Featuring a unified dual-role experience, buyers and suppliers operate seamlessly in a single mobile app: browse series packs (`1-2-2-1`, `S-M-L-XL`), switch between `TRY / USD / EUR / RUB`, negotiate real-time custom offers in live chat, and shoot & publish new wholesale garments directly from the built-in Supplier Camera Studio.

### C. Русский (`ru-RU`)
- **App Name:** `Merter Vitrini: Одежда Оптом`
- **Short Description:** `Оптовый маркетплейс одежды из Мертера, студия поставщика и живой B2B чат.`
- **Full Description:**
  > **Merter Vitrini** — официальная B2B платформа оптовой моды из Стамбула (Мертер). Покупатели заказывают одежду сериями (`1-2-2-1`), общаются напрямую с русскоговорящими менеджерами фабрик и получают персональные скидки в чате, а производители фотографируют и публикуют новые модели прямо с камеры смартфона.

### D. العربية (`ar`)
- **App Name:** `مرتر فيتريني: جملة الأزياء`
- **Short Description:** `سوق ملابس الجملة من مرتر إسطنبول، استوديو كاميرا المورد ومحادثة مباشرة.`
- **Full Description:**
  > **مرتر فيتريني (Merter Vitrini)** يربط تجار الجملة مباشرة بمصانع الملابس في مرتر، إسطنبول. تطبيق واحد يجمع متجر المشتري بالجملة واستوديو المورد لتصوير المنتجات بالكاميرا ورفعها فوراً مع التفاوض المباشر وعروض الأسعار الفورية.

---

## 3. Google Play Politikaları & Data Safety (Veri Güvenliği) Formu Cevapları

1. **İzin Politikası (Fotoğraf & Kamera Uyumluluğu):**
   - Uygulama yalnızca tedarikçilerin ürün fotoğrafı çekmesi ve sohbet numune çekimi için `android.permission.CAMERA` izni kullanır (`required="false"`).
   - Galeri seçimi için Android 13+ **System Photo Picker** (`image_picker`) kullanılır; Google Play tarafından kısıtlanan `READ_MEDIA_IMAGES`, `READ_MEDIA_VIDEO` ve `RECORD_AUDIO` izinleri `AndroidManifest.xml` üzerinden kesin olarak kaldırılmıştır (`tools:node="remove"`).
2. **Hesap Silme (Account Deletion Policy — %100 Uyumlu):**
   - **Uygulama İçi:** `Profil -> Hesabımı Kalıcı Olarak Sil` (veya `Tedarikçi -> Satış Ekibi & Hesap -> Tedarikçi Hesabımı Kalıcı Olarak Sil`).
   - **Web Üzerinden:** `https://mertervitrini.com.tr/account-deletion`
3. **Veri Güvenliği (Data Safety) Beyanı Özeti:**
   - **Aktarım Sırasında Şifreleme:** Evet (Tüm API ve WebSocket trafiği TLS/HTTPS & WSS üzerinden şifrelenir; `usesCleartextTraffic="false"`).
   - **Toplanan Veriler:** Ad Soyad, E-posta, Telefon Numarası, Kurumsal Teslimat/Fatura Adresi (yalnızca hesap yönetimi ve B2B sipariş teslimatı amacıyla; üçüncü taraf reklam ağlarıyla **paylaşılmaz**).
   - **Fotoğraflar:** Yalnızca kullanıcının açıkça çektiği/seçtiği ürün ve sohbet görselleri katalog/mesajlaşma işlevi için yüklenir.
4. **Hedef Kitle & İçerik Derecelendirmesi:**
   - **Hedef Yaş Grubu:** `18+` (Kurumsal B2B Ticaret Uygulaması).
   - **Reklam İçerir mi?** `Hayır`.
5. **Uygulama Erişimi (App Access — Play İnceleme Ekibi Notu):**
   - Vitrin kataloğu, ürün inceleme, döviz/dil değiştirme ve sepet özellikleri **üye olmadan (misafir modunda)** tamamen açıktır.
   - Tedarikçi Kamera Stüdyosu ve Tedarikçi Paneli incelemesi için Google Play Console -> *Uygulama İçeriği -> Uygulama Erişimi* bölümüne bir test müşteri ve test tedarikçi hesabı tanımlanmalıdır.

