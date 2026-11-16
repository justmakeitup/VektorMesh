import { FastifyInstance, FastifyPluginAsync } from "fastify";
import pino from "pino";
import { meshGrpcClient } from "../grpc/meshGrpcClient";
import { auditRepository } from "../db/auditRepository";
import { socketHub } from "../ws/socketHub";
import {
  ChaosInjectSchema,
  RouteOverrideSchema,
  FaultType,
  RecommendedAction,
  RootCauseMetric
} from "../types/mesh.types";

const logger = pino({
  name: "api-routes",
  level: process.env.LOG_LEVEL || "info"
});

export const apiRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const JAVA_REST_URL = process.env.JAVA_REST_URL || "http://localhost:8080";
  const PYTHON_REST_URL = process.env.PYTHON_REST_URL || "http://localhost:8000";

  // ============================================================================
  // 1. Health & Dependency Readiness
  // ============================================================================
  fastify.get("/health", async (request, reply) => {
    const isDbConnected = await auditRepository.ping();
    const isGrpcConnected = meshGrpcClient.isConnected();

    // Check Java REST connectivity
    let javaRestStatus = "DOWN";
    try {
      const res = await fetch(`${JAVA_REST_URL}/actuator/health`, {
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) javaRestStatus = "UP";
    } catch {
      javaRestStatus = "UNREACHABLE";
    }

    // Check Python REST connectivity
    let pythonRestStatus = "DOWN";
    let pythonInfo: Record<string, unknown> | null = null;
    try {
      const res = await fetch(`${PYTHON_REST_URL}/health`, {
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        pythonRestStatus = "UP";
        pythonInfo = (await res.json()) as Record<string, unknown>;
      }
    } catch {
      pythonRestStatus = "UNREACHABLE";
    }

    const overallHealthy = isDbConnected && (isGrpcConnected || javaRestStatus === "UP");

    return reply.status(overallHealthy ? 200 : 503).send({
      status: overallHealthy ? "HEALTHY" : "DEGRADED",
      service: "@vektormesh/gateway-node",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      components: {
        mysql: {
          status: isDbConnected ? "UP" : "DOWN"
        },
        javaEngineGrpc: {
          status: isGrpcConnected ? "CONNECTED" : "DISCONNECTED",
          host: process.env.JAVA_GRPC_HOST || "localhost:9090"
        },
        javaEngineRest: {
          status: javaRestStatus,
          url: JAVA_REST_URL
        },
        pythonInference: {
          status: pythonRestStatus,
          url: PYTHON_REST_URL,
          diagnostics: pythonInfo
        }
      }
    });
  });

  // ============================================================================
  // 2. Topology & Real-time Graph State
  // ============================================================================
  fastify.get("/topology", async (request, reply) => {
    try {
      const { nodes, edges } = await auditRepository.getTopologyGraph();
      const latestSnapshot = meshGrpcClient.getLatestSnapshot();

      // Augment relational nodes with live runtime state if available
      const augmentedNodes = nodes.map((dbNode) => {
        const liveStatus = latestSnapshot?.nodes?.find((n) => n.serviceId === dbNode.id);
        return {
          id: dbNode.id,
          serviceName: dbNode.service_name,
          tier: dbNode.tier,
          baseUrl: dbNode.base_url,
          maxThreadPool: dbNode.max_thread_pool,
          sloP99Ms: dbNode.slo_p99_ms,
          circuitState: liveStatus ? liveStatus.circuitState : "CLOSED",
          currentRouteWeights: liveStatus ? liveStatus.currentRouteWeights : {
            primaryWeightPct: 100,
            canaryWeightPct: 0,
            coldReplicaWeightPct: 0
          },
          latestTelemetry: liveStatus?.latestTelemetry || null,
          latestVerdict: liveStatus?.latestVerdict || null,
          activeFaults: liveStatus?.activeFaults || []
        };
      });

      return reply.send({
        nodes: augmentedNodes,
        edges,
        snapshotTimestampMs: latestSnapshot?.snapshotTimestampMs || Date.now(),
        engineConnected: meshGrpcClient.isConnected()
      });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error fetching topology");
      return reply.status(500).send({ error: "Failed to fetch topology" });
    }
  });

  // ============================================================================
  // 3. Cryptographic Audit Ledger & Chain Verification
  // ============================================================================
  fastify.get("/audit", async (request, reply) => {
    const query = request.query as { limit?: string; verify?: string };
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const shouldVerify = query.verify === "true" || query.verify === "1";

    try {
      const entries = await auditRepository.getAuditLedgerFeed(limit);
      let integrityReport = null;

      if (shouldVerify) {
        integrityReport = await auditRepository.verifyAuditChainIntegrity();
      }

      return reply.send({
        count: entries.length,
        entries,
        integrityReport
      });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error querying audit ledger");
      return reply.status(500).send({ error: "Failed to query audit ledger" });
    }
  });

  fastify.get("/audit/verify", async (request, reply) => {
    try {
      const report = await auditRepository.verifyAuditChainIntegrity();
      return reply.send(report);
    } catch (err: any) {
      logger.error({ err: err.message }, "Error verifying audit chain");
      return reply.status(500).send({ error: "Audit chain verification failed" });
    }
  });

  // ============================================================================
  // 4. SLO Compliance Rollups
  // ============================================================================
  fastify.get("/slo", async (request, reply) => {
    try {
      const rollups = await auditRepository.getSloComplianceSummary();
      return reply.send({
        count: rollups.length,
        rollups
      });
    } catch (err: any) {
      logger.error({ err: err.message }, "Error fetching SLO rollups");
      return reply.status(500).send({ error: "Failed to fetch SLO compliance" });
    }
  });

  // ============================================================================
  // 5. Chaos Fault Injection
  // ============================================================================
  fastify.post("/chaos/inject", async (request, reply) => {
    const parseResult = ChaosInjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation error",
        issues: parseResult.error.issues
      });
    }

    const { targetServiceId, faultType, intensityPct, durationSeconds } = parseResult.data;

    try {
      const ack = await meshGrpcClient.triggerChaosFault({
        targetServiceId,
        faultType: faultType as FaultType,
        intensityPct,
        durationSeconds
      });

      // Broadcast alert over WebSockets
      socketHub.getIO()?.to("topology-watchers").emit("mesh:chaos_injected", {
        targetServiceId,
        faultType,
        intensityPct,
        durationSeconds,
        timestamp: Date.now()
      });

      return reply.status(200).send({
        success: ack.success,
        remediationId: ack.remediationId,
        message: ack.message,
        appliedAtMs: ack.appliedAtMs
      });
    } catch (err: any) {
      logger.error({ err: err.message, body: request.body }, "Failed to inject chaos fault");
      return reply.status(502).send({
        error: "Failed to execute chaos injection on Java Engine",
        details: err.message
      });
    }
  });

  // ============================================================================
  // 6. Manual Route Weight Overrides
  // ============================================================================
  fastify.post("/control/weights", async (request, reply) => {
    const parseResult = RouteOverrideSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({
        error: "Validation error",
        issues: parseResult.error.issues
      });
    }

    const data = parseResult.data;

    try {
      const ack = await meshGrpcClient.overrideRouteWeights({
        sourceServiceId: data.sourceServiceId,
        targetServiceId: data.targetServiceId,
        primaryWeightPct: data.primaryWeightPct,
        canaryWeightPct: data.canaryWeightPct,
        coldReplicaWeightPct: data.coldReplicaWeightPct,
        throttleNonCritical: data.throttleNonCritical,
        reason: data.reason
      });

      // Broadcast update over WebSockets
      socketHub.getIO()?.to("topology-watchers").emit("mesh:route_updated", {
        sourceServiceId: data.sourceServiceId,
        targetServiceId: data.targetServiceId,
        weights: {
          primary: data.primaryWeightPct,
          canary: data.canaryWeightPct,
          coldReplica: data.coldReplicaWeightPct
        },
        timestamp: Date.now()
      });

      return reply.status(200).send({
        success: ack.success,
        remediationId: ack.remediationId,
        message: ack.message,
        appliedAtMs: ack.appliedAtMs
      });
    } catch (err: any) {
      logger.error({ err: err.message, body: request.body }, "Failed to override route weights");
      return reply.status(502).send({
        error: "Failed to apply route weights on Java Engine",
        details: err.message
      });
    }
  });

  // ============================================================================
  // 7. Node Reset & Self-Healing Trigger
  // ============================================================================
  fastify.post("/control/reset/:serviceId", async (request, reply) => {
    const { serviceId } = request.params as { serviceId: string };
    if (!serviceId) {
      return reply.status(400).send({ error: "serviceId is required" });
    }

    let resetSuccess = false;
    let message = "";

    // 1. First attempt direct reset via Java REST endpoint
    try {
      const response = await fetch(`${JAVA_REST_URL}/api/v1/control/reset/${serviceId}`, {
        method: "POST",
        signal: AbortSignal.timeout(3000)
      });
      if (response.ok) {
        const body = (await response.json()) as Record<string, unknown>;
        resetSuccess = true;
        message = (body.status as string) || "Reset complete via Java REST";
      }
    } catch (e: any) {
      logger.debug({ err: e.message }, "Java REST reset unreachable, falling back to gRPC");
    }

    // 2. If Java REST is down, fallback to gRPC applyRemediation with RESTART_CONTAINER
    if (!resetSuccess) {
      try {
        const ack = await meshGrpcClient.applyManualRemediation({
          serviceId,
          timestampMs: Date.now(),
          cascadeProbability: 1.0,
          ewmaZScore: 0,
          isolationForestScore: 0,
          rootCauseMetric: "NONE" as RootCauseMetric,
          recommendedAction: "RESTART_CONTAINER" as RecommendedAction
        });
        resetSuccess = ack.success;
        message = ack.message;
      } catch (err: any) {
        logger.error({ err: err.message }, "Both Java REST and gRPC reset failed");
        return reply.status(502).send({
          error: "Failed to reset service on Java Engine",
          details: err.message
        });
      }
    }

    return reply.status(200).send({
      success: resetSuccess,
      serviceId,
      status: "RESET_COMPLETE",
      message
    });
  });

  // ============================================================================
  // 8. Service Diagnostics Proxy & Cache
  // ============================================================================
  fastify.get("/diagnostics/:serviceId", async (request, reply) => {
    const { serviceId } = request.params as { serviceId: string };

    // 1. Try querying Python Anomaly Inference Engine
    try {
      const res = await fetch(`${PYTHON_REST_URL}/diagnostics/${serviceId}`, {
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        const diagnostics = await res.json();
        return reply.send(diagnostics);
      }
    } catch (e: any) {
      logger.debug({ err: e.message }, "Python inference diagnostics fetch failed");
    }

    // 2. Fallback: extract latest telemetry and verdict from local snapshot cache
    const snapshot = meshGrpcClient.getLatestSnapshot();
    const node = snapshot?.nodes?.find((n) => n.serviceId === serviceId);

    if (node) {
      return reply.send({
        service_id: serviceId,
        source: "gateway_snapshot_cache",
        circuit_state: node.circuitState,
        latest_telemetry: node.latestTelemetry || null,
        latest_verdict: node.latestVerdict || null,
        active_faults: node.activeFaults || []
      });
    }

    return reply.status(404).send({
      error: `No diagnostic or telemetry data found for service '${serviceId}'`
    });
  });
};
