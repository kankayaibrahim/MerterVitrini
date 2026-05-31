# PowerShell Script to Cross-Compile & Deploy Go + Next.js Projects for Windows & Linux
# Usage:
#   .\scripts\build_deploy.ps1 -Project admin
#   .\scripts\build_deploy.ps1 -Project admin -Deploy
#   .\scripts\build_deploy.ps1 -Project shop -Deploy
#   .\scripts\build_deploy.ps1 -Project all -Deploy

param (
    [Parameter(Mandatory=$false)]
    [ValidateSet("admin", "shop", "all")]
    [string]$Project = "admin",

    [Parameter(Mandatory=$false)]
    [switch]$Deploy = $false
)

$ErrorActionPreference = "Stop"

# Clear screen
Clear-Host

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "         BUILD & DEPLOYMENT PIPELINE TOOLBOX       " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if Go is installed and available
try {
    $goVersion = & go version
    Write-Host "Detected Go Environment: $goVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: 'go' command was not found." -ForegroundColor Red
    Write-Host "If you have just installed Go, please restart your PowerShell terminal or editor (like VS Code)" -ForegroundColor Yellow
    Write-Host "to reload your environment PATH variables, and then try again!" -ForegroundColor Yellow
    Exit 1
}

# Resolve script root directory
$rootDir = Resolve-Path "$PSScriptRoot\.."

function Build-GoProject {
    param (
        [string]$projPath,
        [string]$binaryName
    )

    $fullProjPath = Join-Path $rootDir $projPath
    $binDir = Join-Path $fullProjPath "bin"

    # Create bin directory if not exists
    if (-not (Test-Path $binDir)) {
        New-Item -ItemType Directory -Path $binDir -Force | Out-Null
    }

    # If versioninfo.json exists, compile it to resource.syso for Windows properties embedding
    $versionJson = Join-Path $fullProjPath "versioninfo.json"
    if (Test-Path $versionJson) {
        $goVersionInfo = Join-Path $env:USERPROFILE "go\bin\goversioninfo.exe"
        if (Test-Path $goVersionInfo) {
            Write-Host "[BUILD] Compiling Windows metadata properties..." -ForegroundColor White
            Push-Location $fullProjPath
            try {
                & $goVersionInfo | Out-Null
            } finally {
                Pop-Location
            }
        }
    }

    # Backup current environment
    $oldGoOs = $env:GOOS
    $oldGoArch = $env:GOARCH

    try {
        # Go into the project path
        Push-Location $fullProjPath

        Write-Host "`n--------------------------------------------------" -ForegroundColor DarkCyan
        Write-Host "Building Go Backend: $projPath" -ForegroundColor DarkCyan
        Write-Host "--------------------------------------------------" -ForegroundColor DarkCyan

        # 1. Compile for WINDOWS (AMD64)
        $winBinaryName = "$binaryName.exe"
        $winBinaryPath = Join-Path $binDir $winBinaryName
        
        # Terminate running process if active to release file locks on Windows
        $processName = $binaryName
        if (Get-Process -Name $processName -ErrorAction SilentlyContinue) {
            Write-Host "[WARNING] Found running instance of '$processName.exe'. Terminating to release file lock..." -ForegroundColor Yellow
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
        # Restore environment variables
        $env:GOOS = $oldGoOs
        $env:GOARCH = $oldGoArch
        Pop-Location
    }
}

# --- PIPELINE ACTIONS ---

# 1. ADMIN SUITE (Backend Go + Frontend Next.js)
if ($Project -eq "admin" -or $Project -eq "all") {
    # Compile Backend
    Build-GoProject -projPath "admin\backend" -binaryName "admin-backend"

    # Compile Frontend
    Write-Host "`n--------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host "Building Admin Next.js Frontend" -ForegroundColor DarkCyan
    Write-Host "--------------------------------------------------" -ForegroundColor DarkCyan
    
    $adminFrontendDir = Join-Path $rootDir "admin\frontend"
    Push-Location $adminFrontendDir
    try {
        Write-Host "[BUILD] Running Next.js static export build..." -ForegroundColor White
        & npm.cmd run build
        Write-Host "[OK] Next.js Frontend Compilation Success!" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Next.js Frontend Compilation FAILED!" -ForegroundColor Red
        throw $_
    } finally {
        Pop-Location
    }

    # Trigger Deploy if flagged
    if ($Deploy) {
        Write-Host "`n--------------------------------------------------" -ForegroundColor Yellow
        Write-Host "Deploying Admin Suite to http://admin.mertervitrini.com.tr" -ForegroundColor Yellow
        Write-Host "--------------------------------------------------" -ForegroundColor Yellow
        Push-Location $rootDir
        try {
            & python scripts/deploy_admin.py
        } catch {
            Write-Host "[ERROR] Admin suite deployment failed!" -ForegroundColor Red
            throw $_
        } finally {
            Pop-Location
        }
    }
}

# 2. SHOP SUITE (Frontend HTML index + Nginx configuration)
if ($Project -eq "shop" -or $Project -eq "all") {
    $shopDir = Join-Path $rootDir "shop\backend"
    if (Test-Path $shopDir) {
        if (-not (Test-Path (Join-Path $shopDir "go.mod"))) {
            Write-Host "`nInitializing shop/backend module placeholder..." -ForegroundColor Yellow
            New-Item -ItemType File -Path (Join-Path $shopDir "go.mod") -Value "module mertervitrini/shop/backend`n`ngo 1.22" -Force | Out-Null
            New-Item -ItemType File -Path (Join-Path $shopDir "main.go") -Value "package main`n`nimport `"fmt`"`n`nfunc main() {`n`tfmt.Println(`"Shop Backend Placeholder`")`n}" -Force | Out-Null
        }
        Build-GoProject -projPath "shop\backend" -binaryName "shop-backend"
    }

    # Compile Frontend
    Write-Host "`n--------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host "Building Shop Next.js Frontend" -ForegroundColor DarkCyan
    Write-Host "--------------------------------------------------" -ForegroundColor DarkCyan
    
    $shopFrontendDir = Join-Path $rootDir "shop\frontend"
    Push-Location $shopFrontendDir
    try {
        Write-Host "[BUILD] Running Next.js static export build..." -ForegroundColor White
        & npm.cmd run build
        Write-Host "[OK] Next.js Frontend Compilation Success!" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Next.js Frontend Compilation FAILED!" -ForegroundColor Red
        throw $_
    } finally {
        Pop-Location
    }

    # Trigger Deploy if flagged
    if ($Deploy) {
        Write-Host "`n--------------------------------------------------" -ForegroundColor Yellow
        Write-Host "Deploying Shop Suite to http://mertervitrini.com.tr" -ForegroundColor Yellow
        Write-Host "--------------------------------------------------" -ForegroundColor Yellow
        Push-Location $rootDir
        try {
            & python scripts/deploy_shop.py
        } catch {
            Write-Host "[ERROR] Shop deployment failed!" -ForegroundColor Red
            throw $_
        } finally {
            Pop-Location
        }
    }
}

Write-Host "`n==================================================" -ForegroundColor Cyan
Write-Host "           ALL PIPELINE ACTIONS COMPLETED         " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
