"""
VektorMesh Dual-Model Anomaly Detection Pipeline Verification Test Suite
Executes 3 synthetic benchmark scenarios:
  1. Normal Baseline Traffic -> cascade_probability < 0.20, NO_OP
  2. Slow-Bleed Memory Leak -> HEAP_LEAK, RESTART_CONTAINER
  3. Sudden Latency / DB Pool Spike -> DB_POOL_EXHAUSTION, REROUTE_COLD_REPLICA (>= 0.70 prob)
"""

import sys
from pathlib import Path

# Resolve inference-python root into sys.path
_repo_dir = Path(__file__).resolve().parent.parent
if str(_repo_dir) not in sys.path:
    sys.path.insert(0, str(_repo_dir))

from app.models.dual_detector import DualDetector
from app.generated.vektormesh_pb2 import (
    TelemetryFrame,
    RootCauseMetric,
    RecommendedAction
)


def run_scenario_1_normal(detector: DualDetector):
    """
    Scenario 1: Steady normal baseline traffic for 30 seconds.
    Expectation: cascade_probability < 0.20, NO_OP.
    """
    last_verdict = None
    for i in range(30):
        frame = TelemetryFrame(
            service_id="order-processor",
            timestamp_ms=1000 * i,
            cpu_jitter_pct=22.0 + (i % 3),
            thread_pool_saturation_pct=28.0 + (i % 4),
            heap_used_mb=420.0 + (i % 2),
            heap_max_mb=1024.0,
            p95_latency_ms=40.0,
            p99_latency_ms=55.0,
            error_rate_pct=0.01,
            active_connections=25
        )
        last_verdict = detector.evaluate_frame(frame)

    assert last_verdict is not None
    assert last_verdict.cascade_probability < 0.20, f"Expected prob < 0.20, got {last_verdict.cascade_probability}"
    assert last_verdict.root_cause_metric == RootCauseMetric.NONE
    assert last_verdict.recommended_action == RecommendedAction.NO_OP
    return last_verdict


def run_scenario_2_memory_leak(detector: DualDetector):
    """
    Scenario 2: Slow-bleed heap memory leak over 45 frames.
    Latency and CPU stay healthy; heap steadily inflates toward OOM.
    Expectation: Isolation Forest + linear slope triggers HEAP_LEAK & RESTART_CONTAINER.
    """
    last_verdict = None
    for i in range(45):
        # Heap inflates by ~13 MB/s from 400 MB to 960 MB (96% heap)
        heap = 400.0 + (i * 13.0)
        frame = TelemetryFrame(
            service_id="inventory-db-proxy",
            timestamp_ms=1000 * i,
            cpu_jitter_pct=25.0,
            thread_pool_saturation_pct=30.0,
            heap_used_mb=min(heap, 960.0),
            heap_max_mb=1000.0,
            p95_latency_ms=45.0,
            p99_latency_ms=58.0,
            error_rate_pct=0.0,
            active_connections=20
        )
        last_verdict = detector.evaluate_frame(frame)

    assert last_verdict is not None
    assert last_verdict.root_cause_metric == RootCauseMetric.HEAP_LEAK, (
        f"Expected HEAP_LEAK, got {RootCauseMetric.Name(last_verdict.root_cause_metric)}"
    )
    assert last_verdict.recommended_action in (RecommendedAction.RESTART_CONTAINER, RecommendedAction.OPEN_CIRCUIT), (
        f"Expected RESTART_CONTAINER or OPEN_CIRCUIT, got {RecommendedAction.Name(last_verdict.recommended_action)}"
    )
    return last_verdict


def run_scenario_3_db_pool_spike(detector: DualDetector):
    """
    Scenario 3: Normal baseline followed by sudden surge in p99 latency & thread pool saturation.
    Expectation: Adaptive EWMA catches edge spike immediately, attributes DB_POOL_EXHAUSTION,
    and returns cascade_probability >= 0.70 triggering REROUTE_COLD_REPLICA.
    """
    # 1. Warm baseline for 20 frames
    for i in range(20):
        frame = TelemetryFrame(
            service_id="payment-ledger",
            timestamp_ms=1000 * i,
            cpu_jitter_pct=25.0,
            thread_pool_saturation_pct=30.0,
            heap_used_mb=450.0,
            heap_max_mb=1000.0,
            p95_latency_ms=35.0,
            p99_latency_ms=48.0,
            error_rate_pct=0.0,
            active_connections=25
        )
        detector.evaluate_frame(frame)

    # 2. Instant catastrophic thread pool exhaustion
    spike_frame = TelemetryFrame(
        service_id="payment-ledger",
        timestamp_ms=20000,
        cpu_jitter_pct=32.0,
        thread_pool_saturation_pct=88.0,
        heap_used_mb=450.0,
        heap_max_mb=1000.0,
        p95_latency_ms=180.0,
        p99_latency_ms=280.0,
        error_rate_pct=0.02,
        active_connections=85
    )
    spike_verdict = detector.evaluate_frame(spike_frame)

    assert spike_verdict.cascade_probability >= 0.70, (
        f"Expected cascade_probability >= 0.70, got {spike_verdict.cascade_probability}"
    )
    assert spike_verdict.root_cause_metric == RootCauseMetric.DB_POOL_EXHAUSTION, (
        f"Expected DB_POOL_EXHAUSTION, got {RootCauseMetric.Name(spike_verdict.root_cause_metric)}"
    )
    assert spike_verdict.recommended_action == RecommendedAction.REROUTE_COLD_REPLICA, (
        f"Expected REROUTE_COLD_REPLICA, got {RecommendedAction.Name(spike_verdict.recommended_action)}"
    )
    return spike_verdict


def main():
    print("=" * 105)
    print("       VektorMesh Dual-Model Anomaly Detection Pipeline: Verification Suite")
    print("=" * 105)

    detector = DualDetector()

    results = []

    # 1. Run Scenario 1
    v1 = run_scenario_1_normal(detector)
    results.append({
        "scenario": "1. Normal Baseline Traffic",
        "service": v1.service_id,
        "ewma_z": f"{v1.ewma_z_score:.2f}",
        "if_score": f"{v1.isolation_forest_score:.4f}",
        "cascade_p": f"{v1.cascade_probability:.4f}",
        "rca": RootCauseMetric.Name(v1.root_cause_metric),
        "action": RecommendedAction.Name(v1.recommended_action),
        "status": "PASS"
    })

    # 2. Run Scenario 2
    v2 = run_scenario_2_memory_leak(DualDetector())
    results.append({
        "scenario": "2. Slow-Bleed Memory Leak",
        "service": v2.service_id,
        "ewma_z": f"{v2.ewma_z_score:.2f}",
        "if_score": f"{v2.isolation_forest_score:.4f}",
        "cascade_p": f"{v2.cascade_probability:.4f}",
        "rca": RootCauseMetric.Name(v2.root_cause_metric),
        "action": RecommendedAction.Name(v2.recommended_action),
        "status": "PASS"
    })

    # 3. Run Scenario 3
    v3 = run_scenario_3_db_pool_spike(DualDetector())
    results.append({
        "scenario": "3. Sudden DB Pool Spike",
        "service": v3.service_id,
        "ewma_z": f"{v3.ewma_z_score:.2f}",
        "if_score": f"{v3.isolation_forest_score:.4f}",
        "cascade_p": f"{v3.cascade_probability:.4f}",
        "rca": RootCauseMetric.Name(v3.root_cause_metric),
        "action": RecommendedAction.Name(v3.recommended_action),
        "status": "PASS"
    })

    # Format Output Table
    header = f"{'Scenario':<30} | {'Service ID':<20} | {'EWMA Z':<8} | {'IF Score':<8} | {'Cascade P':<9} | {'Root Cause':<20} | {'Action':<20} | {'Status'}"
    divider = "-" * len(header)
    print(header)
    print(divider)
    for r in results:
        print(
            f"{r['scenario']:<30} | {r['service']:<20} | {r['ewma_z']:<8} | {r['if_score']:<8} | {r['cascade_p']:<9} | {r['rca']:<20} | {r['action']:<20} | {r['status']}"
        )
    print(divider)
    print("\n[SUCCESS] All 3 ML anomaly detection benchmark scenarios passed mathematical verification!\n")


if __name__ == "__main__":
    main()
