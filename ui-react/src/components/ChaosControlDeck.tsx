import React, { useState } from "react";
import {
  Flame,
  RotateCcw,
  Sliders,
  AlertTriangle,
  Send,
  CheckCircle2,
  Zap,
  Timer
} from "lucide-react";
import {
  FaultType,
  ServiceNodeDb,
  ServiceEdgeDb,
  SystemStateSnapshot
} from "../types/mesh";

interface ChaosControlDeckProps {
  nodes: ServiceNodeDb[];
  edges: ServiceEdgeDb[];
  snapshot?: SystemStateSnapshot | null;
  onInjectChaos: (
    targetServiceId: string,
    faultType: FaultType,
    intensityPct: number,
    durationSeconds: number
  ) => Promise<{ success: boolean; message?: string }>;
  onOverrideWeights: (
    sourceServiceId: string,
    targetServiceId: string,
    primaryWeightPct: number,
    canaryWeightPct: number,
    coldReplicaWeightPct: number,
    throttleNonCritical?: boolean,
    reason?: string
  ) => Promise<{ success: boolean; message?: string }>;
  onResetService: (serviceId: string) => Promise<{ success: boolean; message?: string }>;
}

export const ChaosControlDeck: React.FC<ChaosControlDeckProps> = ({
  nodes,
  edges,
  snapshot,
  onInjectChaos,
  onOverrideWeights,
  onResetService
}) => {
  const [activeTab, setActiveTab] = useState<"chaos" | "routes">("chaos");

  // Chaos form state
  const [targetServiceId, setTargetServiceId] = useState<string>("order-processor");
  const [faultType, setFaultType] = useState<FaultType>("MEMORY_BLEED");
  const [intensityPct, setIntensityPct] = useState<number>(75);
  const [durationSeconds, setDurationSeconds] = useState<number>(30);
  const [isInjecting, setIsInjecting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);

  // Route Override form state
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number>(1); // default order-processor
  const [primaryWeight, setPrimaryWeight] = useState<number>(100);
  const [canaryWeight, setCanaryWeight] = useState<number>(0);
  const [coldReplicaWeight, setColdReplicaWeight] = useState<number>(0);
  const [throttleNonCritical, setThrottleNonCritical] = useState<boolean>(false);
  const [isApplyingRoute, setIsApplyingRoute] = useState<boolean>(false);

  // Collect all active faults across all services from real-time snapshot
  const activeFaults = (snapshot?.nodes || []).flatMap((node) =>
    (node.activeFaults || []).map((fault) => ({
      serviceId: node.serviceId,
      serviceName: node.serviceName || node.serviceId,
      ...fault
    }))
  );

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------
  const handleInjectFault = async () => {
    setIsInjecting(true);
    setStatusMessage(null);

    try {
      const result = await onInjectChaos(
        targetServiceId,
        faultType,
        intensityPct,
        durationSeconds
      );

      if (result.success) {
        setStatusMessage({
          text: `Injected ${faultType} on ${targetServiceId} (${durationSeconds}s)`,
          type: "success"
        });
      } else {
        setStatusMessage({
          text: result.message || "Failed to inject fault",
          type: "error"
        });
      }
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || "Failed to inject fault",
        type: "error"
      });
    } finally {
      setIsInjecting(false);
    }

    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleResetTarget = async () => {
    setStatusMessage(null);
    const result = await onResetService(targetServiceId);
    if (result.success) {
      setStatusMessage({
        text: `Emergency self-healing reset triggered for ${targetServiceId}`,
        type: "success"
      });
    } else {
      setStatusMessage({
        text: result.message || "Reset failed",
        type: "error"
      });
    }
    setTimeout(() => setStatusMessage(null), 5000);
  };

  const handleApplyWeights = async () => {
    const edge = edges[selectedEdgeIndex];
    if (!edge) return;

    setIsApplyingRoute(true);
    setStatusMessage(null);

    const result = await onOverrideWeights(
      edge.source_service_id,
      edge.target_service_id,
      primaryWeight,
      canaryWeight,
      coldReplicaWeight,
      throttleNonCritical,
      "Manual dashboard override"
    );

    setIsApplyingRoute(false);
    if (result.success) {
      setStatusMessage({
        text: `Weights updated for ${edge.source_service_id} -> ${edge.target_service_id}`,
        type: "success"
      });
    } else {
      setStatusMessage({
        text: result.message || "Failed to override weights",
        type: "error"
      });
    }
    setTimeout(() => setStatusMessage(null), 5000);
  };

  // Adjust route weights with balancing to ensure total <= 100
  const handlePrimaryChange = (val: number) => {
    setPrimaryWeight(val);
    const remaining = 100 - val;
    if (coldReplicaWeight + canaryWeight > remaining) {
      setColdReplicaWeight(Math.min(coldReplicaWeight, remaining));
      setCanaryWeight(Math.max(0, remaining - coldReplicaWeight));
    }
  };

  const handleColdReplicaChange = (val: number) => {
    setColdReplicaWeight(val);
    const remaining = 100 - val;
    if (primaryWeight + canaryWeight > remaining) {
      setPrimaryWeight(Math.min(primaryWeight, remaining));
      setCanaryWeight(Math.max(0, remaining - primaryWeight));
    }
  };

  return (
    <div className="bg-[#12151E] border border-[#23293B] rounded-lg p-4 flex flex-col select-none">
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-[#23293B] pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab("chaos")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer ${
              activeTab === "chaos"
                ? "bg-red-500/20 text-red-400 border border-red-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Chaos Engine</span>
            {activeFaults.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-red-600 text-[10px] text-white font-bold rounded-full animate-pulse">
                {activeFaults.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("routes")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-mono transition-colors cursor-pointer ${
              activeTab === "routes"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Route Weights</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-mono uppercase tracking-wider">
          Control Deck
        </span>
      </div>

      {/* Tab 1: Synthetic Chaos Fault Injector */}
      {activeTab === "chaos" && (
        <div className="space-y-3.5 flex flex-col">
          {/* Active Chaos Countdown Card */}
          {activeFaults.length > 0 && (
            <div className="p-3 rounded-lg bg-red-950/40 border border-red-500/50 space-y-2.5 shadow-lg shadow-red-950/20">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1.5 text-xs font-mono font-bold text-red-400">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <span>ACTIVE CHAOS FAULT</span>
                </span>
                <span className="flex items-center space-x-1 text-xs font-mono font-bold text-amber-300 bg-red-900/60 px-2 py-0.5 rounded border border-red-700/50">
                  <Timer className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span>{activeFaults[0].remainingSeconds}s REMAINING</span>
                </span>
              </div>

              {activeFaults.map((f, idx) => {
                const totalSec = f.durationSeconds || 30;
                const pctRemaining = Math.max(0, Math.min(100, Math.round((f.remainingSeconds / totalSec) * 100)));
                return (
                  <div
                    key={`${f.serviceId}-${idx}`}
                    className="bg-[#090A0F]/90 p-2.5 rounded border border-red-500/30 text-xs font-mono space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-bold text-white text-xs">{f.serviceId}</span>
                        <span className="text-[10px] text-red-400">
                          {f.faultType} ({f.intensityPct}%)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-amber-400 font-extrabold text-base font-mono">
                          {f.remainingSeconds}s
                        </span>
                        <button
                          type="button"
                          onClick={() => onResetService(f.serviceId)}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-500 active:scale-95 text-white text-[10px] font-bold rounded uppercase tracking-wider transition-all cursor-pointer shadow"
                          title="Halt fault injection and heal container"
                        >
                          STOP
                        </button>
                      </div>
                    </div>

                    {/* Live Progress Bar */}
                    <div className="w-full h-1.5 bg-[#1A202C] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-500 to-amber-400 transition-all duration-1000 ease-linear rounded-full"
                        style={{ width: `${pctRemaining}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            {/* Target Node Selector */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                Target Microservice
              </label>
              <select
                value={targetServiceId}
                onChange={(e) => setTargetServiceId(e.target.value)}
                className="w-full bg-[#090A0F] border border-[#23293B] rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-red-500/50 cursor-pointer"
              >
                {nodes.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.id} ({node.service_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Fault Type Selector */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                Synthetic Fault Pattern
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: "MEMORY_BLEED", label: "Memory Bleed (+32MB/s)" },
                  { id: "SOCKET_EXHAUSTION", label: "DB Pool Exhaustion" },
                  { id: "LATENCY_SPIKE", label: "Latency Spike (+400ms)" },
                  { id: "CORRUPT_PAYLOAD", label: "Corrupt Payload" }
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFaultType(f.id as FaultType)}
                    className={`px-2 py-1.5 rounded text-[11px] font-mono text-left transition-all border cursor-pointer ${
                      faultType === f.id
                        ? "bg-red-500/20 text-red-300 border-red-500/60 shadow-sm"
                        : "bg-[#090A0F] text-slate-400 border-[#23293B] hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-1">
                <span>Intensity / Concurrency</span>
                <span className="text-red-400 font-bold">{intensityPct}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={intensityPct}
                onChange={(e) => setIntensityPct(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-[#090A0F] rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>

            {/* Duration Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-1">
                <span>Duration (Seconds)</span>
                <span className="text-amber-400 font-bold">{durationSeconds}s</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-[#090A0F] rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#23293B] flex space-x-2">
            <button
              type="button"
              onClick={handleInjectFault}
              disabled={isInjecting}
              className="flex-1 flex items-center justify-center space-x-2 bg-red-600 hover:bg-red-500 active:scale-[0.98] text-white text-xs font-mono font-bold py-2.5 px-4 rounded transition-all cursor-pointer shadow-md shadow-red-950/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>{isInjecting ? "Injecting Fault..." : "⚡ Inject Fault"}</span>
            </button>

            <button
              type="button"
              onClick={handleResetTarget}
              title={`Recycle ${targetServiceId} and normalize circuit breaker`}
              className="px-3 py-2.5 bg-[#1A202C] hover:bg-[#2D3748] active:scale-95 text-slate-300 text-xs font-mono rounded border border-[#23293B] transition-all flex items-center justify-center cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Manual Route Weight Override */}
      {activeTab === "routes" && (
        <div className="space-y-3.5 flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            {/* Edge Selector */}
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                Directed Mesh Edge
              </label>
              <select
                value={selectedEdgeIndex}
                onChange={(e) => setSelectedEdgeIndex(parseInt(e.target.value, 10))}
                className="w-full bg-[#090A0F] border border-[#23293B] rounded px-2.5 py-1.5 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500/50"
              >
                {edges.map((edge, idx) => (
                  <option key={edge.id || idx} value={idx}>
                    {edge.source_service_id} ➔ {edge.target_service_id}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary Weight Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-1">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Primary Weight</span>
                </span>
                <span className="text-emerald-400 font-bold">{primaryWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={primaryWeight}
                onChange={(e) => handlePrimaryChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-[#090A0F] rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>

            {/* Cold Replica Weight Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-1">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>Cold Replica Reroute</span>
                </span>
                <span className="text-cyan-400 font-bold">{coldReplicaWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={coldReplicaWeight}
                onChange={(e) => handleColdReplicaChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-[#090A0F] rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>

            {/* Non-Critical Traffic Throttle Toggle */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-mono text-slate-400">
                Throttle Non-Critical
              </span>
              <button
                type="button"
                onClick={() => setThrottleNonCritical(!throttleNonCritical)}
                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors ${
                  throttleNonCritical ? "bg-amber-500" : "bg-slate-700"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    throttleNonCritical ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 border-t border-[#23293B]">
            <button
              onClick={handleApplyWeights}
              disabled={isApplyingRoute}
              className="w-full flex items-center justify-center space-x-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-mono font-medium py-2 rounded transition-colors disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isApplyingRoute ? "Updating..." : "Apply Route Weights"}</span>
            </button>
          </div>
        </div>
      )}

      {/* Status Feedback Toast */}
      {statusMessage && (
        <div
          className={`mt-3 px-2.5 py-1.5 rounded text-[11px] font-mono flex items-center space-x-1.5 ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
              : "bg-red-500/10 text-red-300 border border-red-500/30"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
          )}
          <span className="truncate">{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};
