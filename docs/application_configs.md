# Merter Vitrini Uygulama Yapılandırma ve Port Dağılım Kılavuzu

Bu belge, **mertervitrini.com.tr** sunucusunda çalışan uygulamaların, portların, dizinlerin ve servislerin güncel durumunu ve yapılandırmasını açıklar.

---

## 1. Genel Sunucu Bilgileri
- **Sunucu IP:** `213.202.255.80`
- **SSH Port:** `22`
- **Kullanıcı:** `root`
- **İşletim Sistemi:** Linux (Debian/CentOS/Rocky benzeri systemd tabanlı dağıtım)

---

## 2. Servis ve Port Matrisi

Aşağıdaki tabloda sunucuda koşan tüm uygulamalar, dinledikleri portlar ve sistemdeki servis isimleri listelenmiştir:

| Uygulama / Servis Adı | Servis İsmi (Systemd) | Dinlenen Port / Soket | Erişim Tipi | Açıklama |
| :--- | :--- | :--- | :--- | :--- |
| **Nginx** | `nginx` | `80`, `443` | Dışa Açık (Public) | Ana web sunucusu ve ters proxy (reverse proxy). SSL sertifikalarını yönetir. |
| **PostgreSQL** | `postgresql` | `5432` | Yerel (Local/127.0.0.1) | Veritabanı sunucusu. Veritabanı adı: `merterdevdb` |
| **Redis** | `redis-server` | `6379` | Yerel (Local/127.0.0.1) | Önbellek (Cache) ve oturum yönetimi. |
| **Shop Storefront Frontend** | `shop-frontend` | `3000` | Ters Proxy (`localhost:3000`) | Next.js Storefront (Müşteri Arayüzü) SSR Modu. |
| **Shop Storefront Backend** | `shop-backend` | `8081` | Ters Proxy (`localhost:8081`) | Go dilinde yazılmış Storefront REST API'si. |
| **Admin Suite Backend** | `admin-backend` | `8085` | Ters Proxy (`localhost:8085`) | Go dilinde yazılmış Admin Yönetim Paneli REST API'si. |
| **Admin Suite Frontend** | *(Servis Yok)* | *Statik Servis (Nginx)* | Statik Dosya (`/out`) | SPA (Single Page Application) olarak tarayıcıda koşar. |
| **LibreTranslate** | `libretranslate` | `5000` | Yerel (Local/127.0.0.1) | Otomatik dil çeviri motoru. |
| **Translate Proxy** | `translate-proxy` | `5001` | Yerel (Local/127.0.0.1) | Çeviri istekleri için proxy katmanı. |
| **Keycloak** | `java` | `8082` / `7800` | Ters Proxy | Kimlik Doğrulama / Oturum Yönetimi (Realm: `merter`). |

---

## 3. Dizin ve Dosya Yapısı (Dizin Eşleşmeleri)

### Proje Dizini (Yerel Geliştirme Bilgisayarı)
- **Repo Kökü:** `c:\Projects\mertervitrini.com.tr`
  - `admin/frontend` -> Admin Paneli Next.js kodları
  - `admin/backend` -> Admin Paneli Go API kodları
  - `shop/frontend` -> Mağaza Arayüzü Next.js kodları
  - `shop/backend` -> Mağaza Arayüzü Go API kodları
  - `scripts/unified_deployer.py` -> PySide6 GUI ve CLI deployment aracı

### Sunucu Dizinleri (Production Server)

1. **Shop Storefront (Müşteri Arayüzü):**
   - **Frontend Dizini (Next.js SSR):** `/var/www/mertervitrini.com.tr/frontend`
   - **Backend Dizini (Go API):** `/var/www/mertervitrini.com.tr/backend`
     - Çalıştırılabilir Dosya: `/var/www/mertervitrini.com.tr/backend/bin/shop-backend`
     - Yapılandırma Dosyası: `/var/www/mertervitrini.com.tr/backend/bin/config.json`

2. **Admin Suite (Yönetim Paneli):**
   - **Frontend Dizini (Statik out):** `/var/www/admin.mertervitrini.com.tr/frontend`
     - Derlenmiş statik dosyalar bu dizindeki `out` klasörünün içindedir: `/var/www/admin.mertervitrini.com.tr/frontend/out`
   - **Backend Dizini (Go API):** `/var/www/admin.mertervitrini.com.tr/backend`
     - Çalıştırılabilir Dosya: `/var/www/admin.mertervitrini.com.tr/backend/bin/admin-backend`
     - Yapılandırma Dosyası: `/var/www/admin.mertervitrini.com.tr/backend/bin/config.json`

3. **Ortak Medya Dizinleri (Görseller ve Uploads):**
   - **Kalıcı Depolama:** `/var/www/media` (Ürün resimleri vb.)
   - Hem Shop hem Admin frontend klasörlerinde `uploads` sembolik linki (symlink) ile `/var/www/media` dizinine bağlanmıştır.

---

## 4. Nginx Yönlendirme (Domain) ve Proxy Yapılandırması

Nginx, `/etc/nginx/conf.d/` altındaki konfigürasyon dosyaları ile gelen istekleri alan adlarına (domain) göre ilgili portlara dağıtır:

### A. Mağaza Sitesi (`mertervitrini.com.tr` ve `www.mertervitrini.com.tr`)
- **Dosya:** `/etc/nginx/conf.d/mertervitrini.com.tr.conf`
- **Frontend Yönlendirmesi (Port 3000):** 
  `https://mertervitrini.com.tr/` -> `http://127.0.0.1:3000` (Next.js SSR Sunucusu)
- **Backend API Yönlendirmesi (Port 8081):**
  `https://mertervitrini.com.tr/api/` -> `http://127.0.0.1:8081/api/`
  `https://api.mertervitrini.com.tr/` -> `http://127.0.0.1:8081`

### B. Admin Paneli (`admin.mertervitrini.com.tr`)
- **Dosya:** `/etc/nginx/conf.d/admin.mertervitrini.com.tr.conf`
- **Frontend Servisi (Statik Klasör):**
  `https://admin.mertervitrini.com.tr/` -> Nginx tarafından doğrudan `/var/www/admin.mertervitrini.com.tr/frontend/out` altındaki statik dosyalar (`index.html` vb.) sunulur.
- **Backend API Yönlendirmesi (Port 8085):**
  `https://adminapi.mertervitrini.com.tr/` -> `http://127.0.0.1:8085` (Admin Backend Go API)

---

## 5. Admin Panelinin Çalışmama Nedeni ve Çözümü

### Sorunun Nedeni:
Deploy aracı olan `unified_deployer.py` dosyasında yer alan **SSR Modu (Canlı Node.js sunucusu)** seçeneği işaretlendiğinde, bu seçenek **global** bir bayrak (`self.ssr_mode = True`) olarak set ediliyordu. 

Bu durumda:
1. **Shop Storefront** Next.js projesi SSR modunda doğru şekilde derlenip ayağa kalkıyordu.
2. Ancak **Admin Panel** frontend'i de yanlışlıkla SSR modundaymış gibi işleniyor ve sunucuya sadece derlenmiş statik dosyalar değil, **tüm kaynak kod dosyaları** (`src`, `node_modules`, `tsconfig.json` vb.) aktarılıyordu.
3. Nginx yapılandırmasındaki `root` parametresi `/var/www/admin.mertervitrini.com.tr/frontend` olarak kalıyordu.
4. Kaynak kodlar bu dizinde olduğu ve ana dizinde `index.html` bulunmadığı için (sadece `out/index.html` içinde mevcuttu), Nginx dizin listelemeye çalışıyor ve `403 Forbidden` hatası veriyordu. Bu yüzden yönetim paneline erişilemiyordu.

### Yapılan Geçici/Acil Çözüm (Server Tarafında):
Sunucudaki `/etc/nginx/conf.d/admin.mertervitrini.com.tr.conf` dosyasında admin panelinin statik kök dizini (root path) şu şekilde düzeltildi:
```nginx
# Eski Hatalı Satır:
root /var/www/admin.mertervitrini.com.tr/frontend;

# Yeni Çalışan Satır:
root /var/www/admin.mertervitrini.com.tr/frontend/out;
```
Nginx yeniden yüklendi (`systemctl reload nginx`) ve Admin Paneli **şu anda sorunsuz bir şekilde çalışmaktadır.**

### Kalıcı Çözüm Planı:
`scripts/unified_deployer.py` dosyasındaki Next.js derleme ve yükleme fonksiyonları revize edilerek, admin paneli için `ssr_mode` özelliğinin **daima kapatılması (her zaman statik export olarak derlenmesi)** sağlanacaktır. Böylece arayüzden "SSR Modu" seçilerek deploy yapılsa dahi Admin Suite bundan etkilenmeyecek ve bozulmayacaktır.
