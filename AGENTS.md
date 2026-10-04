# AGENTS.md - Merter Vitrini B2B E-Ticaret Platformu Ana Sözleşmesi

> **ÖNEMLİ:** Bu dosya, `mertervitrini.com.tr` monorepo çalışma alanına katılan herhangi bir AI ajanı (Antigravity vb.) veya geliştirici için bağlayıcı ve en üst düzey operasyonel sözleşmedir (Root Contract). Çalışma alanında herhangi bir kod, konfigürasyon veya veritabanı değişikliği yapmadan önce bu dosyadaki kurallar ve yönergeler kesinlikle okunmalı ve harfiyen uygulanmalıdır.

---

## 1. Proje Kimliği ve Felsefesi

**Merter Vitrini (`mertervitrini.com.tr`)**, Türkiye'nin ve Merter tekstil piyasasının toptan hazır giyim ve moda ürünlerini küresel pazarlara (B2B) sunan, çok dilli, çok para birimli, yüksek performanslı ve kurumsal düzeyde entegre bir B2B e-ticaret platformudur.

### Temel Sistem Felsefesi:
1. **Sadeleştirilmiş Birleşik Monorepo Mimarisi:** Tek depoda (monorepo) birleştirilmiş yüksek performanslı tek Go backend (`backend/`, Port `8080`) ve hem vitrin mağazasını hem de `/admin` yönetim panelini barındıran tek Next.js SSR frontend (`frontend/`, Port `3000`).
2. **Yüksek Performans & Düşük Kaynak Tüketimi:** Backend tarafında Go 1.25'in ultra-hafif `net/http` ve `pgx/v5` havuzları; frontend tarafında Next.js 16 (App Router) + React 19 ile optimize edilmiş dinamik SSR mimarisi.
3. **Üretici Maskeleme & Entegrasyon Gizliliği:** Toptancı tedarikçilerinin (Lustrin, Etika, Jane's vb.) gerçek isimleri storefront üzerinde maske kodlarla (MIMOZA, FLORA, EDUSA) sunulur. SKU yapıları otomatik üretilen benzersiz kodlarla korunur.
4. **Veri Bütünlüğü ve Çok Dillilik:** Kategori ağaçları PostgreSQL `ltree` eklentisiyle hiyerarşik yönetilir. Tüm katalog, renk, kumaş, sayfa ve blog verileri normalleştirilmiş çeviri tablolarında çok dilli olarak saklanır.
5. **Kurumsal Kimlik Yönetimi:** Tüm müşteri ve admin yetkilendirmesi Keycloak 26 (Quarkus LTS) IAM motoru üzerinden yürütülür.

---

## 2. Teknoloji Yığını (Tech Stack)

| Katman / Bileşen | Teknoloji / Kütüphane | Sürüm | Görev / Açıklama |
| :--- | :--- | :--- | :--- |
| **Unified Frontend** | Next.js (App Router, SSR) | `16.2.6` | Müşteri Vitrini (/) + Yönetim Paneli (/admin) (Port `3000`) |
| **Unified UI & State** | React, Tailwind CSS, Lucide | `React 19.2.4`, `Tailwind v4` | Modern, responsive, sepet çekmecesi ve admin modülleri |
| **Hata İzleme (Sentry)** | Sentry Next.js SDK | `^10.55.0` | İstemci & Sunucu hata yakalama ve performans izleme |
| **Unified Backend** | Go (Golang) | `1.25.0` | Birleşik REST API: Store (`/api/v1/store/`) & Admin (`/api/v1/`) (Port `8080`) |
| **Kimlik & Yetki (IAM)** | Keycloak (Quarkus LTS, Java 21) | `26.6.2` | OIDC kimlik doğrulama, JWT, Realm: `merter` |
| **Veritabanı** | PostgreSQL (pgcrypto, ltree) | `16+` | Ana veritabanı (`merterdevdb`), Keycloak DB (`keycloak`) |
| **Veritabanı Sürücüsü** | `jackc/pgx/v5` (pgxpool) | `5.9.2` | Yüksek performanslı Go native PostgreSQL bağlantı havuzu |
| **Önbellek & Kuyruk** | Redis | `7+` | Senkronizasyon takibi, oturum ve veri önbelleği |
| **Ters Proxy & Web Sunucu** | Nginx | `Stable` | SSL sonlandırma, statik dosya sunumu, reverse proxy |
| **Otomatik Çeviri** | LibreTranslate + Proxy | `v1.5+` | Katalog ve blog çok dilli otomatik çeviri (Port `5000/5001`) |
| **Görsel İşleme** | `deepteams/webp`, `golang.org/x/image`| `v1.2.2` | WebP dinamik yeniden boyutlandırma ve bulk optimizasyon |
| **Dağıtım / CI-CD** | PowerShell & Python (PySide6/Paramiko) | `3.10+` | Cross-compile, SFTP senkronizasyon, systemd yönetimi |

---

## 3. Geliştirme, Derleme ve Çalıştırma Komutları

### A. Birleşik Backend (Go - Port 8080)
```powershell
cd backend
go run .                               # Yerel geliştirme ortamında başlatma
go vet ./...                           # Derleyici ve linter kontrolü
go build -o bin\backend.exe .          # Windows binary derleme
$env:GOOS="linux"; $env:GOARCH="amd64"; go build -o bin\backend .  # Linux production binary
```

### B. Birleşik Frontend (Next.js SSR - Port 3000)
```powershell
cd frontend
npm run dev                           # Yerel geliştirme sunucusu (Vitrin: /, Admin: /admin)
npm run lint                          # ESLint denetimi
npm run build                         # Production SSR build
npm run start                         # SSR üretim sunucusunu başlatma
```

### C. Otomatik Cross-Compile ve Sunucu Dağıtım Scriptleri
```powershell
# Tekil veya toplu derleme/dağıtım (PowerShell)
.\scripts\build_deploy.ps1 -Project backend         # Sadece Go backend derler (Windows + Linux)
.\scripts\build_deploy.ps1 -Project frontend        # Sadece Next.js frontend derler (SSR)
.\scripts\build_deploy.ps1 -Project all -Deploy     # Hepsini derleyip canlı sunucuya aktarır

# Gelişmiş GUI/CLI Deployment Tool (Python)
python scripts\unified_deployer.py -p unified -c all -a deploy
```

---

## 4. Antigravity Autonomous Multi-Role Development Framework

Bu projede tek bir jenerik asistan yerine, kendi içinde koordine olan **Özerk Bir Sanal Yazılım Şirketi** modeli çalışır. Süreçleri `@architect` başlatır, görevleri dağıtır, denetler ve kabul kriterleri %100 yeşil olana kadar durmaksızın koşturur (Self-Looping).

### Rol Matrisi:
1. **`@architect` (Proje Yöneticisi & Baş Mimar - Orkestratör):**
   - Görevleri atomik parçalara böler, Master Roadmap yayınlar.
   - İlgili rolleri (`@coder`, `@dba`, `@seo`, `@security`, `@test`, `@sre`) tetikler.
   - Tüm rollerin çıktılarını denetler; eksik varsa geri gönderir; tüm isterler bitene kadar ASLA durmaz.
   - *Katı Kural:* Fonksiyonel kod yazmaz; mimari yönerge ve pseudocode verir.
2. **`@coder` (Kıdemli Yazılımcı):**
   - Mimarın belirlediği kontratlara harfiyen uyar. Temiz, tip güvenli, idiomatic Go ve Next.js kodu üretir.
3. **`@dba` (Veritabanı & Performans Uzmanı):**
   - PostgreSQL 16 şema tasarımı, UUIDv7 standardı, Base36 sequence'ları, `ltree` indeksleri, `catalog.mv_products` Materialized View yönetimi ve transaction güvenliğini sağlar.
4. **`@seo` (Kıdemli B2B & E-Ticaret SEO / Büyüme Uzmanı):**
   - Schema.org JSON-LD (`Product`, `Offer`, `BreadcrumbList`), çok dilli `hreflang`, canonical URL'ler, dinamik `sitemap.ts`, `robots.ts` (admin sayfalarını hariç tutar), IndexNow API, Google Merchant feed ve Core Web Vitals optimizasyonlarını yürütür.
5. **`@security` (AppSec & Güvenlik Uzmanı):**
   - OWASP Top 10 denetimi, Keycloak JWT RS256 doğrulaması, RBAC matrisi, rate limiting ve tedarikçi gizliliği maskeleme kontrollerini yapar.
6. **`@test` (QA & Test Otomasyon Mühendisi):**
   - Birim, entegrasyon ve E2E test senaryolarını hazırlar; edge-case'leri test eder; sonuçları `@architect`'e raporlar.
7. **`@sre` (Observability, Logging & Exception Kontrolörü):**
   - Günlük log dosyaları (`DailyLogWriter`), Sentry hata izleme, panik yakalama ve servis dayanıklılığını (resilience) denetler.

> Detaylı çalışma protokolü: [.agents/rules/multi-role-framework.md](file:///c:/Projects/mertervitrini.com.tr/.agents/rules/multi-role-framework.md)

---

## 5. Kesin Ajan Çalışma Kuralları (Demir Kurallar)

1. **ASLA İZİNSİZ COMMIT VEYA PUSH YAPMA:**
   - Kullanıcı açıkça *"commit'le"*, *"commit et"* veya *"push yap"* demedikçe **KESİNLİKLE** `git commit` veya `git push` komutlarını ÇALIŞTIRMA!
   - Tüm yeni dosyaları ve değişiklikleri çalışma dizininde (working tree) bırak ve kullanıcıdan inceleme/onay talep et.
2. **KURUMSAL COMMIT FORMATINA UY (İzin Verildiğinde):**
   - Commit mesajlarında kesinlikle [Conventional Commits](https://www.conventionalcommits.org/) formatı kullanılacaktır:
     - `feat: <yeni özellik>`
     - `fix: <hata düzeltmesi>`
     - `refactor: <davranış değiştirmeyen kod iyileştirmesi>`
     - `perf: <performans artırımı>`
     - `chore: <bağımlılık, build, config güncellemeleri>`
     - `docs: <dokümantasyon güncellemeleri>`
3. **SIFIR DERLEYİCİ / LINTER UYARISI STANDARDI (TreatWarningsAsErrors):**
   - Yapılan hiçbir değişiklik TypeScript veya Go derleyicisinde hata veya çözülmemiş uyarı bırakamaz.
   - `npm run lint` ve `go vet ./...` kontrolleri hatasız geçmelidir.
   - Kullanılmayan import, tanımlanıp okunmayan değişken veya tipi belirsiz (`any`) kaçamaklara izin verilmez.
4. **TEST ÇALIŞTIRMA STRATEJİSİ:**
   - Her küçük dosya düzenlemesinde gereksiz yere ağır test paketleri çalıştırarak geliştirme akışını ve CPU kaynaklarını tıkama.
   - Testleri yalnızca büyük bir özellik modülü tamamlandığında veya kullanıcı açıkça talep ettiğinde çalıştır.
5. **BİRLEŞİK SSR FRONTEND MİMARİSİ (ÇOK KRİTİK):**
   - Sistemde tek bir frontend uygulaması vardır (`frontend/`).
   - Storefront müşteri mağazası (`/`) ve Admin yönetim paneli (`/admin`) tek bir Next.js SSR uygulaması altında birleştirilmiştir (`systemd: merter-frontend`, Dinlenen Port: `3000`).
   - Ayrı bir statik export (`out/`) veya ayrı bir SPA frontend servisi ARTIK YOKTUR. Bu sayede Nginx 403 Forbidden hataları ve çift servis yönetimi yükü ortadan kaldırılmıştır.
   - `/admin` rotası arama motorlarına karşı `robots: { index: false, follow: false }` ile korunur.
6. **LINUX BINARY UYUMLULUĞU:**
   - Sunucu AlmaLinux 9.7 (Linux AMD64) mimarisindedir. Sunucuya aktarılacak Go backend çalıştırılabilir dosyaları MUTLAKA `$env:GOOS="linux"; $env:GOARCH="amd64"` çevre değişkenleriyle derlenmeli ve `backend/bin/backend` olarak konuşlandırılmalıdır.
7. **YERELDE FRONTEND STATİK VEYA DERLEME DOSYASI OLUŞTURULMAZ (Kalıcı Kural):**
   - Frontend için yerel geliştirici ortamında statik export (`out/`) veya yerel `.next` derleme dosyaları oluşturulup sunucuya yüklenmez.
   - Next.js SSR uygulaması doğrudan AlmaLinux sunucusu üzerinde (`systemd: merter-frontend`, Port `3000`) çalışır.
   - Dağıtım işleminde yalnızca saf kaynak kodlar (`src/`, `public/`, `package.json` vb.) sunucuya aktarılır; derleme işlemi doğrudan sunucu ortamında (`npm run build`) gerçekleştirilir.
   - Tüm deployment araçlarında (`unified_deployer.py`, `build_deploy.ps1`) `--remote-build` kalıcı olarak varsayılandır (default: true).

---

## 6. Proje Dizin Haritası

```text
c:\Projects\mertervitrini.com.tr\
├── AGENTS.md                               # [BU DOSYA] Kök sistem sözleşmesi ve kurallar
├── README.md                               # Genel proje tanıtımı
├── .env.example                            # Ortam değişkenleri şablonu
├── context/                                # Kalıcı sistem hafıza kütüphanesi
│   ├── architecture.md                     # Katmanlar, iletişim, güvenlik ve middleware mimarisi
│   ├── database.md                         # DB şemaları, ltree, UUIDv7, materialized view ve DDL
│   ├── environments.md                     # Ortamlar, IP'ler, portlar, Nginx ve Keycloak haritası
│   └── business_rules.md                   # B2B sipariş, döviz, tedarikçi maskeleme, SEO kuralları
├── .agents/                                # Antigravity Ajan Sistemi Konfigürasyonu
│   ├── rules/
│   │   ├── multi-role-framework.md         # Otonom çok rollü framework (7 Rol, Orkestrasyon Döngüsü)
│   │   └── workflow-rules.md               # Kodlama standartları, cognitive complexity, clean code
│   └── skills/
│       ├── build-and-deploy/SKILL.md       # Cross-compile ve deployment iş akışı rehberi
│       ├── xml-feed-integration/SKILL.md   # XML entegrasyonu ve katalog senkronizasyon rehberi
│       └── seo-optimization/SKILL.md       # B2B teknik SEO, JSON-LD, hreflang, sitemap rehberi
├── backend/                                # Birleşik Go 1.25 REST API (Port 8080)
│   ├── config/                             # config.json okuyucu ve struct tanımları
│   ├── db/                                 # pgxpool PostgreSQL, Redis ve TCMB worker bağlantıları
│   ├── handlers/                           # Tekilleştirilmiş REST endpoint işleyicileri (admin + store)
│   ├── middleware/                         # JWT / Keycloak auth, CORS, Rate Limit, logging
│   ├── models/                             # DTO ve veritabanı veri modelleri
│   ├── parsers/                            # XML toptancı veri formatlayıcıları
│   ├── bin/                                # Windows (.exe) ve Linux derlenmiş ikili dosyalar
│   └── main.go                             # Servis giriş noktası, router ve graceful shutdown
├── frontend/                               # Birleşik Next.js 16 SSR Frontend (Port 3000)
│   ├── src/app/                            # App Router (Vitrin: /, /[categoryPrefix], /product; Admin: /admin)
│   │   ├── admin/                          # Yönetici Paneli Rotaları (layout.tsx, page.tsx)
│   │   ├── robots.ts                       # Arama motoru robot direktifleri (admin engelli)
│   │   └── sitemap.ts                      # Çok dilli dinamik B2B site haritası
│   ├── src/components/
│   │   ├── store/                          # Müşteri sepet, filtre, header, footer bileşenleri
│   │   └── admin/                          # Admin katalog, sipariş, entegrasyon, cron modülleri
│   ├── src/types/                          # Ortak TypeScript tip tanımları (store & integration)
│   ├── src/utils/                          # Ortak formatlayıcılar ve yardımcı fonksiyonlar
│   └── next.config.ts                      # SSR ve Sentry konfigürasyonu
├── database/                               # Veritabanı DDL ve Migration Scriptleri
│   ├── DB_DDL.sql                          # Master veritabanı şeması ve seed kayıtları
│   ├── 0005_add_blog_tables.sql            # Çok dilli blog tabloları migration'ı
│   └── 0006_add_category_seo_description.sql # Kategori SEO alanları migration'ı
├── docs/                                   # Proje dokümantasyonu ve sunucu kılavuzları
│   ├── application_configs.md              # Port dağılımı, Nginx konfigleri ve sunucu dizinleri
│   └── kategoriler.txt                     # Kategori ağacı referans dökümü
├── keycloak-theme/                         # Özel Merter Vitrini Keycloak giriş teması
├── keycloak_installation.md                # Keycloak 26 Quarkus kurulum ve yönetim dokümanı
├── scripts/                                # Otomasyon, build ve deployment scriptleri
│   ├── build_deploy.ps1                    # PowerShell cross-compile ve deploy scripti
│   ├── unified_deployer.py                 # PySide6 GUI ve CLI deployment aracı
│   └── optimize_seo.py                     # Toplu SEO optimizasyon scripti
└── xml_mapping_schema.json                 # XML toptancı eşleme şeması
```

---

## 7. Kalıcı Hafıza Bağlantıları (Context Referansları)

Çalışma alanında derinlemesine bilgi edinmek için `context/` altındaki ilgili belgelere başvurun:
- **Çok Rollü Otonom Framework:** [.agents/rules/multi-role-framework.md](file:///c:/Projects/mertervitrini.com.tr/.agents/rules/multi-role-framework.md)
- **Katmanlar, Güvenlik ve Servis Mimarisi:** [context/architecture.md](file:///c:/Projects/mertervitrini.com.tr/context/architecture.md)
- **Veritabanı Şemaları, ltree, Materialized View & DDL:** [context/database.md](file:///c:/Projects/mertervitrini.com.tr/context/database.md)
- **Sunucu, Portlar, Nginx, SSL ve Ortamlar:** [context/environments.md](file:///c:/Projects/mertervitrini.com.tr/context/environments.md)
- **Kritik İş Kuralları, Yetkiler, Maskeleme & Sipariş:** [context/business_rules.md](file:///c:/Projects/mertervitrini.com.tr/context/business_rules.md)
- **Ajan Çalışma ve Kod Standartları Kuralları:** [.agents/rules/workflow-rules.md](file:///c:/Projects/mertervitrini.com.tr/.agents/rules/workflow-rules.md)
- **Build & Dağıtım Skill'i:** [.agents/skills/build-and-deploy/SKILL.md](file:///c:/Projects/mertervitrini.com.tr/.agents/skills/build-and-deploy/SKILL.md)
- **XML Entegrasyon Skill'i:** [.agents/skills/xml-feed-integration/SKILL.md](file:///c:/Projects/mertervitrini.com.tr/.agents/skills/xml-feed-integration/SKILL.md)
- **B2B Teknik SEO Skill'i:** [.agents/skills/seo-optimization/SKILL.md](file:///c:/Projects/mertervitrini.com.tr/.agents/skills/seo-optimization/SKILL.md)
