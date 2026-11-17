import React from "react";
import {
  Activity,
  Cpu,
  Database,
  Layers,
  RotateCcw,
  ShieldAlert,
  X
} from "lucide-react";
import {
  ServiceNodeStatus,
  ServiceNodeDb,
  TelemetryHistoryPoint
} from "../types/mesh";

interface NodeInspectorDrawerProps {
  selectedNodeId: string | null;
  nodeDb?: ServiceNodeDb;
  nodeStatus?: ServiceNodeStatus;
  history: TelemetryHistoryPoint[];
  onClose: () => void;
  onResetNode: (serviceId: string) => Promise<{ success: boolean; message?: string }>;
}

export const NodeInspectorDrawer: React.FC<NodeInspectorDrawerProps> = ({
  selectedNodeId,
  nodeDb,
  nodeStatus,
  history,
  onClose,
  onResetNode
}) => {
  if (!selectedNodeId) return null;

  const t = nodeStatus?.latestTelemetry;
  const v = nodeStatus?.latestVerdict;
  const circuit = nodeStatus?.circuitState || "CLOSED";
  const prob = v?.cascadeProbability || 0;

  const handleReset = async () => {
    await onResetNode(selectedNodeId);
  };

  // Sparkline Generator for SVG
  const renderSparkline = (
    data: number[],
    color: string,
    width = 240,
    height = 42,
    threshold?: number
  ) => {
    if (data.length < 2) {
      return (
        <div className="w-full h-[42px] flex items-center justify-center text-[10px] text-[#D9B08C]/60 font-matrix">
          Accumulating rolling telemetry...
        </div>
      );
    }

    const min = 0;
    const max = Math.max(...data, threshold || 1, 10);
    const range = max - min;

    const points = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M ${points.join(" L ")}`;

    return (
      <svg width={width} height={height} className="w-full overflow-visible">
        <defs>
          <linearGradient id={`grad-${color.replace("#", "")}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {threshold && (
          <line
            x1="0"
            y1={height - ((threshold - min) / range) * (height - 6) - 3}
            x2={width}
            y2={height - ((threshold - min) / range) * (height - 6) - 3}
            stroke="#EF4444"
            strokeDasharray="3 3"
            strokeWidth="1"
            opacity="0.6"
          />
        )}

        <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  };

  const p99Series = history.map((h) => h.p99LatencyMs);
  const heapSeries = history.map((h) => h.heapUsedMb);
  const threadSeries = history.map((h) => h.threadPoolSaturationPct);

  return (
    <div className="bg-[#222B27] border border-[#116466]/50 rounded-lg p-4 flex flex-col h-full overflow-y-auto select-none shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[#116466]/40 pb-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2 py-0.5 rounded bg-[#116466]/30 text-[#D1E8E2] font-matrix font-semibold border border-[#116466]">
              {nodeDb?.tier || "CORE"}
            </span>
            <h3 className="font-matrix text-sm font-bold text-[#D1E8E2] tracking-wider uppercase matrix-title">
              {selectedNodeId}
            </h3>
          </div>
          <p className="text-[11px] text-[#D9B08C] font-futuristic mt-0.5">
            {nodeDb?.service_name || "Microservice Node"}
          </p>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleReset}
            title="Recycle Container & Normalize Circuit Breaker"
            className="p-1.5 rounded bg-[#1B221F] hover:bg-[#2C3531] text-[#D9B08C] hover:text-[#FFCB9A] border border-[#116466]/50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded bg-[#1B221F] hover:bg-[#2C3531] text-[#D9B08C] hover:text-[#D1E8E2] border border-[#116466]/50 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Circuit Breaker Status Banner */}
        <div className="flex items-center justify-between p-2.5 rounded bg-[#1B221F] border border-[#116466]/40">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                circuit === "CLOSED"
                  ? "bg-[#D1E8E2] shadow-sm shadow-[#D1E8E2]/60"
                  : circuit === "HALF_OPEN"
                  ? "bg-[#FFCB9A] shadow-sm shadow-[#FFCB9A]/60"
                  : "bg-[#EF4444] shadow-sm shadow-[#EF4444]/60"
              }`}
            />
            <span className="text-xs font-matrix text-[#D1E8E2] uppercase tracking-wider">Resilience4j Circuit</span>
          </div>
          <span
            className={`text-xs font-matrix font-bold px-2 py-0.5 rounded ${
              circuit === "CLOSED"
                ? "bg-[#116466]/30 text-[#D1E8E2] border border-[#116466]"
                : circuit === "HALF_OPEN"
                ? "bg-[#D9B08C]/30 text-[#FFCB9A] border border-[#D9B08C]"
                : "bg-[#EF4444]/20 text-[#EF4444] border border-[#EF4444]"
            }`}
          >
            {circuit}
          </span>
        </div>

        {/* Dual-Model AI Diagnostics Section */}
        <div className="space-y-2.5 p-3 rounded bg-[#1B221F] border border-[#116466]/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-matrix uppercase tracking-wider text-[#FFCB9A] flex items-center space-x-1.5 matrix-title">
              <ShieldAlert className="w-3.5 h-3.5 text-[#FFCB9A]" />
              <span>Dual-Model AI Verdict</span>
            </span>
            <span className="text-[10px] font-matrix text-[#D9B08C]">Python :50052</span>
          </div>

          {/* Cascade Probability Progress Bar */}
          <div>
            <div className="flex justify-between items-baseline text-xs font-matrix mb-1">
              <span className="text-[#D9B08C] tracking-wide">Cascade Probability</span>
              <span
                className={`font-bold ${
                  prob >= 0.7 ? "text-[#EF4444]" : prob >= 0.4 ? "text-[#FFCB9A]" : "text-[#D1E8E2]"
                }`}
              >
                {(prob * 100).toFixed(1)}%
              </span>
            </div>
            <div className="relative w-full h-2 rounded bg-[#2C3531] overflow-hidden border border-[#116466]/40">
              <div
                className={`h-full transition-all duration-300 ${
                  prob >= 0.7
                    ? "bg-[#EF4444]"
                    : prob >= 0.4
                    ? "bg-[#FFCB9A]"
                    : "bg-[#116466]"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, prob * 100))}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-[1px] bg-[#FFCB9A]/80"
                style={{ left: "70%" }}
                title="70% Dynamic Throttling Threshold"
              />
              <div
                className="absolute top-0 bottom-0 w-[1px] bg-[#EF4444]/80"
                style={{ left: "85%" }}
                title="85% Circuit Breaking Threshold"
              />
            </div>
            <div className="flex justify-between text-[9px] font-matrix text-[#D9B08C]/70 mt-0.5">
              <span>0% Baseline</span>
              <span>70% Throttle</span>
              <span>85% Trip</span>
              <span>100%</span>
            </div>
          </div>

          {/* Dual-Model Split Score (EWMA vs Isolation Forest) */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#116466]/30">
            <div className="p-2 rounded bg-[#222B27] border border-[#116466]/50">
              <span className="block text-[10px] font-matrix text-[#D9B08C] uppercase tracking-wider">
                Stage A: EWMA Z-Score
              </span>
              <span
                className={`text-sm font-matrix font-bold ${
                  Math.abs(v?.ewmaZScore || 0) > 2.5 ? "text-[#EF4444]" : "text-[#D1E8E2]"
                }`}
              >
                {(v?.ewmaZScore || 0).toFixed(2)}σ
              </span>
            </div>

            <div className="p-2 rounded bg-[#222B27] border border-[#116466]/50">
              <span className="block text-[10px] font-matrix text-[#D9B08C] uppercase tracking-wider">
                Stage B: Isolation Forest
              </span>
              <span
                className={`text-sm font-matrix font-bold ${
                  (v?.isolationForestScore || 0) < 0.35 ? "text-[#EF4444]" : "text-[#D1E8E2]"
                }`}
              >
                {(v?.isolationForestScore || 0).toFixed(3)}
              </span>
            </div>
          </div>

          {/* Root Cause & Recommended Action Badges */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-[10px] font-matrix text-[#D9B08C]">
              RCA:{" "}
              <span className="font-bold text-[#FFCB9A]">
                {v?.rootCauseMetric || "NONE"}
              </span>
            </div>
            <div className="text-[10px] font-matrix text-[#D9B08C]">
              Policy:{" "}
              <span className="font-bold text-[#D1E8E2]">
                {v?.recommendedAction || "NO_OP"}
              </span>
            </div>
          </div>
        </div>

        {/* Real-Time Telemetry & Rolling Sparklines */}
        <div className="space-y-3">
          <span className="text-[11px] font-matrix uppercase tracking-wider text-[#FFCB9A] flex items-center space-x-1.5 matrix-title">
            <Activity className="w-3.5 h-3.5 text-[#D1E8E2]" />
            <span>Rolling 60s Telemetry</span>
          </span>

          {/* Sparkline 1: Latency P99 vs SLO */}
          <div className="p-2.5 rounded bg-[#1B221F] border border-[#116466]/40">
            <div className="flex justify-between items-center text-xs font-matrix mb-1">
              <span className="text-[#D9B08C]">P99 Latency</span>
              <div className="flex items-center space-x-2">
                <span className="text-[#D1E8E2] font-bold">
                  {Math.round(t?.p99LatencyMs || 0)}ms
                </span>
                <span className="text-[10px] text-[#D9B08C]/70">
                  SLO: {nodeDb?.slo_p99_ms || 100}ms
                </span>
              </div>
            </div>
            {renderSparkline(p99Series, "#D1E8E2", 240, 42, nodeDb?.slo_p99_ms)}
          </div>

          {/* Sparkline 2: Heap Memory Leak Detector */}
          <div className="p-2.5 rounded bg-[#1B221F] border border-[#116466]/40">
            <div className="flex justify-between items-center text-xs font-matrix mb-1">
              <span className="text-[#D9B08C] flex items-center space-x-1">
                <Database className="w-3 h-3 text-[#FFCB9A]" />
                <span>Heap Memory</span>
              </span>
              <span className="text-[#FFCB9A] font-bold">
                {Math.round(t?.heapUsedMb || 0)} / {Math.round(t?.heapMaxMb || 1024)}MB
              </span>
            </div>
            {renderSparkline(heapSeries, "#FFCB9A", 240, 42)}
          </div>

          {/* Sparkline 3: Thread Pool Saturation */}
          <div className="p-2.5 rounded bg-[#1B221F] border border-[#116466]/40">
            <div className="flex justify-between items-center text-xs font-matrix mb-1">
              <span className="text-[#D9B08C] flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-[#D9B08C]" />
                <span>Thread Pool Saturation</span>
              </span>
              <span className="text-[#D9B08C] font-bold">
                {Math.round(t?.threadPoolSaturationPct || 0)}%
              </span>
            </div>
            {renderSparkline(threadSeries, "#D9B08C", 240, 42, 80)}
          </div>
        </div>

        {/* Static Spec Footer */}
        <div className="pt-2 border-t border-[#116466]/40 text-[10px] font-matrix text-[#D9B08C] flex justify-between">
          <span>Max Pool: {nodeDb?.max_thread_pool || 200}</span>
          <span className="truncate max-w-[150px]">{nodeDb?.base_url}</span>
        </div>
      </div>
    </div>
  );
};
