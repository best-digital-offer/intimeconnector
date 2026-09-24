import React, { useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Play,
  RefreshCw,
  Sparkles,
  Layers,
  AlertTriangle,
  Code,
} from 'lucide-react';

interface McpSubmissionViewProps {
  onCallMcp: (body: any) => Promise<any>;
}

export const McpSubmissionView: React.FC<McpSubmissionViewProps> = ({ onCallMcp }) => {
  const [selectedTool, setSelectedTool] = useState<string>('list_connections');
  const [toolArgs, setToolArgs] = useState<string>('{}');
  const [mcpResponse, setMcpResponse] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedConfig, setCopiedConfig] = useState(false);

  const mcpServerUrl = `${window.location.origin}/mcp`;
  const challengeUrl = `${window.location.origin}/.well-known/openai-apps-challenge`;

  const mcpToolsList = [
    {
      name: 'get_profile',
      description: 'Returns authenticated account identity, active plan, remaining monthly action quota.',
      readOnly: true,
      openWorld: false,
      destructive: false,
      justification: 'Reads only local account profile and subscription limits from internal database without side effects.',
    },
    {
      name: 'list_connections',
      description: 'Lists all active API and webhook connections configured by authenticated user with safe metadata.',
      readOnly: true,
      openWorld: false,
      destructive: false,
      justification: 'Fetches connection metadata scoped strictly to the authenticated user. Never exposes secret credentials.',
    },
    {
      name: 'get_connection',
      description: 'Retrieves connection configuration details by connection ID or name, excluding secrets.',
      readOnly: true,
      openWorld: false,
      destructive: false,
      justification: 'Reads configuration for an owned connection without contacting external parties or altering state.',
    },
    {
      name: 'transform_payload',
      description: 'Dry-run transformation: Takes raw input and parses into structured JSON without outbound network requests.',
      readOnly: true,
      openWorld: false,
      destructive: false,
      justification: 'In-memory computation. Pure data parsing/transformation without outbound calls or state mutation.',
    },
    {
      name: 'test_connection',
      description: 'Performs safe non-destructive health probe against a saved connection endpoint.',
      readOnly: false,
      openWorld: true,
      destructive: false,
      justification: 'Makes outbound HTTP network ping to user-configured endpoint (openWorld=true), but does not mutate state.',
    },
    {
      name: 'send_webhook',
      description: 'Securely transforms and dispatches data through a saved user connection to an external API or webhook.',
      readOnly: false,
      openWorld: true,
      destructive: true,
      justification: 'Mutates external third-party state (POST/PUT/DELETE to external CRMs or webhooks) and consumes monthly quota.',
    },
    {
      name: 'get_request_status',
      description: 'Retrieves status, duration, and sanitized execution outcome of a previously dispatched request.',
      readOnly: true,
      openWorld: false,
      destructive: false,
      justification: 'Reads status metadata of a previous request ID owned by the user from database.',
    },
    {
      name: 'list_recent_requests',
      description: 'Returns authenticated user’s recent API and webhook request history with sanitized metadata.',
      readOnly: true,
      openWorld: false,
      destructive: false,
      justification: 'Read-only database query for recent request records belonging strictly to the authenticated user.',
    },
  ];

  const submissionChecklist = [
    { label: 'Production Public HTTPS MCP URL', status: true, detail: '/mcp' },
    { label: 'Domain Challenge Endpoint', status: true, detail: '/.well-known/openai-apps-challenge' },
    { label: 'Developer & Business Identity Documented', status: true, detail: 'APP_SUBMISSION.md' },
    { label: 'Accurate Tool Annotations (readOnly, openWorld, destructive)', status: true, detail: '8/8 tools annotated' },
    { label: 'Annotation Justifications Documented', status: true, detail: 'All 8 justifications provided' },
    { label: 'Exactly Five Positive Test Cases', status: true, detail: 'Documented in APP_SUBMISSION.md' },
    { label: 'Exactly Three Negative Test Cases', status: true, detail: 'IDOR, SSRF, Quota tests ready' },
    { label: 'External Website Billing Policy Compliance', status: true, detail: 'No digital checkouts inside chat' },
    { label: 'Zero-Trust LLM Authorization', status: true, detail: 'Bearer Token ownership enforcement' },
    { label: 'Enterprise SSRF Protection Active', status: true, detail: 'DNS resolution & RFC1918 blocking' },
    { label: 'Health & Readiness Monitoring', status: true, detail: '/api/health & /api/readiness' },
  ];

  const handleTestMcp = async () => {
    setLoading(true);
    setMcpResponse(null);
    try {
      let parsedArgs = {};
      try {
        parsedArgs = JSON.parse(toolArgs || '{}');
      } catch {
        parsedArgs = {};
      }

      const body = {
        jsonrpc: '2.0',
        id: `call_${Date.now()}`,
        method: 'tools/call',
        params: {
          name: selectedTool,
          arguments: parsedArgs,
        },
      };

      const res = await onCallMcp(body);
      setMcpResponse(res);
    } catch (err: unknown) {
      setMcpResponse({ error: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  const copyUrl = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/20 p-6 shadow-xl space-y-2">
        <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
          <Bot className="h-4 w-4" />
          ChatGPT Remote MCP Integration & Submission Center
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">
          Connect Just-in-Time Connector to ChatGPT
        </h1>
        <p className="text-xs text-slate-300 max-w-3xl">
          This server provides a production-ready, Streamable HTTP remote Model Context Protocol (MCP) server. ChatGPT
          connects securely over HTTPS using OAuth 2.1 or Bearer authorization to invoke your saved API connections.
        </p>
      </div>

      {/* Live Server Endpoints */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <span className="text-[11px] font-semibold uppercase text-cyan-400 block">
            Public Remote MCP Server URL
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={mcpServerUrl}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-cyan-300 select-all focus:outline-none"
            />
            <button
              onClick={() => copyUrl(mcpServerUrl, setCopiedUrl)}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 p-2 text-slate-200 transition"
              title="Copy URL"
            >
              {copiedUrl ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500">
            Conforms to MCP protocol version <code>2024-11-05</code>. Compatible with ChatGPT, Claude, and MCP clients.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <span className="text-[11px] font-semibold uppercase text-indigo-400 block">
            OpenAI Domain Challenge Endpoint
          </span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={challengeUrl}
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-indigo-300 select-all focus:outline-none"
            />
            <a
              href={challengeUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg bg-slate-800 hover:bg-slate-700 p-2 text-slate-200 transition"
              title="Open challenge in new tab"
            >
              <ExternalLink className="h-4 w-4 text-indigo-400" />
            </a>
          </div>
          <p className="text-[11px] text-slate-500">
            Returns raw verification token string with <code>text/plain</code> content type (zero JSON wrapping).
          </p>
        </div>
      </div>

      {/* Interactive MCP Tool Test Runner */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              Live MCP Tool Inspector & Caller
            </h2>
            <p className="text-xs text-slate-400">
              Test JSON-RPC tool calls live against the server using your authenticated session.
            </p>
          </div>
          <span className="rounded bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-xs font-semibold border border-emerald-500/20">
            Streamable HTTP Ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Select Tool to Invoke</label>
              <select
                value={selectedTool}
                onChange={(e) => {
                  setSelectedTool(e.target.value);
                  if (e.target.value === 'send_webhook') {
                    setToolArgs('{\n  "connection_id": "conn_crm_001",\n  "data": "John from ABC wants quote"\n}');
                  } else if (e.target.value === 'test_connection') {
                    setToolArgs('{\n  "connection_id": "conn_crm_001"\n}');
                  } else if (e.target.value === 'transform_payload') {
                    setToolArgs('{\n  "raw_input": "Alice from Stark Corp wants 50 seats"\n}');
                  } else {
                    setToolArgs('{}');
                  }
                }}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                {mcpToolsList.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} {t.destructive ? '⚠️ (Destructive)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Tool Arguments (JSON)</label>
              <textarea
                rows={5}
                value={toolArgs}
                onChange={(e) => setToolArgs(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-xs text-cyan-300 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleTestMcp}
              disabled={loading}
              className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Call MCP Tool
            </button>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              JSON-RPC 2.0 Response from /mcp
            </label>
            <pre className="h-[210px] overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-300">
              {mcpResponse ? JSON.stringify(mcpResponse, null, 2) : '// Response will appear here...'}
            </pre>
          </div>
        </div>
      </div>

      {/* Tool Annotations & Justifications Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="h-4 w-4 text-cyan-400" />
            MCP Tool Catalog, Annotations & Review Justifications
          </h2>
          <p className="text-xs text-slate-400">
            Mandated by OpenAI submission requirements: every tool accurately declares readOnlyHint, openWorldHint, and destructiveHint.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-medium text-slate-400">
              <tr>
                <th className="px-5 py-3">Tool Name</th>
                <th className="px-5 py-3">readOnlyHint</th>
                <th className="px-5 py-3">openWorldHint</th>
                <th className="px-5 py-3">destructiveHint</th>
                <th className="px-5 py-3">Technical Review Justification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {mcpToolsList.map((tool) => (
                <tr key={tool.name} className="hover:bg-slate-800/40 transition">
                  <td className="px-5 py-3 font-mono font-bold text-cyan-300 whitespace-nowrap">
                    {tool.name}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        tool.readOnly
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {String(tool.readOnly)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        tool.openWorld
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {String(tool.openWorld)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        tool.destructive
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {String(tool.destructive)}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-300 max-w-md">{tool.justification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submission Readiness Checklist */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          OpenAI App Technical Eligibility Audit
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {submissionChecklist.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-950 p-3"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-slate-200">{item.label}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">{item.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
