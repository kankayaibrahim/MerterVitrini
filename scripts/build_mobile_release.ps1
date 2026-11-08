param(
    [string]$ApiBaseUrl = "https://mertervitrini.com.tr",
    [switch]$SkipApk
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$MobileDir = Join-Path $RepoRoot "mobile"

if (Test-Path "C:\Program Files\Android\openjdk\jdk-21.0.8") {
    $env:JAVA_HOME = "C:\Program Files\Android\openjdk\jdk-21.0.8"
    $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
}

Write-Host "=== Merter Vitrini Mobile Release Builder ===" -ForegroundColor Cyan
Push-Location $MobileDir
try {
    Write-Host "[1/4] Bagimliliklar kontrol ediliyor (flutter pub get)..." -ForegroundColor Yellow
    flutter pub get

    Write-Host "[2/4] Statik kod analizi ve birim testler calistiriliyor..." -ForegroundColor Yellow
    flutter analyze
    if ($LASTEXITCODE -ne 0) { throw "flutter analyze hatasi!" }

    flutter test
    if ($LASTEXITCODE -ne 0) { throw "flutter test hatasi!" }

    Write-Host "[3/4] Google Play Store imzali App Bundle (.aab) derleniyor..." -ForegroundColor Yellow
    flutter build appbundle --release --dart-define=API_BASE_URL=$ApiBaseUrl
    if ($LASTEXITCODE -ne 0) { throw "App Bundle (.aab) derlemesi basarisiz!" }

    if (-not $SkipApk) {
        Write-Host "[4/4] Dogrudan dagitim / test imzali APK derleniyor..." -ForegroundColor Yellow
        flutter build apk --release --dart-define=API_BASE_URL=$ApiBaseUrl
        if ($LASTEXITCODE -ne 0) { throw "APK derlemesi basarisiz!" }
    }

    $aabFile = Get-Item "build\app\outputs\bundle\release\app-release.aab"
    Write-Host "`nBASARILI! Play Store AAB hazir: $($aabFile.FullName) ($([Math]::Round($aabFile.Length / 1MB, 2)) MB)" -ForegroundColor Green
}
finally {
    Pop-Location
}

