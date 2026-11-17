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
  const [selectedEdgeIndex, setSelectedEdgeIndex] = useState<number>(1);
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
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col select-none shadow-xs font-sans">
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
        <div className="flex items-center p-1 bg-slate-100 rounded-lg space-x-1">
          <button
            onClick={() => setActiveTab("chaos")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer ${
              activeTab === "chaos"
                ? "bg-white text-slate-900 font-semibold shadow-xs"
                : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
          >
            <Flame className={`w-3.5 h-3.5 ${activeTab === "chaos" ? "text-amber-600" : "text-slate-500"}`} />
            <span>Chaos Engine</span>
            {activeFaults.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-red-600 text-[10px] text-white font-bold rounded-full animate-pulse">
                {activeFaults.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("routes")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-xs transition-all cursor-pointer ${
              activeTab === "routes"
                ? "bg-white text-slate-900 font-semibold shadow-xs"
                : "text-slate-600 hover:text-slate-900 font-medium"
            }`}
          >
            <Sliders className={`w-3.5 h-3.5 ${activeTab === "routes" ? "text-blue-600" : "text-slate-500"}`} />
            <span>Route Weights</span>
          </button>
        </div>

        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Control Deck
        </span>
      </div>

      {/* Tab 1: Synthetic Chaos Fault Injector */}
      {activeTab === "chaos" && (
        <div className="space-y-3.5 flex flex-col">
          {/* Active Chaos Countdown Card */}
          {activeFaults.length > 0 && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1.5 text-xs font-bold text-red-900">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600"></span>
                  </span>
                  <span className="tracking-wide">ACTIVE FAULT</span>
                </span>
                <span className="flex items-center space-x-1 text-xs font-mono font-bold text-red-800 bg-white px-2 py-0.5 rounded border border-red-200 shadow-xs">
                  <Timer className="w-3.5 h-3.5 text-red-600 animate-spin" />
                  <span>{activeFaults[0].remainingSeconds}s REMAINING</span>
                </span>
              </div>

              {activeFaults.map((f, idx) => {
                const totalSec = f.durationSeconds || 30;
                const pctRemaining = Math.max(0, Math.min(100, Math.round((f.remainingSeconds / totalSec) * 100)));
                return (
                  <div
                    key={`${f.serviceId}-${idx}`}
                    className="bg-white p-2.5 rounded-lg border border-red-200 text-xs space-y-2 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900 text-xs uppercase">{f.serviceId}</span>
                        <span className="text-[11px] text-red-700 font-medium">
                          {f.faultType} ({f.intensityPct}%)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-900 font-mono font-bold text-base">
                          {f.remainingSeconds}s
                        </span>
                        <button
                          type="button"
                          onClick={() => onResetService(f.serviceId)}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:scale-95 text-white text-[10px] font-bold rounded uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                          title="Halt fault injection and heal container"
                        >
                          STOP
                        </button>
                      </div>
                    </div>

                    {/* Live Progress Bar */}
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500 transition-all duration-1000 ease-linear rounded-full"
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
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1 tracking-wider">
                Target Microservice
              </label>
              <select
                value={targetServiceId}
                onChange={(e) => setTargetServiceId(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {nodes.map((node) => (
                  <option key={node.id} value={node.id} className="text-slate-900">
                    {node.id.toUpperCase()} ({node.service_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Fault Type Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1 tracking-wider">
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
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] text-left transition-all border cursor-pointer font-medium ${
                      faultType === f.id
                        ? "bg-blue-50 text-blue-700 border-blue-400 font-semibold shadow-xs"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-medium text-slate-600 mb-1">
                <span>Intensity / Concurrency</span>
                <span className="text-slate-900 font-mono font-bold">{intensityPct}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={intensityPct}
                onChange={(e) => setIntensityPct(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Duration Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-medium text-slate-600 mb-1">
                <span>Duration (Seconds)</span>
                <span className="text-slate-900 font-mono font-bold">{durationSeconds}s</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex space-x-2">
            <button
              type="button"
              onClick={handleInjectFault}
              disabled={isInjecting}
              className="flex-1 flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-semibold py-2.5 px-4 rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{isInjecting ? "Injecting Fault..." : "⚡ Inject Fault"}</span>
            </button>

            <button
              type="button"
              onClick={handleResetTarget}
              title={`Recycle ${targetServiceId} and normalize circuit breaker`}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 transition-all flex items-center justify-center cursor-pointer"
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
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1 tracking-wider">
                Directed Mesh Edge
              </label>
              <select
                value={selectedEdgeIndex}
                onChange={(e) => setSelectedEdgeIndex(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {edges.map((edge, idx) => (
                  <option key={edge.id || idx} value={idx} className="text-slate-900">
                    {edge.source_service_id.toUpperCase()} ➔ {edge.target_service_id.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary Weight Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-medium text-slate-600 mb-1">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  <span>Primary Weight</span>
                </span>
                <span className="text-slate-900 font-mono font-bold">{primaryWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={primaryWeight}
                onChange={(e) => handlePrimaryChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
            </div>

            {/* Cold Replica Weight Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-medium text-slate-600 mb-1">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-amber-600"></span>
                  <span>Cold Replica Reroute</span>
                </span>
                <span className="text-amber-700 font-mono font-bold">{coldReplicaWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={coldReplicaWeight}
                onChange={(e) => handleColdReplicaChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
              />
            </div>

            {/* Non-Critical Traffic Throttle Toggle */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-medium text-slate-700">
                Throttle Non-Critical
              </span>
              <button
                type="button"
                onClick={() => setThrottleNonCritical(!throttleNonCritical)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer ${
                  throttleNonCritical ? "bg-blue-600" : "bg-slate-200"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    throttleNonCritical ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={handleApplyWeights}
              disabled={isApplyingRoute}
              className="w-full flex items-center justify-center space-x-1.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-semibold py-2 rounded-lg transition-all disabled:opacity-50 uppercase tracking-wider cursor-pointer shadow-xs"
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
          className={`mt-3 px-2.5 py-1.5 rounded-lg text-xs flex items-center space-x-1.5 ${
            statusMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
          )}
          <span className="truncate font-medium">{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};
