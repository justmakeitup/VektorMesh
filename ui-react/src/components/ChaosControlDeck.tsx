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
    <div className="bg-[#222B27] border border-[#116466]/50 rounded-lg p-4 flex flex-col select-none shadow-xl">
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-[#116466]/40 pb-3 mb-4">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setActiveTab("chaos")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-matrix transition-all cursor-pointer ${
              activeTab === "chaos"
                ? "bg-[#116466]/30 text-[#FFCB9A] border border-[#FFCB9A]/50 shadow-md shadow-[#116466]/20"
                : "text-[#D9B08C] hover:text-[#D1E8E2]"
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">Chaos Engine</span>
            {activeFaults.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-[#EF4444] text-[10px] text-white font-bold rounded-full animate-pulse font-matrix">
                {activeFaults.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("routes")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-matrix transition-all cursor-pointer ${
              activeTab === "routes"
                ? "bg-[#116466]/30 text-[#D1E8E2] border border-[#116466] shadow-md shadow-[#116466]/20"
                : "text-[#D9B08C] hover:text-[#D1E8E2]"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider">Route Weights</span>
          </button>
        </div>

        <span className="text-[11px] text-[#D9B08C] font-matrix uppercase tracking-widest matrix-title">
          // Control Deck
        </span>
      </div>

      {/* Tab 1: Synthetic Chaos Fault Injector */}
      {activeTab === "chaos" && (
        <div className="space-y-3.5 flex flex-col">
          {/* Active Chaos Countdown Card */}
          {activeFaults.length > 0 && (
            <div className="p-3 rounded-lg bg-[#2A2322] border border-[#EF4444]/60 space-y-2.5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="flex items-center space-x-1.5 text-xs font-matrix font-bold text-[#FFCB9A]">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#EF4444] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#EF4444]"></span>
                  </span>
                  <span className="tracking-wider">ACTIVE CHAOS FAULT</span>
                </span>
                <span className="flex items-center space-x-1 text-xs font-matrix font-bold text-[#FFCB9A] bg-[#222B27] px-2 py-0.5 rounded border border-[#EF4444]/50">
                  <Timer className="w-3.5 h-3.5 text-[#FFCB9A] animate-spin" />
                  <span>{activeFaults[0].remainingSeconds}s REMAINING</span>
                </span>
              </div>

              {activeFaults.map((f, idx) => {
                const totalSec = f.durationSeconds || 30;
                const pctRemaining = Math.max(0, Math.min(100, Math.round((f.remainingSeconds / totalSec) * 100)));
                return (
                  <div
                    key={`${f.serviceId}-${idx}`}
                    className="bg-[#1B221F] p-2.5 rounded border border-[#EF4444]/40 text-xs font-matrix space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="font-bold text-[#D1E8E2] text-xs uppercase">{f.serviceId}</span>
                        <span className="text-[10px] text-[#FFCB9A]">
                          {f.faultType} ({f.intensityPct}%)
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[#FFCB9A] font-extrabold text-base font-matrix">
                          {f.remainingSeconds}s
                        </span>
                        <button
                          type="button"
                          onClick={() => onResetService(f.serviceId)}
                          className="px-2.5 py-1 bg-[#EF4444] hover:bg-[#FF5A5F] active:scale-95 text-white text-[10px] font-bold rounded uppercase tracking-wider transition-all cursor-pointer shadow font-matrix"
                          title="Halt fault injection and heal container"
                        >
                          STOP
                        </button>
                      </div>
                    </div>

                    {/* Live Progress Bar */}
                    <div className="w-full h-1.5 bg-[#2C3531] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#EF4444] to-[#FFCB9A] transition-all duration-1000 ease-linear rounded-full"
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
              <label className="block text-[11px] font-matrix text-[#D9B08C] uppercase mb-1 tracking-wider">
                Target Microservice
              </label>
              <select
                value={targetServiceId}
                onChange={(e) => setTargetServiceId(e.target.value)}
                className="w-full bg-[#1B221F] border border-[#116466]/50 rounded px-2.5 py-1.5 text-xs text-[#D1E8E2] font-matrix focus:outline-none focus:border-[#FFCB9A] cursor-pointer"
              >
                {nodes.map((node) => (
                  <option key={node.id} value={node.id} className="bg-[#1B221F] text-[#D1E8E2]">
                    {node.id.toUpperCase()} ({node.service_name})
                  </option>
                ))}
              </select>
            </div>

            {/* Fault Type Selector */}
            <div>
              <label className="block text-[11px] font-matrix text-[#D9B08C] uppercase mb-1 tracking-wider">
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
                    className={`px-2 py-1.5 rounded text-[11px] font-matrix text-left transition-all border cursor-pointer ${
                      faultType === f.id
                        ? "bg-[#116466]/30 text-[#FFCB9A] border-[#FFCB9A]/60 shadow-sm"
                        : "bg-[#1B221F] text-[#D9B08C] border-[#116466]/40 hover:border-[#D9B08C] hover:text-[#D1E8E2]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-matrix text-[#D9B08C] mb-1 tracking-wide">
                <span>Intensity / Concurrency</span>
                <span className="text-[#FFCB9A] font-bold">{intensityPct}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                value={intensityPct}
                onChange={(e) => setIntensityPct(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-[#1B221F] rounded-lg appearance-none cursor-pointer accent-[#116466]"
              />
            </div>

            {/* Duration Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-matrix text-[#D9B08C] mb-1 tracking-wide">
                <span>Duration (Seconds)</span>
                <span className="text-[#FFCB9A] font-bold">{durationSeconds}s</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={durationSeconds}
                onChange={(e) => setDurationSeconds(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-[#1B221F] rounded-lg appearance-none cursor-pointer accent-[#FFCB9A]"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-[#116466]/40 flex space-x-2">
            <button
              type="button"
              onClick={handleInjectFault}
              disabled={isInjecting}
              className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-[#116466] to-[#178587] hover:from-[#178587] hover:to-[#FFCB9A] text-[#D1E8E2] hover:text-[#2C3531] text-xs font-matrix font-bold py-2.5 px-4 rounded transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>{isInjecting ? "Injecting Fault..." : "⚡ Inject Fault"}</span>
            </button>

            <button
              type="button"
              onClick={handleResetTarget}
              title={`Recycle ${targetServiceId} and normalize circuit breaker`}
              className="px-3 py-2.5 bg-[#1B221F] hover:bg-[#2C3531] active:scale-95 text-[#D9B08C] hover:text-[#FFCB9A] text-xs font-matrix rounded border border-[#116466]/50 transition-all flex items-center justify-center cursor-pointer"
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
              <label className="block text-[11px] font-matrix text-[#D9B08C] uppercase mb-1 tracking-wider">
                Directed Mesh Edge
              </label>
              <select
                value={selectedEdgeIndex}
                onChange={(e) => setSelectedEdgeIndex(parseInt(e.target.value, 10))}
                className="w-full bg-[#1B221F] border border-[#116466]/50 rounded px-2.5 py-1.5 text-xs text-[#D1E8E2] font-matrix focus:outline-none focus:border-[#FFCB9A]"
              >
                {edges.map((edge, idx) => (
                  <option key={edge.id || idx} value={idx} className="bg-[#1B221F] text-[#D1E8E2]">
                    {edge.source_service_id.toUpperCase()} ➔ {edge.target_service_id.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            {/* Primary Weight Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-matrix text-[#D9B08C] mb-1">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-[#D1E8E2]"></span>
                  <span className="tracking-wide">Primary Weight</span>
                </span>
                <span className="text-[#D1E8E2] font-bold">{primaryWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={primaryWeight}
                onChange={(e) => handlePrimaryChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-[#1B221F] rounded-lg appearance-none cursor-pointer accent-[#D1E8E2]"
              />
            </div>

            {/* Cold Replica Weight Slider */}
            <div>
              <div className="flex justify-between items-center text-[11px] font-matrix text-[#D9B08C] mb-1">
                <span className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-[#FFCB9A]"></span>
                  <span className="tracking-wide">Cold Replica Reroute</span>
                </span>
                <span className="text-[#FFCB9A] font-bold">{coldReplicaWeight}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={coldReplicaWeight}
                onChange={(e) => handleColdReplicaChange(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-[#1B221F] rounded-lg appearance-none cursor-pointer accent-[#FFCB9A]"
              />
            </div>

            {/* Non-Critical Traffic Throttle Toggle */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] font-matrix text-[#D9B08C] tracking-wide">
                Throttle Non-Critical
              </span>
              <button
                type="button"
                onClick={() => setThrottleNonCritical(!throttleNonCritical)}
                className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors cursor-pointer ${
                  throttleNonCritical ? "bg-[#FFCB9A]" : "bg-[#1B221F] border border-[#116466]/60"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-[#2C3531] transition-transform ${
                    throttleNonCritical ? "translate-x-4 bg-[#2C3531]" : "translate-x-1 bg-[#D9B08C]"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-2 border-t border-[#116466]/40">
            <button
              onClick={handleApplyWeights}
              disabled={isApplyingRoute}
              className="w-full flex items-center justify-center space-x-1.5 bg-[#116466] hover:bg-[#FFCB9A] hover:text-[#2C3531] text-[#D1E8E2] text-xs font-matrix font-medium py-2 rounded transition-all disabled:opacity-50 uppercase tracking-wider cursor-pointer"
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
          className={`mt-3 px-2.5 py-1.5 rounded text-[11px] font-matrix flex items-center space-x-1.5 ${
            statusMessage.type === "success"
              ? "bg-[#116466]/20 text-[#D1E8E2] border border-[#116466]"
              : "bg-[#2A2322] text-[#FFCB9A] border border-[#EF4444]"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-[#116466] shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444] shrink-0" />
          )}
          <span className="truncate">{statusMessage.text}</span>
        </div>
      )}
    </div>
  );
};
