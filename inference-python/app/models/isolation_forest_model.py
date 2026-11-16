"""
Stage B: Slow-Bleed Multivariate Detector (scikit-learn Isolation Forest)
Maintains warm-started Isolation Forest models per service tier to detect
complex multivariate degradations and slow-bleed resource exhaustion.
"""

import os
import threading
from pathlib import Path
from typing import Dict, Optional, List
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest

from app.core.config import settings


class MultivariateIsolationForestDetector:
    """
    Multivariate Anomaly Detector using scikit-learn IsolationForest.
    Supports on-disk model persistence (.joblib), automatic fallback to
    warm-started synthetic baseline distributions, and thread-safe online scoring.
    """

    FEATURE_NAMES = [
        "cpu_jitter_pct",
        "thread_pool_saturation_pct",
        "heap_utilization_ratio",
        "heap_slope_mb_per_sec",
        "p99_latency_ms",
        "error_rate_pct"
    ]

    def __init__(
        self,
        n_estimators: int = settings.IF_N_ESTIMATORS,
        contamination: float = settings.IF_CONTAMINATION,
        random_state: int = settings.IF_RANDOM_STATE,
        models_dir: Optional[str] = None
    ):
        self.n_estimators = n_estimators
        self.contamination = contamination
        self.random_state = random_state
        self._models: Dict[str, IsolationForest] = {}
        self._lock = threading.Lock()

        # Storage directory for serialized .joblib models
        base_dir = Path(__file__).resolve().parent.parent.parent
        self.models_dir = Path(models_dir) if models_dir else (base_dir / "saved_models")
        self.models_dir.mkdir(parents=True, exist_ok=True)

        # Seed global default model
        self._default_model = self._load_or_bootstrap_model("default")

    def _create_and_bootstrap_model(self) -> IsolationForest:
        """
        Creates and trains a warm-started IsolationForest model on synthetic normal traffic.
        Ensures cold-start inference does not require waiting for 1,000 real-world frames.
        """
        rng = np.random.default_rng(self.random_state)
        n = settings.SYNTHETIC_BOOTSTRAP_SAMPLES

        # Generate realistic healthy microservice baseline metrics
        cpu = rng.normal(loc=25.0, scale=6.0, size=n).clip(5.0, 45.0)
        thread_sat = rng.normal(loc=30.0, scale=7.0, size=n).clip(10.0, 50.0)
        heap_ratio = rng.normal(loc=0.42, scale=0.06, size=n).clip(0.20, 0.60)
        heap_slope = rng.normal(loc=0.005, scale=0.015, size=n).clip(-0.03, 0.05)
        p99 = rng.lognormal(mean=3.7, sigma=0.25, size=n).clip(20.0, 85.0)  # ~40-60ms
        error_rate = rng.exponential(scale=0.05, size=n).clip(0.0, 0.3)

        X_normal = np.column_stack([cpu, thread_sat, heap_ratio, heap_slope, p99, error_rate])

        model = IsolationForest(
            n_estimators=self.n_estimators,
            contamination=self.contamination,
            random_state=self.random_state,
            warm_start=False,
            n_jobs=1
        )
        model.fit(X_normal)
        return model

    def _load_or_bootstrap_model(self, tier_or_service: str) -> IsolationForest:
        """Loads serialized model from disk if present, else bootstraps synthetic baseline."""
        model_path = self.models_dir / f"{tier_or_service}.joblib"
        if model_path.is_file():
            try:
                loaded = joblib.load(model_path)
                if isinstance(loaded, IsolationForest):
                    return loaded
            except Exception:
                pass
        return self._create_and_bootstrap_model()

    def get_model(self, tier_or_service: str) -> IsolationForest:
        with self._lock:
            if tier_or_service not in self._models:
                self._models[tier_or_service] = self._load_or_bootstrap_model(tier_or_service)
            return self._models[tier_or_service]

    def save_model(self, tier_or_service: str, filepath: Optional[str] = None) -> str:
        """Persists in-memory model to disk (.joblib)."""
        with self._lock:
            model = self._models.get(tier_or_service, self._default_model)
            out_path = Path(filepath) if filepath else (self.models_dir / f"{tier_or_service}.joblib")
            out_path.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(model, out_path)
            return str(out_path)

    def load_model(self, tier_or_service: str, filepath: str) -> bool:
        """Loads and swaps an in-memory model at runtime."""
        path = Path(filepath)
        if not path.is_file():
            return False
        with self._lock:
            model = joblib.load(path)
            self._models[tier_or_service] = model
            return True

    def score(
        self,
        service_id: str,
        feature_vector: np.ndarray,
        tier: Optional[str] = None
    ) -> tuple[float, float]:
        """
        Computes the multivariate anomaly score for a 6D feature vector.
        Args:
            service_id: Identifier of the service
            feature_vector: 1D array of shape (6,)
            tier: Optional service tier for model partitioning
        Returns:
            (normalized_score [0.0, 1.0], raw_decision_function_value)
        """
        key = tier if tier else service_id
        model = self.get_model(key)

        X = feature_vector.reshape(1, -1)
        raw_decision = float(model.decision_function(X)[0])

        # Calibrated Sigmoid Transformation:
        # raw_decision > 0 is inlier (maps to 0.05 - 0.18)
        # raw_decision < 0 is outlier (maps to 0.50 - 0.98)
        normalized_score = float(1.0 / (1.0 + np.exp(20.0 * raw_decision)))
        normalized_score = float(np.clip(normalized_score, 0.0, 1.0))

        return normalized_score, raw_decision

    def refit(self, tier_or_service: str, X_clean: np.ndarray, persist: bool = True) -> bool:
        """
        Online refitting capability for retraining on clean historical windows.
        """
        if X_clean.shape[0] < 50 or X_clean.shape[1] != 6:
            return False

        with self._lock:
            model = IsolationForest(
                n_estimators=self.n_estimators,
                contamination=self.contamination,
                random_state=self.random_state,
                n_jobs=1
            )
            model.fit(X_clean)
            self._models[tier_or_service] = model
            if persist:
                out_path = self.models_dir / f"{tier_or_service}.joblib"
                joblib.dump(model, out_path)
            return True
