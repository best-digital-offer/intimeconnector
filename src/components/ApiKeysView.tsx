import React, { useState } from 'react';
import { ApiKeyItem } from '../types';
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Clock,
} from 'lucide-react';

interface ApiKeysViewProps {
  apiKeys: ApiKeyItem[];
  onCreateKey: (name: string) => Promise<any>;
  onRevokeKey: (id: string) => Promise<void>;
}

export const ApiKeysView: React.FC<ApiKeysViewProps> = ({
  apiKeys,
  onCreateKey,
  onRevokeKey,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await onCreateKey(keyName || 'Production API Key');
      setCreatedSecret(res.api_key.raw_key);
      setKeyName('');
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (createdSecret) {
      navigator.clipboard.writeText(createdSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-indigo-400" />
            API Credentials & Personal Tokens
          </h1>
          <p className="text-xs text-slate-400">
            Authenticate requests to the Just-in-Time Connector API and ChatGPT Remote MCP server.
          </p>
        </div>

        <button
          onClick={() => {
            setCreatedSecret(null);
            setModalOpen(true);
          }}
          className="rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-indigo-500 transition flex items-center gap-1.5 self-start"
        >
          <Plus className="h-4 w-4" />
          Generate API Key
        </button>
      </div>

      {/* Security note */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-white">One-Way SHA-256 Key Hashing:</span>
          <p className="text-slate-400">
            For maximum security, raw API key tokens are displayed exactly once at creation and never stored in raw
            plaintext on our servers. Store your secret key in a secure secrets manager.
          </p>
        </div>
      </div>

      {/* Keys Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-medium text-slate-400">
            <tr>
              <th className="px-5 py-3">Key Name</th>
              <th className="px-5 py-3">Key Prefix</th>
              <th className="px-5 py-3">Scopes</th>
              <th className="px-5 py-3">Last Used</th>
              <th className="px-5 py-3">Created</th>
              <th className="px-5 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {apiKeys.map((key) => (
              <tr key={key.id} className="hover:bg-slate-800/40 transition">
                <td className="px-5 py-3 font-semibold text-white flex items-center gap-2">
                  <KeyRound className="h-3.5 w-3.5 text-indigo-400" />
                  {key.name}
                </td>
                <td className="px-5 py-3 font-mono text-[11px] text-cyan-400">{key.key_prefix}••••••••</td>
                <td className="px-5 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {key.scopes.map((s, i) => (
                      <span key={i} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-400">
                  {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never used'}
                </td>
                <td className="px-5 py-3 text-slate-400">{new Date(key.created_at).toLocaleDateString()}</td>
                <td className="px-5 py-3 text-right">
                  {key.is_revoked ? (
                    <span className="text-[10px] font-semibold text-rose-400">REVOKED</span>
                  ) : (
                    <button
                      onClick={() => onRevokeKey(key.id)}
                      className="rounded bg-rose-500/10 hover:bg-rose-500/20 px-2.5 py-1 text-[11px] font-semibold text-rose-400 transition"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {apiKeys.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                  No API keys generated yet. Click &ldquo;Generate API Key&rdquo; to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Key Generation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 text-xs">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-cyan-400" />
              Generate Personal API Key
            </h2>

            {!createdSecret ? (
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Key Name / Description</label>
                  <input
                    type="text"
                    required
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="e.g. ChatGPT Remote MCP Key, Zapier Webhook Key"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 text-[11px] text-slate-400 space-y-1">
                  <div className="font-semibold text-slate-300">Default Key Permissions:</div>
                  <div>• connections:read (inspect user connections)</div>
                  <div>• execute (run authenticated API dispatches)</div>
                  <div>• profile:read (read plan & usage limits)</div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 font-semibold text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-1.5 font-semibold text-slate-950 disabled:opacity-50"
                  >
                    {loading ? 'Generating...' : 'Create Key'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
                  <span>
                    Copy this key immediately. You will <strong>not</strong> be able to view it again after closing this window.
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-slate-300">Your New API Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdSecret}
                      className="w-full rounded-lg border border-cyan-500/40 bg-slate-950 p-2.5 font-mono text-cyan-300 select-all focus:outline-none"
                    />
                    <button
                      onClick={copyToClipboard}
                      className="rounded-lg bg-cyan-500 hover:bg-cyan-400 p-2.5 text-slate-950 transition flex items-center gap-1 font-semibold"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => {
                      setModalOpen(false);
                      setCreatedSecret(null);
                    }}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2 font-semibold text-white transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
