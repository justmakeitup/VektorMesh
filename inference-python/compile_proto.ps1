# ============================================================================
# VektorMesh Python Protobuf Compiler (PowerShell)
# Compiles proto/vektormesh.proto into app/generated with import patching
# ============================================================================
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootDir = (Resolve-Path "$scriptDir\..").Path
$protoPath = Join-Path $rootDir "proto\vektormesh.proto"
$outDir = Join-Path $scriptDir "app\generated"

Write-Host "==> Compiling Protocol Buffers into $outDir..." -ForegroundColor Cyan

if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

python -m grpc_tools.protoc `
    "-I$rootDir\proto" `
    "--python_out=$outDir" `
    "--grpc_python_out=$outDir" `
    "--pyi_out=$outDir" `
    "$protoPath"

$grpcFile = Join-Path $outDir "vektormesh_pb2_grpc.py"
if (Test-Path $grpcFile) {
    (Get-Content $grpcFile) -replace '^import vektormesh_pb2 as', 'from . import vektormesh_pb2 as' | Set-Content $grpcFile
}

$initContent = @'
"""Auto-generated VektorMesh gRPC & Protocol Buffer bindings."""
import sys
from pathlib import Path

_gen_dir = str(Path(__file__).resolve().parent)
if _gen_dir not in sys.path:
    sys.path.insert(0, _gen_dir)

from . import vektormesh_pb2
from . import vektormesh_pb2_grpc

__all__ = ["vektormesh_pb2", "vektormesh_pb2_grpc"]
'@

Set-Content -Path (Join-Path $outDir "__init__.py") -Value $initContent

Write-Host "==> Successfully generated Python gRPC stubs in app/generated/" -ForegroundColor Green
