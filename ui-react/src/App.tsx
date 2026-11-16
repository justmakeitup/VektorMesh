import React from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Radio,
  Server,
  Shield,
  Zap,
  X
} from "lucide-react";
import { useVektorMeshSocket } from "./hooks/useVektorMeshSocket";
import { TopologyCanvas } from "./components/TopologyCanvas";
import { ChaosControlDeck } from "./components/ChaosControlDeck";
import { NodeInspectorDrawer } from "./components/NodeInspectorDrawer";
import { AuditLedgerPanel } from "./components/AuditLedgerPanel";

export const App: React.FC = () => {
  const {
    connected,
    engineConnected,
    topology,
    snapshot,
    recentAudits,
    auditIntegrityReport,
    alerts,
    telemetryHistory,
    selectedNodeId,
    isVerifyingAudit,
    setSelectedNodeId,
    injectChaosFault,
    overrideRouteWeights,
    resetServiceNode,
    verifyAuditLedger,
    dismissAlert,
    clearAlerts
  } = useVektorMeshSocket();

  const selectedNodeDb = topology.nodes.find((n) => n.id === selectedNodeId);
  const selectedNodeStatus = snapshot?.nodes?.find((n) => n.serviceId === selectedNodeId);
  const selectedNodeHistory = selectedNodeId
    ? telemetryHistory.get(selectedNodeId) || []
    : [];

  const globalMaxProb = snapshot?.summary?.globalMaxCascadeProbability || 0;
  const activeFaultsCount = snapshot?.summary?.activeFaultsCount || 0;
  const activeAnomaliesCount = snapshot?.summary?.activeAnomaliesCount || 0;

  // Compute maximum remaining seconds across all active faults
  const maxActiveFaultRemaining = (snapshot?.nodes || []).reduce((max, node) => {
    for (const f of node.activeFaults || []) {
      if (f.remainingSeconds > max) max = f.remainingSeconds;
    }
    return max;
  }, 0);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#090A0F] text-slate-100 overflow-hidden font-sans">
      {/* =================================================================== */}
      {/* 1. Mission Control Header Bar */}
      {/* =================================================================== */}
      <header className="h-14 bg-[#12151E] border-b border-[#23293B] px-5 flex items-center justify-between shrink-0 select-none">
        {/* Brand & Subtitle */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Radio className="w-4 h-4 text-black animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-mono text-sm font-extrabold text-white tracking-wider">
                VEKTORMESH
              </h1>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                v1.0.0
              </span>
            </div>
            <p className="text-[10px] font-mono text-slate-400">
              Autonomous Polyglot Canary & Anomaly Remediation Control Plane
            </p>
          </div>
        </div>

        {/* Global Cluster Summary Status */}
        <div className="hidden lg:flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-3 py-1 bg-[#090A0F] border border-[#23293B] rounded">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Max Cascade</span>
            <span
              className={`text-xs font-mono font-bold ${
                globalMaxProb >= 0.7
                  ? "text-red-400"
                  : globalMaxProb >= 0.4
                  ? "text-amber-400"
                  : "text-emerald-400"
              }`}
            >
              {(globalMaxProb * 100).toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1 bg-[#090A0F] border border-[#23293B] rounded">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Active Faults</span>
            <span
              className={`text-xs font-mono font-bold flex items-center space-x-1 ${
                activeFaultsCount > 0 ? "text-red-400 animate-pulse" : "text-slate-400"
              }`}
            >
              <span>{activeFaultsCount}</span>
              {activeFaultsCount > 0 && maxActiveFaultRemaining > 0 && (
                <span className="text-amber-400 font-semibold">({maxActiveFaultRemaining}s)</span>
              )}
            </span>
          </div>

          <div className="flex items-center space-x-2 px-3 py-1 bg-[#090A0F] border border-[#23293B] rounded">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Anomalies</span>
            <span
              className={`text-xs font-mono font-bold ${
                activeAnomaliesCount > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {activeAnomaliesCount}
            </span>
          </div>
        </div>

        {/* Distributed Backend Health Indicators */}
        <div className="flex items-center space-x-3 text-xs font-mono">
          {/* WebSocket BFF */}
          <div className="flex items-center space-x-1.5" title="Node.js Fastify Edge Gateway (:4000)">
            <span
              className={`w-2 h-2 rounded-full ${
                connected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-red-500"
              }`}
            />
            <span className="text-slate-300 text-[11px]">BFF Gateway</span>
          </div>

          {/* Java Spring Boot Core Engine */}
          <div className="flex items-center space-x-1.5" title="Java 21 Spring Boot 3 Engine (:9090 gRPC)">
            <span
              className={`w-2 h-2 rounded-full ${
                engineConnected ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-amber-500"
              }`}
            />
            <span className="text-slate-300 text-[11px]">Java Engine</span>
          </div>

          {/* Python Inference Engine */}
          <div className="flex items-center space-x-1.5" title="Python Dual-Model Anomaly Engine (:50052 gRPC)">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
            <span className="text-slate-300 text-[11px]">Python ML</span>
          </div>
        </div>
      </header>

      {/* =================================================================== */}
      {/* 2. Autonomous Alert Banner Stream (High-Priority Toasts) */}
      {/* =================================================================== */}
      {alerts.length > 0 && (
        <div className="bg-red-500/10 border-b border-red-500/30 px-5 py-2 flex items-center justify-between text-xs font-mono text-red-300 shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 animate-pulse" />
            <span className="font-bold text-white shrink-0">
              [{alerts[0].action} // {alerts[0].serviceId}]:
            </span>
            <span className="truncate">{alerts[0].description}</span>
          </div>

          <div className="flex items-center space-x-2 shrink-0 ml-4">
            <span className="text-[10px] text-red-400/70">
              {alerts.length > 1 ? `+${alerts.length - 1} more` : ""}
            </span>
            <button
              onClick={() => dismissAlert(alerts[0].eventId)}
              className="text-red-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. Main Workspace Grid */}
      {/* =================================================================== */}
      <main className="flex-1 grid grid-cols-12 gap-3 p-3 overflow-hidden min-h-0">
        {/* Left/Center: 60fps HTML5 Canvas Mesh Visualizer */}
        <section className="col-span-12 lg:col-span-8 flex flex-col h-full min-h-0">
          <div className="flex-1 min-h-0">
            <TopologyCanvas
              topology={topology}
              snapshot={snapshot}
              selectedNodeId={selectedNodeId}
              onSelectNode={(id) => setSelectedNodeId(id)}
            />
          </div>
        </section>

        {/* Right Sidebar: Dual-Model Inspector & Chaos Control Deck */}
        <section className="col-span-12 lg:col-span-4 flex flex-col space-y-3 h-full min-h-0 overflow-y-auto pr-1">
          {/* Top: Chaos Engineering & Route Overrides */}
          <div className="shrink-0 min-h-fit">
            <ChaosControlDeck
              nodes={topology.nodes}
              edges={topology.edges}
              snapshot={snapshot}
              onInjectChaos={injectChaosFault}
              onOverrideWeights={overrideRouteWeights}
              onResetService={resetServiceNode}
            />
          </div>

          {/* Bottom Half: Dual-Model ML Deep Dive & Sparklines */}
          <div className="flex-1 min-h-[320px]">
            <NodeInspectorDrawer
              selectedNodeId={selectedNodeId}
              nodeDb={selectedNodeDb}
              nodeStatus={selectedNodeStatus}
              history={selectedNodeHistory}
              onClose={() => setSelectedNodeId(null)}
              onResetNode={resetServiceNode}
            />
          </div>
        </section>
      </main>

      {/* =================================================================== */}
      {/* 4. Bottom Drawer: Cryptographic Audit Ledger */}
      {/* =================================================================== */}
      <footer className="shrink-0 p-3 pt-0">
        <AuditLedgerPanel
          entries={recentAudits}
          report={auditIntegrityReport}
          isVerifying={isVerifyingAudit}
          onVerifyChain={verifyAuditLedger}
        />
      </footer>
    </div>
  );
};

export default App;
