import React, { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  Zap,
  Bot,
  ShieldCheck,
  Lock,
  Code,
  Terminal,
} from 'lucide-react';

export const DocsView: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'quickstart' | 'connections' | 'mcp' | 'ssrf' | 'api'>('quickstart');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copySnippet = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const curlExample = `curl -X POST https://yourdomain.com/api/execute \\
  -H "Authorization: Bearer jtc_live_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "connection_id": "conn_crm_001",
    "input_data": "John Smith from Acme Corp wants a quote for 50 licenses. Email: john@acme.com"
  }'`;

  const mcpConfigExample = `{
  "mcpServers": {
    "just-in-time-connector": {
      "url": "https://yourdomain.com/mcp",
      "headers": {
        "Authorization": "Bearer jtc_live_your_api_key"
      }
    }
  }
}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-indigo-400" />
          Developer Documentation & API Guides
        </h1>
        <p className="text-xs text-slate-400">
          Everything you need to configure endpoints, build transformations, and connect ChatGPT.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Navigation */}
        <div className="md:col-span-3 space-y-1">
          {[
            { id: 'quickstart', label: '1. Quickstart Guide' },
            { id: 'connections', label: '2. Connection Setup & Auth' },
            { id: 'mcp', label: '3. ChatGPT Remote MCP' },
            { id: 'ssrf', label: '4. SSRF & Security Rules' },
            { id: 'api', label: '5. Direct REST API' },
          ].map((sec) => (
            <button
              key={sec.id}
              onClick={() => setActiveSection(sec.id as any)}
              className={`w-full text-left rounded-lg px-3 py-2 text-xs font-semibold transition ${
                activeSection === sec.id
                  ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {sec.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="md:col-span-9 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6 text-xs text-slate-300">
          {activeSection === 'quickstart' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-cyan-400" />
                Quickstart: From Natural Language to Dispatched Webhook
              </h2>
              <p>
                Just-in-Time Connector is designed for non-technical users and AI agents to dispatch API requests
                without complex workflow graphs. Here is the lifecycle:
              </p>

              <ol className="list-decimal list-inside space-y-2 text-slate-300">
                <li>
                  <strong className="text-white">Create a Connection:</strong> Save your target endpoint URL (e.g.{' '}
                  <code>https://httpbin.org/post</code> or your CRM webhook) and select authentication.
                </li>
                <li>
                  <strong className="text-white">Set Transformation (Optional):</strong> Define mapping rules or let
                  our built-in Gemini 3.8 Flash model extract key entities automatically.
                </li>
                <li>
                  <strong className="text-white">Instruct from ChatGPT or Dashboard:</strong> Pass natural-language
                  input like <em>&ldquo;Send this lead to my CRM&rdquo;</em>.
                </li>
                <li>
                  <strong className="text-white">Secure Execution:</strong> The server verifies your identity, checks
                  the endpoint for SSRF safety, attaches encrypted credentials, dispatches the HTTP call, and returns
                  a safe confirmation.
                </li>
              </ol>
            </div>
          )}

          {activeSection === 'connections' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-indigo-400" />
                Connection Setup & Credential Storage
              </h2>
              <p>
                We support REST APIs and incoming webhooks with standard HTTP verbs (<code>POST</code>,{' '}
                <code>PUT</code>, <code>PATCH</code>, <code>GET</code>, <code>DELETE</code>).
              </p>

              <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <span className="font-semibold text-white">Encryption at Rest</span>
                <p className="text-slate-400">
                  Credentials (Bearer tokens, API keys, basic auth passwords) are encrypted using{' '}
                  <strong>AES-256-GCM envelope encryption</strong> with a 96-bit initialization vector and 128-bit
                  authentication tag. Secrets are NEVER returned in cleartext to frontend responses or LLM prompts.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'mcp' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bot className="h-4 w-4 text-amber-400" />
                Connecting ChatGPT via Remote Streamable HTTP MCP
              </h2>
              <p>
                Just-in-Time Connector exposes a remote MCP server compliant with the <code>2024-11-05</code>{' '}
                Streamable HTTP protocol.
              </p>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">Configuration Snippet:</span>
                  <button
                    onClick={() => copySnippet(mcpConfigExample, 'mcp')}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    {copiedCode === 'mcp' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy JSON
                  </button>
                </div>
                <pre className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-cyan-300 overflow-x-auto">
                  {mcpConfigExample}
                </pre>
              </div>
            </div>
          )}

          {activeSection === 'ssrf' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                SSRF Protection & Outbound Guardrails
              </h2>
              <p>
                To prevent our infrastructure from being abused as an open proxy or used to attack internal cloud
                services, all target URLs undergo pre-flight verification:
              </p>

              <ul className="list-disc list-inside space-y-1.5 text-slate-300">
                <li>
                  <strong>Loopback blocking:</strong> <code>127.0.0.0/8</code>, <code>::1</code>, <code>localhost</code>
                </li>
                <li>
                  <strong>Cloud Metadata endpoints:</strong> <code>169.254.169.254</code>, <code>metadata.google.internal</code>
                </li>
                <li>
                  <strong>RFC1918 Private ranges:</strong> <code>10.0.0.0/8</code>, <code>172.16.0.0/12</code>, <code>192.168.0.0/16</code>
                </li>
                <li>
                  <strong>Protocol restriction:</strong> Only HTTPS is permitted for external targets in production.
                </li>
              </ul>
            </div>
          )}

          {activeSection === 'api' && (
            <div className="space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="h-4 w-4 text-cyan-400" />
                Direct Execution API (cURL)
              </h2>
              <p>You can execute requests programmatically using your personal API key:</p>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-white">Example POST /api/execute:</span>
                  <button
                    onClick={() => copySnippet(curlExample, 'curl')}
                    className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300"
                  >
                    {copiedCode === 'curl' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    Copy cURL
                  </button>
                </div>
                <pre className="rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-200 overflow-x-auto">
                  {curlExample}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
