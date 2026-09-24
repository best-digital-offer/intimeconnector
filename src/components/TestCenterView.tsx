import React, { useState } from 'react';
import { Connection, Transformation } from '../types';
import {
  FlaskConical,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Lock,
  ArrowRight,
  Terminal,
  Sparkles,
} from 'lucide-react';

interface TestCenterViewProps {
  connections: Connection[];
  transformations: Transformation[];
  onExecute: (data: any) => Promise<any>;
}

export const TestCenterView: React.FC<TestCenterViewProps> = ({
  connections,
  transformations,
  onExecute,
}) => {
  const [selectedConnId, setSelectedConnId] = useState<string>(connections[0]?.id || '');
  const [selectedTransId, setSelectedTransId] = useState<string>('');
  const [inputPayload, setInputPayload] = useState<string>(
    'Alice Cooper from Cyberdyne Systems wants 50 enterprise licenses and can be reached at alice@cyberdyne.io'
  );
  const [idempotencyKey, setIdempotencyKey] = useState<string>(`test_key_${Date.now()}`);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedConn = connections.find((c) => c.id === selectedConnId);

  const handleRunExecution = async () => {
    if (!selectedConnId) {
      setError('Please select a connection.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await onExecute({
        connection_id: selectedConnId,
        transformation_id: selectedTransId || undefined,
        input_data: inputPayload,
        idempotency_key: idempotencyKey,
      });
      setResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-emerald-400" />
          Execution Test Center
        </h1>
        <p className="text-xs text-slate-400">
          Simulate a real execution exactly as ChatGPT or your external webhook will trigger it.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2 border-b border-slate-800 pb-3">
              <Terminal className="h-4 w-4 text-cyan-400" />
              1. Execution Parameters
            </h2>

            {/* Connection Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Target Connection</label>
              <select
                value={selectedConnId}
                onChange={(e) => setSelectedConnId(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.http_method} • {new URL(c.endpoint_url).hostname})
                  </option>
                ))}
              </select>
              {selectedConn && (
                <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                  <span className="text-cyan-400 font-semibold">{selectedConn.http_method}</span>
                  <span className="truncate">{selectedConn.endpoint_url}</span>
                  <span className="flex items-center gap-0.5 text-slate-300 bg-slate-800 px-1.5 py-0.5 rounded text-[10px]">
                    <Lock className="h-2.5 w-2.5 text-cyan-400" />
                    {selectedConn.auth_type.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* Transformation Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Transformation Rule (Optional)
              </label>
              <select
                value={selectedTransId}
                onChange={(e) => setSelectedTransId(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Auto-Detect / Heuristic NLP Extractor</option>
                {transformations.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.mode})
                  </option>
                ))}
              </select>
            </div>

            {/* Idempotency Key */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Idempotency Key
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 font-mono focus:border-cyan-500 focus:outline-none"
                />
                <button
                  onClick={() => setIdempotencyKey(`test_key_${Date.now()}`)}
                  className="rounded bg-slate-800 hover:bg-slate-700 px-3 text-xs text-slate-300 transition"
                  title="Generate New Key"
                >
                  New
                </button>
              </div>
            </div>

            {/* Payload Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  Input Instruction or Payload
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setInputPayload(
                        'John Smith from Acme Global Corp wants a quote for 100 enterprise licenses. Contact: john@acmeglobal.com'
                      )
                    }
                    className="text-[10px] text-cyan-400 hover:underline"
                  >
                    Load Lead Prompt
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() =>
                      setInputPayload(
                        JSON.stringify(
                          { full_name: 'Sarah Connor', company_name: 'Cyberdyne', email: 'sarah@sky.net' },
                          null,
                          2
                        )
                      )
                    }
                    className="text-[10px] text-cyan-400 hover:underline"
                  >
                    Load JSON
                  </button>
                </div>
              </div>
              <textarea
                rows={6}
                value={inputPayload}
                onChange={(e) => setInputPayload(e.target.value)}
                placeholder="Enter free-form natural language or raw JSON..."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <button
              onClick={handleRunExecution}
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-600 hover:from-emerald-400 hover:to-cyan-500 p-3 text-xs font-bold text-slate-950 transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Executing & Validating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Secure Execution
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Execution Output */}
        <div className="lg:col-span-6 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                2. Live Execution Result
              </h2>
              {result && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    result.success
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {result.success ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                  {result.success ? 'SUCCESS (200 OK)' : 'FAILED'}
                </span>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300">
                <span className="font-semibold">Execution Error:</span> {error}
              </div>
            )}

            {result ? (
              <div className="space-y-3 text-xs">
                {/* Latency & Correlation stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase">Duration</span>
                    <span className="font-bold text-white text-sm">{result.durationMs} ms</span>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase">HTTP Status</span>
                    <span
                      className={`font-bold text-sm ${
                        result.httpStatus && result.httpStatus < 400 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {result.httpStatus || 'N/A'}
                    </span>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <span className="text-[10px] text-slate-500 block uppercase">Attempts</span>
                    <span className="font-bold text-white text-sm">{result.attemptsCount}</span>
                  </div>
                </div>

                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Request ID:</span>
                    <span className="font-mono text-cyan-400">{result.requestId}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Correlation ID:</span>
                    <span className="font-mono text-slate-300">{result.correlationId}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Safe Response Preview (Redacted & Truncated)
                  </span>
                  <pre className="max-h-64 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-200">
                    {result.safeResponsePreview || result.errorMessage || '// No response body returned'}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="py-16 text-center text-slate-500 text-xs">
                <FlaskConical className="h-8 w-8 mx-auto mb-2 text-slate-700" />
                Configure parameters and click &ldquo;Run Secure Execution&rdquo; to test endpoint dispatch.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
