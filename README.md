# VektorMesh

> **Autonomous Polyglot Canary & Self-Healing Microservice Anomaly Control Plane**  
> *Engineered in Python 3.11+, Java 21 Virtual Threads, Node.js 20+ Fastify, MySQL 8.0, and React 18 Canvas.*

---

## 1. System Architecture & Polyglot Overview

VektorMesh is an end-to-end, multi-language distributed control plane designed to prevent cascading failures in high-throughput microservice topologies. It combines real-time statistical and multivariate machine learning with autonomous execution policies, programmatic circuit breaking, and a cryptographically verifiable SHA-256 hash-chained audit ledger.

```
                                  ┌──────────────────────────────────────────────────┐
                                  │   React 18 + HTML5 Canvas Mission Control (:3000)│
                                  └──────────────▲────────────────────▲──────────────┘
                                                 │ ws:// (Socket.io)  │ http://
┌────────────────────────────────────────────────┴────────────────────┴────────────────────────────────┐
│ Node.js 20+ Fastify Edge Gateway & BFF (:4000)                                                       │
│   ├── SocketHub: 1-to-N multiplexed WebSocket broadcaster (60fps telemetry snapshots & alert toasts)│
│   ├── gRPC Streaming Client: Single persistent channel with exponential backoff to Java Engine      │
│   └── Independent Cryptographic Verifier: Walks full SHA-256 ledger proof from Genesis to Head      │
└────────────────────────────────────▲─────────────────────────────────▲───────────────────────────────┘
                                     │                                 │
           ┌─────────────────────────┴───────────────┐                 │
           │ gRPC StreamSystemState()                │ gRPC RPCs       │
           ▼                                         ▼                 ▼
┌──────────────────────────────────────┐     ┌────────────────────────────────────────────────────────┐
│ Java 21 Spring Boot 3 Engine (:9090) │     │ MySQL 8.0 Cryptographic Audit Ledger (:3306)          │
│   ├── Virtual Threads (Loom 1Hz loop)│     │   ├── service_nodes & service_edges (Mesh Topology)   │
│   ├── Synthetic Chaos Fault Injector │     │   ├── slo_compliance_rollups (1-min burn metrics)     │
│   ├── Resilience4j Circuit Breakers  │     │   └── remediation_audit_ledger                        │
│   └── Trigger-Compatible Audit Layer │     │         ├── trg_audit_ledger_hash_chain (SHA-256)     │
└──────────────────▲───────────────────┘     │         └── trg_audit_ledger_no_update/delete (Append)│
                   │                         └────────────────────────────────────────────────────────┘
                   │ gRPC EvaluateTelemetryStream()
                   ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Python 3.11+ Dual-Model Anomaly Inference Engine (:50052 gRPC / :8000 FastAPI)                      │
│   ├── Sliding Window Manager: Pre-allocated NumPy ring buffers (120 frames per service)             │
│   ├── Stage A: Fast Adaptive EWMA Statistical Filter (α=0.25, dynamic σ bounds)                     │
│   ├── Stage B: Multivariate Isolation Forest (6D Feature Vector + Logistic Calibration)             │
│   └── Stage C: Sigmoid Fusion, Monotonic Heap Slope Penalty, and Root Cause Attribution (RCA)       │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Port & Service Matrix

| Service | Port(s) | Protocol / Stack | Role & Responsibility |
|---|---|---|---|
| **ui-react** | `3000` | HTTP / React 18, Canvas, Nginx | 60fps high-contrast live topology map, chaos controls, ML inspector, audit viewer |
| **gateway-node** | `4000` | HTTP, WS / Fastify, Socket.io | BFF Gateway, 1-to-N gRPC multiplexer, WebSocket event hub, audit query layer |
| **engine-java** | `8080`, `9090` | HTTP, gRPC / Spring Boot 3, Java 21 | Core Execution Engine, Virtual Thread 1Hz telemetry synthesiser, Resilience4j, Chaos |
| **inference-python** | `8000`, `50052` | HTTP, gRPC / FastAPI, grpc.aio | Dual-Model ML Anomaly Detector (EWMA + Isolation Forest), Root Cause Attribution |
| **mysql-db** | `3306` | MySQL Wire / MySQL 8.0.36 | Topology graph store, append-only SHA-256 hash-chained audit ledger, SLO rollups |

---

## 3. Core Architectural Highlights

### A. Dual-Model Machine Learning Pipeline (`/inference-python`)
- **Stage A (Adaptive EWMA Filter):** Fast statistical anomaly screener with $\alpha = 0.25$. Updates running mean $\mu_t$ and variance $\sigma^2_t$ per service to detect sudden latency spikes or error burst anomalies within 1 frame ($< 10\,\text{ms}$).
- **Stage B (Warm-Started Multivariate Isolation Forest):** Evaluates a 6-dimensional telemetry vector:
  $$\mathbf{x} = \left[\Delta\text{cpu}, \Delta\text{threads}, \Delta\text{heap}, \text{p95}, \text{p99}, \text{error\_rate}\right]$$
  Detects non-linear slow-bleed anomalies (e.g. database connection starvation, creeping memory leaks).
- **Stage C (Sigmoid Fusion & Root-Cause Attribution):** Blends Stage A and Stage B scores, incorporates an OLS linear regression heap slope penalty ($+32\,\text{MB}/\text{s}$ penalty), and maps the attributed root-cause metric (`HEAP_LEAK`, `DB_POOL_EXHAUSTION`, `NETWORK_THROTTLE`, `CPU_JITTER`) to remediation policies:
  - $p_{\text{cascade}} \ge 0.70 \implies$ `THROTTLE_TRAFFIC` or `REROUTE_COLD_REPLICA` (20% primary / 80% cold)
  - $p_{\text{cascade}} \ge 0.85 \implies$ `OPEN_CIRCUIT` or `RESTART_CONTAINER`

### B. Java 21 Virtual Threads & Resilience4j Self-Healing (`/engine-java`)
- **Virtual Thread Concurrency:** Configured with `spring.threads.virtual.enabled=true` and custom `Executors.newVirtualThreadPerTaskExecutor()` beans for non-blocking 1Hz telemetry streaming and asynchronous chaos fault simulation.
- **Autonomous Remediation:** Programmatic Resilience4j circuit breaker state machine (`CLOSED` $\leftrightarrow$ `HALF_OPEN` $\leftrightarrow$ `OPEN`) coupled with a 10-second cooldown window that allows emergency escalation bypass if anomaly severity jumps $> 0.15$.

### C. Cryptographic SHA-256 Hash-Chained Audit Ledger (`/db`)
- Every autonomous or manual remediation is recorded in `remediation_audit_ledger`.
- A MySQL `BEFORE INSERT` trigger (`trg_audit_ledger_hash_chain`) computes a deterministic SHA-256 hash over:
  $$\text{curr\_hash} = \text{SHA-256}\left(\text{prev\_hash} \parallel \text{event\_id} \parallel \text{timestamp\_utc} \parallel \text{service\_id} \parallel \text{action\_type} \parallel \text{trigger\_source} \parallel \text{probability} \parallel \text{payload}\right)$$
- `BEFORE UPDATE` and `BEFORE DELETE` triggers guarantee append-only immutability.
- Independent verification services in both Java and Node.js walk the chain from Genesis (`prev_hash = '0'*64`) to the Head hash to mathematically prove zero tampering.

### D. 60fps HTML5 Canvas Mission Control (`/ui-react`)
- Layered DAG layout positioning 6 seeded services across Edge, Core, and Data tiers.
- High-DPI canvas loop rendering glowing directional particles:
  - **Neon Emerald (`#10B981`):** Normal Primary route traffic.
  - **Electric Cyan (`#06B6D4`):** Shifted Cold Replica traffic ($20/80$ split).
  - **Crimson Alert (`#EF4444`):** Blocked barrier markers on tripped circuit edges and expanding red blast-radius pulse rings around damaged nodes.

---

## 4. Quickstart Guide

### Prerequisites
- Docker & Docker Compose **OR** Local Polyglot Toolchains:
  - Python 3.11+
  - Java 21 & Maven 3.9+
  - Node.js 20+ & npm

### Method 1: Master Single-Command Docker Launch
```bash
# Unix / Linux / macOS
chmod +x ./start-vektormesh.sh
./start-vektormesh.sh

# Windows PowerShell
.\start-vektormesh.ps1
```

Or run Docker Compose directly:
```bash
docker compose up -d --build
```

### Method 2: Local Development Mode (Without Docker)
```bash
# 1. Compile Protocol Buffers across all languages
powershell -ExecutionPolicy Bypass -File .\scripts\compile-protos.ps1  # (or ./scripts/compile-protos.sh)

# 2. Run Python Anomaly Inference Engine
cd inference-python
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8000

# 3. Run Java Core Execution Engine
cd ../engine-java
mvn clean spring-boot:run

# 4. Run Node.js Edge Gateway
cd ../gateway-node
npm install
npm test       # Runs the 27-point verification suite
npm run dev

# 5. Run React UI Mission Control
cd ../ui-react
npm install
npm run dev    # Opens on http://localhost:3000
```

---

## 5. 3-Minute Interviewer Demonstration Script

Follow this step-by-step walkthrough to demonstrate the full polyglot self-healing lifecycle in real time:

### Step 1: Baseline Health Inspection
1. Open **`http://localhost:3000`** in Google Chrome or any modern browser.
2. Verify all 6 service nodes (`api-gateway`, `auth-service`, `order-processor`, `payment-ledger`, `inventory-db-proxy`, `notification-worker`) are green (`CLOSED` circuit state).
3. Observe the steady 60fps flow of Neon Emerald particles along the directed edges.

### Step 2: Inject Synthetic Memory Bleed Chaos Fault
1. In the right-hand **Chaos Deck**, select:
   - Target Microservice: `order-processor`
   - Fault Pattern: `Memory Bleed (+32MB/s)`
   - Intensity: `80%`
   - Duration: `45s`
2. Click **"Inject Fault"**.
3. **What happens immediately:**
   - Expanding crimson radar blast-radius rings pulse around `order-processor` on the Canvas.
   - The top banner flashes an active chaos alert toast.

### Step 3: Observe Dual-Model ML Detection & Attribution
1. Click on the `order-processor` node on the canvas to open the **Dual-Model AI Inspector**.
2. Watch the rolling **Heap Memory sparkline** climb sharply.
3. Observe the Python Inference Engine:
   - Calculate a positive heap growth rate ($\text{slope} > 2.0\,\text{MB}/\text{s}$).
   - Elevate Stage B Isolation Forest score.
   - Escalate `cascade_probability` past the **70% Dynamic Throttling Threshold**.
   - Attribute the root cause: `HEAP_LEAK`.

### Step 4: Autonomous Resilience4j Self-Healing & Traffic Rerouting
1. Watch the Java Engine execute autonomous self-healing:
   - The route between `api-gateway` and `order-processor` dynamically updates to **Electric Cyan**.
   - 80% of traffic is rerouted away from the bleeding primary instance to the cold replica partition.
   - A container recycling request (`RESTART_CONTAINER`) is scheduled.
2. Once recycled, `cascade_probability` returns to $0.0\%$, the blast radius vanishes, and particles return to Emerald.

### Step 5: Cryptographic SHA-256 Ledger Verification
1. Expand the bottom **Cryptographic Audit Ledger** panel.
2. Notice the new immutable rows recording `CHAOS_INJECTION` and autonomous `RESTART_CONTAINER` / `THROTTLE_TRAFFIC` actions.
3. Click **"Verify Hash Chain"**:
   - The Gateway executes an independent mathematical SHA-256 verification walk across all ledger records.
   - A glowing neon emerald badge confirms:  
     `CHAIN INTACT: N/N BLOCKS VERIFIED` along with the Genesis and Head cryptographic hashes.

---

## 6. Monorepo Structure

```
VektorMesh/
├── docker-compose.yml              # Master full-stack 5-container orchestration
├── start-vektormesh.sh             # Master Unix startup & health polling script
├── start-vektormesh.ps1            # Master PowerShell startup & health polling script
├── Makefile                        # Polyglot build and compilation shortcuts
├── proto/
│   └── vektormesh.proto            # Canonical cross-language gRPC specification
├── db/
│   └── init.sql                    # MySQL 8.0 schema, triggers, and seed topology
├── inference-python/               # Python 3.11+ Dual-Model ML Inference Engine
│   ├── app/models/                 # EWMA, Isolation Forest, and RCA modules
│   ├── app/grpc_server/            # Asynchronous grpc.aio servicer (port 50052)
│   ├── app/main.py                 # Unified FastAPI (:8000) + gRPC runtime
│   └── tests/verify_models.py      # Dual-model validation test suite
├── engine-java/                    # Java 21 Spring Boot 3 Core Execution Engine
│   ├── src/main/java/              # Virtual thread synthesis loop, Resilience4j, Chaos
│   └── src/test/                   # JUnit 5 & Mockito core execution tests
├── gateway-node/                   # Node.js 20+ Fastify & Socket.io BFF Gateway
│   ├── src/grpc/meshGrpcClient.ts  # 1-to-N multiplexed gRPC client with backoff
│   ├── src/db/auditRepository.ts   # MySQL pool & standalone SHA-256 chain verifier
│   ├── src/ws/socketHub.ts         # Socket.io real-time event hub
│   ├── src/routes/apiRoutes.ts     # Fastify REST endpoints
│   └── tests/verify_gateway.ts     # 27-point comprehensive gateway integration suite
├── ui-react/                       # React 18 + Canvas Mission Control Dashboard
│   ├── src/components/             # TopologyCanvas, ChaosControlDeck, NodeInspectorDrawer, AuditLedgerPanel
│   ├── src/hooks/                  # useVektorMeshSocket custom hook
│   └── Dockerfile & nginx.conf     # Multi-stage production Nginx container
└── scripts/                        # Polyglot compilation & verification runners
```

---

## 7. License
Licensed under the Apache 2.0 License.
