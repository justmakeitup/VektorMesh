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
        return "bg-[#FFCB9A]/20 text-[#FFCB9A] border-[#FFCB9A]/40";
      case "CHAOS_INJECTION":
        return "bg-[#D9B08C]/20 text-[#D9B08C] border-[#D9B08C]/40";
      case "MANUAL_ROUTE_OVERRIDE":
        return "bg-[#116466]/30 text-[#D1E8E2] border-[#116466]";
      default:
        return "bg-[#116466]/20 text-[#D1E8E2] border-[#116466]/40";
    }
  };

  return (
    <div className="bg-[#222B27] border border-[#116466]/40 rounded-lg overflow-hidden select-none flex flex-col font-futuristic">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-[#1B221F] border-b border-[#116466]/40">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-[#FFCB9A]" />
            <h3 className="font-matrix text-xs font-bold text-[#D1E8E2] uppercase tracking-wider matrix-title">
              Cryptographic Audit Ledger & Immutability Chain
            </h3>
          </div>

          <span className="text-[10px] font-matrix text-[#D9B08C] px-2 py-0.5 rounded bg-[#2C3531] border border-[#116466]/40">
            MySQL SHA-256 Trigger
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Integrity Badge Banner */}
          {report && (
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded text-xs font-matrix font-medium border ${
                report.isIntact
                  ? "bg-[#116466]/20 text-[#D1E8E2] border-[#116466] shadow-sm shadow-[#116466]/30"
                  : "bg-red-500/20 text-red-300 border-red-500/50 shadow-sm shadow-red-500/20"
              }`}
            >
              {report.isIntact ? (
                <ShieldCheck className="w-3.5 h-3.5 text-[#D1E8E2]" />
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
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#116466] hover:bg-[#FFCB9A] hover:text-[#2C3531] text-[#D1E8E2] text-xs font-matrix uppercase tracking-wider rounded transition-colors disabled:opacity-50 border border-[#116466]/60 shadow-sm"
          >
            <RefreshCw className={`w-3 h-3 ${isVerifying ? "animate-spin" : ""}`} />
            <span>{isVerifying ? "Verifying..." : "Verify Hash Chain"}</span>
          </button>

          {/* Toggle Expand */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-[#D9B08C] hover:text-[#D1E8E2] transition-colors"
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
            <div className="px-4 py-2 bg-[#1B221F] border-b border-[#116466]/30 text-[10px] font-matrix text-[#D9B08C] flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span>
                  Genesis:{" "}
                  <code className="text-[#D1E8E2] bg-[#2C3531] px-1 py-0.5 rounded border border-[#116466]/30">
                    {formatHash(report.genesisHash)}
                  </code>
                </span>
                <span className="text-[#116466]">➔</span>
                <span>
                  Head:{" "}
                  <code className="text-[#FFCB9A] bg-[#2C3531] px-1 py-0.5 rounded border border-[#116466]/30">
                    {formatHash(report.headHash)}
                  </code>
                </span>
              </div>
              <span className="text-[#D9B08C]/70">Verified at: {report.verifiedAt}</span>
            </div>
          )}

          {/* Audit Ledger Rows Table */}
          <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
            <table className="w-full text-left text-xs font-matrix">
              <thead className="bg-[#1B221F] text-[#D9B08C] text-[10px] uppercase border-b border-[#116466]/40 sticky top-0 tracking-wider">
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
              <tbody className="divide-y divide-[#116466]/20 text-[#D1E8E2]">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-[#D9B08C]/60 font-matrix">
                      No audit records loaded yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr
                      key={entry.sequence_id}
                      className="hover:bg-[#28332E] transition-colors cursor-pointer"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td className="py-2 px-3 text-[#D9B08C] font-bold">
                        #{entry.sequence_id}
                      </td>
                      <td className="py-2 px-3 text-[#D9B08C]/80 whitespace-nowrap">
                        {entry.timestamp_utc}
                      </td>
                      <td className="py-2 px-3 text-[#D1E8E2] font-medium">
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
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1B221F] text-[#D9B08C] border border-[#116466]/30">
                          {entry.trigger_source}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold">
                        <span
                          className={
                            entry.cascade_probability >= 0.7
                              ? "text-red-400"
                              : entry.cascade_probability >= 0.4
                              ? "text-[#FFCB9A]"
                              : "text-[#D1E8E2]"
                          }
                        >
                          {(entry.cascade_probability * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-[10px] text-[#D9B08C]/80 whitespace-nowrap">
                        <span className="text-[#D9B08C]/60">{formatHash(entry.prev_hash)}</span>
                        <span className="mx-1.5 text-[#116466]">➔</span>
                        <span className="text-[#FFCB9A]">{formatHash(entry.curr_hash)}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntry(entry);
                          }}
                          className="text-[10px] text-[#FFCB9A] hover:text-[#D1E8E2] flex items-center space-x-0.5 ml-auto transition-colors"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#222B27] border border-[#116466] rounded-lg w-full max-w-lg p-5 space-y-3 font-matrix shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#116466]/40 pb-2">
              <h4 className="text-sm font-bold text-[#D1E8E2] matrix-title">
                Audit Block #{selectedEntry.sequence_id} Details
              </h4>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-[#D9B08C] hover:text-[#D1E8E2] text-sm"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1.5 text-[#D1E8E2]">
              <div>
                <span className="text-[#D9B08C]">Event ID:</span> {selectedEntry.event_id}
              </div>
              <div>
                <span className="text-[#D9B08C]">Timestamp:</span> {selectedEntry.timestamp_utc}
              </div>
              <div>
                <span className="text-[#D9B08C]">Prev Hash:</span>{" "}
                <code className="text-[#D9B08C]/70 break-all">{selectedEntry.prev_hash}</code>
              </div>
              <div>
                <span className="text-[#D9B08C]">Curr Hash:</span>{" "}
                <code className="text-[#FFCB9A] break-all">{selectedEntry.curr_hash}</code>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-[11px] text-[#D9B08C] block mb-1">Payload JSON:</span>
              <pre className="p-3 bg-[#1B221F] border border-[#116466]/40 rounded text-[11px] text-[#D1E8E2] overflow-x-auto max-h-48">
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
