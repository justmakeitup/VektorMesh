"""
Stage A: Fast Statistical Edge Filter (Holt-Winters / Adaptive EWMA)
Tracks Exponentially Weighted Moving Average (EWMA) and Moving Variance
to compute instantaneous dynamic Z-scores for edge telemetry spikes.
"""

import math
from dataclasses import dataclass
from typing import Dict
from app.core.config import settings


@dataclass(slots=True)
class MetricEWMAState:
    mean: float
    variance: float
    initialized: bool = False

    def update(self, value: float, alpha: float, epsilon: float) -> float:
        """
        Updates the EWMA mean and variance using Welford-adapted exponential weighting.
        Returns the instantaneous Z-score against prior state before updating.
        """
        if not self.initialized:
            self.mean = value
            # Initialize with small prior variance to avoid div by zero on frame 1
            self.variance = max(value * 0.1, 1.0)
            self.initialized = True
            return 0.0

        diff = value - self.mean
        std_dev = math.sqrt(max(self.variance, epsilon))
        z_score = diff / std_dev

        # Update mean and variance
        self.mean = alpha * value + (1.0 - alpha) * self.mean
        # Exponentially weighted sample variance:
        # Var_t = (1 - alpha) * (Var_{t-1} + alpha * (x_t - Mean_{t-1})^2)
        self.variance = (1.0 - alpha) * (self.variance + alpha * (diff ** 2))

        return z_score


@dataclass(slots=True)
class ServiceEWMAState:
    p99: MetricEWMAState
    cpu: MetricEWMAState
    thread_pool: MetricEWMAState

    @classmethod
    def create_default(cls) -> "ServiceEWMAState":
        return cls(
            p99=MetricEWMAState(mean=50.0, variance=100.0, initialized=False),
            cpu=MetricEWMAState(mean=25.0, variance=50.0, initialized=False),
            thread_pool=MetricEWMAState(mean=30.0, variance=50.0, initialized=False)
        )


class AdaptiveEWMAFilter:
    """
    Per-service adaptive statistical edge filter.
    Calculates instantaneous Z-scores on incoming frames without requiring long baselines.
    """

    def __init__(self, alpha: float = settings.EWMA_ALPHA, epsilon: float = settings.MIN_VARIANCE_EPSILON):
        self.alpha = alpha
        self.epsilon = epsilon
        self._states: Dict[str, ServiceEWMAState] = {}

    def get_or_create_state(self, service_id: str) -> ServiceEWMAState:
        if service_id not in self._states:
            self._states[service_id] = ServiceEWMAState.create_default()
        return self._states[service_id]

    def evaluate(
        self,
        service_id: str,
        p99_latency_ms: float,
        cpu_jitter_pct: float,
        thread_pool_saturation_pct: float
    ) -> tuple[float, dict[str, float]]:
        """
        Calculates instantaneous Z-scores for key edge metrics.
        Returns:
            (max_z_score, individual_z_scores_dict)
        """
        state = self.get_or_create_state(service_id)

        z_p99 = state.p99.update(p99_latency_ms, self.alpha, self.epsilon)
        z_cpu = state.cpu.update(cpu_jitter_pct, self.alpha, self.epsilon)
        z_thread = state.thread_pool.update(thread_pool_saturation_pct, self.alpha, self.epsilon)

        individual_z = {
            "p99_latency_ms": max(0.0, z_p99),
            "cpu_jitter_pct": max(0.0, z_cpu),
            "thread_pool_saturation_pct": max(0.0, z_thread)
        }

        # The instantaneous edge Z-score reflects the maximum active deviation
        max_z = max(individual_z.values())
        return max_z, individual_z
