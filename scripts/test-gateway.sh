#!/usr/bin/env bash
# ============================================================================
# VektorMesh Node.js Edge Gateway Verification Runner (Bash)
# Tests Fastify REST routes, Socket.io WebSocket hub, and SHA-256 Ledger
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
GATEWAY_DIR="${ROOT_DIR}/gateway-node"

echo "================================================================="
echo "  VektorMesh Edge Gateway Integration Test Runner (Bash)         "
echo "================================================================="

cd "${GATEWAY_DIR}"

echo "==> [1/2] Verifying TypeScript Compilation..."
npm run build
echo "    TypeScript build clean (0 errors)."

echo "==> [2/2] Executing Gateway Integration & WebSocket Suite..."
npm test

echo "================================================================="
echo "  Gateway integration tests passed successfully!                "
echo "================================================================="
