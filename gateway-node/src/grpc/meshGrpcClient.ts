import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import * as path from "path";
import * as fs from "fs";
import pino from "pino";
import {
  SystemStateSnapshot,
  FaultInjectionRequest,
  RouteWeightUpdate,
  AnomalyVerdict,
  RemediationAck,
  RemediationAlertEvent,
  TelemetryFrame,
  CircuitState
} from "../types/mesh.types";

const logger = pino({
  name: "mesh-grpc-client",
  level: process.env.LOG_LEVEL || "info"
});

export class MeshGrpcClientManager {
  private static instance: MeshGrpcClientManager;

  private meshControlClient: any;
  private inferenceClient: any;
  private protoPackage: any;

  private activeStream: grpc.ClientReadableStream<SystemStateSnapshot> | null = null;
  private latestSnapshot: SystemStateSnapshot | null = null;
  private isStreamConnected: boolean = false;

  // Reconnection backoff state
  private reconnectDelayMs: number = 500;
  private readonly maxReconnectDelayMs: number = 10000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Prior state cache for transition & alert detection
  private previousCircuitStates: Map<string, CircuitState> = new Map();
  private previousProbabilities: Map<string, number> = new Map();

  // Callbacks
  private snapshotListeners: Set<(snapshot: SystemStateSnapshot) => void> = new Set();
  private alertListeners: Set<(alert: RemediationAlertEvent) => void> = new Set();
  private statusListeners: Set<(status: { connected: boolean; retryingInMs?: number }) => void> = new Set();

  private constructor() {
    this.initClients();
  }

  public static getInstance(): MeshGrpcClientManager {
    if (!MeshGrpcClientManager.instance) {
      MeshGrpcClientManager.instance = new MeshGrpcClientManager();
    }
    return MeshGrpcClientManager.instance;
  }

  private resolveProtoPath(): string {
    if (process.env.PROTO_PATH && fs.existsSync(process.env.PROTO_PATH)) {
      return process.env.PROTO_PATH;
    }
    const candidates = [
      path.resolve(__dirname, "../../../proto/vektormesh.proto"),
      path.resolve(__dirname, "../../proto/vektormesh.proto"),
      path.resolve(process.cwd(), "../proto/vektormesh.proto"),
      path.resolve(process.cwd(), "proto/vektormesh.proto"),
      "/proto/vektormesh.proto"
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return candidates[0];
  }

  private initClients(): void {
    const protoPath = this.resolveProtoPath();

    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: false, // CamelCase mapping
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });

    this.protoPackage = grpc.loadPackageDefinition(packageDefinition) as any;
    const vektormeshV1 = this.protoPackage.vektormesh.v1;

    const javaHost = process.env.JAVA_GRPC_HOST || "127.0.0.1:9090";
    const pythonHost = process.env.PYTHON_GRPC_HOST || "127.0.0.1:50052";

    logger.info({ javaHost, pythonHost }, "Initializing gRPC channel stubs");

    this.meshControlClient = new vektormeshV1.MeshControlService(
      javaHost,
      grpc.credentials.createInsecure(),
      {
        "grpc.keepalive_time_ms": 15000,
        "grpc.keepalive_timeout_ms": 5000,
        "grpc.keepalive_permit_without_calls": 1
      }
    );

    this.inferenceClient = new vektormeshV1.AnomalyInferenceService(
      pythonHost,
      grpc.credentials.createInsecure(),
      {
        "grpc.keepalive_time_ms": 15000,
        "grpc.keepalive_timeout_ms": 5000
      }
    );
  }

  /**
   * Starts the persistent 1-to-N multiplexed gRPC subscription.
   * Single gRPC connection fans out to all connected WebSocket clients.
   */
  public startSystemStateStream(): void {
    if (this.activeStream) {
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    try {
      logger.info("Opening backend gRPC stream: MeshControlService.StreamSystemState()");
      const stream = this.meshControlClient.streamSystemState({});
      this.activeStream = stream;

      stream.on("data", (snapshot: SystemStateSnapshot) => {
        if (!this.isStreamConnected) {
          this.isStreamConnected = true;
          this.reconnectDelayMs = 500; // Reset backoff upon successful frame
          logger.info("Live gRPC telemetry stream successfully connected to Java Engine (:9090)");
          this.notifyStatusListeners({ connected: true });
        }

        this.latestSnapshot = snapshot;
        this.detectTransitionsAndAlert(snapshot);
        this.notifySnapshotListeners(snapshot);
      });

      stream.on("error", (err: grpc.ServiceError) => {
        logger.warn({ error: err.message, code: err.code }, "gRPC streamSystemState encountered error");
        this.handleStreamDisconnect();
      });

      stream.on("end", () => {
        logger.warn("gRPC streamSystemState ended by server");
        this.handleStreamDisconnect();
      });
    } catch (err: any) {
      logger.error({ error: err.message }, "Failed to initiate streamSystemState");
      this.handleStreamDisconnect();
    }
  }

  private handleStreamDisconnect(): void {
    if (this.activeStream) {
      this.activeStream.removeAllListeners();
      this.activeStream = null;
    }

    this.isStreamConnected = false;
    const retryIn = this.reconnectDelayMs;

    this.notifyStatusListeners({ connected: false, retryingInMs: retryIn });
    logger.info(`Scheduling gRPC auto-reconnection in ${retryIn}ms...`);

    // Exponential backoff with jitter
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 1.5, this.maxReconnectDelayMs);
      this.startSystemStateStream();
    }, retryIn);
  }

  /**
   * Detects state transitions (circuit breaker trips, autonomous remediations, active chaos)
   * and dispatches dedicated high-priority alerts.
   */
  private detectTransitionsAndAlert(snapshot: SystemStateSnapshot): void {
    if (!snapshot.nodes || !Array.isArray(snapshot.nodes)) return;

    for (const node of snapshot.nodes) {
      const prevCircuit = this.previousCircuitStates.get(node.serviceId);
      const prevProb = this.previousProbabilities.get(node.serviceId) || 0;

      // 1. Circuit Breaker Transition Alert
      if (prevCircuit && prevCircuit !== node.circuitState) {
        this.notifyAlertListeners({
          eventId: `cb-trans-${Date.now()}-${node.serviceId}`,
          serviceId: node.serviceId,
          action: node.circuitState === "OPEN" ? "OPEN_CIRCUIT" : "CIRCUIT_RESTORED",
          triggerSource: "AUTONOMOUS_AI",
          cascadeProbability: node.latestVerdict?.cascadeProbability || 0,
          rootCause: node.latestVerdict?.rootCauseMetric || "NONE",
          timestamp: new Date().toISOString(),
          description: `Circuit Breaker transitioned from ${prevCircuit} to ${node.circuitState}`,
          details: { circuitState: node.circuitState, routeWeights: node.currentRouteWeights }
        });
      }
      this.previousCircuitStates.set(node.serviceId, node.circuitState);

      // 2. Active Anomaly Remediation Alert
      if (node.latestVerdict && node.latestVerdict.recommendedAction !== "NO_OP") {
        const currProb = node.latestVerdict.cascadeProbability;
        // Emit alert if newly escalated
        if (currProb >= 0.70 && (currProb - prevProb > 0.10 || prevProb < 0.70)) {
          this.notifyAlertListeners({
            eventId: `remediation-${Date.now()}-${node.serviceId}`,
            serviceId: node.serviceId,
            action: node.latestVerdict.recommendedAction,
            triggerSource: "AUTONOMOUS_AI",
            cascadeProbability: currProb,
            rootCause: node.latestVerdict.rootCauseMetric,
            timestamp: new Date().toISOString(),
            description: `Autonomous remediation triggered: ${node.latestVerdict.recommendedAction} due to ${node.latestVerdict.rootCauseMetric} (p=${currProb.toFixed(3)})`,
            details: {
              ewmaZScore: node.latestVerdict.ewmaZScore,
              isolationForestScore: node.latestVerdict.isolationForestScore
            }
          });
        }
      }

      if (node.latestVerdict) {
        this.previousProbabilities.set(node.serviceId, node.latestVerdict.cascadeProbability);
      }
    }
  }

  // ============================================================================
  // Unary Control RPCs (Promisified)
  // ============================================================================

  public triggerChaosFault(req: FaultInjectionRequest): Promise<RemediationAck> {
    return new Promise((resolve, reject) => {
      this.meshControlClient.triggerChaosFault(req, (err: grpc.ServiceError | null, res: RemediationAck) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }

  public overrideRouteWeights(req: RouteWeightUpdate): Promise<RemediationAck> {
    return new Promise((resolve, reject) => {
      this.meshControlClient.overrideRouteWeights(req, (err: grpc.ServiceError | null, res: RemediationAck) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }

  public applyManualRemediation(verdict: AnomalyVerdict): Promise<RemediationAck> {
    return new Promise((resolve, reject) => {
      this.meshControlClient.applyRemediation(verdict, (err: grpc.ServiceError | null, res: RemediationAck) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }

  public evaluateSingleFrame(frame: TelemetryFrame): Promise<AnomalyVerdict> {
    return new Promise((resolve, reject) => {
      this.inferenceClient.evaluateSingleFrame(frame, (err: grpc.ServiceError | null, res: AnomalyVerdict) => {
        if (err) return reject(err);
        resolve(res);
      });
    });
  }

  // ============================================================================
  // Pub/Sub Subscription Management
  // ============================================================================

  public onSnapshot(callback: (snapshot: SystemStateSnapshot) => void): () => void {
    this.snapshotListeners.add(callback);
    return () => this.snapshotListeners.delete(callback);
  }

  public onAlert(callback: (alert: RemediationAlertEvent) => void): () => void {
    this.alertListeners.add(callback);
    return () => this.alertListeners.delete(callback);
  }

  public onStatus(callback: (status: { connected: boolean; retryingInMs?: number }) => void): () => void {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  private notifySnapshotListeners(snapshot: SystemStateSnapshot): void {
    for (const listener of this.snapshotListeners) {
      try {
        listener(snapshot);
      } catch (e) {
        logger.debug({ err: e }, "Error notifying snapshot listener");
      }
    }
  }

  private notifyAlertListeners(alert: RemediationAlertEvent): void {
    for (const listener of this.alertListeners) {
      try {
        listener(alert);
      } catch (e) {
        logger.debug({ err: e }, "Error notifying alert listener");
      }
    }
  }

  private notifyStatusListeners(status: { connected: boolean; retryingInMs?: number }): void {
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch (e) {
        logger.debug({ err: e }, "Error notifying status listener");
      }
    }
  }

  public getLatestSnapshot(): SystemStateSnapshot | null {
    return this.latestSnapshot;
  }

  public isConnected(): boolean {
    return this.isStreamConnected;
  }
}

export const meshGrpcClient = MeshGrpcClientManager.getInstance();
