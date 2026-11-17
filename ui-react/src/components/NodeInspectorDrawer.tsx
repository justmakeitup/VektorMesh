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
    <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col h-full overflow-y-auto select-none shadow-xs font-sans">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-slate-100 pb-3 mb-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-semibold border border-slate-200">
              {nodeDb?.tier || "CORE"}
            </span>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight uppercase">
              {selectedNodeId}
            </h3>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {nodeDb?.service_name || "Microservice Node"}
          </p>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={handleReset}
            title="Recycle Container & Normalize Circuit Breaker"
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {/* Circuit Breaker Status Banner */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${
                circuit === "CLOSED"
                  ? "bg-emerald-500"
                  : circuit === "HALF_OPEN"
                  ? "bg-amber-500"
                  : "bg-red-500"
              }`}
            />
            <span className="text-xs font-medium text-slate-700">Resilience4j Circuit</span>
          </div>
          <span
            className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
              circuit === "CLOSED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : circuit === "HALF_OPEN"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-red-50 text-red-700 border-red-200"
            }`}
          >
            {circuit}
          </span>
        </div>

        {/* Dual-Model AI Diagnostics Section */}
        <div className="space-y-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-600" />
              <span>Dual-Model AI Verdict</span>
            </span>
            <span className="text-[10px] font-mono text-slate-500">Python :50052</span>
          </div>

          {/* Cascade Probability Progress Bar */}
          <div>
            <div className="flex justify-between items-baseline text-xs mb-1">
              <span className="text-slate-600 font-medium">Cascade Probability</span>
              <span
                className={`font-mono font-bold ${
                  prob >= 0.7 ? "text-red-600" : prob >= 0.4 ? "text-amber-600" : "text-emerald-700"
                }`}
              >
                {(prob * 100).toFixed(1)}%
              </span>
            </div>
            <div className="relative w-full h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  prob >= 0.7
                    ? "bg-red-500"
                    : prob >= 0.4
                    ? "bg-amber-500"
                    : "bg-blue-600"
                }`}
                style={{ width: `${Math.min(100, Math.max(0, prob * 100))}%` }}
              />
              <div
                className="absolute top-0 bottom-0 w-[1px] bg-amber-600"
                style={{ left: "70%" }}
                title="70% Dynamic Throttling Threshold"
              />
              <div
                className="absolute top-0 bottom-0 w-[1px] bg-red-600"
                style={{ left: "85%" }}
                title="85% Circuit Breaking Threshold"
              />
            </div>
            <div className="flex justify-between text-[10px] font-mono text-slate-500 mt-1">
              <span>0% Baseline</span>
              <span>70% Throttle</span>
              <span>85% Trip</span>
              <span>100%</span>
            </div>
          </div>

          {/* Dual-Model Split Score (EWMA vs Isolation Forest) */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Stage A: EWMA Z-Score
              </span>
              <span
                className={`text-sm font-mono font-bold ${
                  Math.abs(v?.ewmaZScore || 0) > 2.5 ? "text-red-600" : "text-slate-900"
                }`}
              >
                {(v?.ewmaZScore || 0).toFixed(2)}σ
              </span>
            </div>

            <div className="p-2 rounded-lg bg-white border border-slate-200">
              <span className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                Stage B: Isolation Forest
              </span>
              <span
                className={`text-sm font-mono font-bold ${
                  (v?.isolationForestScore || 0) < 0.35 ? "text-red-600" : "text-slate-900"
                }`}
              >
                {(v?.isolationForestScore || 0).toFixed(3)}
              </span>
            </div>
          </div>

          {/* Root Cause & Recommended Action Badges */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <div className="text-slate-600">
              RCA:{" "}
              <span className="font-mono font-bold text-amber-700">
                {v?.rootCauseMetric || "NONE"}
              </span>
            </div>
            <div className="text-slate-600">
              Policy:{" "}
              <span className="font-mono font-bold text-blue-700">
                {v?.recommendedAction || "NO_OP"}
              </span>
            </div>
          </div>
        </div>

        {/* Real-Time Telemetry & Rolling Sparklines */}
        <div className="space-y-3">
          <span className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>Rolling 60s Telemetry</span>
          </span>

          {/* Sparkline 1: Latency P99 vs SLO */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-600 font-medium">P99 Latency</span>
              <div className="flex items-center space-x-2">
                <span className="text-slate-900 font-mono font-bold">
                  {Math.round(t?.p99LatencyMs || 0)}ms
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  SLO: {nodeDb?.slo_p99_ms || 100}ms
                </span>
              </div>
            </div>
            {renderSparkline(p99Series, "#2563EB", 240, 42, nodeDb?.slo_p99_ms)}
          </div>

          {/* Sparkline 2: Heap Memory Leak Detector */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-600 font-medium flex items-center space-x-1">
                <Database className="w-3 h-3 text-emerald-600" />
                <span>Heap Memory</span>
              </span>
              <span className="text-slate-900 font-mono font-bold">
                {Math.round(t?.heapUsedMb || 0)} / {Math.round(t?.heapMaxMb || 1024)}MB
              </span>
            </div>
            {renderSparkline(heapSeries, "#059669", 240, 42)}
          </div>

          {/* Sparkline 3: Thread Pool Saturation */}
          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="flex justify-between items-center text-xs mb-1">
              <span className="text-slate-600 font-medium flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-amber-600" />
                <span>Thread Pool Saturation</span>
              </span>
              <span className="text-slate-900 font-mono font-bold">
                {Math.round(t?.threadPoolSaturationPct || 0)}%
              </span>
            </div>
            {renderSparkline(threadSeries, "#D97706", 240, 42, 80)}
          </div>
        </div>

        {/* Static Spec Footer */}
        <div className="pt-2 border-t border-slate-200 text-xs font-mono text-slate-500 flex justify-between">
          <span>Max Pool: {nodeDb?.max_thread_pool || 200}</span>
          <span className="truncate max-w-[150px]">{nodeDb?.base_url}</span>
        </div>
      </div>
    </div>
  );
};
