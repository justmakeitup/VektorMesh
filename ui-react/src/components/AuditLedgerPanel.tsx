import React, { useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  Hash,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { AuditLedgerDb, AuditChainIntegrityReport } from "../types/mesh";

interface AuditLedgerPanelProps {
  entries: AuditLedgerDb[];
  report: AuditChainIntegrityReport | null;
  isVerifying: boolean;
  onVerifyChain: () => Promise<AuditChainIntegrityReport>;
}

export const AuditLedgerPanel: React.FC<AuditLedgerPanelProps> = ({
  entries,
  report,
  isVerifying,
  onVerifyChain
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [selectedEntry, setSelectedEntry] = useState<AuditLedgerDb | null>(null);

  const formatHash = (h: string) => {
    if (!h) return "00000000...";
    return `${h.substring(0, 8)}...${h.substring(h.length - 8)}`;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "OPEN_CIRCUIT":
      case "RESTART_CONTAINER":
        return "bg-red-500/20 text-red-300 border-red-500/40";
      case "THROTTLE_TRAFFIC":
      case "REROUTE_COLD_REPLICA":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "CHAOS_INJECTION":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
      case "MANUAL_ROUTE_OVERRIDE":
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
      default:
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    }
  };

  return (
    <div className="bg-[#12151E] border border-[#23293B] rounded-lg overflow-hidden select-none flex flex-col">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#0D1017] border-b border-[#23293B]">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-emerald-400" />
            <h3 className="font-mono text-xs font-bold text-slate-100 uppercase tracking-wider">
              Cryptographic Audit Ledger & Immutability Chain
            </h3>
          </div>

          <span className="text-[10px] font-mono text-slate-500 px-2 py-0.5 rounded bg-[#171B26] border border-[#23293B]">
            MySQL SHA-256 Trigger
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Integrity Badge Banner */}
          {report && (
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-mono font-medium border ${
                report.isIntact
                  ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                  : "bg-red-500/10 text-red-300 border-red-500/40 shadow-sm shadow-red-500/20"
              }`}
            >
              {report.isIntact ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              )}
              <span>
                {report.isIntact
                  ? `CHAIN INTACT: ${report.verifiedCount} BLOCKS VERIFIED`
                  : `CHAIN BROKEN AT SEQ #${report.brokenAtSequenceId}`}
              </span>
            </div>
          )}

          {/* Verify Chain Action Button */}
          <button
            onClick={() => onVerifyChain()}
            disabled={isVerifying}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-mono rounded transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isVerifying ? "animate-spin" : ""}`} />
            <span>{isVerifying ? "Verifying..." : "Verify Hash Chain"}</span>
          </button>

          {/* Toggle Expand */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-slate-200"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Table Content */}
      {isExpanded && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Hash Chain Proof Strip */}
          {report && (
            <div className="px-4 py-2 bg-[#090A0F] border-b border-[#23293B] text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span>
                  Genesis:{" "}
                  <code className="text-slate-300 bg-[#12151E] px-1 py-0.5 rounded">
                    {formatHash(report.genesisHash)}
                  </code>
                </span>
                <span>➔</span>
                <span>
                  Head:{" "}
                  <code className="text-emerald-400 bg-[#12151E] px-1 py-0.5 rounded">
                    {formatHash(report.headHash)}
                  </code>
                </span>
              </div>
              <span className="text-slate-500">Verified at: {report.verifiedAt}</span>
            </div>
          )}

          {/* Audit Ledger Rows Table */}
          <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#0D1017] text-slate-400 text-[10px] uppercase border-b border-[#23293B] sticky top-0">
                <tr>
                  <th className="py-2 px-3">Seq #</th>
                  <th className="py-2 px-3">UTC Timestamp</th>
                  <th className="py-2 px-3">Service</th>
                  <th className="py-2 px-3">Remediation Action</th>
                  <th className="py-2 px-3">Trigger Source</th>
                  <th className="py-2 px-3">Cascade Prob</th>
                  <th className="py-2 px-3">Prev Hash ➔ Curr Hash</th>
                  <th className="py-2 px-3 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C2233] text-slate-300">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500 font-mono">
                      No audit records loaded yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr
                      key={entry.sequence_id}
                      className="hover:bg-[#171B26] transition-colors cursor-pointer"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td className="py-2 px-3 text-slate-400 font-bold">
                        #{entry.sequence_id}
                      </td>
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">
                        {entry.timestamp_utc}
                      </td>
                      <td className="py-2 px-3 text-white font-medium">
                        {entry.service_id}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-bold border ${getActionColor(
                            entry.action_type
                          )}`}
                        >
                          {entry.action_type}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E293B] text-slate-300">
                          {entry.trigger_source}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold">
                        <span
                          className={
                            entry.cascade_probability >= 0.7
                              ? "text-red-400"
                              : entry.cascade_probability >= 0.4
                              ? "text-amber-400"
                              : "text-emerald-400"
                          }
                        >
                          {(entry.cascade_probability * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[10px] text-slate-400 whitespace-nowrap">
                        <span className="text-slate-500">{formatHash(entry.prev_hash)}</span>
                        <span className="mx-1.5 text-emerald-500">➔</span>
                        <span className="text-emerald-400">{formatHash(entry.curr_hash)}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntry(entry);
                          }}
                          className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center space-x-0.5 ml-auto"
                        >
                          <span>JSON</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* JSON Payload Modal Drawer */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#12151E] border border-[#23293B] rounded-lg w-full max-w-lg p-5 space-y-3 font-mono">
            <div className="flex justify-between items-center border-b border-[#23293B] pb-2">
              <h4 className="text-sm font-bold text-white">
                Audit Block #{selectedEntry.sequence_id} Details
              </h4>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1.5 text-slate-300">
              <div>
                <span className="text-slate-500">Event ID:</span> {selectedEntry.event_id}
              </div>
              <div>
                <span className="text-slate-500">Timestamp:</span> {selectedEntry.timestamp_utc}
              </div>
              <div>
                <span className="text-slate-500">Prev Hash:</span>{" "}
                <code className="text-slate-400 break-all">{selectedEntry.prev_hash}</code>
              </div>
              <div>
                <span className="text-slate-500">Curr Hash:</span>{" "}
                <code className="text-emerald-400 break-all">{selectedEntry.curr_hash}</code>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-[11px] text-slate-400 block mb-1">Payload JSON:</span>
              <pre className="p-3 bg-[#090A0F] border border-[#23293B] rounded text-[11px] text-slate-300 overflow-x-auto max-h-48">
                {typeof selectedEntry.payload_json === "string"
                  ? selectedEntry.payload_json
                  : JSON.stringify(selectedEntry.payload_json, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
