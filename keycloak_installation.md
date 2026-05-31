# Keycloak 26.6.2 Kurulum ve Yönetim Dokümantasyonu

Bu doküman, `213.202.255.80` IP adresli sunucu üzerinde kurulan ve üretime hazır (production-ready) hale getirilen **Keycloak 26.6.2** IAM (Kimlik ve Yetki Yönetimi) altyapısının bilgilerini, veritabanı entegrasyonunu ve yönetim detaylarını içermektedir.

---

## 🛡️ Keycloak Giriş ve Yönetici Bilgileri

Keycloak sunucusu Quarkus motoru üzerinde optimize edilmiş olarak `8082` portunda çalışmaktadır. Nginx SSL ve Certbot yapılandırmaları ile **`https://auth.mertervitrini.com.tr`** adresi üzerinden güvenli (HTTPS) olarak yayındadır.

### 1. ⚙️ Master Realm (Keycloak Sistem Yöneticisi)
Bu hesap Keycloak sisteminin tamamını (yeni realm oluşturma, istemci ekleme vb.) yönetmek için kullanılır:
* **Yönetici Konsolu Giriş Linki:** `https://auth.mertervitrini.com.tr/admin/master/console/`
* **Kullanıcı Adı:** `admin`
* **Şifre:** `KcAdminPassword02vMhY8`

### 2. 👤 Merter Realm (Admin Panel Giriş Yöneticisi)
Bu hesap doğrudan sizin **Admin Paneliniz** (`https://admin.mertervitrini.com.tr/`) üzerindeki "Keycloak ile Giriş Yap" butonuna tıkladığınızda açılan giriş ekranında oturum açmak için kullanılacak asıl kullanıcıdır:
* **Realm Adı:** `merter`
* **Client ID (İstemci):** `admin-client`
* **Kullanıcı Adı (Username):** `admin`
* **E-posta (Email):** `admin@mertervitrini.com.tr`
* **Şifre:** `KcAdminPassword02vMhY8`
* **Kullanıcı Rolü:** `admin` *(Admin panelindeki tüm yetkilere sahiptir)*

> 💡 **Güvenlik Notu:** İlk girişinizi yaptıktan sonra Keycloak yönetim konsolundan veya kendi profil ayarlarınızdan şifrelerinizi güncelleyebilirsiniz.

---

## ⚙️ Teknik Altyapı ve Kurulum Detayları

### 1. Sistem ve Çalışma Ortamı
* **İşletim Sistemi:** AlmaLinux 9.7 (Moss Jungle Cat) - RHEL 9 tabanlı kurumsal dağıtım.
* **Java Çalışma Ortamı:** OpenJDK 21 (LTS). Java 8 olan varsayılan java alternatifi sistem genelinde Java 21'e yükseltilmiştir:
  ```bash
  # Sistem Java Sürümü
  openjdk version "21.0.11" 2026-04-21 LTS
  OpenJDK Runtime Environment (Red_Hat-21.0.11.0.10-1)
  ```

### 2. PostgreSQL Veritabanı Yapılandırması
Keycloak, gömülü H2 veritabanı yerine sunucudaki PostgreSQL üzerinde bağımsız bir veritabanı ve kullanıcı ile çalışmaktadır:
* **Veritabanı Adı (Database):** `keycloak`
* **Veritabanı Kullanıcısı (User):** `keycloak`
* **Veritabanı Şifresi:** `KcPass02vMhY8Xgi`
* **Bağlantı Adresi:** `jdbc:postgresql://localhost:5432/keycloak`

### 3. Keycloak Yapılandırma Dosyası (`/opt/keycloak/conf/keycloak.conf`)
Quarkus çalışma motoru ayarları aşağıdaki gibi optimize edilmiştir:
```ini
# Database integration
db=postgres
db-username=keycloak
db-password=KcPass02vMhY8Xgi
db-url=jdbc:postgresql://localhost:5432/keycloak

# HTTP Engine settings
http-enabled=true
http-port=8082

# Proxy and Hostname configuration
proxy=edge
hostname-strict=false
```

### 4. Systemd Arka Plan Servis Yönetimi (`/etc/systemd/system/keycloak.service`)
Keycloak, sunucu açılışında otomatik olarak başlamak üzere daemon servis olarak kurulmuştur. 
```ini
[Unit]
Description=Keycloak Identity and Access Management Daemon
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/keycloak
Environment=JAVA_HOME=/usr/lib/jvm/jre-21
Environment=KC_BOOTSTRAP_ADMIN_USERNAME=admin
Environment=KC_BOOTSTRAP_ADMIN_PASSWORD=KcAdminPassword02vMhY8
ExecStart=/opt/keycloak/bin/kc.sh start --optimized
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

---

## 🛠️ Temel Servis Komutları

Sunucu üzerinde terminal bağlantısı (SSH) kurarak Keycloak servisini yönetmek için aşağıdaki komutları kullanabilirsiniz:

```bash
# Servis durumunu kontrol etme:
systemctl status keycloak

# Canlı servis loglarını izleme:
journalctl -u keycloak -f

# Keycloak servisini yeniden başlatma:
systemctl restart keycloak

# Keycloak servisini durdurma:
systemctl stop keycloak

# Keycloak servisini başlatma:
systemctl start keycloak
```

---

## ⚡ Entegrasyon İpuçları (Next.js / Go API Gateway)

Keycloak yetkilendirme akışlarını uygulamanıza bağlarken aşağıdaki standart kütüphaneleri ve yöntemleri kullanabilirsiniz:

1. **Go Backend (API Gateway / Resource Server):**
   * JWT imza doğrulamasını Keycloak JWKS endpoint'i (`/realms/{realm-name}/protocol/openid-connect/certs`) üzerinden yapabilirsiniz.
   * `github.com/golang-jwt/jwt` veya `github.com/MicahParks/keycloakidp` kütüphaneleri ile JWT token doğrulama adımlarını Go Handler'larınıza ara yazılım (Middleware) olarak entegre edebilirsiniz.

2. **Next.js Frontend (Client):**
   * Entegrasyon için **NextAuth.js (Auth.js)** kütüphanesini ve hazır `KeycloakProvider`'ı kullanabilirsiniz.
   * Kullanıcı oturum açtığında tarayıcı doğrudan Keycloak login sayfasına yönlendirilir ve güvenli OIDC (OpenID Connect) Authorization Code akışı ile token Next.js tarafına iletilir.
