import { z } from "zod";

// ============================================================================
// Protobuf Wire Contract Mirrors
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
  | "FAULT_TYPE_UNSPECIFIED"
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

export interface RouteWeightUpdate {
  sourceServiceId: string;
  targetServiceId: string;
  primaryWeightPct: number;
  canaryWeightPct: number;
  coldReplicaWeightPct: number;
  throttleNonCritical: boolean;
  reason: string;
}

export interface FaultInjectionRequest {
  targetServiceId: string;
  faultType: FaultType;
  intensityPct: number;
  durationSeconds: number;
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
  circuitState: CircuitState;
  currentRouteWeights: RouteWeights;
  activeFaults: ActiveFault[];
  latestTelemetry?: TelemetryFrame;
  latestVerdict?: AnomalyVerdict;
}

export interface SystemStateSnapshot {
  snapshotTimestampMs: string | number;
  nodes: ServiceNodeStatus[];
  activeRoutes: RouteWeightUpdate[];
}

export interface RemediationAck {
  success: boolean;
  remediationId: string;
  message: string;
  appliedAtMs: string | number;
}

// ============================================================================
// Enriched WebSocket Broadcast Events
// ============================================================================

export interface EnrichedNodeStatus extends ServiceNodeStatus {
  serviceName: string;
  tier: string;
  baseUrl: string;
  maxThreadPool: number;
  sloP99Ms: number;
  probabilityDelta: "RISING" | "FALLING" | "STABLE";
}

export interface MeshTopologyUpdateEvent {
  timestamp: number;
  nodes: EnrichedNodeStatus[];
  edges: RouteWeightUpdate[];
  globalMaxCascadeProbability: number;
  activeAnomaliesCount: number;
  activeFaultsCount: number;
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

// ============================================================================
// MySQL Relational DB Row Types
// ============================================================================

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

export interface SloRollupDb {
  id: number;
  service_id: string;
  window_start: string;
  avg_p99_ms: number;
  error_budget_burned_pct: number;
  anomalies_detected: number;
  created_at: string;
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

// ============================================================================
// Zod Request Validation Schemas
// ============================================================================

export const ChaosInjectSchema = z.object({
  targetServiceId: z.string().min(1, "targetServiceId is required"),
  faultType: z.enum([
    "LATENCY_SPIKE",
    "SOCKET_EXHAUSTION",
    "MEMORY_BLEED",
    "CORRUPT_PAYLOAD"
  ]),
  intensityPct: z.number().int().min(1).max(100),
  durationSeconds: z.number().int().min(5).max(3600)
});

export type ChaosInjectDto = z.infer<typeof ChaosInjectSchema>;

export const RouteOverrideSchema = z.object({
  sourceServiceId: z.string().min(1),
  targetServiceId: z.string().min(1),
  primaryWeightPct: z.number().min(0).max(100),
  canaryWeightPct: z.number().min(0).max(100),
  coldReplicaWeightPct: z.number().min(0).max(100),
  throttleNonCritical: z.boolean().default(false),
  reason: z.string().default("Operator manual override")
}).refine(
  (data) => data.primaryWeightPct + data.canaryWeightPct + data.coldReplicaWeightPct <= 100.01,
  { message: "Sum of route weights cannot exceed 100%" }
);

export type RouteOverrideDto = z.infer<typeof RouteOverrideSchema>;
