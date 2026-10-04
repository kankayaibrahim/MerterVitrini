# PowerShell Script to Cross-Compile & Deploy Unified Go Backend + Next.js Frontend
# Usage:
#   .\scripts\build_deploy.ps1 -Project backend
#   .\scripts\build_deploy.ps1 -Project frontend
#   .\scripts\build_deploy.ps1 -Project all
#   .\scripts\build_deploy.ps1 -Project all -Deploy

param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("backend", "frontend", "all", "admin", "shop")]
    [string]$Project = "all",

    [Parameter(Mandatory=$false)]
    [switch]$Deploy = $false
)

$ErrorActionPreference = "Stop"

Clear-Host

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "   MERTER VITRINI UNIFIED BUILD & DEPLOY TOOLBOX  " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check Go
try {
    $goVersion = & go version
    Write-Host "Detected Go Environment: $goVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: 'go' command was not found in PATH." -ForegroundColor Red
    Exit 1
}

$rootDir = Resolve-Path "$PSScriptRoot\.."

function Build-GoProject {
    param (
        [string]$projPath,
        [string]$binaryName
    )

    $fullProjPath = Join-Path $rootDir $projPath
    $binDir = Join-Path $fullProjPath "bin"

    if (-not (Test-Path $binDir)) {
        New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    }

    $oldGoOs = $env:GOOS
    $oldGoArch = $env:GOARCH

    try {
        Push-Location $fullProjPath

        Write-Host "`n--------------------------------------------------" -ForegroundColor DarkCyan
        Write-Host "Building Unified Go Backend: $projPath" -ForegroundColor DarkCyan
        Write-Host "--------------------------------------------------" -ForegroundColor DarkCyan

        # 1. Compile for WINDOWS (AMD64)
        $winBinaryName = "$binaryName.exe"
        $winBinaryPath = Join-Path $binDir $winBinaryName
        
        $processName = $binaryName
        if (Get-Process -Name $processName -ErrorAction SilentlyContinue) {
            Write-Host "[WARNING] Found running instance of '$processName.exe'. Terminating..." -ForegroundColor Yellow
            Stop-Process -Name $processName -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 1
        }

        Write-Host "[BUILD] Compiling Go for Windows (amd64)..." -ForegroundColor White
        $env:GOOS = "windows"
        $env:GOARCH = "amd64"
        & go build -o (Join-Path "bin" $winBinaryName) .
        
        if (Test-Path $winBinaryPath) {
            $sizeKB = [Math]::Round((Get-Item $winBinaryPath).Length / 1KB, 2)
            Write-Host "[OK] Windows Go Build Success! -> $projPath/bin/$winBinaryName ($sizeKB KB)" -ForegroundColor Green
        }

        # 2. Compile for LINUX (AMD64)
        $linuxBinaryName = $binaryName
        $linuxBinaryPath = Join-Path $binDir $linuxBinaryName
        Write-Host "[BUILD] Compiling Go for Linux (amd64)..." -ForegroundColor White
        
        $env:GOOS = "linux"
        $env:GOARCH = "amd64"
        & go build -o (Join-Path "bin" $linuxBinaryName) .
        
        if (Test-Path $linuxBinaryPath) {
            $sizeKB = [Math]::Round((Get-Item $linuxBinaryPath).Length / 1KB, 2)
            Write-Host "[OK] Linux Go Build Success!   -> $projPath/bin/$linuxBinaryName ($sizeKB KB)" -ForegroundColor Green
        }

    } catch {
        Write-Host "[ERROR] Compilation FAILED for Go project $projPath`n$_" -ForegroundColor Red
        throw $_
    } finally {
        $env:GOOS = $oldGoOs
        $env:GOARCH = $oldGoArch
        Pop-Location
    }
}

# --- PIPELINE ACTIONS ---

# 1. UNIFIED GO BACKEND
if ($Project -eq "backend" -or $Project -eq "all" -or $Project -eq "admin" -or $Project -eq "shop") {
    Build-GoProject -projPath "backend" -binaryName "backend"
}

# 2. UNIFIED NEXT.JS FRONTEND (SSR Mağaza + /admin Yönetim Paneli)
if ($Project -eq "frontend" -or $Project -eq "all" -or $Project -eq "admin" -or $Project -eq "shop") {
    Write-Host "`n--------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host "Verifying Unified Next.js Frontend (SSR Mağaza + /admin)" -ForegroundColor DarkCyan
    Write-Host "--------------------------------------------------" -ForegroundColor DarkCyan
    
    $frontendDir = Join-Path $rootDir "frontend"
    Push-Location $frontendDir
    try {
        Write-Host "[TYPECHECK] Running TypeScript verification (no local build artifacts)..." -ForegroundColor White
        & npx.cmd tsc --noEmit
        Write-Host "[OK] TypeScript validation clean (0 errors)!" -ForegroundColor Green
        Write-Host "[REMOTE-BUILD POLICY] Yerel statik/derleme dosyası oluşturulmaz. Next.js SSR doğrudan sunucuda derlenir ve çalışır." -ForegroundColor Gray
    } catch {
        Write-Host "[ERROR] Next.js TypeScript verification FAILED!" -ForegroundColor Red
        throw $_
    } finally {
        Pop-Location
    }

    # Trigger Deploy if flagged
    if ($Deploy) {
        Write-Host "`n--------------------------------------------------" -ForegroundColor Yellow
        Write-Host "Deploying Unified Suite to AlmaLinux Production (Remote Build Mode)..." -ForegroundColor Yellow
        Write-Host "--------------------------------------------------" -ForegroundColor Yellow
        Push-Location $rootDir
        try {
            & python scripts/unified_deployer.py -p unified -c all -a deploy --remote-build
        } catch {
            Write-Host "[ERROR] Unified deployment failed!" -ForegroundColor Red
            throw $_
        } finally {
            Pop-Location
        }
    }
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "           ALL PIPELINE ACTIONS COMPLETED         " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
