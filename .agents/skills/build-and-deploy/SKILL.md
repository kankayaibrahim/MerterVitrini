---
name: build-and-deploy
description: Merter Vitrini projesinde Go backend'in cross-compile derlenmesi, Next.js frontend'in paketlenmesi ve canlı sunucuya (AlmaLinux) güvenli aktarımı için iş akışı.
---

# Merter Vitrini Derleme ve Canlı Dağıtım İş Akışı (Build & Deploy Skill)

Bu rehber, Merter Vitrini birleşik mimarisindeki (Unified Backend & Unified SSR Frontend) bileşenlerin yerel ortamda derlenip, test edilip, canlı sunucuya (`213.202.255.80`) hatasız dağıtılması için operasyonel prosedürü tanımlar.

---

## 1. Kritik Mimari Kurallar (Önce Oku)

1. **Birleşik SSR Frontend Mimarisi:**
   - Frontend (`frontend/`), hem müşteri vitrinini (`/`) hem de yönetim panelini (`/admin`) barındıran tek bir Next.js SSR uygulamasıdır.
   - Canlı sunucuda Port `3000` üzerinde `merter-frontend.service` tarafından yönetilir.
   - Ayrı bir statik export (`out/`) süreci yoktur; Nginx statik dizin çakışmaları ve 403 Forbidden hataları tamamen bertaraf edilmiştir.
2. **Birleşik Go Backend:**
   - Backend (`backend/`), hem Storefront (`/api/v1/store/`) hem de Admin (`/api/v1/`) API uçlarını tek bir Go servisi olarak sunar (Port `8080`).
   - Canlı sunucuda `merter-backend.service` tarafından yönetilir.
3. **Go Backend Linux AMD64 Olarak Derlenmelidir:**
   - Sunucu AlmaLinux 9 (Linux AMD64) mimarisindedir. Binary'ler Windows ortamından aktarılmadan önce mutlaka cross-compile edilmelidir (`$env:GOOS="linux"; $env:GOARCH="amd64"`).

---

## 2. Derleme Adımları (Build Workflow)

### Adım A: Unified Go Backend'i Derleme
```powershell
cd backend
# 1. Kod analizi
go vet ./...

# 2. Windows geliştirme binary'si (İsteğe bağlı)
go build -o bin\backend.exe .

# 3. Linux Production Binary (Cross-Compile)
$env:GOOS="linux"; $env:GOARCH="amd64"
go build -o bin\backend .

# Ortam değişkenlerini sıfırlama (Windows ortamına dönüş)
$env:GOOS="windows"; $env:GOARCH="amd64"
```

### Adım B: Unified Next.js Frontend'i Derleme
```powershell
cd frontend
# 1. Tip denetimi
npx tsc --noEmit

# 2. Production SSR Derleme
npm run build
```

---

## 3. Otomatik PowerShell Scripti ile Derleme ve Dağıtım

Tüm derleme ve dağıtım süreçleri `scripts/build_deploy.ps1` üzerinden tek komutla yönetilebilir:

```powershell
# Sadece Birleşik Go Backend'i derle (Windows + Linux):
.\scripts\build_deploy.ps1 -Project backend

# Sadece Birleşik Next.js Frontend'i derle:
.\scripts\build_deploy.ps1 -Project frontend

# Tüm sistemi derle:
.\scripts\build_deploy.ps1 -Project all

# Tüm sistemi derleyip canlı sunucuya deploy et:
.\scripts\build_deploy.ps1 -Project all -Deploy
```

---

## 4. Python Unified Deployer ile Gelişmiş Dağıtım

Detaylı bileşen seçimi ve SFTP log takibi için `scripts/unified_deployer.py` kullanılabilir:

```powershell
# Birleşik sistemi derleyip deploy etme
python scripts\unified_deployer.py -p unified -c all -a deploy

# Sadece Backend deploy etme
python scripts\unified_deployer.py -p unified -c backend -a deploy

# Sadece Frontend deploy etme
python scripts\unified_deployer.py -p unified -c frontend -a deploy
```

---

## 5. Dağıtım Sonrası Doğrulama (Post-Deploy Health Checks)

Dağıtım tamamlandıktan sonra servislerin ayakta ve sağlıklı olduğu doğrulanmalıdır:

```powershell
# 1. Unified API Sağlık Kontrolü
Invoke-RestMethod -Uri "https://mertervitrini.com.tr/api/v1/health"
# Beklenen Yanıt: {"status":"healthy","database":"connected","service":"unified-backend"}

# 2. Storefront Vitrin Kontrolü
Invoke-WebRequest -Uri "https://mertervitrini.com.tr" -Method Head

# 3. Admin Paneli Kontrolü
Invoke-WebRequest -Uri "https://mertervitrini.com.tr/admin" -Method Head
```
