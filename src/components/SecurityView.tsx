import React, { useState } from 'react';
import { SecurityEvent } from '../types';
import {
  ShieldAlert,
  ShieldCheck,
  Lock,
  AlertTriangle,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  EyeOff,
  Server,
} from 'lucide-react';

interface SecurityViewProps {
  securityEvents: SecurityEvent[];
  onTestSsrf: (url: string) => Promise<any>;
}

export const SecurityView: React.FC<SecurityViewProps> = ({
  securityEvents,
  onTestSsrf,
}) => {
  const [testUrl, setTestUrl] = useState('http://169.254.169.254/latest/meta-data/');
  const [testing, setTesting] = useState(false);
  const [ssrfResult, setSsrfResult] = useState<any | null>(null);

  const handleTestSsrf = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setSsrfResult(null);
    try {
      const res = await onTestSsrf(testUrl);
      setSsrfResult(res);
    } catch (err: unknown) {
      setSsrfResult({ is_safe: false, reason: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const presetAttackUrls = [
    { label: 'AWS/GCP Metadata IP', url: 'http://169.254.169.254/latest/meta-data/' },
    { label: 'Localhost Loopback', url: 'http://localhost:6379/keys' },
    { label: 'Private Subnet (10.0.0.1)', url: 'http://10.0.0.1/admin' },
    { label: 'Valid Public API', url: 'https://httpbin.org/post' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-cyan-400" />
          Enterprise Security & SSRF Shield
        </h1>
        <p className="text-xs text-slate-400">
          Multi-layer defense protecting against Server-Side Request Forgery, unauthorized proxies, and secret leakage.
        </p>
      </div>

      {/* Security Architecture Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs">
            <Lock className="h-4 w-4" />
            AES-256-GCM Envelope Encryption
          </div>
          <p className="text-xs text-slate-300">
            Secrets are encrypted at rest with 128-bit authentication tags and unique 96-bit initialization vectors.
            Master keys are strictly environment-managed.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-indigo-400 font-semibold text-xs">
            <Server className="h-4 w-4" />
            Full DNS SSRF Resolution Guard
          </div>
          <p className="text-xs text-slate-300">
            Outbound URLs undergo pre-flight DNS lookup. Resolving to 127.0.0.0/8, 169.254.0.0/16, RFC1918 ranges, or
            IPv6 local loops triggers immediate socket termination.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
            <EyeOff className="h-4 w-4" />
            Zero-Trust LLM Authorization
          </div>
          <p className="text-xs text-slate-300">
            The AI model never decides user identity or access rights. All connection ownership, usage limits, and
            tokens are verified server-side prior to execution.
          </p>
        </div>
      </div>

      {/* Interactive SSRF Testing Sandbox */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            Interactive SSRF Shield Verification Sandbox
          </h2>
          <p className="text-xs text-slate-400">
            Test how our server-side validator analyzes URLs and blocks malicious internal probes before any network
            socket is opened.
          </p>
        </div>

        <form onSubmit={handleTestSsrf} className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              required
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="Enter URL to test (e.g. http://169.254.169.254 or https://api.stripe.com)"
              className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={testing}
              className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 transition flex items-center gap-1.5 shrink-0 disabled:opacity-50"
            >
              {testing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Test URL
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 text-[11px]">Quick Attack Presets:</span>
            {presetAttackUrls.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setTestUrl(preset.url)}
                className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-1 text-[11px] text-slate-300 font-mono transition"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </form>

        {ssrfResult && (
          <div
            className={`rounded-xl border p-4 text-xs space-y-1.5 ${
              ssrfResult.is_safe
                ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                : 'border-rose-500/30 bg-rose-950/20 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-sm">
              {ssrfResult.is_safe ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  URL Verified Safe (Outbound execution permitted)
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-rose-400" />
                  SSRF Threat Intercepted & Blocked
                </>
              )}
            </div>
            {ssrfResult.reason && <p className="text-slate-200">Reason: {ssrfResult.reason}</p>}
            {ssrfResult.resolved_ip && (
              <p className="font-mono text-[11px] text-slate-400">
                Resolved IP Address: <span className="text-white">{ssrfResult.resolved_ip}</span>
              </p>
            )}
          </div>
        )}
      </div>

      {/* Security Audit Events */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Security Event Stream</h2>
            <p className="text-xs text-slate-400">Automated detections and blocked attack vectors</p>
          </div>
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
            {securityEvents.length} events logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-medium text-slate-400">
              <tr>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3">Event Type</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Client IP</th>
                <th className="px-5 py-3">Enforcement</th>
                <th className="px-5 py-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {securityEvents.map((evt) => (
                <tr key={evt.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                    {new Date(evt.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-3 font-mono font-medium text-cyan-400 whitespace-nowrap">
                    {evt.event_type}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                        evt.severity === 'high' || evt.severity === 'critical'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {evt.severity}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-slate-400 whitespace-nowrap">{evt.ip_address}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <span className="rounded bg-rose-500/10 text-rose-400 px-1.5 py-0.5 text-[10px] font-semibold border border-rose-500/20">
                      BLOCKED
                    </span>
                  </td>
                  <td className="px-5 py-3 max-w-xs truncate text-slate-400">
                    {JSON.stringify(evt.details)}
                  </td>
                </tr>
              ))}
              {securityEvents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    No security events detected. All traffic within normal security boundaries.
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
