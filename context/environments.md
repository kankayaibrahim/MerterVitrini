# Ortamlar, Ağ, Port ve Dağıtım Haritası (Environments)

## 1. Sunucu ve Donanım Bilgileri (Production)

- **Sunucu IP:** `213.202.255.80`
- **SSH Bağlantısı:** Port `22`, Kullanıcı: `root`
- **İşletim Sistemi:** AlmaLinux 9.7 (Moss Jungle Cat) - RHEL 9 tabanlı kurumsal Linux
- **Java Sürümü:** OpenJDK 21 LTS (`/usr/lib/jvm/jre-21`)
- **Web Sunucu & Ters Proxy:** Nginx (Certbot Let's Encrypt SSL)
- **Kalıcı Medya Deposu:** `/var/www/media` (Ürün görselleri ve yüklemeler)
  - `frontend/public/uploads` sembolik linki (symlink) ile bağlanmıştır.

---

## 2. Servis ve Port Matrisi (Birleştirilmiş Yeni Mimari)

| Servis Adı | Systemd Servis İsmi | Dinlenen Port | Erişim Tipi | Canlı Domain / URL |
| :--- | :--- | :--- | :--- | :--- |
| **Nginx Web Sunucusu** | `nginx` | `80`, `443` | Dışa Açık (Public) | Tüm alan adları (SSL) |
| **Unified Frontend (SSR)** | `merter-frontend` | `3000` | Ters Proxy (`127.0.0.1:3000`) | `https://mertervitrini.com.tr` (Vitrin) & `/admin` (Yönetim) |
| **Unified Backend (Go)** | `merter-backend` | `8080` | Ters Proxy (`127.0.0.1:8080`) | `https://mertervitrini.com.tr/api/` veya `https://api.mertervitrini.com.tr` |
| **Keycloak IAM (Quarkus)** | `keycloak` | `8082` | Ters Proxy (`127.0.0.1:8082`) | `https://auth.mertervitrini.com.tr` |
| **PostgreSQL Veritabanı** | `postgresql` | `5432` | Yerel (127.0.0.1) | `merterdevdb` & `keycloak` |
| **Redis Önbellek & Kuyruk** | `redis-server` | `6379` | Yerel (127.0.0.1) | Senkronizasyon & Oturum |
| **LibreTranslate Motoru** | `libretranslate` | `5000` | Yerel (127.0.0.1) | Otomatik Dil Çeviri API |
| **Translate Proxy** | `translate-proxy` | `5001` | Yerel (127.0.0.1) | Çeviri İsteği Yönlendirici |

---

## 3. Nginx Domain ve Sanal Konfigürasyon Dosyaları

Sunucuda Nginx ayarları `/etc/nginx/conf.d/` altındadır:

### A. Birleşik Mağaza & Admin Sitesi (`/etc/nginx/conf.d/mertervitrini.com.tr.conf`)
- `https://mertervitrini.com.tr/` -> `http://127.0.0.1:3000` (Next.js SSR: Vitrin + `/admin`)
- `https://admin.mertervitrini.com.tr/` -> İsteğe bağlı olarak doğrudan `http://127.0.0.1:3000/admin` adresine proxy yapılabilir veya `mertervitrini.com.tr/admin` adresine 301 yönlendirmesi yapılabilir.
- `https://mertervitrini.com.tr/api/` -> `http://127.0.0.1:8080/api/` (Unified Backend Go)
- `/uploads/` -> `/var/www/media/` doğrudan statik dosya sunumu.

### B. Keycloak Kimlik Sunucusu (`/etc/nginx/conf.d/auth.mertervitrini.com.tr.conf`)
- `https://auth.mertervitrini.com.tr/` -> `http://127.0.0.1:8082`
- `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
- `proxy_set_header X-Forwarded-Proto https;`

---

## 4. Keycloak Kimlik Doğrulama Bilgileri

- **IAM URL:** `https://auth.mertervitrini.com.tr`
- **Master Realm (Sistem Yöneticisi):**
  - URL: `https://auth.mertervitrini.com.tr/admin/master/console/`
  - Kullanıcı Adı: `admin`
  - Şifre: `KcAdminPassword02vMhY8`
- **Merter Realm (Admin Panel Girişi):**
  - Realm: `merter`
  - Client ID: `admin-client`
  - Kullanıcı Adı: `admin`
  - E-posta: `admin@mertervitrini.com.tr`
  - Şifre: `KcAdminPassword02vMhY8`
  - Rol: `admin`

---

## 5. Yerel Geliştirme Ortamı (Localhost)

- **İşletim Sistemi:** Windows
- **Çalışma Dizini:** `c:\Projects\mertervitrini.com.tr`
- **Gereksinimler:**
  - Go 1.27.2 (`go version`)
  - Node.js 20+ & npm (`node -v`, `npm -v`)
  - PostgreSQL 18 (Port: `5432`, Veritabanı: `merterdevdb`)
  - Redis (Port: `6379`)
  - Python 3.10+ (Deployment ve otomasyon scriptleri için)
- **Yerel Port Tahsisleri:**
  - **Unified Frontend:** `http://localhost:3000` (Vitrin: `/`, Admin: `/admin`)
  - **Unified Backend:** `http://localhost:8080` (Store API: `/api/v1/store/`, Admin API: `/api/v1/`)

---

## 6. Canlı Sunucu Operasyonel Komutları (Systemd & SSH)

Sunucu üzerinde terminal bağlantısı kurarak servisleri denetleme ve yeniden başlatma:

```bash
# Servis Durumlarını Kontrol Etme
systemctl status merter-frontend
systemctl status merter-backend
systemctl status keycloak
systemctl status nginx

# Servisleri Yeniden Başlatma
systemctl restart merter-frontend
systemctl restart merter-backend
systemctl reload nginx

# Canlı Log Takibi
journalctl -u merter-backend -f
journalctl -u merter-frontend -f
journalctl -u keycloak -f
```
