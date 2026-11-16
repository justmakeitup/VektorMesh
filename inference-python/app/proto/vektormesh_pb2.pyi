from google.protobuf import empty_pb2 as _empty_pb2
from google.protobuf.internal import containers as _containers
from google.protobuf.internal import enum_type_wrapper as _enum_type_wrapper
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Iterable as _Iterable, Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class RootCauseMetric(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    NONE: _ClassVar[RootCauseMetric]
    CPU_JITTER: _ClassVar[RootCauseMetric]
    HEAP_LEAK: _ClassVar[RootCauseMetric]
    DB_POOL_EXHAUSTION: _ClassVar[RootCauseMetric]
    NETWORK_THROTTLE: _ClassVar[RootCauseMetric]

class RecommendedAction(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    NO_OP: _ClassVar[RecommendedAction]
    THROTTLE_TRAFFIC: _ClassVar[RecommendedAction]
    OPEN_CIRCUIT: _ClassVar[RecommendedAction]
    REROUTE_COLD_REPLICA: _ClassVar[RecommendedAction]
    RESTART_CONTAINER: _ClassVar[RecommendedAction]

class FaultType(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    FAULT_TYPE_UNSPECIFIED: _ClassVar[FaultType]
    LATENCY_SPIKE: _ClassVar[FaultType]
    SOCKET_EXHAUSTION: _ClassVar[FaultType]
    MEMORY_BLEED: _ClassVar[FaultType]
    CORRUPT_PAYLOAD: _ClassVar[FaultType]

class CircuitState(int, metaclass=_enum_type_wrapper.EnumTypeWrapper):
    __slots__ = ()
    CLOSED: _ClassVar[CircuitState]
    OPEN: _ClassVar[CircuitState]
    HALF_OPEN: _ClassVar[CircuitState]
NONE: RootCauseMetric
CPU_JITTER: RootCauseMetric
HEAP_LEAK: RootCauseMetric
DB_POOL_EXHAUSTION: RootCauseMetric
NETWORK_THROTTLE: RootCauseMetric
NO_OP: RecommendedAction
THROTTLE_TRAFFIC: RecommendedAction
OPEN_CIRCUIT: RecommendedAction
REROUTE_COLD_REPLICA: RecommendedAction
RESTART_CONTAINER: RecommendedAction
FAULT_TYPE_UNSPECIFIED: FaultType
LATENCY_SPIKE: FaultType
SOCKET_EXHAUSTION: FaultType
MEMORY_BLEED: FaultType
CORRUPT_PAYLOAD: FaultType
CLOSED: CircuitState
OPEN: CircuitState
HALF_OPEN: CircuitState

class TelemetryFrame(_message.Message):
    __slots__ = ("service_id", "timestamp_ms", "cpu_jitter_pct", "thread_pool_saturation_pct", "heap_used_mb", "heap_max_mb", "p95_latency_ms", "p99_latency_ms", "error_rate_pct", "active_connections")
    SERVICE_ID_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_MS_FIELD_NUMBER: _ClassVar[int]
    CPU_JITTER_PCT_FIELD_NUMBER: _ClassVar[int]
    THREAD_POOL_SATURATION_PCT_FIELD_NUMBER: _ClassVar[int]
    HEAP_USED_MB_FIELD_NUMBER: _ClassVar[int]
    HEAP_MAX_MB_FIELD_NUMBER: _ClassVar[int]
    P95_LATENCY_MS_FIELD_NUMBER: _ClassVar[int]
    P99_LATENCY_MS_FIELD_NUMBER: _ClassVar[int]
    ERROR_RATE_PCT_FIELD_NUMBER: _ClassVar[int]
    ACTIVE_CONNECTIONS_FIELD_NUMBER: _ClassVar[int]
    service_id: str
    timestamp_ms: int
    cpu_jitter_pct: float
    thread_pool_saturation_pct: float
    heap_used_mb: float
    heap_max_mb: float
    p95_latency_ms: float
    p99_latency_ms: float
    error_rate_pct: float
    active_connections: int
    def __init__(self, service_id: _Optional[str] = ..., timestamp_ms: _Optional[int] = ..., cpu_jitter_pct: _Optional[float] = ..., thread_pool_saturation_pct: _Optional[float] = ..., heap_used_mb: _Optional[float] = ..., heap_max_mb: _Optional[float] = ..., p95_latency_ms: _Optional[float] = ..., p99_latency_ms: _Optional[float] = ..., error_rate_pct: _Optional[float] = ..., active_connections: _Optional[int] = ...) -> None: ...

class AnomalyVerdict(_message.Message):
    __slots__ = ("service_id", "timestamp_ms", "cascade_probability", "ewma_z_score", "isolation_forest_score", "root_cause_metric", "recommended_action")
    SERVICE_ID_FIELD_NUMBER: _ClassVar[int]
    TIMESTAMP_MS_FIELD_NUMBER: _ClassVar[int]
    CASCADE_PROBABILITY_FIELD_NUMBER: _ClassVar[int]
    EWMA_Z_SCORE_FIELD_NUMBER: _ClassVar[int]
    ISOLATION_FOREST_SCORE_FIELD_NUMBER: _ClassVar[int]
    ROOT_CAUSE_METRIC_FIELD_NUMBER: _ClassVar[int]
    RECOMMENDED_ACTION_FIELD_NUMBER: _ClassVar[int]
    service_id: str
    timestamp_ms: int
    cascade_probability: float
    ewma_z_score: float
    isolation_forest_score: float
    root_cause_metric: RootCauseMetric
    recommended_action: RecommendedAction
    def __init__(self, service_id: _Optional[str] = ..., timestamp_ms: _Optional[int] = ..., cascade_probability: _Optional[float] = ..., ewma_z_score: _Optional[float] = ..., isolation_forest_score: _Optional[float] = ..., root_cause_metric: _Optional[_Union[RootCauseMetric, str]] = ..., recommended_action: _Optional[_Union[RecommendedAction, str]] = ...) -> None: ...

class RouteWeightUpdate(_message.Message):
    __slots__ = ("source_service_id", "target_service_id", "primary_weight_pct", "canary_weight_pct", "cold_replica_weight_pct", "throttle_non_critical", "reason")
    SOURCE_SERVICE_ID_FIELD_NUMBER: _ClassVar[int]
    TARGET_SERVICE_ID_FIELD_NUMBER: _ClassVar[int]
    PRIMARY_WEIGHT_PCT_FIELD_NUMBER: _ClassVar[int]
    CANARY_WEIGHT_PCT_FIELD_NUMBER: _ClassVar[int]
    COLD_REPLICA_WEIGHT_PCT_FIELD_NUMBER: _ClassVar[int]
    THROTTLE_NON_CRITICAL_FIELD_NUMBER: _ClassVar[int]
    REASON_FIELD_NUMBER: _ClassVar[int]
    source_service_id: str
    target_service_id: str
    primary_weight_pct: float
    canary_weight_pct: float
    cold_replica_weight_pct: float
    throttle_non_critical: bool
    reason: str
    def __init__(self, source_service_id: _Optional[str] = ..., target_service_id: _Optional[str] = ..., primary_weight_pct: _Optional[float] = ..., canary_weight_pct: _Optional[float] = ..., cold_replica_weight_pct: _Optional[float] = ..., throttle_non_critical: _Optional[bool] = ..., reason: _Optional[str] = ...) -> None: ...

class FaultInjectionRequest(_message.Message):
    __slots__ = ("target_service_id", "fault_type", "intensity_pct", "duration_seconds")
    TARGET_SERVICE_ID_FIELD_NUMBER: _ClassVar[int]
    FAULT_TYPE_FIELD_NUMBER: _ClassVar[int]
    INTENSITY_PCT_FIELD_NUMBER: _ClassVar[int]
    DURATION_SECONDS_FIELD_NUMBER: _ClassVar[int]
    target_service_id: str
    fault_type: FaultType
    intensity_pct: int
    duration_seconds: int
    def __init__(self, target_service_id: _Optional[str] = ..., fault_type: _Optional[_Union[FaultType, str]] = ..., intensity_pct: _Optional[int] = ..., duration_seconds: _Optional[int] = ...) -> None: ...

class RouteWeights(_message.Message):
    __slots__ = ("primary_weight_pct", "canary_weight_pct", "cold_replica_weight_pct")
    PRIMARY_WEIGHT_PCT_FIELD_NUMBER: _ClassVar[int]
    CANARY_WEIGHT_PCT_FIELD_NUMBER: _ClassVar[int]
    COLD_REPLICA_WEIGHT_PCT_FIELD_NUMBER: _ClassVar[int]
    primary_weight_pct: float
    canary_weight_pct: float
    cold_replica_weight_pct: float
    def __init__(self, primary_weight_pct: _Optional[float] = ..., canary_weight_pct: _Optional[float] = ..., cold_replica_weight_pct: _Optional[float] = ...) -> None: ...

class ActiveFault(_message.Message):
    __slots__ = ("fault_type", "intensity_pct", "started_at_ms", "duration_seconds", "remaining_seconds")
    FAULT_TYPE_FIELD_NUMBER: _ClassVar[int]
    INTENSITY_PCT_FIELD_NUMBER: _ClassVar[int]
    STARTED_AT_MS_FIELD_NUMBER: _ClassVar[int]
    DURATION_SECONDS_FIELD_NUMBER: _ClassVar[int]
    REMAINING_SECONDS_FIELD_NUMBER: _ClassVar[int]
    fault_type: FaultType
    intensity_pct: int
    started_at_ms: int
    duration_seconds: int
    remaining_seconds: int
    def __init__(self, fault_type: _Optional[_Union[FaultType, str]] = ..., intensity_pct: _Optional[int] = ..., started_at_ms: _Optional[int] = ..., duration_seconds: _Optional[int] = ..., remaining_seconds: _Optional[int] = ...) -> None: ...

class ServiceNodeStatus(_message.Message):
    __slots__ = ("service_id", "circuit_state", "current_route_weights", "active_faults", "latest_telemetry", "latest_verdict")
    SERVICE_ID_FIELD_NUMBER: _ClassVar[int]
    CIRCUIT_STATE_FIELD_NUMBER: _ClassVar[int]
    CURRENT_ROUTE_WEIGHTS_FIELD_NUMBER: _ClassVar[int]
    ACTIVE_FAULTS_FIELD_NUMBER: _ClassVar[int]
    LATEST_TELEMETRY_FIELD_NUMBER: _ClassVar[int]
    LATEST_VERDICT_FIELD_NUMBER: _ClassVar[int]
    service_id: str
    circuit_state: CircuitState
    current_route_weights: RouteWeights
    active_faults: _containers.RepeatedCompositeFieldContainer[ActiveFault]
    latest_telemetry: TelemetryFrame
    latest_verdict: AnomalyVerdict
    def __init__(self, service_id: _Optional[str] = ..., circuit_state: _Optional[_Union[CircuitState, str]] = ..., current_route_weights: _Optional[_Union[RouteWeights, _Mapping]] = ..., active_faults: _Optional[_Iterable[_Union[ActiveFault, _Mapping]]] = ..., latest_telemetry: _Optional[_Union[TelemetryFrame, _Mapping]] = ..., latest_verdict: _Optional[_Union[AnomalyVerdict, _Mapping]] = ...) -> None: ...

class SystemStateSnapshot(_message.Message):
    __slots__ = ("snapshot_timestamp_ms", "nodes", "active_routes")
    SNAPSHOT_TIMESTAMP_MS_FIELD_NUMBER: _ClassVar[int]
    NODES_FIELD_NUMBER: _ClassVar[int]
    ACTIVE_ROUTES_FIELD_NUMBER: _ClassVar[int]
    snapshot_timestamp_ms: int
    nodes: _containers.RepeatedCompositeFieldContainer[ServiceNodeStatus]
    active_routes: _containers.RepeatedCompositeFieldContainer[RouteWeightUpdate]
    def __init__(self, snapshot_timestamp_ms: _Optional[int] = ..., nodes: _Optional[_Iterable[_Union[ServiceNodeStatus, _Mapping]]] = ..., active_routes: _Optional[_Iterable[_Union[RouteWeightUpdate, _Mapping]]] = ...) -> None: ...

class RemediationAck(_message.Message):
    __slots__ = ("success", "remediation_id", "message", "applied_at_ms")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    REMEDIATION_ID_FIELD_NUMBER: _ClassVar[int]
    MESSAGE_FIELD_NUMBER: _ClassVar[int]
    APPLIED_AT_MS_FIELD_NUMBER: _ClassVar[int]
    success: bool
    remediation_id: str
    message: str
    applied_at_ms: int
    def __init__(self, success: _Optional[bool] = ..., remediation_id: _Optional[str] = ..., message: _Optional[str] = ..., applied_at_ms: _Optional[int] = ...) -> None: ...
