import { FastifyInstance } from "fastify";
import { Server as SocketIOServer, Socket } from "socket.io";
import pino from "pino";
import { meshGrpcClient } from "../grpc/meshGrpcClient";
import { auditRepository } from "../db/auditRepository";
import {
  ChaosInjectSchema,
  RouteOverrideSchema,
  SystemStateSnapshot,
  RemediationAlertEvent,
  ServiceNodeDb
} from "../types/mesh.types";

const logger = pino({
  name: "socket-hub",
  level: process.env.LOG_LEVEL || "info"
});

export class SocketHub {
  private static instance: SocketHub;
  private io: SocketIOServer | null = null;
  private nodeMetadataCache: Map<string, ServiceNodeDb> = new Map();

  private constructor() {}

  public static getInstance(): SocketHub {
    if (!SocketHub.instance) {
      SocketHub.instance = new SocketHub();
    }
    return SocketHub.instance;
  }

  /**
   * Initializes Socket.io attached to the Fastify HTTP server instance.
   */
  public initialize(fastify: FastifyInstance): SocketIOServer {
    if (this.io) {
      return this.io;
    }

    this.io = new SocketIOServer(fastify.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ["websocket", "polling"],
      pingInterval: 10000,
      pingTimeout: 5000
    });

    // Populate node metadata cache in background
    this.refreshNodeMetadata();

    this.setupSocketHandlers();
    this.setupGrpcEventListeners();

    logger.info("Socket.io Real-Time Event Hub initialized and attached to HTTP server");
    return this.io;
  }

  private async refreshNodeMetadata(): Promise<void> {
    try {
      const { nodes } = await auditRepository.getTopologyGraph();
      this.nodeMetadataCache.clear();
      for (const node of nodes) {
        this.nodeMetadataCache.set(node.id, node);
      }
      logger.info({ nodeCount: nodes.length }, "Node metadata cache refreshed for WebSocket enricher");
    } catch (err: any) {
      logger.warn({ err: err.message }, "Failed to refresh node metadata cache");
    }
  }

  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on("connection", (socket: Socket) => {
      logger.info({ socketId: socket.id, ip: socket.handshake.address }, "Dashboard client connected to WebSocket");

      // Join the standard topology watcher room
      socket.join("topology-watchers");

      // ------------------------------------------------------------------------
      // Interactive Client Event: Inject Chaos Fault (Synchronously Registered)
      // ------------------------------------------------------------------------
      socket.on("control:inject_chaos", async (payload: unknown, ack?: (res: any) => void) => {
        logger.info({ socketId: socket.id, payload }, "Received chaos injection event from client");

        const parsed = ChaosInjectSchema.safeParse(payload);
        if (!parsed.success) {
          const errRes = { success: false, error: parsed.error.issues };
          if (ack) ack(errRes);
          return socket.emit("control:error", errRes);
        }

        try {
          const result = await meshGrpcClient.triggerChaosFault({
            targetServiceId: parsed.data.targetServiceId,
            faultType: parsed.data.faultType,
            intensityPct: parsed.data.intensityPct,
            durationSeconds: parsed.data.durationSeconds
          });

          const successRes = {
            success: result.success,
            remediationId: result.remediationId,
            message: result.message,
            appliedAtMs: result.appliedAtMs
          };

          if (ack) ack(successRes);
          this.io?.to("topology-watchers").emit("mesh:chaos_injected", {
            serviceId: parsed.data.targetServiceId,
            faultType: parsed.data.faultType,
            intensityPct: parsed.data.intensityPct,
            durationSeconds: parsed.data.durationSeconds,
            timestamp: Date.now()
          });
        } catch (err: any) {
          logger.error({ err: err.message }, "Error triggering chaos fault via gRPC");
          const errorRes = { success: false, error: err.message || "Failed to trigger chaos fault" };
          if (ack) ack(errorRes);
          socket.emit("control:error", errorRes);
        }
      });

      // ------------------------------------------------------------------------
      // Interactive Client Event: Override Route Weights
      // ------------------------------------------------------------------------
      socket.on("control:override_weights", async (payload: unknown, ack?: (res: any) => void) => {
        logger.info({ socketId: socket.id, payload }, "Received route weight override event from client");

        const parsed = RouteOverrideSchema.safeParse(payload);
        if (!parsed.success) {
          const errRes = { success: false, error: parsed.error.issues };
          if (ack) ack(errRes);
          return socket.emit("control:error", errRes);
        }

        try {
          const result = await meshGrpcClient.overrideRouteWeights({
            sourceServiceId: parsed.data.sourceServiceId,
            targetServiceId: parsed.data.targetServiceId,
            primaryWeightPct: parsed.data.primaryWeightPct,
            canaryWeightPct: parsed.data.canaryWeightPct,
            coldReplicaWeightPct: parsed.data.coldReplicaWeightPct,
            throttleNonCritical: parsed.data.throttleNonCritical,
            reason: parsed.data.reason
          });

          const successRes = {
            success: result.success,
            remediationId: result.remediationId,
            message: result.message,
            appliedAtMs: result.appliedAtMs
          };

          if (ack) ack(successRes);
          this.io?.to("topology-watchers").emit("mesh:route_updated", {
            sourceServiceId: parsed.data.sourceServiceId,
            targetServiceId: parsed.data.targetServiceId,
            weights: {
              primary: parsed.data.primaryWeightPct,
              canary: parsed.data.canaryWeightPct,
              coldReplica: parsed.data.coldReplicaWeightPct
            },
            timestamp: Date.now()
          });
        } catch (err: any) {
          logger.error({ err: err.message }, "Error overriding route weights via gRPC");
          const errorRes = { success: false, error: err.message || "Failed to override route weights" };
          if (ack) ack(errorRes);
          socket.emit("control:error", errorRes);
        }
      });

      // ------------------------------------------------------------------------
      // Interactive Client Event: Request Refresh
      // ------------------------------------------------------------------------
      socket.on("mesh:request_refresh", async () => {
        await this.sendInitialState(socket);
      });

      socket.on("disconnect", (reason: string) => {
        logger.info({ socketId: socket.id, reason }, "Dashboard client disconnected from WebSocket");
      });

      // Deliver initial state snapshot in background AFTER listeners are attached
      this.sendInitialState(socket).catch((err) => {
        logger.error({ err: err.message }, "Failed to send initial state snapshot");
      });
    });
  }

  /**
   * Bundles full current topology, latest telemetry snapshot, and recent audit logs
   * into a single initial state packet.
   */
  private async sendInitialState(socket: Socket): Promise<void> {
    try {
      const topology = await auditRepository.getTopologyGraph();
      const recentAudits = await auditRepository.getAuditLedgerFeed(20);
      const snapshot = meshGrpcClient.getLatestSnapshot();
      const isEngineConnected = meshGrpcClient.isConnected();

      socket.emit("mesh:initial_state", {
        topology,
        snapshot,
        recentAudits,
        engineConnected: isEngineConnected,
        timestamp: Date.now()
      });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error assembling mesh:initial_state for client");
    }
  }

  /**
   * Binds gRPC stream callbacks to Socket.io 1-to-N fan-out broadcasts.
   */
  private setupGrpcEventListeners(): void {
    // 1. Broadcast high-frequency telemetry & state snapshot
    meshGrpcClient.onSnapshot((snapshot: SystemStateSnapshot) => {
      if (!this.io) return;

      const enrichedSnapshot = this.enrichSnapshot(snapshot);
      this.io.to("topology-watchers").emit("mesh:state_snapshot", enrichedSnapshot);
    });

    // 2. Broadcast high-priority remediation alerts
    meshGrpcClient.onAlert((alert: RemediationAlertEvent) => {
      if (!this.io) return;
      logger.warn({ alert }, "Broadcasting remediation alert to all dashboard clients");
      this.io.to("topology-watchers").emit("mesh:remediation_alert", alert);
    });

    // 3. Broadcast engine connectivity status changes
    meshGrpcClient.onStatus((status: { connected: boolean; retryingInMs?: number }) => {
      if (!this.io) return;
      this.io.to("topology-watchers").emit("mesh:engine_status", {
        ...status,
        timestamp: Date.now()
      });
    });
  }

  /**
   * Enriches a raw protobuf snapshot with summary metrics and metadata.
   */
  private enrichSnapshot(snapshot: SystemStateSnapshot): any {
    let globalMaxCascadeProbability = 0;
    let activeAnomaliesCount = 0;
    let activeFaultsCount = 0;

    const enrichedNodes = (snapshot.nodes || []).map((node) => {
      const meta = this.nodeMetadataCache.get(node.serviceId);
      const prob = node.latestVerdict?.cascadeProbability || 0;

      if (prob > globalMaxCascadeProbability) {
        globalMaxCascadeProbability = prob;
      }
      if (prob >= 0.70) {
        activeAnomaliesCount++;
      }
      if (node.activeFaults && node.activeFaults.length > 0) {
        activeFaultsCount += node.activeFaults.length;
      }

      return {
        ...node,
        serviceName: meta ? meta.service_name : node.serviceId,
        tier: meta ? meta.tier : "UNKNOWN",
        baseUrl: meta ? meta.base_url : "",
        sloP99Ms: meta ? meta.slo_p99_ms : 100.0,
        maxThreadPool: meta ? meta.max_thread_pool : 200
      };
    });

    return {
      snapshotTimestampMs: snapshot.snapshotTimestampMs || Date.now(),
      nodes: enrichedNodes,
      activeRoutes: snapshot.activeRoutes || [],
      summary: {
        globalMaxCascadeProbability: Math.round(globalMaxCascadeProbability * 1000) / 1000,
        activeAnomaliesCount,
        activeFaultsCount,
        nodeCount: enrichedNodes.length,
        routeCount: (snapshot.activeRoutes || []).length
      }
    };
  }

  public getIO(): SocketIOServer | null {
    return this.io;
  }
}

export const socketHub = SocketHub.getInstance();
