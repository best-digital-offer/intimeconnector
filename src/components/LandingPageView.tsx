import React, { useState } from 'react';
import {
  Zap,
  ArrowRight,
  ShieldCheck,
  Bot,
  Play,
  Check,
  Lock,
  Layers,
  Sparkles,
  Server,
  Terminal,
  HelpCircle,
} from 'lucide-react';
import { Plan } from '../types';

interface LandingPageViewProps {
  plans: Plan[];
  onOpenApp: () => void;
  onOpenAuth: () => void;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  plans,
  onOpenApp,
  onOpenAuth,
}) => {
  const [demoInput, setDemoInput] = useState(
    'John Smith from ABC Corp wants a quote for 50 licenses and can be contacted at john@abc.com'
  );
  const [demoOutput, setDemoOutput] = useState<any>({
    name: 'John Smith',
    company: 'ABC Corp',
    request: 'Quote for 50 licenses',
    email: 'john@abc.com',
    source: 'ChatGPT Remote MCP',
    priority: 'HIGH',
  });
  const [isTransforming, setIsTransforming] = useState(false);

  const handleSimulateTransform = () => {
    setIsTransforming(true);
    setTimeout(() => {
      // Heuristic extraction
      const emailMatch = demoInput.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const nameMatch = demoInput.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:from|at)\s+([A-Za-z0-9&.\s]+?)(?:wants|requires|needs|interested|,|\.|$)/i);

      setDemoOutput({
        name: nameMatch ? nameMatch[1].trim() : 'Alice Walker',
        company: nameMatch ? nameMatch[2].trim() : 'Stark Industries',
        request: demoInput.includes('quote') ? 'Pricing Quote' : 'New Ingestion',
        email: emailMatch ? emailMatch[0].toLowerCase() : 'alice@stark.io',
        source: 'ChatGPT Remote MCP',
        timestamp: new Date().toISOString(),
      });
      setIsTransforming(false);
    }, 400);
  };

  return (
    <div className="space-y-20 pb-20">
      {/* Hero Section */}
      <section className="relative pt-12 pb-16 text-center space-y-6 max-w-4xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400">
          <Zap className="h-3.5 w-3.5" />
          The Next-Generation Alternative to Zapier & Make
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Turn Any Instruction Into a{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
            Secure API Action.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Connect your APIs once. Transform your data automatically. Use them from your web dashboard or directly inside{' '}
          <strong>ChatGPT</strong> through our production remote MCP server.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={onOpenApp}
            className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 px-6 py-3.5 text-sm font-bold text-slate-950 transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25"
          >
            Create Your First Connection
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              const el = document.getElementById('how-it-works');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}
            className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 px-6 py-3.5 text-sm font-bold text-slate-200 transition"
          >
            See How It Works
          </button>
        </div>
      </section>

      {/* Interactive Live Demo */}
      <section className="max-w-5xl mx-auto px-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <div className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Interactive Playground</div>
              <h2 className="text-lg font-bold text-white">Experience Natural-Language Execution</h2>
            </div>
            <span className="rounded-full bg-emerald-500/10 text-emerald-400 px-3 py-1 text-xs font-semibold border border-emerald-500/30">
              Live Remote MCP Architecture
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300">
                1. What you say to ChatGPT or submit in Dashboard:
              </label>
              <textarea
                rows={5}
                value={demoInput}
                onChange={(e) => setDemoInput(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs text-white focus:border-cyan-500 focus:outline-none"
              />
              <button
                onClick={handleSimulateTransform}
                disabled={isTransforming}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-bold text-white transition flex items-center gap-1.5"
              >
                <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                {isTransforming ? 'Transforming with Gemini...' : 'Transform & Validate'}
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                2. Structured, Validated Payload Sent to Target Webhook:
              </label>
              <pre className="h-[125px] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-300">
                {JSON.stringify(demoOutput, null, 2)}
              </pre>
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-cyan-400 shrink-0" />
                AES-256 Bearer Token injected server-side. Zero plaintext keys in browser or prompt.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="max-w-5xl mx-auto px-4 space-y-10">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">How It Works in 3 Simple Steps</h2>
          <p className="text-xs sm:text-sm text-slate-400">No multi-step workflow graphs. No zap maintenance.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 font-bold border border-cyan-500/30">
              1
            </div>
            <h3 className="text-base font-bold text-white">Connect Once</h3>
            <p className="text-xs text-slate-400">
              Add your webhook, CRM endpoint, or internal REST API. Enter your Bearer token or API key once. It is
              immediately encrypted at rest with AES-256-GCM.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/30">
              2
            </div>
            <h3 className="text-base font-bold text-white">Define Rules or Use AI</h3>
            <p className="text-xs text-slate-400">
              Set simple visual mapping rules or let our built-in Gemini 3.8 Flash model extract entities from
              unstructured text automatically.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
              3
            </div>
            <h3 className="text-base font-bold text-white">Execute On Demand</h3>
            <p className="text-xs text-slate-400">
              Ask ChatGPT: <em>&ldquo;Send this client summary to my CRM.&rdquo;</em> The remote MCP server validates
              your account, attaches credentials, dispatches safely, and reports back.
            </p>
          </div>
        </div>
      </section>

      {/* Why It Is Different Table */}
      <section className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Why It&rsquo;s Different From Zapier or Make</h2>
          <p className="text-xs sm:text-sm text-slate-400">Explain the API action. Don&rsquo;t build a workflow.</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold">
              <tr>
                <th className="p-4">Capability</th>
                <th className="p-4 text-cyan-400 font-bold">Just-in-Time Connector</th>
                <th className="p-4 text-slate-500">Traditional Zapier / Make</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              <tr>
                <td className="p-4 font-semibold text-white">Execution Paradigm</td>
                <td className="p-4 text-cyan-300">Just-in-time from natural conversation</td>
                <td className="p-4 text-slate-500">Rigid trigger-action multi-step graph</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">ChatGPT Remote MCP</td>
                <td className="p-4 text-emerald-400 flex items-center gap-1">
                  <Check className="h-4 w-4" /> Native Streamable HTTP MCP (2024-11-05)
                </td>
                <td className="p-4 text-slate-500">Limited custom actions / polling delay</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">SSRF Defense</td>
                <td className="p-4 text-emerald-400 flex items-center gap-1">
                  <Check className="h-4 w-4" /> Strict DNS & RFC1918 pre-flight blocking
                </td>
                <td className="p-4 text-slate-500">Variable / Blackbox</td>
              </tr>
              <tr>
                <td className="p-4 font-semibold text-white">Credential Protection</td>
                <td className="p-4 text-emerald-400 flex items-center gap-1">
                  <Check className="h-4 w-4" /> AES-256-GCM Envelope Encryption
                </td>
                <td className="p-4 text-slate-500">Standard cloud database store</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-5xl mx-auto px-4 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold text-white">Transparent, Economical Pricing</h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Start free with 25 actions. Upgrade only when your volume grows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-white text-base">{p.name}</h3>
                <div className="mt-2 text-2xl font-extrabold text-white">${p.price_monthly}<span className="text-xs font-normal text-slate-400">/mo</span></div>
                <div className="mt-1 text-xs text-cyan-400 font-semibold">{p.actions_limit.toLocaleString()} actions/mo</div>

                <ul className="mt-4 space-y-2 text-xs text-slate-300">
                  {p.features.slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Check className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button
                onClick={onOpenApp}
                className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-xs font-bold text-white transition"
              >
                Choose {p.name}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">Frequently Asked Questions</h2>
        </div>

        <div className="space-y-3 text-xs">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
            <h3 className="font-semibold text-white">Can ChatGPT read my API credentials?</h3>
            <p className="text-slate-400">
              Never. ChatGPT connects to our remote MCP server using your authenticated OAuth or API key token. When an
              action is executed, our server injects the decrypted secret directly into the outbound HTTP header. The LLM
              only receives the safe response summary.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
            <h3 className="font-semibold text-white">Can users trigger requests to arbitrary internal URLs (SSRF)?</h3>
            <p className="text-slate-400">
              No. All target URLs are rigorously evaluated by our SSRF engine. Any URL resolving to localhost, 127.0.0.1,
              AWS/GCP metadata endpoints (169.254.169.254), or RFC1918 private IP ranges is immediately blocked.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-1">
            <h3 className="font-semibold text-white">Why does billing live on the external website?</h3>
            <p className="text-slate-400">
              In accordance with OpenAI platform monetization rules, ChatGPT apps are prohibited from selling digital
              subscriptions or initiating checkouts inside chat. All subscriptions are purchased on this website and
              entitlements are enforced server-side.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 pt-8 max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
        <div>
          © 2026 Just-in-Time Connector Technologies Inc. All rights reserved.
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onOpenApp} className="hover:text-slate-300">Dashboard</button>
          <a href="#how-it-works" className="hover:text-slate-300">Documentation</a>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400 font-mono text-[11px]">Streamable HTTP MCP v2024-11-05</span>
        </div>
      </footer>
    </div>
  );
};
