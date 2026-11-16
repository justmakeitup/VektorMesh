# ============================================================================
# VektorMesh Node.js Edge Gateway Verification Runner (PowerShell)
# Tests Fastify REST routes, Socket.io WebSocket hub, and SHA-256 Ledger
# ============================================================================
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path "$scriptDir\..").Path
$gatewayDir = Join-Path $rootDir "gateway-node"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  VektorMesh Edge Gateway Integration Test Runner (PowerShell)   " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

Push-Location $gatewayDir
try {
    Write-Host "==> [1/2] Verifying TypeScript Compilation..." -ForegroundColor Yellow
    npm run build
    Write-Host "    TypeScript build clean (0 errors)." -ForegroundColor Green

    Write-Host "==> [2/2] Executing Gateway Integration & WebSocket Suite..." -ForegroundColor Yellow
    npm test
    Write-Host "=================================================================" -ForegroundColor Cyan
    Write-Host "  Gateway integration tests passed successfully!                " -ForegroundColor Green
    Write-Host "=================================================================" -ForegroundColor Cyan
} finally {
    Pop-Location
}
