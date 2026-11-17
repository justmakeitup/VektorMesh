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
        return "bg-red-50 text-red-700 border-red-200";
      case "THROTTLE_TRAFFIC":
      case "REROUTE_COLD_REPLICA":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "CHAOS_INJECTION":
        return "bg-purple-50 text-purple-700 border-purple-200";
      case "MANUAL_ROUTE_OVERRIDE":
        return "bg-blue-50 text-blue-700 border-blue-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden select-none flex flex-col shadow-xs font-sans">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Hash className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Cryptographic Audit Ledger & Immutability Chain
            </h3>
          </div>

          <span className="text-[10px] font-mono font-medium text-slate-600 px-2 py-0.5 rounded bg-white border border-slate-200 shadow-xs">
            MySQL SHA-256 Trigger
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Integrity Badge Banner */}
          {report && (
            <div
              className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-semibold border ${
                report.isIntact
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-red-50 text-red-800 border-red-200"
              }`}
            >
              {report.isIntact ? (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
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
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white text-xs font-mono font-medium uppercase tracking-wider rounded-lg transition-colors disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-3 h-3 ${isVerifying ? "animate-spin" : ""}`} />
            <span>{isVerifying ? "Verifying..." : "Verify Hash Chain"}</span>
          </button>

          {/* Toggle Expand */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-slate-400 hover:text-slate-700 transition-colors"
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
            <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-200 text-xs font-mono text-slate-600 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span>
                  Genesis:{" "}
                  <code className="text-slate-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-xs">
                    {formatHash(report.genesisHash)}
                  </code>
                </span>
                <span className="text-blue-600">➔</span>
                <span>
                  Head:{" "}
                  <code className="text-blue-700 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200 shadow-xs">
                    {formatHash(report.headHash)}
                  </code>
                </span>
              </div>
              <span className="text-slate-500">Verified at: {report.verifiedAt}</span>
            </div>
          )}

          {/* Audit Ledger Rows Table */}
          <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-mono text-[10px] uppercase border-b border-slate-200 sticky top-0 tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Seq #</th>
                  <th className="py-2.5 px-3">UTC Timestamp</th>
                  <th className="py-2.5 px-3">Service</th>
                  <th className="py-2.5 px-3">Remediation Action</th>
                  <th className="py-2.5 px-3">Trigger Source</th>
                  <th className="py-2.5 px-3">Cascade Prob</th>
                  <th className="py-2.5 px-3">Prev Hash ➔ Curr Hash</th>
                  <th className="py-2.5 px-3 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400 font-mono">
                      No audit records loaded yet.
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr
                      key={entry.sequence_id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedEntry(entry)}
                    >
                      <td className="py-2 px-3 text-slate-900 font-mono font-bold">
                        #{entry.sequence_id}
                      </td>
                      <td className="py-2 px-3 text-slate-500 font-mono whitespace-nowrap">
                        {entry.timestamp_utc}
                      </td>
                      <td className="py-2 px-3 text-slate-900 font-semibold">
                        {entry.service_id}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${getActionColor(
                            entry.action_type
                          )}`}
                        >
                          {entry.action_type}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                          {entry.trigger_source}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono font-bold">
                        <span
                          className={
                            entry.cascade_probability >= 0.7
                              ? "text-red-600"
                              : entry.cascade_probability >= 0.4
                              ? "text-amber-600"
                              : "text-emerald-700"
                          }
                        >
                          {(entry.cascade_probability * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2 px-3 text-xs font-mono text-slate-600 whitespace-nowrap">
                        <span className="text-slate-400">{formatHash(entry.prev_hash)}</span>
                        <span className="mx-1.5 text-blue-600">➔</span>
                        <span className="text-blue-700 font-semibold">{formatHash(entry.curr_hash)}</span>
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEntry(entry);
                          }}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-0.5 ml-auto transition-colors"
                        >
                          <span>JSON</span>
                          <ExternalLink className="w-3 h-3" />
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-5 space-y-3 font-sans shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
              <h4 className="text-sm font-bold text-slate-900">
                Audit Block #{selectedEntry.sequence_id} Details
              </h4>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-slate-400 hover:text-slate-700 text-sm p-1"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-1.5 text-slate-700">
              <div>
                <span className="text-slate-500 font-medium">Event ID:</span> {selectedEntry.event_id}
              </div>
              <div>
                <span className="text-slate-500 font-medium">Timestamp:</span> {selectedEntry.timestamp_utc}
              </div>
              <div>
                <span className="text-slate-500 font-medium">Prev Hash:</span>{" "}
                <code className="text-slate-600 font-mono break-all">{selectedEntry.prev_hash}</code>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Curr Hash:</span>{" "}
                <code className="text-blue-700 font-mono font-semibold break-all">{selectedEntry.curr_hash}</code>
              </div>
            </div>

            <div className="pt-2">
              <span className="text-[11px] font-medium text-slate-600 block mb-1">Payload JSON:</span>
              <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 overflow-x-auto max-h-48">
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
