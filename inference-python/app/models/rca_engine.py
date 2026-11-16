"""
Stage C: Cascade Probability Fusion & Explainable Root-Cause Attribution (RCA) Engine
Fuses fast statistical edge signals with slow-bleed multivariate scores,
identifies anomalous metric root causes, and maps verdicts to remediation policies.
"""

import numpy as np
from app.core.config import settings
from app.generated.vektormesh_pb2 import (
    RootCauseMetric,
    RecommendedAction
)


class RootCauseAttributionEngine:
    """
    RCA Engine evaluating fused anomaly probability and determining deterministic,
    explainable root-cause metrics and mitigation actions.
    """

    @staticmethod
    def fuse_probabilities(
        ewma_z_score: float,
        isolation_forest_score: float,
        heap_utilization_ratio: float,
        heap_slope_mb_per_sec: float
    ) -> float:
        """
        Calibrated Sigmoid Fusion:
        Combines instantaneous Z-score with multivariate Isolation Forest score,
        applying a monotonic penalty for dangerous heap saturation trajectories.
        """
        # 1. Transform EWMA Z-score into bounded [0, 1] probability
        # Centers z=3.0 at ~0.50 probability; z=0 maps to ~0.01; z=4.5 maps to ~0.90
        clamped_z = min(max(ewma_z_score, 0.0), 6.0)
        z_prob = 1.0 / (1.0 + np.exp(-1.5 * (clamped_z - 3.0)))

        # 2. Weighted ensemble combination:
        base_probability = 0.50 * z_prob + 0.50 * isolation_forest_score

        # 3. Monotonic Heap Exhaustion Penalty
        # Adds progressive penalty if heap > 85% with an active upward trajectory
        penalty = 0.0
        if heap_utilization_ratio > 0.85 and heap_slope_mb_per_sec > 0.0:
            excess_heap = heap_utilization_ratio - 0.85
            slope_factor = min(heap_slope_mb_per_sec, 2.0)
            penalty = (3.0 * excess_heap) + (0.50 * slope_factor)

        cascade_prob = float(np.clip(base_probability + penalty, 0.0, 1.0))
        return cascade_prob

    @staticmethod
    def attribute_root_cause(
        cascade_prob: float,
        cpu_jitter_pct: float,
        thread_pool_saturation_pct: float,
        heap_utilization_ratio: float,
        heap_slope_mb_per_sec: float,
        p99_latency_ms: float,
        active_connections: int,
        z_scores: dict[str, float]
    ) -> RootCauseMetric:
        """
        Deterministic, explainable rule engine that attributes the dominant root cause.
        """
        # 1. If fused anomaly probability is below baseline threshold, verdict is NONE
        if cascade_prob < settings.MIN_ANOMALY_PROBABILITY:
            return RootCauseMetric.NONE

        z_p99 = z_scores.get("p99_latency_ms", 0.0)
        z_cpu = z_scores.get("cpu_jitter_pct", 0.0)
        z_thread = z_scores.get("thread_pool_saturation_pct", 0.0)

        # 2. Check HEAP_LEAK: Positive slope with high memory utilization
        if (
            heap_slope_mb_per_sec >= settings.HEAP_LEAK_SLOPE_THRESHOLD
            and heap_utilization_ratio >= settings.HEAP_LEAK_RATIO_THRESHOLD
        ):
            return RootCauseMetric.HEAP_LEAK

        if heap_utilization_ratio >= 0.85 and heap_slope_mb_per_sec > 0.05:
            return RootCauseMetric.HEAP_LEAK

        # 3. Check DB_POOL_EXHAUSTION: High thread pool saturation & queuing with moderate CPU
        if (
            thread_pool_saturation_pct >= settings.DB_POOL_SATURATION_THRESHOLD
            and (active_connections >= 30 or z_thread >= 2.0)
            and cpu_jitter_pct < 70.0
        ):
            return RootCauseMetric.DB_POOL_EXHAUSTION

        # 4. Check NETWORK_THROTTLE: Sharp latency spike while CPU and Heap remain stable
        if (
            (z_p99 >= settings.NETWORK_THROTTLE_Z_THRESHOLD or p99_latency_ms > 200.0)
            and cpu_jitter_pct < 55.0
            and heap_utilization_ratio < 0.80
            and thread_pool_saturation_pct < 70.0
        ):
            return RootCauseMetric.NETWORK_THROTTLE

        # 5. Check CPU_JITTER: Dominant CPU deviation
        if z_cpu >= 2.0 and z_cpu > z_p99 and z_cpu > z_thread:
            return RootCauseMetric.CPU_JITTER

        if cpu_jitter_pct > 75.0:
            return RootCauseMetric.CPU_JITTER

        # 6. Fallback based on relative z-score dominance
        if z_thread > z_p99 and z_thread > z_cpu:
            return RootCauseMetric.DB_POOL_EXHAUSTION
        elif z_p99 > z_cpu and z_p99 > z_thread:
            return RootCauseMetric.NETWORK_THROTTLE
        elif z_cpu > 1.5:
            return RootCauseMetric.CPU_JITTER

        return RootCauseMetric.NONE

    @staticmethod
    def map_policy_action(
        cascade_prob: float,
        root_cause: RootCauseMetric,
        heap_utilization_ratio: float
    ) -> RecommendedAction:
        """
        Maps the cascade probability and root cause to a control plane remediation action.
        Policy Rules:
          - < 0.45: NO_OP
          - 0.45 - 0.69: THROTTLE_TRAFFIC
          - 0.70 - 0.84: REROUTE_COLD_REPLICA (if DB_POOL_EXHAUSTION or NETWORK_THROTTLE) or THROTTLE_TRAFFIC
          - 0.85 - 0.92: OPEN_CIRCUIT
          - > 0.92 (or confirmed critical HEAP_LEAK > 90% heap): RESTART_CONTAINER
        """
        # Critical heap OOM escape hatch: > 90% heap with confirmed leak triggers immediate restart
        if root_cause == RootCauseMetric.HEAP_LEAK and heap_utilization_ratio >= settings.HEAP_CRITICAL_RATIO_THRESHOLD:
            return RecommendedAction.RESTART_CONTAINER

        if cascade_prob < settings.PROB_THROTTLE:
            return RecommendedAction.NO_OP

        if cascade_prob < settings.PROB_REROUTE_COLD:
            return RecommendedAction.THROTTLE_TRAFFIC

        if cascade_prob < settings.PROB_OPEN_CIRCUIT:
            if root_cause in (RootCauseMetric.DB_POOL_EXHAUSTION, RootCauseMetric.NETWORK_THROTTLE):
                return RecommendedAction.REROUTE_COLD_REPLICA
            return RecommendedAction.THROTTLE_TRAFFIC

        if cascade_prob < settings.PROB_RESTART_CONTAINER:
            return RecommendedAction.OPEN_CIRCUIT

        return RecommendedAction.RESTART_CONTAINER
