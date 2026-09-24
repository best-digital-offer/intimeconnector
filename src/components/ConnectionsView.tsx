import React, { useState } from 'react';
import { Connection, HttpMethod, AuthType } from '../types';
import {
  Plus,
  PlugZap,
  Lock,
  Globe,
  Trash2,
  Edit2,
  Play,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Shield,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';

interface ConnectionsViewProps {
  connections: Connection[];
  onSaveConnection: (connectionData: any) => Promise<void>;
  onDeleteConnection: (id: string) => Promise<void>;
  onTestConnection: (id: string) => Promise<any>;
  planConnectionLimit: number;
}

export const ConnectionsView: React.FC<ConnectionsViewProps> = ({
  connections,
  onSaveConnection,
  onDeleteConnection,
  onTestConnection,
  planConnectionLimit,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConn, setEditingConn] = useState<Connection | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [httpMethod, setHttpMethod] = useState<HttpMethod>('POST');
  const [authType, setAuthType] = useState<AuthType>('bearer');
  const [secret, setSecret] = useState('');
  const [headersJson, setHeadersJson] = useState('{\n  "Content-Type": "application/json"\n}');
  const [queryParamsJson, setQueryParamsJson] = useState('{}');
  const [timeoutMs, setTimeoutMs] = useState(8000);
  const [retryCount, setRetryCount] = useState(2);

  const openCreateModal = () => {
    setEditingConn(null);
    setName('');
    setDescription('');
    setEndpointUrl('https://httpbin.org/post');
    setHttpMethod('POST');
    setAuthType('bearer');
    setSecret('');
    setHeadersJson('{\n  "Content-Type": "application/json"\n}');
    setQueryParamsJson('{}');
    setTimeoutMs(8000);
    setRetryCount(2);
    setFormError(null);
    setModalOpen(true);
  };

  const openEditModal = (conn: Connection) => {
    setEditingConn(conn);
    setName(conn.name);
    setDescription(conn.description);
    setEndpointUrl(conn.endpoint_url);
    setHttpMethod(conn.http_method);
    setAuthType(conn.auth_type);
    setSecret(''); // Keep blank to retain existing
    setHeadersJson(JSON.stringify(conn.headers, null, 2));
    setQueryParamsJson(JSON.stringify(conn.query_params, null, 2));
    setTimeoutMs(conn.timeout_ms || 8000);
    setRetryCount(conn.retry_count || 2);
    setFormError(null);
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let parsedHeaders = {};
    let parsedParams = {};
    try {
      parsedHeaders = JSON.parse(headersJson || '{}');
      parsedParams = JSON.parse(queryParamsJson || '{}');
    } catch {
      setFormError('Headers or Query Parameters must be valid JSON.');
      return;
    }

    setLoading(true);
    try {
      await onSaveConnection({
        id: editingConn?.id,
        name,
        description,
        endpoint_url: endpointUrl,
        http_method: httpMethod,
        auth_type: authType,
        secret: secret || undefined,
        headers: parsedHeaders,
        query_params: parsedParams,
        timeout_ms: timeoutMs,
        retry_count: retryCount,
      });
      setModalOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (connId: string) => {
    setTestingId(connId);
    setTestResult(null);
    try {
      const result = await onTestConnection(connId);
      setTestResult({ connId, ...result });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setTestResult({ connId, success: false, errorMessage: msg });
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <PlugZap className="h-5 w-5 text-cyan-400" />
            API & Webhook Connections
          </h1>
          <p className="text-xs text-slate-400">
            Define your API destinations once. Credentials are encrypted at rest using AES-256-GCM.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400">
            Using <span className="font-semibold text-white">{connections.length}</span> of{' '}
            <span className="font-semibold text-white">{planConnectionLimit}</span> connections
          </div>
          <button
            onClick={openCreateModal}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-indigo-500 transition flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Connection
          </button>
        </div>
      </div>

      {/* Test feedback banner if active */}
      {testResult && (
        <div
          className={`rounded-xl border p-4 text-xs ${
            testResult.success
              ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
              : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
          }`}
        >
          <div className="flex items-center justify-between font-semibold">
            <div className="flex items-center gap-2">
              {testResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-400" />
              )}
              Connection Test Result: {testResult.success ? 'ONLINE & RESPONDING' : 'FAILED'}
            </div>
            <button onClick={() => setTestResult(null)} className="text-slate-400 hover:text-white">
              Dismiss
            </button>
          </div>
          <p className="mt-1 text-slate-300">
            HTTP Status: {testResult.httpStatus || 'N/A'} | Latency: {testResult.durationMs ?? 0} ms
          </p>
          {testResult.errorMessage && <p className="mt-1 text-rose-400">{testResult.errorMessage}</p>}
          {testResult.safeResponsePreview && (
            <pre className="mt-2 p-2 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono overflow-x-auto text-slate-300 max-h-32">
              {testResult.safeResponsePreview}
            </pre>
          )}
        </div>
      )}

      {/* Connections Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {connections.map((conn) => (
          <div
            key={conn.id}
            className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5 hover:border-slate-700 transition space-y-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/60 border border-indigo-800/40 text-indigo-400">
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white leading-tight">{conn.name}</h3>
                    <span className="text-[10px] font-mono text-cyan-400 uppercase font-semibold">
                      {conn.http_method}
                    </span>
                  </div>
                </div>

                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1 ${
                    conn.status === 'active'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {conn.status.toUpperCase()}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-400 line-clamp-2">{conn.description || 'No description provided.'}</p>

              <div className="mt-3 space-y-1.5 text-xs font-mono text-slate-300 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80">
                <div className="truncate text-[11px] text-slate-400">
                  <span className="text-slate-500">URL:</span> {conn.endpoint_url}
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Auth:</span>
                  <span className="text-slate-300 font-sans flex items-center gap-1">
                    <Lock className="h-3 w-3 text-cyan-400" />
                    {conn.auth_type.toUpperCase()}
                  </span>
                </div>
                {conn.credential_masked && (
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Key:</span>
                    <span className="text-cyan-400">{conn.credential_masked}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-3 flex items-center justify-between">
              <button
                onClick={() => handleTest(conn.id)}
                disabled={testingId === conn.id}
                className="flex items-center gap-1.5 rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-200 transition disabled:opacity-50"
              >
                {testingId === conn.id ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                ) : (
                  <Play className="h-3.5 w-3.5 text-emerald-400" />
                )}
                {testingId === conn.id ? 'Pinging...' : 'Test Connection'}
              </button>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEditModal(conn)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  title="Edit Connection"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDeleteConnection(conn.id)}
                  className="rounded p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  title="Delete Connection"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal for Create/Edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <PlugZap className="h-4 w-4 text-cyan-400" />
                {editingConn ? 'Edit Connection' : 'Create New API / Webhook Connection'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {formError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-rose-300 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Connection Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HubSpot CRM Webhook, Internal ERP"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief note about the endpoint purpose"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block font-semibold text-slate-300 mb-1">HTTP Method</label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value as HttpMethod)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="POST">POST</option>
                    <option value="GET">GET</option>
                    <option value="PUT">PUT</option>
                    <option value="PATCH">PATCH</option>
                    <option value="DELETE">DELETE</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-300 mb-1">Endpoint URL</label>
                  <input
                    type="url"
                    required
                    value={endpointUrl}
                    onChange={(e) => setEndpointUrl(e.target.value)}
                    placeholder="https://api.yourdomain.com/webhook"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Authentication Method</label>
                  <select
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value as AuthType)}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="none">No Auth (Public Webhook)</option>
                    <option value="bearer">Bearer Token (Authorization: Bearer ...)</option>
                    <option value="api_key">API Key (X-API-Key: ...)</option>
                    <option value="basic">Basic Auth (user:password)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    {authType === 'none' ? 'Secret (Disabled)' : 'Credential Secret'}
                  </label>
                  <input
                    type="password"
                    disabled={authType === 'none'}
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    placeholder={
                      editingConn && connSecretPlaceholder(editingConn)
                        ? `Leave blank to keep existing (${connSecretPlaceholder(editingConn)})`
                        : 'Enter secret token or key'
                    }
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none disabled:opacity-40"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Default Headers (JSON)
                </label>
                <textarea
                  rows={3}
                  value={headersJson}
                  onChange={(e) => setHeadersJson(e.target.value)}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Timeout (ms)</label>
                  <input
                    type="number"
                    min={1000}
                    max={15000}
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Max Retries</label>
                  <input
                    type="number"
                    min={0}
                    max={3}
                    value={retryCount}
                    onChange={(e) => setRetryCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition disabled:opacity-50"
                >
                  {loading ? 'Saving...' : editingConn ? 'Update Connection' : 'Create Connection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

function connSecretPlaceholder(conn: Connection): string | undefined {
  return conn.credential_masked;
}
