#!/usr/bin/env bash
# ============================================================================
# VektorMesh Protocol Buffer Cross-Language Compilation Script
# Generates gRPC stubs for Python, Java, and TypeScript/Node.js
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROTO_SRC="${ROOT_DIR}/proto/vektormesh.proto"
PYTHON_OUT="${ROOT_DIR}/inference-python/app/proto"
NODE_OUT="${ROOT_DIR}/gateway-node/src/proto"
GATEWAY_DIR="${ROOT_DIR}/gateway-node"

echo "================================================================="
echo "  VektorMesh Polyglot Protobuf Compiler                          "
echo "================================================================="

if [ ! -f "${PROTO_SRC}" ]; then
  echo "Error: Protocol buffer file not found at ${PROTO_SRC}" >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# 1. Python Stub Generation (FastAPI Anomaly Inference Service)
# ----------------------------------------------------------------------------
echo "==> [1/3] Generating Python gRPC Stubs..."
mkdir -p "${PYTHON_OUT}"

python -m grpc_tools.protoc \
  -I"${ROOT_DIR}/proto" \
  --python_out="${PYTHON_OUT}" \
  --grpc_python_out="${PYTHON_OUT}" \
  --pyi_out="${PYTHON_OUT}" \
  "${PROTO_SRC}"

echo "    Python stubs generated in: ${PYTHON_OUT}"

# ----------------------------------------------------------------------------
# 2. Node.js / TypeScript Type Generation (Fastify Gateway)
# ----------------------------------------------------------------------------
echo "==> [2/3] Generating Node.js / TypeScript Definitions..."
mkdir -p "${NODE_OUT}"

if [ -f "${GATEWAY_DIR}/node_modules/.bin/proto-loader-gen-types" ]; then
  "${GATEWAY_DIR}/node_modules/.bin/proto-loader-gen-types" \
    --longs=String \
    --enums=String \
    --defaults \
    --oneofs \
    --grpcLib=@grpc/grpc-js \
    --outDir="${NODE_OUT}" \
    "${PROTO_SRC}"
  echo "    TypeScript types generated in: ${NODE_OUT}"
elif command -v npm >/dev/null 2>&1; then
  (cd "${GATEWAY_DIR}" && npm run proto:generate) || echo "    Note: Run 'cd gateway-node && npm install' first."
else
  echo "    Node/npm not in PATH, skipping static type generation."
fi

# ----------------------------------------------------------------------------
# 3. Java Stub Compilation Notice (Spring Boot 3 Core Execution Engine)
# ----------------------------------------------------------------------------
echo "==> [3/3] Java gRPC Stubs..."
echo "    Java stubs are automatically built by the Maven protobuf plugin."
echo "    Command: (cd ${ROOT_DIR}/engine-java && mvn compile)"

echo "================================================================="
echo "  Protobuf compilation successfully completed.                    "
echo "================================================================="
