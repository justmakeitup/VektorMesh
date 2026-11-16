# ============================================================================
# VektorMesh Protocol Buffer Cross-Language Compilation Script (PowerShell)
# Generates gRPC stubs for Python, Java, and TypeScript/Node.js
# ============================================================================
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path "$scriptDir\..").Path

$protoSrc = Join-Path $rootDir "proto\vektormesh.proto"
$pythonOut = Join-Path $rootDir "inference-python\app\proto"
$nodeOut = Join-Path $rootDir "gateway-node\src\proto"
$gatewayDir = Join-Path $rootDir "gateway-node"

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  VektorMesh Polyglot Protobuf Compiler (Windows PowerShell)     " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan

if (-not (Test-Path $protoSrc)) {
    Write-Error "Protocol buffer file not found at $protoSrc"
    exit 1
}

# ----------------------------------------------------------------------------
# 1. Python Generation
# ----------------------------------------------------------------------------
Write-Host "==> [1/3] Generating Python gRPC Stubs..." -ForegroundColor Yellow
if (-not (Test-Path $pythonOut)) {
    New-Item -ItemType Directory -Force -Path $pythonOut | Out-Null
}

python -m grpc_tools.protoc `
    "-I$rootDir\proto" `
    "--python_out=$pythonOut" `
    "--grpc_python_out=$pythonOut" `
    "--pyi_out=$pythonOut" `
    "$protoSrc"

Write-Host "    Python stubs generated in: $pythonOut" -ForegroundColor Green

# ----------------------------------------------------------------------------
# 2. Node.js Generation
# ----------------------------------------------------------------------------
Write-Host "==> [2/3] Generating Node.js / TypeScript Definitions..." -ForegroundColor Yellow
if (-not (Test-Path $nodeOut)) {
    New-Item -ItemType Directory -Force -Path $nodeOut | Out-Null
}

$localGenTypes = Join-Path $gatewayDir "node_modules\.bin\proto-loader-gen-types.cmd"
if (Test-Path $localGenTypes) {
    & $localGenTypes `
        --longs=String `
        --enums=String `
        --defaults `
        --oneofs `
        --grpcLib=@grpc/grpc-js `
        "--outDir=$nodeOut" `
        "$protoSrc"
    Write-Host "    TypeScript types generated in: $nodeOut" -ForegroundColor Green
} else {
    Write-Host "    Running via npm in gateway-node..." -ForegroundColor Gray
    Push-Location $gatewayDir
    try {
        npm run proto:generate
        Write-Host "    TypeScript types generated via npm script in: $nodeOut" -ForegroundColor Green
    } catch {
        Write-Host "    Run 'cd gateway-node && npm install' to enable static type generation." -ForegroundColor Yellow
    } finally {
        Pop-Location
    }
}

# ----------------------------------------------------------------------------
# 3. Java Generation
# ----------------------------------------------------------------------------
Write-Host "==> [3/3] Java gRPC Stubs..." -ForegroundColor Yellow
$localMvn = Join-Path $rootDir ".tools\apache-maven-3.9.9\bin\mvn.cmd"
if (Test-Path $localMvn) {
    Push-Location (Join-Path $rootDir "engine-java")
    try {
        & $localMvn compile
        Write-Host "    Java stubs compiled via local Maven into target/generated-sources" -ForegroundColor Green
    } finally {
        Pop-Location
    }
} else {
    Write-Host "    Java stubs are compiled by Maven via os-maven-plugin and protobuf-maven-plugin." -ForegroundColor Gray
    Write-Host "    Command: cd $rootDir\engine-java; mvn compile" -ForegroundColor Gray
}

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host "  Protobuf compilation successfully completed.                    " -ForegroundColor Cyan
Write-Host "=================================================================" -ForegroundColor Cyan
