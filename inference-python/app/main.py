"""
VektorMesh Python Anomaly Inference Engine (app/main.py)
Unified runtime hosting both:
  - Asynchronous gRPC Server (port 50052)
  - FastAPI HTTP Diagnostic & Simulation Server (port 8000)
within the same asyncio event loop.
"""

import sys
import time
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any

import grpc
import structlog
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure generated protobuf stubs can be resolved
_gen_dir = str(Path(__file__).resolve().parent / "generated")
if _gen_dir not in sys.path:
    sys.path.insert(0, _gen_dir)

from app.core.config import settings
from app.models.dual_detector import DualDetector
from app.grpc_server.servicer import AnomalyInferenceServicer
from app.generated.vektormesh_pb2 import (
    TelemetryFrame,
    RootCauseMetric,
    RecommendedAction
)
from app.generated.vektormesh_pb2_grpc import add_AnomalyInferenceServiceServicer_to_server

# Structured logging configuration
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.processors.JSONRenderer()
    ]
)
logger = structlog.get_logger("vektormesh.main")

# Global singleton detector instance
detector = DualDetector()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages coordinated lifecycle for both FastAPI HTTP and grpc.aio servers.
    """
    logger.info("Initializing VektorMesh Anomaly Inference Engine...")

    # 1. Initialize asynchronous gRPC server
    grpc_server = grpc.aio.server()
    servicer = AnomalyInferenceServicer(detector=detector)
    add_AnomalyInferenceServiceServicer_to_server(servicer, grpc_server)

    bind_address = f"{settings.HOST}:{settings.GRPC_PORT}"
    grpc_server.add_insecure_port(bind_address)
    await grpc_server.start()

    logger.info("Asynchronous gRPC server listening", bind_address=bind_address)
    logger.info("FastAPI HTTP diagnostics listening", port=settings.HTTP_PORT)

    app.state.grpc_server = grpc_server
    app.state.detector = detector

    yield

    logger.info("Initiating graceful shutdown of gRPC and HTTP servers...")
    await grpc_server.stop(grace=5.0)
    logger.info("Inference Engine stopped.")


app = FastAPI(
    title="VektorMesh Anomaly Inference Engine",
    description="Dual-Model ML Control Plane for Real-Time Anomaly Remediation & Root-Cause Attribution",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


# ============================================================================
# Pydantic Request & Response Models
# ============================================================================

class SimulateFrameRequest(BaseModel):
    service_id: str = Field(..., example="order-processor")
    timestamp_ms: Optional[int] = Field(default=0, example=1730851200000)
    cpu_jitter_pct: float = Field(..., ge=0.0, le=100.0, example=24.5)
    thread_pool_saturation_pct: float = Field(..., ge=0.0, le=100.0, example=35.0)
    heap_used_mb: float = Field(..., ge=0.0, example=512.0)
    heap_max_mb: float = Field(..., gt=0.0, example=1024.0)
    p95_latency_ms: float = Field(..., ge=0.0, example=45.0)
    p99_latency_ms: float = Field(..., ge=0.0, example=72.0)
    error_rate_pct: float = Field(..., ge=0.0, le=100.0, example=0.1)
    active_connections: int = Field(..., ge=0, example=28)


class VerdictResponse(BaseModel):
    service_id: str
    timestamp_ms: int
    cascade_probability: float
    ewma_z_score: float
    isolation_forest_score: float
    root_cause_metric: str
    recommended_action: str


class HealthResponse(BaseModel):
    status: str
    engine: str
    grpc_port: int
    http_port: int
    active_tracked_services: int
    tracked_service_ids: List[str]
    models_ready: bool
    pipeline: List[str]


# ============================================================================
# HTTP REST Diagnostic & Simulation Endpoints
# ============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Returns engine operational readiness and tracked telemetry window metrics."""
    service_ids = detector.window_mgr.get_all_service_ids()
    return HealthResponse(
        status="HEALTHY",
        engine="VektorMesh Dual-Model Anomaly Inference Engine",
        grpc_port=settings.GRPC_PORT,
        http_port=settings.HTTP_PORT,
        active_tracked_services=len(service_ids),
        tracked_service_ids=service_ids,
        models_ready=True,
        pipeline=[
            "Stage_A_Adaptive_EWMA_Filter",
            "Stage_B_Warm_Started_Multivariate_Isolation_Forest",
            "Stage_C_Calibrated_Sigmoid_RCA_Policy_Fusion"
        ]
    )


@app.get("/diagnostics/{service_id}")
async def get_service_diagnostics(service_id: str):
    """
    Returns sliding window statistics, EWMA states, derived slope, and recent verdicts.
    """
    buffer = detector.window_mgr.get_or_create(service_id)
    if len(buffer) == 0:
        raise HTTPException(status_code=404, detail=f"No telemetry frames recorded for '{service_id}'")

    recent_frames = buffer.get_snapshots(count=10)
    recent_verdicts = detector.get_recent_verdicts(service_id, count=10)
    ewma_state = detector.ewma_filter.get_or_create_state(service_id)

    formatted_verdicts = [
        {
            "timestamp_ms": v.timestamp_ms,
            "cascade_probability": round(v.cascade_probability, 4),
            "ewma_z_score": round(v.ewma_z_score, 4),
            "isolation_forest_score": round(v.isolation_forest_score, 4),
            "root_cause_metric": RootCauseMetric.Name(v.root_cause_metric),
            "recommended_action": RecommendedAction.Name(v.recommended_action)
        }
        for v in recent_verdicts
    ]

    return {
        "service_id": service_id,
        "window_depth": len(buffer),
        "derived_metrics": {
            "current_heap_slope_mb_per_sec": round(buffer._compute_heap_slope(), 4),
            "latest_p99_latency_ms": recent_frames[-1].p99_latency_ms if recent_frames else 0.0,
            "latest_heap_used_mb": recent_frames[-1].heap_used_mb if recent_frames else 0.0,
            "latest_heap_max_mb": recent_frames[-1].heap_max_mb if recent_frames else 0.0
        },
        "ewma_baselines": {
            "p99_mean": round(ewma_state.p99.mean, 2),
            "p99_variance": round(ewma_state.p99.variance, 2),
            "cpu_mean": round(ewma_state.cpu.mean, 2),
            "thread_pool_mean": round(ewma_state.thread_pool.mean, 2)
        },
        "recent_verdicts": formatted_verdicts
    }


@app.post("/simulate/frame", response_model=VerdictResponse)
async def simulate_telemetry_frame(req: SimulateFrameRequest):
    """
    Accepts a single TelemetryFrame payload over HTTP and returns the immediate AnomalyVerdict.
    Used for ad-hoc simulations and automated unit testing without requiring gRPC clients.
    """
    ts = req.timestamp_ms if req.timestamp_ms and req.timestamp_ms > 0 else int(time.time() * 1000)
    frame = TelemetryFrame(
        service_id=req.service_id,
        timestamp_ms=ts,
        cpu_jitter_pct=req.cpu_jitter_pct,
        thread_pool_saturation_pct=req.thread_pool_saturation_pct,
        heap_used_mb=req.heap_used_mb,
        heap_max_mb=req.heap_max_mb,
        p95_latency_ms=req.p95_latency_ms,
        p99_latency_ms=req.p99_latency_ms,
        error_rate_pct=req.error_rate_pct,
        active_connections=req.active_connections
    )

    verdict = detector.evaluate_frame(frame)

    return VerdictResponse(
        service_id=verdict.service_id,
        timestamp_ms=verdict.timestamp_ms,
        cascade_probability=round(verdict.cascade_probability, 4),
        ewma_z_score=round(verdict.ewma_z_score, 4),
        isolation_forest_score=round(verdict.isolation_forest_score, 4),
        root_cause_metric=RootCauseMetric.Name(verdict.root_cause_metric),
        recommended_action=RecommendedAction.Name(verdict.recommended_action)
    )


@app.get("/models/status")
async def get_models_status():
    """Returns the on-disk and in-memory status of trained Isolation Forest models."""
    models_dir = detector.if_detector.models_dir
    persisted = {}
    if models_dir.exists():
        for f in models_dir.glob("*.joblib"):
            persisted[f.stem] = {
                "filename": f.name,
                "size_kb": round(f.stat().st_size / 1024.0, 1),
                "modified": time.ctime(f.stat().st_mtime)
            }

    with detector.if_detector._lock:
        loaded_services = list(detector.if_detector._models.keys())

    return {
        "models_directory": str(models_dir),
        "persisted_models": persisted,
        "loaded_in_memory": loaded_services,
        "default_model_ready": True
    }


@app.post("/models/reload")
async def reload_models():
    """Hot-reloads serialized Isolation Forest models from disk without restarting."""
    models_dir = detector.if_detector.models_dir
    reloaded = []
    if models_dir.exists():
        for f in models_dir.glob("*.joblib"):
            service_id = f.stem
            success = detector.if_detector.load_model(service_id, str(f))
            if success:
                reloaded.append(service_id)

    return {
        "status": "SUCCESS",
        "reloaded_models": reloaded,
        "count": len(reloaded)
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.HOST, port=settings.HTTP_PORT, reload=False)
