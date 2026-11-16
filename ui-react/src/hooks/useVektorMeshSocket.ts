import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  SystemStateSnapshot,
  ServiceNodeDb,
  ServiceEdgeDb,
  AuditLedgerDb,
  AuditChainIntegrityReport,
  RemediationAlertEvent,
  TelemetryHistoryPoint,
  FaultType
} from "../types/mesh";

const MAX_HISTORY_POINTS = 60;
const MAX_ALERTS = 25;

export interface UseVektorMeshSocketReturn {
  connected: boolean;
  engineConnected: boolean;
  topology: { nodes: ServiceNodeDb[]; edges: ServiceEdgeDb[] };
  snapshot: SystemStateSnapshot | null;
  recentAudits: AuditLedgerDb[];
  auditIntegrityReport: AuditChainIntegrityReport | null;
  alerts: RemediationAlertEvent[];
  telemetryHistory: Map<string, TelemetryHistoryPoint[]>;
  selectedNodeId: string | null;
  isVerifyingAudit: boolean;
  setSelectedNodeId: (nodeId: string | null) => void;
  injectChaosFault: (
    targetServiceId: string,
    faultType: FaultType,
    intensityPct: number,
    durationSeconds: number
  ) => Promise<{ success: boolean; message?: string }>;
  overrideRouteWeights: (
    sourceServiceId: string,
    targetServiceId: string,
    primaryWeightPct: number,
    canaryWeightPct: number,
    coldReplicaWeightPct: number,
    throttleNonCritical?: boolean,
    reason?: string
  ) => Promise<{ success: boolean; message?: string }>;
  resetServiceNode: (serviceId: string) => Promise<{ success: boolean; message?: string }>;
  verifyAuditLedger: () => Promise<AuditChainIntegrityReport>;
  fetchServiceDiagnostics: (serviceId: string) => Promise<any>;
  dismissAlert: (eventId: string) => void;
  clearAlerts: () => void;
}

export function useVektorMeshSocket(): UseVektorMeshSocketReturn {
  const [connected, setConnected] = useState<boolean>(false);
  const [engineConnected, setEngineConnected] = useState<boolean>(false);
  const [topology, setTopology] = useState<{ nodes: ServiceNodeDb[]; edges: ServiceEdgeDb[] }>({
    nodes: [],
    edges: []
  });
  const [snapshot, setSnapshot] = useState<SystemStateSnapshot | null>(null);
  const [recentAudits, setRecentAudits] = useState<AuditLedgerDb[]>([]);
  const [auditIntegrityReport, setAuditIntegrityReport] = useState<AuditChainIntegrityReport | null>(null);
  const [alerts, setAlerts] = useState<RemediationAlertEvent[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("order-processor");
  const [isVerifyingAudit, setIsVerifyingAudit] = useState<boolean>(false);

  // Map of serviceId -> rolling TelemetryHistoryPoint[]
  const telemetryHistoryRef = useRef<Map<string, TelemetryHistoryPoint[]>>(new Map());
  const [, setHistoryRenderTrigger] = useState<number>(0);

  const socketRef = useRef<Socket | null>(null);

  // --------------------------------------------------------------------------
  // Socket.io Connection & Event Subscriptions
  // --------------------------------------------------------------------------
  useEffect(() => {
    // Relative URL connects via Vite dev proxy or Nginx in production
    const socket: Socket = io({
      transports: ["websocket", "polling"],
      reconnectionAttempts: 15,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("mesh:request_refresh");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setEngineConnected(false);
    });

    socket.on("connect_error", () => {
      setConnected(false);
    });

    // 1. Initial State Handshake
    socket.on("mesh:initial_state", (payload: any) => {
      if (payload.topology) {
        setTopology(payload.topology);
      }
      if (payload.snapshot) {
        setSnapshot(payload.snapshot);
        recordSnapshotHistory(payload.snapshot);
      }
      if (payload.recentAudits) {
        setRecentAudits(payload.recentAudits);
      }
      if (typeof payload.engineConnected === "boolean") {
        setEngineConnected(payload.engineConnected);
      }
    });

    // 2. High-Frequency Live State Updates
    socket.on("mesh:state_snapshot", (updatedSnapshot: SystemStateSnapshot) => {
      setSnapshot(updatedSnapshot);
      setEngineConnected(true);
      recordSnapshotHistory(updatedSnapshot);
    });

    // 3. Autonomous Remediation & Alert Stream
    socket.on("mesh:remediation_alert", (alert: RemediationAlertEvent) => {
      setAlerts((prev) => [alert, ...prev.slice(0, MAX_ALERTS - 1)]);
    });

    // 4. Engine Connectivity Status
    socket.on("mesh:engine_status", (status: { connected: boolean }) => {
      setEngineConnected(status.connected);
    });

    // 5. Audit Feed Update or Reset
    socket.on("mesh:chaos_injected", (data: any) => {
      setAlerts((prev) => [
        {
          eventId: `chaos-${Date.now()}`,
          serviceId: data.serviceId || data.targetServiceId,
          action: "CHAOS_INJECTION",
          triggerSource: "CHAOS_INJECTOR",
          cascadeProbability: (data.intensityPct || 50) / 100,
          rootCause: data.faultType || "NONE",
          timestamp: new Date().toISOString(),
          description: `Synthetic fault ${data.faultType} injected with ${data.intensityPct}% intensity for ${data.durationSeconds}s`
        },
        ...prev.slice(0, MAX_ALERTS - 1)
      ]);
    });

    // Fetch initial REST fallback in case socket handshake is delayed
    fetchFallbackTopology();

    return () => {
      socket.disconnect();
    };
  }, []);

  // Record rolling telemetry history per node
  const recordSnapshotHistory = (snap: SystemStateSnapshot) => {
    if (!snap.nodes) return;
    const now = Date.now();
    let hasUpdates = false;

    for (const node of snap.nodes) {
      if (!node.latestTelemetry) continue;
      const t = node.latestTelemetry;
      const history = telemetryHistoryRef.current.get(node.serviceId) || [];

      const point: TelemetryHistoryPoint = {
        timestamp: now,
        p99LatencyMs: t.p99LatencyMs || 0,
        p95LatencyMs: t.p95LatencyMs || 0,
        heapUsedMb: t.heapUsedMb || 0,
        heapMaxMb: t.heapMaxMb || 1024,
        cpuJitterPct: t.cpuJitterPct || 0,
        threadPoolSaturationPct: t.threadPoolSaturationPct || 0,
        errorRatePct: t.errorRatePct || 0
      };

      const updatedHistory = [...history, point].slice(-MAX_HISTORY_POINTS);
      telemetryHistoryRef.current.set(node.serviceId, updatedHistory);
      hasUpdates = true;
    }

    if (hasUpdates) {
      setHistoryRenderTrigger(now);
    }
  };

  const fetchFallbackTopology = async () => {
    try {
      const topoRes = await fetch("/api/topology");
      if (topoRes.ok) {
        const data = await topoRes.json();
        setTopology({ nodes: data.nodes || [], edges: data.edges || [] });
      }
      const auditRes = await fetch("/api/audit?limit=20");
      if (auditRes.ok) {
        const data = await auditRes.json();
        setRecentAudits(data.entries || []);
      }
    } catch {
      // Handled quietly; socket will hydrate when online
    }
  };

  // --------------------------------------------------------------------------
  // Imperative Actions
  // --------------------------------------------------------------------------

  const injectChaosFault = useCallback(
    async (
      targetServiceId: string,
      faultType: FaultType,
      intensityPct: number,
      durationSeconds: number
    ): Promise<{ success: boolean; message?: string }> => {
      const payload = { targetServiceId, faultType, intensityPct, durationSeconds };

      try {
        // Direct REST execution for sub-15ms guaranteed response
        const res = await fetch("/api/chaos/inject", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        // Also emit over socket if connected for broadcast synchronization
        if (socketRef.current?.connected) {
          socketRef.current.emit("control:inject_chaos", payload);
        }

        return {
          success: res.ok && data.success !== false,
          message: data.message || (res.ok ? "Fault injection dispatched" : "Failed to inject fault")
        };
      } catch (e: any) {
        // Fallback over socket if fetch encountered a network partition
        if (socketRef.current?.connected) {
          return new Promise((resolve) => {
            socketRef.current?.emit("control:inject_chaos", payload, (res: any) => {
              resolve(res || { success: true });
            });
            setTimeout(() => resolve({ success: true, message: "Fault dispatched via socket" }), 1000);
          });
        }
        return { success: false, message: e.message || "Network error during chaos injection" };
      }
    },
    []
  );

  const overrideRouteWeights = useCallback(
    async (
      sourceServiceId: string,
      targetServiceId: string,
      primaryWeightPct: number,
      canaryWeightPct: number,
      coldReplicaWeightPct: number,
      throttleNonCritical: boolean = false,
      reason: string = "Operator manual override"
    ): Promise<{ success: boolean; message?: string }> => {
      const payload = {
        sourceServiceId,
        targetServiceId,
        primaryWeightPct,
        canaryWeightPct,
        coldReplicaWeightPct,
        throttleNonCritical,
        reason
      };

      if (socketRef.current?.connected) {
        return new Promise((resolve) => {
          socketRef.current?.emit("control:override_weights", payload, (res: any) => {
            if (res && res.success) {
              resolve({ success: true, message: res.message });
            } else {
              fallbackRestWeights(payload).then(resolve);
            }
          });
          setTimeout(() => fallbackRestWeights(payload).then(resolve), 2000);
        });
      } else {
        return fallbackRestWeights(payload);
      }
    },
    []
  );

  const fallbackRestWeights = async (payload: any) => {
    try {
      const res = await fetch("/api/control/weights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      return { success: res.ok, message: data.message || data.error };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  };

  const resetServiceNode = useCallback(
    async (serviceId: string): Promise<{ success: boolean; message?: string }> => {
      try {
        const res = await fetch(`/api/control/reset/${serviceId}`, {
          method: "POST"
        });
        const data = await res.json();
        if (socketRef.current?.connected) {
          socketRef.current.emit("control:reset_node", { serviceId });
        }
        return { success: res.ok, message: data.message || "Reset request dispatched" };
      } catch (e: any) {
        return { success: false, message: e.message };
      }
    },
    []
  );

  const verifyAuditLedger = useCallback(async (): Promise<AuditChainIntegrityReport> => {
    setIsVerifyingAudit(true);
    try {
      const res = await fetch("/api/audit/verify");
      const report: AuditChainIntegrityReport = await res.json();
      setAuditIntegrityReport(report);

      // Also refresh recent ledger rows
      const listRes = await fetch("/api/audit?limit=25");
      if (listRes.ok) {
        const listData = await listRes.json();
        setRecentAudits(listData.entries || []);
      }

      return report;
    } catch (err: any) {
      const failedReport: AuditChainIntegrityReport = {
        isIntact: false,
        verifiedCount: 0,
        genesisHash: "",
        headHash: "",
        brokenAtSequenceId: null,
        message: `Verification network failure: ${err.message}`,
        verifiedAt: new Date().toISOString()
      };
      setAuditIntegrityReport(failedReport);
      return failedReport;
    } finally {
      setIsVerifyingAudit(false);
    }
  }, []);

  const fetchServiceDiagnostics = useCallback(async (serviceId: string): Promise<any> => {
    try {
      const res = await fetch(`/api/diagnostics/${serviceId}`);
      if (res.ok) {
        return await res.json();
      }
      return null;
    } catch {
      return null;
    }
  }, []);

  const dismissAlert = useCallback((eventId: string) => {
    setAlerts((prev) => prev.filter((a) => a.eventId !== eventId));
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    connected,
    engineConnected,
    topology,
    snapshot,
    recentAudits,
    auditIntegrityReport,
    alerts,
    telemetryHistory: telemetryHistoryRef.current,
    selectedNodeId,
    isVerifyingAudit,
    setSelectedNodeId,
    injectChaosFault,
    overrideRouteWeights,
    resetServiceNode,
    verifyAuditLedger,
    fetchServiceDiagnostics,
    dismissAlert,
    clearAlerts
  };
}
