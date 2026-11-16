#!/usr/bin/env bash
# ============================================================================
# VektorMesh Master Polyglot Orchestration & Verification Bootstrapper
# ============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}========================================================================${NC}"
echo -e "${CYAN}    VEKTORMESH: POLYGLOT CANARY & SELF-HEALING CONTROL PLANE            ${NC}"
echo -e "${CYAN}========================================================================${NC}"

# 1. Compile Protocol Buffers
echo -e "\n${YELLOW}==> [1/4] Compiling gRPC Protocol Buffers across Polyglot Tiers...${NC}"
if [ -f "./scripts/compile-protos.sh" ]; then
    bash ./scripts/compile-protos.sh
else
    echo "Protobuf script not found, skipping."
fi

# 2. Check Docker availability
echo -e "\n${YELLOW}==> [2/4] Checking Docker Runtime Environment...${NC}"
if command -v docker &> /dev/null && docker info &> /dev/null; then
    echo -e "${GREEN}Docker daemon is active. Launching full 5-tier container cluster...${NC}"
    docker compose down --remove-orphans || true
    docker compose build
    docker compose up -d

    # 3. Health Poll Loop
    echo -e "\n${YELLOW}==> [3/4] Awaiting Cluster Convergence (Polling Health Endpoints)...${NC}"
    MAX_ATTEMPTS=45
    ATTEMPT=1
    ALL_HEALTHY=false

    while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
        echo -n -e "\rPolling service health (Attempt $ATTEMPT/$MAX_ATTEMPTS)... "

        UI_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 || echo "000")
        GW_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/api/health || echo "000")
        PY_OK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health || echo "000")

        if [ "$UI_OK" = "200" ] && [ "$GW_OK" = "200" ] && [ "$PY_OK" = "200" ]; then
            ALL_HEALTHY=true
            echo -e "\n${GREEN}All services are HEALTHY and converged!${NC}"
            break
        fi

        sleep 2
        ATTEMPT=$((ATTEMPT + 1))
    done

    if [ "$ALL_HEALTHY" = false ]; then
        echo -e "\n${YELLOW}Cluster convergence took longer than expected. Check 'docker compose logs'.${NC}"
    fi
else
    echo -e "${YELLOW}Docker is not currently running. You can run services in local dev mode:${NC}"
    echo "  - Python: cd inference-python && uvicorn app.main:app --port 8000"
    echo "  - Java:   cd engine-java && ./mvnw spring-boot:run"
    echo "  - Node:   cd gateway-node && npm start"
    echo "  - React:  cd ui-react && npm run dev"
fi

# 4. Access Matrix & Demo Walkthrough Script
echo -e "\n${CYAN}========================================================================${NC}"
echo -e "${CYAN}                       PORT & SERVICE ACCESS MATRIX                     ${NC}"
echo -e "${CYAN}========================================================================${NC}"
echo -e "  - React Mission Control UI:    ${GREEN}http://localhost:3000${NC}"
echo -e "  - Node.js Edge Gateway BFF:    ${GREEN}http://localhost:4000${NC}"
echo -e "  - Java Spring Boot Actuator:   ${GREEN}http://localhost:8080/actuator/health${NC}"
echo -e "  - Java MeshControl gRPC:       ${GREEN}localhost:9090${NC}"
echo -e "  - Python FastAPI Diagnostics:  ${GREEN}http://localhost:8000/health${NC}"
echo -e "  - Python Anomaly gRPC:         ${GREEN}localhost:50052${NC}"
echo -e "  - MySQL Cryptographic DB:      ${GREEN}localhost:3306 (user: vektormesh)${NC}"

echo -e "\n${CYAN}========================================================================${NC}"
echo -e "${CYAN}                    3-MINUTE INTERVIEWER DEMO SCRIPT                    ${NC}"
echo -e "${CYAN}========================================================================${NC}"
echo -e "1. Open ${GREEN}http://localhost:3000${NC} in your browser to observe the 60fps Canvas DAG."
echo -e "2. In the right panel Chaos Deck, choose ${YELLOW}order-processor${NC} and ${YELLOW}MEMORY_BLEED${NC}."
echo -e "3. Click ${RED}'Inject Fault'${NC}. Watch the expanding crimson blast radius rings appear."
echo -e "4. Observe Python's Dual-Model detector identify the leak slope and escalate cascade prob >= 70%."
echo -e "5. Watch Java autonomously reroute 80% traffic to the Cold Replica (cyan particle flow)."
echo -e "6. In the bottom drawer, click ${GREEN}'Verify Hash Chain'${NC} to validate the SHA-256 audit ledger."
echo -e "${CYAN}========================================================================${NC}"
