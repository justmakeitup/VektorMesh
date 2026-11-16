#!/usr/bin/env bash
# ============================================================================
# VektorMesh Python Protobuf Compiler
# Compiles proto/vektormesh.proto into app/generated with import patching
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PROTO_PATH="${ROOT_DIR}/proto/vektormesh.proto"
OUT_DIR="${SCRIPT_DIR}/app/generated"

echo "==> Compiling Protocol Buffers into ${OUT_DIR}..."

mkdir -p "${OUT_DIR}"

python -m grpc_tools.protoc \
    -I"${ROOT_DIR}/proto" \
    --python_out="${OUT_DIR}" \
    --grpc_python_out="${OUT_DIR}" \
    --pyi_out="${OUT_DIR}" \
    "${PROTO_PATH}"

# Fix relative import in generated grpc stub
if [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' 's/^import vektormesh_pb2 as/from . import vektormesh_pb2 as/' "${OUT_DIR}/vektormesh_pb2_grpc.py"
else
    sed -i -E 's/^import vektormesh_pb2 as/from . import vektormesh_pb2 as/' "${OUT_DIR}/vektormesh_pb2_grpc.py"
fi

cat << 'EOF' > "${OUT_DIR}/__init__.py"
"""Auto-generated VektorMesh gRPC & Protocol Buffer bindings."""
import sys
from pathlib import Path

_gen_dir = str(Path(__file__).resolve().parent)
if _gen_dir not in sys.path:
    sys.path.insert(0, _gen_dir)

from . import vektormesh_pb2
from . import vektormesh_pb2_grpc

__all__ = ["vektormesh_pb2", "vektormesh_pb2_grpc"]
EOF

echo "==> Successfully generated Python gRPC stubs in app/generated/"
