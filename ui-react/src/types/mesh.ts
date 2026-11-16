// ============================================================================
// VektorMesh UI TypeScript Contract Definitions
// ============================================================================

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export type RootCauseMetric =
  | "NONE"
  | "CPU_JITTER"
  | "HEAP_LEAK"
  | "DB_POOL_EXHAUSTION"
  | "NETWORK_THROTTLE";

export type RecommendedAction =
  | "NO_OP"
  | "THROTTLE_TRAFFIC"
  | "OPEN_CIRCUIT"
  | "REROUTE_COLD_REPLICA"
  | "RESTART_CONTAINER";

export type FaultType =
  | "LATENCY_SPIKE"
  | "SOCKET_EXHAUSTION"
  | "MEMORY_BLEED"
  | "CORRUPT_PAYLOAD";

export interface TelemetryFrame {
  serviceId: string;
  timestampMs: string | number;
  cpuJitterPct: number;
  threadPoolSaturationPct: number;
  heapUsedMb: number;
  heapMaxMb: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRatePct: number;
  activeConnections: number;
}

export interface AnomalyVerdict {
  serviceId: string;
  timestampMs: string | number;
  cascadeProbability: number;
  ewmaZScore: number;
  isolationForestScore: number;
  rootCauseMetric: RootCauseMetric;
  recommendedAction: RecommendedAction;
}

export interface RouteWeights {
  primaryWeightPct: number;
  canaryWeightPct: number;
  coldReplicaWeightPct: number;
}

export interface ActiveFault {
  faultType: FaultType;
  intensityPct: number;
  startedAtMs: string | number;
  durationSeconds: number;
  remainingSeconds: number;
}

export interface ServiceNodeStatus {
  serviceId: string;
  serviceName?: string;
  tier?: string;
  baseUrl?: string;
  sloP99Ms?: number;
  maxThreadPool?: number;
  circuitState: CircuitState;
  currentRouteWeights: RouteWeights;
  activeFaults: ActiveFault[];
  latestTelemetry?: TelemetryFrame;
  latestVerdict?: AnomalyVerdict;
}

export interface RouteWeightUpdate {
  sourceServiceId: string;
  targetServiceId: string;
  primaryWeightPct: number;
  canaryWeightPct: number;
  coldReplicaWeightPct: number;
  throttleNonCritical: boolean;
  reason: string;
}

export interface SystemStateSnapshot {
  snapshotTimestampMs: string | number;
  nodes: ServiceNodeStatus[];
  activeRoutes: RouteWeightUpdate[];
  summary?: {
    globalMaxCascadeProbability: number;
    activeAnomaliesCount: number;
    activeFaultsCount: number;
    nodeCount: number;
    routeCount: number;
  };
}

export interface ServiceNodeDb {
  id: string;
  service_name: string;
  tier: string;
  base_url: string;
  max_thread_pool: number;
  slo_p99_ms: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceEdgeDb {
  id: number;
  source_service_id: string;
  target_service_id: string;
  protocol: string;
  primary_weight_pct: number;
  canary_weight_pct: number;
  cold_replica_weight_pct: number;
  circuit_state: CircuitState;
  created_at: string;
  updated_at: string;
}

export interface AuditLedgerDb {
  sequence_id: number;
  event_id: string;
  timestamp_utc: string;
  service_id: string;
  action_type: string;
  trigger_source: string;
  cascade_probability: number;
  payload_json: string | Record<string, unknown>;
  prev_hash: string;
  curr_hash: string;
}

export interface AuditChainIntegrityReport {
  isIntact: boolean;
  verifiedCount: number;
  genesisHash: string;
  headHash: string;
  brokenAtSequenceId: number | null;
  message: string;
  verifiedAt: string;
}

export interface RemediationAlertEvent {
  eventId: string;
  serviceId: string;
  action: RecommendedAction | string;
  triggerSource: "AUTONOMOUS_AI" | "MANUAL_OVERRIDE" | "CHAOS_INJECTOR";
  cascadeProbability: number;
  rootCause: RootCauseMetric | string;
  timestamp: string;
  description: string;
  details?: Record<string, unknown>;
}

export interface TelemetryHistoryPoint {
  timestamp: number;
  p99LatencyMs: number;
  p95LatencyMs: number;
  heapUsedMb: number;
  heapMaxMb: number;
  cpuJitterPct: number;
  threadPoolSaturationPct: number;
  errorRatePct: number;
}
