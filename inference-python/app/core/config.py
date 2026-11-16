"""
VektorMesh Inference Engine Configuration Module
Centralized runtime hyper-parameters, thresholds, and networking options.
"""

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    # Networking
    GRPC_PORT: int = int(os.getenv("GRPC_PORT", "50052"))
    HTTP_PORT: int = int(os.getenv("HTTP_PORT", "8000"))
    HOST: str = os.getenv("HOST", "0.0.0.0")

    # Sliding Window & Feature Extraction
    WINDOW_SIZE: int = int(os.getenv("WINDOW_SIZE", "120"))  # 120 frames = 2 mins at 1 Hz
    SLOPE_WINDOW: int = int(os.getenv("SLOPE_WINDOW", "30"))  # 30 frames for linear regression slope
    MIN_FRAMES_FOR_SLOPE: int = 5

    # Stage A: Adaptive EWMA Filter
    EWMA_ALPHA: float = float(os.getenv("EWMA_ALPHA", "0.25"))
    MIN_VARIANCE_EPSILON: float = 1e-4

    # Stage B: Isolation Forest Slow-Bleed Detector
    IF_N_ESTIMATORS: int = int(os.getenv("IF_N_ESTIMATORS", "100"))
    IF_CONTAMINATION: float = float(os.getenv("IF_CONTAMINATION", "0.05"))
    IF_RANDOM_STATE: int = 42
    SYNTHETIC_BOOTSTRAP_SAMPLES: int = 1000

    # Stage C: Root-Cause Attribution & Cascade Fusion Thresholds
    HEAP_LEAK_SLOPE_THRESHOLD: float = 0.20  # MB/sec
    HEAP_LEAK_RATIO_THRESHOLD: float = 0.70  # 70% heap used
    HEAP_CRITICAL_RATIO_THRESHOLD: float = 0.90  # 90% heap used -> immediate restart
    DB_POOL_SATURATION_THRESHOLD: float = 75.0  # 75% thread pool saturation
    NETWORK_THROTTLE_Z_THRESHOLD: float = 3.0  # 3.0 standard deviations
    CPU_JITTER_DOMINANCE_RATIO: float = 1.30  # Relative contributor dominance factor
    MIN_ANOMALY_PROBABILITY: float = 0.35  # Below 0.35 is ROOT_CAUSE_METRIC: NONE

    # Decision Engine Policy Mapping Thresholds
    PROB_THROTTLE: float = 0.45
    PROB_REROUTE_COLD: float = 0.70
    PROB_OPEN_CIRCUIT: float = 0.85
    PROB_RESTART_CONTAINER: float = 0.92


settings = Settings()
