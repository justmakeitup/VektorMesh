# ============================================================================
# VektorMesh PowerShell Orchestrator
# Launches all 4 services in dedicated windows and opens the browser
# ============================================================================
$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $rootDir

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "       VEKTORMESH: POLYGLOT CANARY & CONTROL PLANE LAUNCHER             " -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# 1. Start Python Engine
Write-Host "`n[1/4] Starting Python Anomaly Engine (:8000 / :50052)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k title VektorMesh - Python Engine (:8000 / :50052) && cd /d `"$rootDir\inference-python`" && python -m uvicorn app.main:app --port 8000 --host 0.0.0.0"

Start-Sleep -Seconds 2

# 2. Start Java Engine
Write-Host "[2/4] Starting Java 21 Spring Boot Engine (:8080 / :9090)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k title VektorMesh - Java Engine (:8080 / :9090) && cd /d `"$rootDir\engine-java`" && java -jar target\engine-java-1.0.0-SNAPSHOT.jar --spring.profiles.active=local"

# Wait for Java engine to initialize
Start-Sleep -Seconds 18

# 3. Start Node Gateway
Write-Host "[3/4] Starting Node.js Edge Gateway (:4000)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k title VektorMesh - Node Gateway (:4000) && cd /d `"$rootDir\gateway-node`" && npm start"

Start-Sleep -Seconds 2

# 4. Start React UI
Write-Host "[4/4] Starting React UI Dashboard (:3000)..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k title VektorMesh - React UI (:3000) && cd /d `"$rootDir\ui-react`" && npm run dev"

Start-Sleep -Seconds 2

Write-Host "`n========================================================================" -ForegroundColor Cyan
Write-Host "  All 4 tiers launched successfully! Opening http://localhost:3000...   " -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  - UI Dashboard:       http://localhost:3000" -ForegroundColor White
Write-Host "  - Gateway BFF:        http://localhost:4000" -ForegroundColor White
Write-Host "  - Java Engine:        http://localhost:8080" -ForegroundColor White
Write-Host "  - Python Diagnostics: http://localhost:8000" -ForegroundColor White
Write-Host "`nTo stop all services, run .\stop.ps1 or stop.bat`n" -ForegroundColor DarkGray

Start-Process "http://localhost:3000"
