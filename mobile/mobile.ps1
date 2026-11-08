<#
.SYNOPSIS
    Merter Vitrini B2B Mobil Uygulamasi — Windows Calistirma, Derleme ve Dagitim Araci

.DESCRIPTION
    Flutter tabanli birlesik (Musteri + Tedarikci) uygulamasini Windows masaustunde
    dogrudan derleyip calistirmak, Hot-Reload gelistirme oturumu acmak, Android APK /
    Play Store AAB paketleri uretmek ve statik analiz/test sureclerini yonetmek icin
    tek noktadan PowerShell araci.

.EXAMPLE
    .\mobile.ps1                        # Interaktif secim menusunu acar
    .\mobile.ps1 run                    # Windows masaustunde (Hot Reload) calistirir (Canli API)
    .\mobile.ps1 run -Local             # Windows masaustunde yerel Go API (http://localhost:8080) ile calistirir
    .\mobile.ps1 build-win              # Windows Release .exe derler
    .\mobile.ps1 build-run-win          # Windows Release .exe derler ve aninda calistirir
    .\mobile.ps1 open-win               # Derlenmis Windows .exe uygulamasini dogrudan acar
    .\mobile.ps1 apk                    # Imzali Android Release APK derler
    .\mobile.ps1 publish-apk            # Imzali APK derler ve mertervitrini.com.tr'ye OTA yayinlar
    .\mobile.ps1 bump-publish           # Surumu otomatik +1 artirir, APK derler ve OTA yayinlar
    .\mobile.ps1 release                # Test + Analiz + Play Store AAB + APK tam paket derler
    .\mobile.ps1 check                  # flutter analyze + flutter test calistirir
    .\mobile.ps1 clean                  # Derleme onbelleklerini temizler ve paketleri yeniler
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet(
        "menu",
        "run", "run-win", "run-local", "run-android", "run-chrome",
        "build-win", "build-run-win", "open-win",
        "apk", "apk-debug", "aab", "release",
        "publish-apk", "bump-publish",
        "check", "analyze", "test",
        "clean", "pub", "devices", "doctor"
    )]
    [string]$Action = "menu",

    [string]$ApiBaseUrl = "https://mertervitrini.com.tr",

    [ValidateSet("none", "build", "patch", "minor", "major")]
    [string]$BumpVersion = "none",

    [string]$ReleaseNotes = "",

    [switch]$ForceUpdate,

    [switch]$Local,

    [switch]$DebugMode,

    [switch]$OpenFolder
)

$ErrorActionPreference = "Stop"
$MobileDir = $PSScriptRoot

if ($Local -or $Action -eq "run-local") {
    $ApiBaseUrl = "http://localhost:8080"
}

function Initialize-BuildEnvironment {
    $jdkCandidates = @(
        "C:\Program Files\Android\openjdk\jdk-21.0.8",
        "C:\Program Files\Android\Android Studio\jbr"
    )
    if (-not $env:JAVA_HOME -or -not (Test-Path $env:JAVA_HOME)) {
        foreach ($candidate in $jdkCandidates) {
            if (Test-Path $candidate) {
                $env:JAVA_HOME = $candidate
                $env:PATH = "$env:JAVA_HOME\bin;$env:PATH"
                break
            }
        }
    }

    if (-not (Get-Command flutter -ErrorAction SilentlyContinue)) {
        throw "Flutter SDK PATH uzerinde bulunamadi. Lutfen Flutter kurulumunu kontrol edin."
    }
}

function Write-Step {
    param([string]$Message)
    Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Write-Success {
    param([string]$Message)
    Write-Host "`n[OK] $Message" -ForegroundColor Green
}

function Initialize-WindowsPlatform {
    $winCMake = Join-Path $MobileDir "windows\CMakeLists.txt"
    if (-not (Test-Path $winCMake)) {
        Write-Step "Windows masaustu platform dosyalari olusturuluyor..."
        & flutter create --platforms=windows --project-name=mertervitrini_mobile .
        if ($LASTEXITCODE -ne 0) {
            throw "Windows platformu olusturulamadi."
        }
    }
}

function Stop-RunningWindowsApp {
    $running = Get-Process -Name "mertervitrini_mobile" -ErrorAction SilentlyContinue
    if ($running) {
        Write-Host "Acik olan 'mertervitrini_mobile.exe' ornegi kapatiliyor (dosya kilidini onlemek icin)..." -ForegroundColor Yellow
        $running | Stop-Process -Force
        Start-Sleep -Milliseconds 400
    }
}

function Invoke-PubGet {
    Write-Step "Bagimliliklar esitleniyor (flutter pub get)..."
    & flutter pub get
    if ($LASTEXITCODE -ne 0) { throw "flutter pub get basarisiz oldu!" }
}

function Invoke-Analyze {
    Write-Step "Statik kod analizi calistiriliyor (flutter analyze)..."
    & flutter analyze
    if ($LASTEXITCODE -ne 0) { throw "flutter analyze uyari/hata bildirdi!" }
    Write-Success "Statik kod analizi sifir hata ile gecti."
}

function Invoke-UnitTests {
    Write-Step "Birim ve widget testleri calistiriliyor (flutter test)..."
    & flutter test
    if ($LASTEXITCODE -ne 0) { throw "flutter test basarisiz oldu!" }
    Write-Success "Tum birim testler basariyla gecti."
}

function Invoke-RunWindows {
    Initialize-WindowsPlatform
    Stop-RunningWindowsApp
    $modeFlag = if ($DebugMode) { "--debug" } else { "--debug" }
    Write-Step "Merter Vitrini Windows Masaustunde baslatiliyor (API: $ApiBaseUrl)..."
    Write-Host "Ipucu: Terminalde 'r' = Hot Reload, 'R' = Hot Restart, 'q' = Cikis" -ForegroundColor DarkGray
    & flutter run -d windows $modeFlag "--dart-define=API_BASE_URL=$ApiBaseUrl"
}

function Invoke-BuildWindows {
    param([switch]$LaunchAfter)
    Initialize-WindowsPlatform
    Stop-RunningWindowsApp
    Invoke-PubGet

    $buildMode = if ($DebugMode) { "--debug" } else { "--release" }
    $modeFolder = if ($DebugMode) { "Debug" } else { "Release" }

    Write-Step "Windows masaustu uygulamasi ($modeFolder) derleniyor (API: $ApiBaseUrl)..."
    & flutter build windows $buildMode "--dart-define=API_BASE_URL=$ApiBaseUrl"
    if ($LASTEXITCODE -ne 0) { throw "Windows .exe derlemesi basarisiz oldu!" }

    $exePath = Join-Path $MobileDir "build\windows\x64\runner\$modeFolder\mertervitrini_mobile.exe"
    if (-not (Test-Path $exePath)) {
        throw "Derlenen .exe bulunamadi: $exePath"
    }

    $exeItem = Get-Item $exePath
    Write-Success "Windows uygulamasi hazir: $($exeItem.FullName) ($([Math]::Round($exeItem.Length / 1KB, 0)) KB)"

    if ($OpenFolder) {
        Start-Process explorer.exe -ArgumentList "/select,`"$($exeItem.FullName)`""
    }
    if ($LaunchAfter) {
        Write-Step "mertervitrini_mobile.exe baslatiliyor..."
        Start-Process -FilePath $exeItem.FullName -WorkingDirectory $exeItem.DirectoryName
    }
}

function Invoke-OpenWindowsExe {
    $releaseExe = Join-Path $MobileDir "build\windows\x64\runner\Release\mertervitrini_mobile.exe"
    $debugExe   = Join-Path $MobileDir "build\windows\x64\runner\Debug\mertervitrini_mobile.exe"

    if (Test-Path $releaseExe) {
        Write-Step "Mevcut Release Windows uygulamasi aciliyor..."
        Start-Process -FilePath $releaseExe -WorkingDirectory (Split-Path $releaseExe -Parent)
        return
    }
    if (Test-Path $debugExe) {
        Write-Step "Mevcut Debug Windows uygulamasi aciliyor..."
        Start-Process -FilePath $debugExe -WorkingDirectory (Split-Path $debugExe -Parent)
        return
    }

    Write-Host "Derlenmis .exe bulunamadi; once Release derlemesi baslatiliyor..." -ForegroundColor Yellow
    Invoke-BuildWindows -LaunchAfter
}

function Invoke-BuildApk {
    param([switch]$IsDebug)
    Invoke-PubGet
    $flag = if ($IsDebug) { "--debug" } else { "--release" }
    $outSub = if ($IsDebug) { "app-debug.apk" } else { "app-release.apk" }

    Write-Step "Android APK ($flag) derleniyor (API: $ApiBaseUrl)..."
    & flutter build apk $flag "--dart-define=API_BASE_URL=$ApiBaseUrl"
    if ($LASTEXITCODE -ne 0) { throw "Android APK derlemesi basarisiz oldu!" }

    $apkPath = Join-Path $MobileDir "build\app\outputs\flutter-apk\$outSub"
    if (Test-Path $apkPath) {
        $apkItem = Get-Item $apkPath
        Write-Success "APK hazir: $($apkItem.FullName) ($([Math]::Round($apkItem.Length / 1MB, 2)) MB)"
        if ($OpenFolder) {
            Start-Process explorer.exe -ArgumentList "/select,`"$($apkItem.FullName)`""
        }
    }
}

function Invoke-BuildAab {
    Invoke-PubGet
    Write-Step "Google Play Store imzali App Bundle (.aab) derleniyor (API: $ApiBaseUrl)..."
    & flutter build appbundle --release "--dart-define=API_BASE_URL=$ApiBaseUrl"
    if ($LASTEXITCODE -ne 0) { throw "App Bundle (.aab) derlemesi basarisiz oldu!" }

    $aabPath = Join-Path $MobileDir "build\app\outputs\bundle\release\app-release.aab"
    if (Test-Path $aabPath) {
        $aabItem = Get-Item $aabPath
        Write-Success "Play Store AAB hazir: $($aabItem.FullName) ($([Math]::Round($aabItem.Length / 1MB, 2)) MB)"
        if ($OpenFolder) {
            Start-Process explorer.exe -ArgumentList "/select,`"$($aabItem.FullName)`""
        }
    }
}

function Update-PubspecVersion {
    param([string]$Mode)
    if ($Mode -eq "none" -or [string]::IsNullOrWhiteSpace($Mode)) {
        return
    }
    $pubspecPath = Join-Path $MobileDir "pubspec.yaml"
    $raw = Get-Content -Path $pubspecPath -Raw -Encoding UTF8
    if ($raw -notmatch '(?m)^version:\s*(\d+)\.(\d+)\.(\d+)(?:\+(\d+))?') {
        throw "pubspec.yaml icinde gecerli 'version: X.Y.Z+N' satiri bulunamadi."
    }

    $major = [int]$Matches[1]
    $minor = [int]$Matches[2]
    $patch = [int]$Matches[3]
    $build = if ($Matches[4]) { [int]$Matches[4] } else { 1 }

    switch ($Mode) {
        "major" { $major++; $minor = 0; $patch = 0; $build++ }
        "minor" { $minor++; $patch = 0; $build++ }
        "patch" { $patch++; $build++ }
        "build" { $build++ }
    }

    $newVer = "$major.$minor.$patch+$build"
    $updated = [regex]::Replace($raw, '(?m)^version:\s*\d+\.\d+\.\d+(?:\+\d+)?', "version: $newVer", 1)
    Set-Content -Path $pubspecPath -Value $updated -NoNewline -Encoding UTF8
    Write-Success "pubspec.yaml surumu guncellendi -> $newVer"
}

function Publish-ReleaseApk {
    param([string]$EffectiveBump = "none")
    if ($EffectiveBump -ne "none") {
        Update-PubspecVersion -Mode $EffectiveBump
    }

    Invoke-PubGet
    Invoke-Analyze
    Invoke-UnitTests
    Invoke-BuildApk

    $repoRoot = Split-Path -Parent $MobileDir
    $publisherPy = Join-Path $repoRoot "scripts\publish_mobile_apk.py"
    $apkFile = Join-Path $MobileDir "build\app\outputs\flutter-apk\app-release.apk"

    Write-Step "Imzali APK ve OTA version.json canli sunucuya (mertervitrini.com.tr) yukleniyor..."
    $pyArgs = @($publisherPy, "--apk", $apkFile, "--base-url", $ApiBaseUrl)
    if (-not [string]::IsNullOrWhiteSpace($ReleaseNotes)) {
        $pyArgs += @("--notes-tr", $ReleaseNotes)
    }
    if ($ForceUpdate) {
        $pyArgs += "--force"
    }

    & python @pyArgs
    if ($LASTEXITCODE -ne 0) {
        throw "APK canli sunucuya yuklenemedi!"
    }
    Write-Success "OTA APK yayini tamamlandi! Telefonunuzdan https://mertervitrini.com.tr/mobil-uygulama adresinden indirebilirsiniz."
}

function Invoke-CleanProject {
    Stop-RunningWindowsApp
    Write-Step "Proje derleme ciktilari temizleniyor (flutter clean)..."
    & flutter clean
    Invoke-PubGet
    Write-Success "Temizlik ve paket kurulumu tamamlandi."
}

function Invoke-SelectedAction {
    param([string]$Selected)

    switch ($Selected) {
        "run"           { Invoke-RunWindows }
        "run-win"       { Invoke-RunWindows }
        "run-local"     { $script:ApiBaseUrl = "http://localhost:8080"; Invoke-RunWindows }
        "run-chrome"    {
            Write-Step "Chrome Web uzerinde baslatiliyor (API: $ApiBaseUrl)..."
            & flutter run -d chrome "--dart-define=API_BASE_URL=$ApiBaseUrl"
        }
        "run-android"   {
            Write-Step "Bagli Android cihaz/emulator uzerinde baslatiliyor (API: $ApiBaseUrl)..."
            & flutter run "--dart-define=API_BASE_URL=$ApiBaseUrl"
        }
        "build-win"     { Invoke-BuildWindows }
        "build-run-win" { Invoke-BuildWindows -LaunchAfter }
        "open-win"      { Invoke-OpenWindowsExe }
        "apk"           { Invoke-BuildApk }
        "apk-debug"     { Invoke-BuildApk -IsDebug }
        "aab"           { Invoke-BuildAab }
        "publish-apk"   { Publish-ReleaseApk -EffectiveBump $BumpVersion }
        "bump-publish"  {
            $mode = if ($BumpVersion -eq "none") { "patch" } else { $BumpVersion }
            Publish-ReleaseApk -EffectiveBump $mode
        }
        "release"       {
            Invoke-PubGet
            Invoke-Analyze
            Invoke-UnitTests
            Invoke-BuildAab
            Invoke-BuildApk
        }
        "check"         { Invoke-Analyze; Invoke-UnitTests }
        "analyze"       { Invoke-Analyze }
        "test"          { Invoke-UnitTests }
        "clean"         { Invoke-CleanProject }
        "pub"           { Invoke-PubGet }
        "devices"       { & flutter devices }
        "doctor"        { & flutter doctor -v }
    }
}

function Show-InteractiveMenu {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "   MERTER VITRINI B2B MOBIL — WINDOWS & ANDROID YONETIM ARACI   " -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host " Aktif API Adresi : $ApiBaseUrl" -ForegroundColor Yellow
    Write-Host " Calisma Dizini   : $MobileDir" -ForegroundColor DarkGray
    Write-Host "----------------------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "  [1] Windows'ta Calistir — Gelistirme / Hot Reload (Canli API)" -ForegroundColor Green
    Write-Host "  [2] Windows'ta Calistir — Yerel Backend (http://localhost:8080)" -ForegroundColor Green
    Write-Host "  [3] Windows .EXE Derle ve Hemen Ac (Release)" -ForegroundColor White
    Write-Host "  [4] Windows .EXE Sadece Derle (Release)" -ForegroundColor White
    Write-Host "  [5] Mevcut Derlenmis Windows .EXE Uygulamasini Ac" -ForegroundColor White
    Write-Host "  [6] Android Imzali Release APK Derle" -ForegroundColor Yellow
    Write-Host "  [7] Google Play Store Tam Paket Derle (Analyze + Test + AAB + APK)" -ForegroundColor Yellow
    Write-Host "  [8] Kod Analizi ve Birim Testleri Calistir (analyze + test)" -ForegroundColor Magenta
    Write-Host "  [9] Temizle ve Bagimliliklari Yenile (flutter clean + pub get)" -ForegroundColor DarkCyan
    Write-Host "  [10] Imzali APK Derle ve Canli Siteye Yukle (OTA Yayinla)" -ForegroundColor Green
    Write-Host "  [11] Yeni Surum (+1) Artir + APK Derle + Canli Siteye OTA Yayinla" -ForegroundColor Green
    Write-Host "  [0] Cikis" -ForegroundColor DarkGray
    Write-Host "================================================================" -ForegroundColor Cyan

    $choice = Read-Host "Seciminiz (0-11)"
    switch ($choice.Trim()) {
        "1"  { Invoke-SelectedAction "run-win" }
        "2"  { Invoke-SelectedAction "run-local" }
        "3"  { Invoke-SelectedAction "build-run-win" }
        "4"  { Invoke-SelectedAction "build-win" }
        "5"  { Invoke-SelectedAction "open-win" }
        "6"  { Invoke-SelectedAction "apk" }
        "7"  { Invoke-SelectedAction "release" }
        "8"  { Invoke-SelectedAction "check" }
        "9"  { Invoke-SelectedAction "clean" }
        "10" { Invoke-SelectedAction "publish-apk" }
        "11" { Invoke-SelectedAction "bump-publish" }
        "0"  { Write-Host "Cikis yapildi." -ForegroundColor DarkGray; return }
        default { Write-Host "Gecersiz secim: $choice" -ForegroundColor Red }
    }
}

Push-Location $MobileDir
try {
    Initialize-BuildEnvironment
    if ($Action -eq "menu") {
        Show-InteractiveMenu
    }
    else {
        Invoke-SelectedAction $Action
    }
}
finally {
    Pop-Location
}

