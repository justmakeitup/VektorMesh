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
        <div className="w-full h-[42px] flex items-center justify-center text-[10px] text-slate-600 font-mono">
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
        {/* Background gradient fill */}
        <defs>
          <linearGradient id={`grad-${color}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Threshold dashed line if provided */}
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

        {/* Stroke line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  };

  // Extract history series
  const p99Series = history.map((h) => h.p99LatencyMs);
  const heapSeries = history.map((h) => h.heapUsedMb);
  const threadSeries = history.map((h) => h.threadPoolSaturationPct);

  return (
    <div className="bg-[#12151E] border border-[#23293B] rounded-lg p-4 flex flex-col h-full overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[#23293B] pb-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-semibold border border-emerald-500/20">
              {nodeDb?.tier || "CORE"}
            </span>
            <h3 className="font-mono text-sm font-bold text-white tracking-wide">
              {selectedNodeId}
            </h3>
          </div>
          <p className="text-[11px] text-slate-400 font-sans mt-0.5">
            {nodeDb?.service_name || "Microservice Node"}
          </p>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleReset}
            title="Recycle Container & Normalize Circuit Breaker"
            className="p-1.5 rounded hover:bg-[#1A202C] text-slate-400 hover:text-emerald-400 border border-[#23293B] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[#1A202C] text-slate-400 hover:text-slate-200 border border-[#23293B] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Circuit Breaker Status Banner */}
        <div className="flex items-center justify-between p-2.5 rounded bg-[#090A0F] border border-[#23293B]">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                circuit === "CLOSED"
                  ? "bg-emerald-400 shadow-sm shadow-emerald-400/50"
                  : circuit === "HALF_OPEN"
                  ? "bg-amber-400 shadow-sm shadow-amber-400/50"
                  : "bg-red-500 shadow-sm shadow-red-500/50"
              }`}
            />
            <span className="text-xs font-mono text-slate-300">Resilience4j Circuit</span>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              circuit === "CLOSED"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : circuit === "HALF_OPEN"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                : "bg-red-500/20 text-red-400 border border-red-500/40"
            }`}
          >
            {circuit}
          </span>
        </div>

        {/* ================================================================= */}
        {/* Dual-Model AI Diagnostics Section */}
        {/* ================================================================= */}
        <div className="space-y-2.5 p-3 rounded bg-[#090A0F] border border-[#23293B]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              <span>Dual-Model AI Verdict</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">Python :50052</span>
          </div>

          {/* Cascade Probability Progress Bar */}
          <div>
            <div className="flex justify-between items-baseline text-xs font-mono mb-1">
              <span className="text-slate-400">Cascade Probability</span>
              <span
                className={`font-bold ${
                  prob >= 0.7 ? "text-red-400" : prob >= 0.4 ? "text-amber-400" : "text-emerald-400"
                }`}
              >
                {(prob * 100).toFixed(1)}%
              </span>
            </div>
            <div className="relative w-full h-2 rounded bg-[#171B26] overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  prob >= 0.7
                    ? "bg-red-500"
                    : prob >= 0.4
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, prob * 100))}%` }}
              />
              {/* Threshold Indicators */}
              <div
                className="absolute top-0 bottom-0 w-[1px] bg-amber-400/80"
                style={{ left: "70%" }}
                title="70% Dynamic Throttling Threshold"
              />
              <div
                className="absolute top-0 bottom-0 w-[1px] bg-red-400/80"
                style={{ left: "85%" }}
                title="85% Circuit Breaking Threshold"
              />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-slate-600 mt-0.5">
              <span>0% Baseline</span>
              <span>70% Throttle</span>
              <span>85% Trip</span>
              <span>100%</span>
            </div>
          </div>

          {/* Dual-Model Split Score (EWMA vs Isolation Forest) */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-[#1C2233]">
            <div className="p-2 rounded bg-[#12151E] border border-[#23293B]">
              <span className="block text-[10px] font-mono text-slate-400">
                Stage A: EWMA Z-Score
              </span>
              <span
                className={`text-sm font-mono font-bold ${
                  Math.abs(v?.ewmaZScore || 0) > 2.5 ? "text-red-400" : "text-slate-200"
                }`}
              >
                {(v?.ewmaZScore || 0).toFixed(2)}σ
              </span>
            </div>

            <div className="p-2 rounded bg-[#12151E] border border-[#23293B]">
              <span className="block text-[10px] font-mono text-slate-400">
                Stage B: Isolation Forest
              </span>
              <span
                className={`text-sm font-mono font-bold ${
                  (v?.isolationForestScore || 0) < 0.35 ? "text-red-400" : "text-slate-200"
                }`}
              >
                {(v?.isolationForestScore || 0).toFixed(3)}
              </span>
            </div>
          </div>

          {/* Root Cause & Recommended Action Badges */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-[10px] font-mono text-slate-400">
              RCA:{" "}
              <span className="font-bold text-amber-300">
                {v?.rootCauseMetric || "NONE"}
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Policy:{" "}
              <span className="font-bold text-cyan-300">
                {v?.recommendedAction || "NO_OP"}
              </span>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Real-Time Telemetry & Rolling Sparklines */}
        {/* ================================================================= */}
        <div className="space-y-3">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Rolling 60s Telemetry</span>
          </span>

          {/* Sparkline 1: Latency P99 vs SLO */}
          <div className="p-2.5 rounded bg-[#090A0F] border border-[#23293B]">
            <div className="flex justify-between items-center text-xs font-mono mb-1">
              <span className="text-slate-400">P99 Latency</span>
              <div className="flex items-center space-x-2">
                <span className="text-emerald-400 font-bold">
                  {Math.round(t?.p99LatencyMs || 0)}ms
                </span>
                <span className="text-[10px] text-slate-500">
                  SLO: {nodeDb?.slo_p99_ms || 100}ms
                </span>
              </div>
            </div>
            {renderSparkline(p99Series, "#10B981", 240, 42, nodeDb?.slo_p99_ms)}
          </div>

          {/* Sparkline 2: Heap Memory Leak Detector */}
          <div className="p-2.5 rounded bg-[#090A0F] border border-[#23293B]">
            <div className="flex justify-between items-center text-xs font-mono mb-1">
              <span className="text-slate-400 flex items-center space-x-1">
                <Database className="w-3 h-3 text-cyan-400" />
                <span>Heap Memory</span>
              </span>
              <span className="text-cyan-400 font-bold">
                {Math.round(t?.heapUsedMb || 0)} / {Math.round(t?.heapMaxMb || 1024)}MB
              </span>
            </div>
            {renderSparkline(heapSeries, "#06B6D4", 240, 42)}
          </div>

          {/* Sparkline 3: Thread Pool Saturation */}
          <div className="p-2.5 rounded bg-[#090A0F] border border-[#23293B]">
            <div className="flex justify-between items-center text-xs font-mono mb-1">
              <span className="text-slate-400 flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-amber-400" />
                <span>Thread Pool Saturation</span>
              </span>
              <span className="text-amber-400 font-bold">
                {Math.round(t?.threadPoolSaturationPct || 0)}%
              </span>
            </div>
            {renderSparkline(threadSeries, "#F59E0B", 240, 42, 80)}
          </div>
        </div>

        {/* Static Spec Footer */}
        <div className="pt-2 border-t border-[#23293B] text-[10px] font-mono text-slate-500 flex justify-between">
          <span>Max Pool: {nodeDb?.max_thread_pool || 200}</span>
          <span className="truncate max-w-[150px]">{nodeDb?.base_url}</span>
        </div>
      </div>
    </div>
  );
};
