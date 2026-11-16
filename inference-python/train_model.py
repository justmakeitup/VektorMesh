"""
VektorMesh Isolation Forest Model Training, Tuning & Evaluation Pipeline
------------------------------------------------------------------------
Trains, tunes, validates, and serializes production-grade Isolation Forest
models per microservice tier.

Usage:
  python train_model.py [--samples 5000] [--output-dir saved_models]
                        [--n-estimators 120] [--contamination 0.02]
                        [--benchmark] [--evaluate]
"""

import sys
import time
import argparse
from pathlib import Path
from typing import Dict, Tuple, List, Optional
import numpy as np
import joblib
from sklearn.ensemble import IsolationForest
from sklearn.metrics import precision_score, recall_score, f1_score, roc_auc_score

# Resolve repo root
_repo_dir = Path(__file__).resolve().parent
if str(_repo_dir) not in sys.path:
    sys.path.insert(0, str(_repo_dir))

FEATURE_NAMES = [
    "cpu_jitter_pct",
    "thread_pool_saturation_pct",
    "heap_utilization_ratio",
    "heap_slope_mb_per_sec",
    "p99_latency_ms",
    "error_rate_pct"
]

# Service-specific steady-state distributions for high-fidelity baselines
SERVICE_PROFILES = {
    "order-processor": {
        "cpu_mean": 24.0, "cpu_std": 5.0,
        "threads_mean": 32.0, "threads_std": 6.0,
        "heap_ratio_mean": 0.45, "heap_ratio_std": 0.05,
        "p99_mean": 45.0, "p99_std": 8.0,
        "error_scale": 0.02
    },
    "inventory-service": {
        "cpu_mean": 30.0, "cpu_std": 7.0,
        "threads_mean": 40.0, "threads_std": 8.0,
        "heap_ratio_mean": 0.52, "heap_ratio_std": 0.06,
        "p99_mean": 60.0, "p99_std": 12.0,
        "error_scale": 0.03
    },
    "payment-gateway": {
        "cpu_mean": 18.0, "cpu_std": 4.0,
        "threads_mean": 22.0, "threads_std": 5.0,
        "heap_ratio_mean": 0.38, "heap_ratio_std": 0.04,
        "p99_mean": 28.0, "p99_std": 5.0,
        "error_scale": 0.005
    },
    "default": {
        "cpu_mean": 25.0, "cpu_std": 6.0,
        "threads_mean": 30.0, "threads_std": 7.0,
        "heap_ratio_mean": 0.42, "heap_ratio_std": 0.06,
        "p99_mean": 50.0, "p99_std": 10.0,
        "error_scale": 0.02
    }
}


def generate_baseline_dataset(
    service_id: str,
    n_samples: int = 5000,
    random_state: int = 42
) -> np.ndarray:
    """
    Generates unpolluted, steady-state multi-dimensional telemetry data
    modeling realistic microservice operating baselines.
    """
    rng = np.random.default_rng(random_state)
    prof = SERVICE_PROFILES.get(service_id, SERVICE_PROFILES["default"])

    cpu = rng.normal(loc=prof["cpu_mean"], scale=prof["cpu_std"], size=n_samples).clip(2.0, 65.0)
    threads = rng.normal(loc=prof["threads_mean"], scale=prof["threads_std"], size=n_samples).clip(5.0, 65.0)
    heap_ratio = rng.normal(loc=prof["heap_ratio_mean"], scale=prof["heap_ratio_std"], size=n_samples).clip(0.15, 0.70)
    heap_slope = rng.normal(loc=0.002, scale=0.012, size=n_samples).clip(-0.04, 0.05)
    p99 = rng.normal(loc=prof["p99_mean"], scale=prof["p99_std"], size=n_samples).clip(10.0, 120.0)
    error_rate = rng.exponential(scale=prof["error_scale"], size=n_samples).clip(0.0, 0.25)

    return np.column_stack([cpu, threads, heap_ratio, heap_slope, p99, error_rate])


def generate_evaluation_set(
    service_id: str,
    n_normal: int = 2000,
    n_anomalies: int = 200,
    random_state: int = 99
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generates a labeled test set containing normal traffic (label=0)
    and realistic cascading anomalies (label=1).
    """
    rng = np.random.default_rng(random_state)
    X_normal = generate_baseline_dataset(service_id, n_samples=n_normal, random_state=random_state)
    y_normal = np.zeros(n_normal, dtype=int)

    # 1. Slow-bleed memory leak (High heap ratio + steep upward slope)
    n_leak = n_anomalies // 3
    leak_cpu = rng.normal(25.0, 5.0, n_leak).clip(15.0, 40.0)
    leak_threads = rng.normal(30.0, 5.0, n_leak).clip(20.0, 45.0)
    leak_heap = rng.uniform(0.85, 0.98, n_leak)
    leak_slope = rng.uniform(0.35, 1.20, n_leak)
    leak_p99 = rng.normal(55.0, 10.0, n_leak).clip(40.0, 80.0)
    leak_err = rng.uniform(0.0, 0.05, n_leak)
    X_leak = np.column_stack([leak_cpu, leak_threads, leak_heap, leak_slope, leak_p99, leak_err])

    # 2. Thread pool & DB saturation spike
    n_pool = n_anomalies // 3
    pool_cpu = rng.uniform(70.0, 95.0, n_pool)
    pool_threads = rng.uniform(85.0, 100.0, n_pool)
    pool_heap = rng.normal(0.50, 0.08, n_pool).clip(0.3, 0.7)
    pool_slope = rng.normal(0.01, 0.02, n_pool)
    pool_p99 = rng.uniform(250.0, 800.0, n_pool)
    pool_err = rng.uniform(0.05, 0.20, n_pool)
    X_pool = np.column_stack([pool_cpu, pool_threads, pool_heap, pool_slope, pool_p99, pool_err])

    # 3. Cascading error rate & latency blowout
    n_blowout = n_anomalies - n_leak - n_pool
    blow_cpu = rng.uniform(50.0, 85.0, n_blowout)
    blow_threads = rng.uniform(60.0, 90.0, n_blowout)
    blow_heap = rng.normal(0.48, 0.06, n_blowout)
    blow_slope = rng.normal(0.0, 0.02, n_blowout)
    blow_p99 = rng.uniform(500.0, 2500.0, n_blowout)
    blow_err = rng.uniform(0.15, 0.60, n_blowout)
    X_blow = np.column_stack([blow_cpu, blow_threads, blow_heap, blow_slope, blow_p99, blow_err])

    X_anomalies = np.vstack([X_leak, X_pool, X_blow])
    y_anomalies = np.ones(n_anomalies, dtype=int)

    X_eval = np.vstack([X_normal, X_anomalies])
    y_eval = np.concatenate([y_normal, y_anomalies])
    return X_eval, y_eval


def train_isolation_forest(
    X_train: np.ndarray,
    n_estimators: int = 120,
    max_samples: int = 256,
    contamination: float = 0.02,
    random_state: int = 42
) -> IsolationForest:
    """
    Fits an optimized Isolation Forest model.
    Uses max_samples=256 as proven by Liu et al. to avoid swamping and masking,
    while achieving blazing sub-millisecond tree traversal.
    """
    model = IsolationForest(
        n_estimators=n_estimators,
        max_samples=min(max_samples, len(X_train)),
        contamination=contamination,
        random_state=random_state,
        n_jobs=-1  # Multi-threaded offline training
    )
    model.fit(X_train)
    return model


def benchmark_inference_latency(model: IsolationForest, n_iterations: int = 5000) -> float:
    """Measures single-frame inference latency over thousands of calls."""
    sample_vector = np.array([[28.5, 33.2, 0.44, 0.003, 48.0, 0.01]], dtype=np.float64)

    # Warmup
    for _ in range(100):
        model.decision_function(sample_vector)

    t0 = time.perf_counter_ns()
    for _ in range(n_iterations):
        model.decision_function(sample_vector)
    t1 = time.perf_counter_ns()

    latency_us = (t1 - t0) / (n_iterations * 1000.0)
    return latency_us


def evaluate_model_performance(
    model: IsolationForest,
    X_eval: np.ndarray,
    y_true: np.ndarray
) -> Dict[str, float]:
    """
    Evaluates calibrated anomaly detection metrics (Precision, Recall, F1, ROC-AUC).
    Uses the calibrated sigmoid probability threshold (P > 0.45 = Anomaly).
    """
    raw_decisions = model.decision_function(X_eval)
    # Calibrated Sigmoid
    probs = 1.0 / (1.0 + np.exp(20.0 * raw_decisions))
    y_pred = (probs >= 0.45).astype(int)

    precision = float(precision_score(y_true, y_pred, zero_division=0))
    recall = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))
    roc_auc = float(roc_auc_score(y_true, probs))

    # False alarm rate on normal traffic
    false_positives = int(np.sum((y_pred == 1) & (y_true == 0)))
    total_normal = int(np.sum(y_true == 0))
    fpr = float(false_positives / total_normal) if total_normal > 0 else 0.0

    return {
        "precision": precision,
        "recall": recall,
        "f1_score": f1,
        "roc_auc": roc_auc,
        "false_alarm_rate": fpr,
        "false_positives": false_positives,
        "total_normal": total_normal
    }


def main():
    parser = argparse.ArgumentParser(description="VektorMesh Anomaly Detection Model Trainer")
    parser.add_argument("--samples", type=int, default=5000, help="Number of baseline training samples")
    parser.add_argument("--output-dir", type=str, default="saved_models", help="Directory to save .joblib models")
    parser.add_argument("--n-estimators", type=int, default=120, help="Number of isolation trees")
    parser.add_argument("--contamination", type=float, default=0.02, help="Expected contamination proportion")
    parser.add_argument("--benchmark", action="store_true", default=True, help="Benchmark inference latency")
    parser.add_argument("--evaluate", action="store_true", default=True, help="Evaluate precision and recall")
    args = parser.parse_args()

    out_dir = Path(_repo_dir / args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print("\n" + "=" * 80)
    print("      VektorMesh Anomaly Engine: Production ML Training & Tuning")
    print("=" * 80)
    print(f"Hyperparameters: n_estimators={args.n_estimators}, max_samples=256, contamination={args.contamination}")
    print(f"Output Directory: {out_dir.resolve()}\n")

    services = ["order-processor", "inventory-service", "payment-gateway", "default"]

    for service_id in services:
        print(f"[*] Training model for '{service_id}' ({args.samples} baseline samples)...")
        X_train = generate_baseline_dataset(service_id, n_samples=args.samples)

        t_start = time.perf_counter()
        model = train_isolation_forest(
            X_train,
            n_estimators=args.n_estimators,
            max_samples=256,
            contamination=args.contamination
        )
        t_fit = (time.perf_counter() - t_start) * 1000.0

        # Benchmark latency
        latency_us = benchmark_inference_latency(model, n_iterations=3000)

        # Evaluate performance
        metrics = {}
        if args.evaluate:
            X_eval, y_eval = generate_evaluation_set(service_id, n_normal=2000, n_anomalies=200)
            metrics = evaluate_model_performance(model, X_eval, y_eval)

        # Save to disk
        model_file = out_dir / f"{service_id}.joblib"
        joblib.dump(model, model_file)

        print(f"    - Fit Time:      {t_fit:.1f} ms")
        print(f"    - Latency:       {latency_us:.2f} \u00b5s ({latency_us / 1000.0:.4f} ms per frame)")
        if metrics:
            print(f"    - Recall (Sens): {metrics['recall'] * 100:.2f}% (Anomalies caught)")
            print(f"    - Precision:     {metrics['precision'] * 100:.2f}%")
            print(f"    - F1 Score:      {metrics['f1_score']:.4f}")
            print(f"    - False Alarms:  {metrics['false_alarm_rate'] * 100:.2f}% ({metrics['false_positives']}/{metrics['total_normal']})")
            print(f"    - ROC-AUC:       {metrics['roc_auc']:.4f}")
        print(f"    - Persisted:     {model_file.name} ({model_file.stat().st_size / 1024:.1f} KB)\n")

    print("=" * 80)
    print(" [SUCCESS] All models trained, validated, and persisted successfully.")
    print(" The Python Inference Engine will now automatically load these serialized models on boot.")
    print("=" * 80 + "\n")


if __name__ == "__main__":
    main()
