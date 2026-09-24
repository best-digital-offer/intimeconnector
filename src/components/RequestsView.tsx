import React, { useState } from 'react';
import { Connection, ExecutionRequest } from '../types';
import {
  History,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Eye,
  Lock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface RequestsViewProps {
  requests: ExecutionRequest[];
  connections: Connection[];
  selectedRequest: ExecutionRequest | null;
  onSelectRequest: (req: ExecutionRequest | null) => void;
}

export const RequestsView: React.FC<RequestsViewProps> = ({
  requests,
  connections,
  selectedRequest,
  onSelectRequest,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredRequests = requests.filter((r) => {
    const conn = connections.find((c) => c.id === r.connection_id);
    const connName = conn?.name.toLowerCase() || '';
    const matchesSearch =
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.endpoint_domain.toLowerCase().includes(search.toLowerCase()) ||
      connName.includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="h-5 w-5 text-cyan-400" />
            Audit & Request History
          </h1>
          <p className="text-xs text-slate-400">
            Immutable log of all external API executions with automated secret redaction.
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search by ID, domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-lg border border-slate-800 bg-slate-900 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none w-48"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-cyan-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="blocked">Blocked (SSRF/Quota)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-medium text-slate-400">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Request ID</th>
                <th className="px-5 py-3">Connection</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">HTTP Code</th>
                <th className="px-5 py-3">Duration</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredRequests.map((req) => {
                const conn = connections.find((c) => c.id === req.connection_id);
                return (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                      {new Date(req.created_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] text-cyan-400 whitespace-nowrap">
                      {req.id}
                    </td>
                    <td className="px-5 py-3 font-medium text-white whitespace-nowrap">
                      {conn?.name || req.connection_id}
                      <span className="block text-[10px] text-slate-500">{req.endpoint_domain}</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          req.action_type === 'mcp_tool'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                            : req.action_type === 'web_dashboard'
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {req.action_type === 'mcp_tool'
                          ? 'ChatGPT MCP'
                          : req.action_type === 'web_dashboard'
                          ? 'Dashboard'
                          : 'Test Run'}
                      </span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          req.status === 'success'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : req.status === 'blocked'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {req.status === 'success' ? (
                          <CheckCircle2 className="h-2.5 w-2.5" />
                        ) : (
                          <XCircle className="h-2.5 w-2.5" />
                        )}
                        {req.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-[11px] whitespace-nowrap">
                      {req.http_status ? (
                        <span className={req.http_status < 400 ? 'text-emerald-400' : 'text-rose-400'}>
                          {req.http_status}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-400 whitespace-nowrap">{req.duration_ms} ms</td>
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => onSelectRequest(req)}
                        className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] font-medium text-slate-200 transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredRequests.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                    No matching execution requests found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Request Inspection Drawer / Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Eye className="h-4 w-4 text-cyan-400" />
                  Request Inspector: {selectedRequest.id}
                </h2>
                <p className="text-[11px] text-slate-400">
                  Executed on {new Date(selectedRequest.created_at).toLocaleString()}
                </p>
              </div>
              <button onClick={() => onSelectRequest(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Status pills */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                <span className="font-bold text-emerald-400">{selectedRequest.status.toUpperCase()}</span>
              </div>
              <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">HTTP Code</span>
                <span className="font-bold text-white">{selectedRequest.http_status || 'N/A'}</span>
              </div>
              <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Duration</span>
                <span className="font-bold text-white">{selectedRequest.duration_ms} ms</span>
              </div>
              <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                <span className="text-[10px] text-slate-500 uppercase block">Attempts</span>
                <span className="font-bold text-white">{selectedRequest.attempts_count}</span>
              </div>
            </div>

            {/* Metadata */}
            <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">Destination:</span>
                <span className="text-slate-200">
                  {selectedRequest.endpoint_domain}
                  {selectedRequest.endpoint_path}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Correlation ID:</span>
                <span className="text-slate-300">{selectedRequest.correlation_id}</span>
              </div>
              {selectedRequest.idempotency_key && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Idempotency Key:</span>
                  <span className="text-slate-300">{selectedRequest.idempotency_key}</span>
                </div>
              )}
            </div>

            {/* Redacted Payload */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-300 flex items-center gap-1">
                  <Lock className="h-3 w-3 text-cyan-400" />
                  Sent Payload (Sensitive Fields Redacted)
                </span>
                <span className="text-[10px] text-slate-500">AES-256 Auth Injected At Dispatch</span>
              </div>
              <pre className="max-h-40 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-200">
                {selectedRequest.masked_request_payload || '{}'}
              </pre>
            </div>

            {/* Safe Response Preview */}
            <div>
              <span className="font-semibold text-slate-300 block mb-1">
                Endpoint Response Preview
              </span>
              <pre className="max-h-48 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-emerald-300">
                {selectedRequest.safe_response_preview ||
                  selectedRequest.error_message ||
                  '// No response body'}
              </pre>
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end">
              <button
                onClick={() => onSelectRequest(null)}
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 font-semibold text-white transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
