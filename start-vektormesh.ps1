# ============================================================================
# VektorMesh Master Polyglot Orchestration & Verification Bootstrapper (PowerShell)
# ============================================================================
$ErrorActionPreference = "Continue"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "    VEKTORMESH: POLYGLOT CANARY & SELF-HEALING CONTROL PLANE            " -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan

# 1. Compile Protocol Buffers
Write-Host "`n==> [1/4] Compiling gRPC Protocol Buffers across Polyglot Tiers..." -ForegroundColor Yellow
if (Test-Path ".\scripts\compile-protos.ps1") {
    powershell -ExecutionPolicy Bypass -File .\scripts\compile-protos.ps1
} else {
    Write-Host "Protobuf script not found, skipping."
}

# 2. Check Docker availability
Write-Host "`n==> [2/4] Checking Docker Runtime Environment..." -ForegroundColor Yellow
$dockerInstalled = Get-Command docker -ErrorAction SilentlyContinue

if ($dockerInstalled) {
    try {
        docker info | Out-Null
        Write-Host "Docker daemon is active. Launching full 5-tier container cluster..." -ForegroundColor Green
        docker compose down --remove-orphans
        docker compose build
        docker compose up -d

        # 3. Health Poll Loop
        Write-Host "`n==> [3/4] Awaiting Cluster Convergence (Polling Health Endpoints)..." -ForegroundColor Yellow
        $maxAttempts = 45
        $attempt = 1
        $allHealthy = $false

        while ($attempt -le $maxAttempts) {
            Write-Host -NoNewline "`rPolling service health (Attempt $attempt/$maxAttempts)... "

            $uiOk = (Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue).StatusCode
            $gwOk = (Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue).StatusCode
            $pyOk = (Invoke-WebRequest -Uri "http://localhost:8000/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction SilentlyContinue).StatusCode

            if ($uiOk -eq 200 -and $gwOk -eq 200 -and $pyOk -eq 200) {
                $allHealthy = $true
                Write-Host "`nAll services are HEALTHY and converged!" -ForegroundColor Green
                break
            }

            Start-Sleep -Seconds 2
            $attempt++
        }

        if (-not $allHealthy) {
            Write-Host "`nCluster convergence took longer than expected. Check 'docker compose logs'." -ForegroundColor Yellow
        }
    } catch {
        Write-Host "Docker daemon returned error, running in local dev inspection mode." -ForegroundColor Yellow
    }
} else {
    Write-Host "Docker is not currently running. You can run individual services locally:" -ForegroundColor Yellow
    Write-Host "  - Python: cd inference-python; uvicorn app.main:app --port 8000"
    Write-Host "  - Java:   cd engine-java; ./mvnw spring-boot:run"
    Write-Host "  - Node:   cd gateway-node; npm start"
    Write-Host "  - React:  cd ui-react; npm run dev"
}

# 4. Access Matrix & Demo Walkthrough Script
Write-Host "`n========================================================================" -ForegroundColor Cyan
Write-Host "                       PORT & SERVICE ACCESS MATRIX                     " -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "  - React Mission Control UI:    http://localhost:3000" -ForegroundColor Green
Write-Host "  - Node.js Edge Gateway BFF:    http://localhost:4000" -ForegroundColor Green
Write-Host "  - Java Spring Boot Actuator:   http://localhost:8080/actuator/health" -ForegroundColor Green
Write-Host "  - Java MeshControl gRPC:       localhost:9090" -ForegroundColor Green
Write-Host "  - Python FastAPI Diagnostics:  http://localhost:8000/health" -ForegroundColor Green
Write-Host "  - Python Anomaly gRPC:         localhost:50052" -ForegroundColor Green
Write-Host "  - MySQL Cryptographic DB:      localhost:3306 (user: vektormesh)" -ForegroundColor Green

Write-Host "`n========================================================================" -ForegroundColor Cyan
Write-Host "                    3-MINUTE INTERVIEWER DEMO SCRIPT                    " -ForegroundColor Cyan
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "1. Open http://localhost:3000 in your browser to observe the 60fps Canvas DAG."
Write-Host "2. In the right panel Chaos Deck, choose 'order-processor' and 'MEMORY_BLEED'."
Write-Host "3. Click 'Inject Fault'. Watch the expanding crimson blast radius rings appear."
Write-Host "4. Observe Python's Dual-Model detector identify the leak slope and escalate cascade prob >= 70%."
Write-Host "5. Watch Java autonomously reroute 80% traffic to the Cold Replica (cyan particle flow)."
Write-Host "6. In the bottom drawer, click 'Verify Hash Chain' to validate the SHA-256 audit ledger."
Write-Host "========================================================================" -ForegroundColor Cyan
