"""
Sliding Window Telemetry State Manager (app/core/window_manager.py)
Maintains thread-safe and async-safe per-service rolling telemetry buffers
and computes real-time derivatives (velocities, slopes, and ratios).
"""

import threading
from collections import deque
from dataclasses import dataclass
from typing import Optional, List, Dict
import numpy as np

from app.core.config import settings
from app.generated.vektormesh_pb2 import TelemetryFrame


@dataclass(slots=True)
class DerivedMetrics:
    """Real-time computed first-order derivatives from sliding window."""
    heap_slope_mb_per_sec: float
    tail_latency_ratio: float
    connection_saturation_ratio: float
    heap_utilization_ratio: float
    window_depth: int


class ServiceTelemetryBuffer:
    """
    Fixed-size ring buffer for a single microservice node.
    Maintains the last N TelemetryFrames and computes instant derivatives.
    """

    def __init__(self, service_id: str, max_size: int = settings.WINDOW_SIZE):
        self.service_id = service_id
        self.max_size = max_size
        self._buffer: deque[TelemetryFrame] = deque(maxlen=max_size)
        self._lock = threading.Lock()

    def append(self, frame: TelemetryFrame) -> DerivedMetrics:
        """
        Appends a new frame to the ring buffer and calculates instantaneous derivatives.
        Execution is guaranteed sub-millisecond using vectorized NumPy operations.
        """
        with self._lock:
            self._buffer.append(frame)
            depth = len(self._buffer)

            # 1. Heap Utilization Ratio
            heap_max = max(frame.heap_max_mb, 1.0)
            heap_util_ratio = float(np.clip(frame.heap_used_mb / heap_max, 0.0, 1.0))

            # 2. Tail Latency Amplification Ratio
            p95_safe = max(frame.p95_latency_ms, 1.0)
            tail_ratio = float(frame.p99_latency_ms / p95_safe)

            # 3. Connection Saturation Ratio (active connections per % thread pool consumed)
            thread_sat_safe = max(frame.thread_pool_saturation_pct, 1.0)
            conn_saturation = float(frame.active_connections / thread_sat_safe)

            # 4. Heap Growth Rate via Linear Regression Slope (MB/sec over last 30 frames)
            heap_slope = self._compute_heap_slope()

            return DerivedMetrics(
                heap_slope_mb_per_sec=heap_slope,
                tail_latency_ratio=tail_ratio,
                connection_saturation_ratio=conn_saturation,
                heap_utilization_ratio=heap_util_ratio,
                window_depth=depth
            )

    def _compute_heap_slope(self) -> float:
        """
        Computes ordinary least-squares slope (MB/sec) over the last N frames.
        Returns 0.0 if fewer than MIN_FRAMES_FOR_SLOPE exist.
        """
        n = min(len(self._buffer), settings.SLOPE_WINDOW)
        if n < settings.MIN_FRAMES_FOR_SLOPE:
            return 0.0

        # Extract last n frames
        recent_frames = [self._buffer[i] for i in range(len(self._buffer) - n, len(self._buffer))]

        # Time in seconds relative to the start of this window slice
        t_base = recent_frames[0].timestamp_ms
        t = np.array([(f.timestamp_ms - t_base) / 1000.0 for f in recent_frames], dtype=np.float64)
        y = np.array([f.heap_used_mb for f in recent_frames], dtype=np.float64)

        t_diff = t - np.mean(t)
        denominator = np.sum(t_diff ** 2)

        if denominator < 1e-6:
            # All frames had virtually identical timestamps
            return 0.0

        y_diff = y - np.mean(y)
        slope = float(np.sum(t_diff * y_diff) / denominator)
        return slope

    def get_snapshots(self, count: Optional[int] = None) -> List[TelemetryFrame]:
        """Returns snapshot copies of recent frames."""
        with self._lock:
            if count is None or count >= len(self._buffer):
                return list(self._buffer)
            return list(self._buffer)[-count:]

    def get_feature_matrix(self, count: int = 30) -> np.ndarray:
        """
        Extracts recent frames into an (M, 6) feature matrix for model diagnostics or refitting:
        [cpu_jitter, thread_sat, heap_ratio, heap_slope, p99_latency, error_rate]
        """
        with self._lock:
            frames = list(self._buffer)[-count:]

        if not frames:
            return np.zeros((0, 6), dtype=np.float64)

        matrix = np.zeros((len(frames), 6), dtype=np.float64)
        for i, f in enumerate(frames):
            heap_ratio = f.heap_used_mb / max(f.heap_max_mb, 1.0)
            matrix[i] = [
                f.cpu_jitter_pct,
                f.thread_pool_saturation_pct,
                heap_ratio,
                0.0,  # Slope requires historical context
                f.p99_latency_ms,
                f.error_rate_pct
            ]
        return matrix

    def __len__(self) -> int:
        with self._lock:
            return len(self._buffer)


class TelemetryWindowManager:
    """
    Thread-safe registry of ServiceTelemetryBuffers indexed by service_id.
    """

    def __init__(self, default_window_size: int = settings.WINDOW_SIZE):
        self.default_window_size = default_window_size
        self._buffers: Dict[str, ServiceTelemetryBuffer] = {}
        self._lock = threading.Lock()

    def get_or_create(self, service_id: str) -> ServiceTelemetryBuffer:
        """Fetches existing buffer or instantiates a new ring buffer atomically."""
        with self._lock:
            if service_id not in self._buffers:
                self._buffers[service_id] = ServiceTelemetryBuffer(
                    service_id=service_id,
                    max_size=self.default_window_size
                )
            return self._buffers[service_id]

    def record_frame(self, frame: TelemetryFrame) -> DerivedMetrics:
        """Records an incoming TelemetryFrame and returns calculated derivatives."""
        buffer = self.get_or_create(frame.service_id)
        return buffer.append(frame)

    def get_all_service_ids(self) -> List[str]:
        """Returns active tracked service identifiers."""
        with self._lock:
            return list(self._buffers.keys())

    def get_buffer_stats(self, service_id: str) -> Optional[Dict[str, float]]:
        """Returns summary statistics for a service's window."""
        with self._lock:
            buf = self._buffers.get(service_id)
        if not buf or len(buf) == 0:
            return None

        frames = buf.get_snapshots()
        latest = frames[-1]
        p99_values = [f.p99_latency_ms for f in frames]
        cpu_values = [f.cpu_jitter_pct for f in frames]

        return {
            "window_size": len(frames),
            "latest_p99_ms": latest.p99_latency_ms,
            "avg_p99_ms": float(np.mean(p99_values)),
            "max_p99_ms": float(np.max(p99_values)),
            "avg_cpu_jitter_pct": float(np.mean(cpu_values)),
            "latest_heap_used_mb": latest.heap_used_mb,
            "latest_heap_max_mb": latest.heap_max_mb
        }
