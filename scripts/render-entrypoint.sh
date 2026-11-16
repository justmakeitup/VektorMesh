#!/bin/bash
set -e

echo "========================================================================"
echo "       VEKTORMESH UNIFIED BACKEND: RENDER CONTAINER RUNTIME             "
echo "========================================================================"

# 1. Start Python Anomaly Inference Engine
echo "[1/3] Launching Python Dual-Model Anomaly Engine (:50052 gRPC / :8000 HTTP)..."
cd /app/inference-python
python -m uvicorn app.main:app --port 8000 --host 127.0.0.1 &
PYTHON_PID=$!

# Wait for Python engine to initialize
sleep 3

# 2. Start Java 21 Spring Boot Engine
echo "[2/3] Launching Java 21 Spring Boot Engine (:9090 gRPC / :8080 HTTP)..."
cd /app/engine-java
java -XX:+UseSerialGC -Xmx256m -jar /app/engine-java/engine-java.jar --spring.profiles.active=local &
JAVA_PID=$!

# Wait for Java engine gRPC listener on 9090
echo "Waiting for Java gRPC server on port 9090 to initialize..."
for i in {1..35}; do
  if (echo > /dev/tcp/127.0.0.1/9090) 2>/dev/null; then
    echo ">> Java Engine gRPC (:9090) is live and ready!"
    break
  fi
  sleep 1
done

# 3. Start Node.js Fastify Edge Gateway in foreground on Render's assigned $PORT
export PORT="${PORT:-10000}"
export HOST="0.0.0.0"
export PROTO_PATH="/app/proto/vektormesh.proto"
export JAVA_GRPC_HOST="127.0.0.1:9090"
export JAVA_REST_URL="http://127.0.0.1:8080"
export PYTHON_GRPC_HOST="127.0.0.1:50052"
export PYTHON_REST_URL="http://127.0.0.1:8000"

echo "[3/3] Launching Node.js Fastify Edge Gateway on port ${PORT}..."
cd /app/gateway-node
exec node dist/server.js
