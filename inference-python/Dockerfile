# ============================================================================
# VektorMesh Python Anomaly Inference Engine Dockerfile
# Optimized Python 3.11-slim build with Protobuf compilation
# ============================================================================

FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY inference-python/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ----------------------------------------------------------------------------
# Final Runtime Stage
# ----------------------------------------------------------------------------
FROM python:3.11-slim AS runner

WORKDIR /app

# Copy installed Python packages from builder
COPY --from=builder /install /usr/local

# Copy application source and protocol buffer definitions
COPY proto/ /proto/
COPY inference-python/app/ /app/app/
COPY inference-python/compile_proto.sh /app/compile_proto.sh

# Compile protobufs directly inside container
RUN chmod +x /app/compile_proto.sh && \
    python -m grpc_tools.protoc \
        -I/proto \
        --python_out=/app/app/generated \
        --grpc_python_out=/app/app/generated \
        --pyi_out=/app/app/generated \
        /proto/vektormesh.proto && \
    sed -i -E 's/^import vektormesh_pb2 as/from . import vektormesh_pb2 as/' /app/app/generated/vektormesh_pb2_grpc.py

# Create __init__.py if not present
RUN echo 'import sys; from pathlib import Path; p = str(Path(__file__).resolve().parent); sys.path.insert(0, p) if p not in sys.path else None; from . import vektormesh_pb2, vektormesh_pb2_grpc; __all__ = ["vektormesh_pb2", "vektormesh_pb2_grpc"]' > /app/app/generated/__init__.py

# Environment configuration
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app \
    GRPC_PORT=50052 \
    HTTP_PORT=8000

EXPOSE 50052
EXPOSE 8000

HEALTHCHECK --interval=5s --timeout=3s --retries=5 --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

ENTRYPOINT ["python", "-m", "app.main"]
