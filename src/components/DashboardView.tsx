import React from 'react';
import { Connection, ExecutionRequest, SecurityEvent, Subscription, Usage } from '../types';
import {
  Zap,
  CheckCircle2,
  XCircle,
  PlugZap,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Bot,
  Terminal,
  Lock,
  ArrowRight,
  Clock,
} from 'lucide-react';

interface DashboardViewProps {
  connections: Connection[];
  requests: ExecutionRequest[];
  securityEvents: SecurityEvent[];
  usage: Usage | null;
  subscription: Subscription | null;
  onNavigate: (tab: string) => void;
  onSelectRequest: (req: ExecutionRequest) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  connections,
  requests,
  securityEvents,
  usage,
  subscription,
  onNavigate,
  onSelectRequest,
}) => {
  const successfulCount = requests.filter((r) => r.status === 'success').length;
  const failedCount = requests.filter((r) => r.status !== 'success').length;
  const remainingUsage = usage ? Math.max(0, usage.actions_limit - usage.actions_count) : 0;
  const activeConnectionsCount = connections.filter((c) => c.status === 'active').length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 p-6 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
              <Zap className="h-3.5 w-3.5" />
              Just-in-Time Execution Engine Active
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Turn Natural-Language Instructions into Secure API Actions
            </h1>
            <p className="text-sm text-slate-400 max-w-2xl">
              Connect your endpoints once. Transform unstructured summaries into validated schemas, and execute directly
              from this dashboard or ChatGPT via remote MCP.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => onNavigate('testcenter')}
              className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3.5 py-2 text-xs font-semibold text-slate-950 transition flex items-center gap-1.5 shadow-md shadow-cyan-500/20"
            >
              <Terminal className="h-3.5 w-3.5" />
              Run in Test Center
            </button>
            <button
              onClick={() => onNavigate('connections')}
              className="rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white transition flex items-center gap-1.5"
            >
              <PlugZap className="h-3.5 w-3.5 text-cyan-400" />
              New Connection
            </button>
            <button
              onClick={() => onNavigate('mcp')}
              className="rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 px-3.5 py-2 text-xs font-semibold text-amber-300 transition flex items-center gap-1.5"
            >
              <Bot className="h-3.5 w-3.5 text-amber-400" />
              ChatGPT MCP Hub
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Actions this Month</span>
            <Activity className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{usage?.actions_count ?? 0}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            Limit: {usage?.actions_limit ?? 25} actions/mo
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Successful Requests</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-400">{successfulCount}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {requests.length > 0
              ? `${Math.round((successfulCount / requests.length) * 100)}% success rate`
              : '100% success rate'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Blocked / Failed</span>
            <XCircle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-400">{failedCount}</div>
          <div className="mt-1 text-[11px] text-slate-500">SSRF, timeouts & errors</div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Active Connections</span>
            <PlugZap className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">{activeConnectionsCount}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            {connections.length} total configured
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">Remaining Quota</span>
            <Lock className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-400">{remainingUsage}</div>
          <div className="mt-1 text-[11px] text-slate-500">
            Renews on {subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}
          </div>
        </div>
      </div>

      {/* Visual Execution Pipeline Diagram */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-5">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-cyan-400" />
          Zero-Trust Request Execution Boundary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-[10px] font-semibold text-cyan-400 uppercase">1. Intent Source</div>
            <div className="mt-1 text-xs font-medium text-white">ChatGPT / Web Dashboard</div>
            <div className="mt-1 text-[10px] text-slate-500">User prompts in plain text</div>
          </div>
          <div className="hidden md:flex items-center justify-center text-slate-600">
            <ArrowRight className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-[10px] font-semibold text-indigo-400 uppercase">2. Transformation</div>
            <div className="mt-1 text-xs font-medium text-white">Rules Engine + Gemini 3.8</div>
            <div className="mt-1 text-[10px] text-slate-500">Deterministic schema mapping</div>
          </div>
          <div className="hidden md:flex items-center justify-center text-slate-600">
            <ArrowRight className="h-4 w-4 text-cyan-500" />
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="text-[10px] font-semibold text-emerald-400 uppercase">3. Safe Dispatch</div>
            <div className="mt-1 text-xs font-medium text-white">SSRF Shield + AES-256 Auth</div>
            <div className="mt-1 text-[10px] text-slate-500">Target API / Webhook</div>
          </div>
        </div>
      </div>

      {/* Recent Requests Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Request History</h2>
            <p className="text-xs text-slate-400">All outbound dispatches with secret redaction and latency timing</p>
          </div>
          <button
            onClick={() => onNavigate('requests')}
            className="flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 transition"
          >
            View All ({requests.length})
            <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-medium text-slate-400">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Connection</th>
                <th className="px-5 py-3">Source</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">HTTP Code</th>
                <th className="px-5 py-3">Latency</th>
                <th className="px-5 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {requests.slice(0, 5).map((req) => {
                const conn = connections.find((c) => c.id === req.connection_id);
                return (
                  <tr key={req.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-5 py-3 text-slate-400 flex items-center gap-1.5 whitespace-nowrap">
                      <Clock className="h-3 w-3 text-slate-500" />
                      {new Date(req.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              {requests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-slate-500">
                    No requests dispatched yet. Try running an execution in the Test Center!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
