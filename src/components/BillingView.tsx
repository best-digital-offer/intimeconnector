import React, { useState } from 'react';
import { Plan, Subscription, Usage } from '../types';
import {
  CreditCard,
  Check,
  Zap,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface BillingViewProps {
  plans: Plan[];
  subscription: Subscription | null;
  currentPlan: Plan | null;
  usage: Usage | null;
  onCheckout: (planId: string) => Promise<any>;
  onCancel: () => Promise<void>;
  onTriggerWebhook: (event: any) => Promise<any>;
}

export const BillingView: React.FC<BillingViewProps> = ({
  plans,
  subscription,
  currentPlan,
  usage,
  onCheckout,
  onCancel,
  onTriggerWebhook,
}) => {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<string | null>(null);

  const usagePercent = usage ? Math.min(100, Math.round((usage.actions_count / usage.actions_limit) * 100)) : 0;

  const handleSelectPlan = async (planId: string) => {
    setLoadingPlanId(planId);
    try {
      const res = await onCheckout(planId);
      // Simulate successful checkout completion by triggering simulated webhook
      await onTriggerWebhook({
        id: `wh_evt_${Date.now()}`,
        type: 'invoice.payment_succeeded',
        data: {
          userId: usage?.user_id,
          planId,
          amount: plans.find((p) => p.id === planId)?.price_monthly,
        },
      });
      window.location.reload();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setLoadingPlanId(null);
    }
  };

  const simulateWebhook = async (type: any) => {
    setWebhookStatus(`Dispatching ${type}...`);
    try {
      const res = await onTriggerWebhook({
        id: `wh_sim_${Date.now()}`,
        type,
        data: {
          userId: usage?.user_id,
          planId: 'plan_pro',
          amount: 15,
        },
      });
      setWebhookStatus(`Webhook processed: ${JSON.stringify(res)}`);
      setTimeout(() => window.location.reload(), 800);
    } catch (err: unknown) {
      setWebhookStatus(`Webhook failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-cyan-400" />
          Subscription & Usage Entitlements
        </h1>
        <p className="text-xs text-slate-400">
          Manage your account tier and track monthly action consumption.
        </p>
      </div>

      {/* OpenAI Compliance Notice */}
      <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 text-xs text-indigo-300 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-white">ChatGPT Monetization Policy Compliance:</span>
          <p className="text-slate-300">
            In strict compliance with OpenAI’s platform guidelines, the Just-in-Time Connector ChatGPT app does
            <strong> not</strong> sell digital subscriptions, collect credit cards, or initiate in-chat checkouts. All
            entitlements are managed securely on this external website and enforced server-side.
          </p>
        </div>
      </div>

      {/* Current Usage Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-4">
          <div>
            <span className="text-xs font-semibold uppercase text-cyan-400 tracking-wider">Current Tier</span>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              {currentPlan?.name || 'Free Plan'}
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/30">
                ACTIVE
              </span>
            </h2>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400">Monthly Billing:</span>
            <div className="text-2xl font-bold text-white">${currentPlan?.price_monthly || 0}/mo</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium">
            <span className="text-slate-300">
              Actions Consumed: <strong className="text-white">{usage?.actions_count ?? 0}</strong> of{' '}
              {usage?.actions_limit ?? 25}
            </span>
            <span className="text-cyan-400 font-semibold">{usagePercent}% Used</span>
          </div>

          <div className="h-3 w-full rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${usagePercent}%` }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-500">
            <span>Quota resets automatically each month</span>
            <span>
              Period End:{' '}
              {subscription?.current_period_end
                ? new Date(subscription.current_period_end).toLocaleDateString()
                : '30 days from sign up'}
            </span>
          </div>
        </div>
      </div>

      {/* Plans Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrent = subscription?.plan_id === plan.id || (!subscription && plan.id === 'plan_free');
          const isPro = plan.id === 'plan_pro';

          return (
            <div
              key={plan.id}
              className={`flex flex-col justify-between rounded-2xl border p-6 transition ${
                isCurrent
                  ? 'border-cyan-500/60 bg-gradient-to-b from-cyan-950/20 to-slate-900/60 shadow-lg shadow-cyan-500/10'
                  : isPro
                  ? 'border-indigo-500/40 bg-slate-900/80 shadow-md'
                  : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white">{plan.name}</h3>
                  {isPro && (
                    <span className="rounded bg-gradient-to-r from-indigo-500 to-cyan-500 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                      Popular
                    </span>
                  )}
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-white">${plan.price_monthly}</span>
                  <span className="text-xs text-slate-400">/ month</span>
                </div>

                <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/80 text-xs">
                  <div className="font-semibold text-white">{plan.actions_limit.toLocaleString()} actions/mo</div>
                  <div className="text-[11px] text-slate-400">{plan.connections_limit} active connections</div>
                </div>

                <ul className="space-y-2 text-xs text-slate-300">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="h-4 w-4 shrink-0 text-cyan-400" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6">
                {isCurrent ? (
                  <button
                    disabled
                    className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-xs font-bold text-cyan-300 cursor-default"
                  >
                    Current Plan
                  </button>
                ) : (
                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={loadingPlanId === plan.id}
                    className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 p-2.5 text-xs font-bold text-slate-950 transition flex items-center justify-center gap-1 shadow-md shadow-cyan-500/20 disabled:opacity-50"
                  >
                    {loadingPlanId === plan.id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Upgrade to {plan.name}
                        <ExternalLink className="h-3 w-3" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Webhook Simulator for Testing Entitlements & Idempotency */}
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Payment Provider Webhook Simulator</h3>
            <p className="text-xs text-slate-400">
              Test server-side entitlement grant, idempotency deduplication, and downgrade handling
            </p>
          </div>
          {webhookStatus && <span className="text-xs font-mono text-cyan-400">{webhookStatus}</span>}
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => simulateWebhook('invoice.payment_succeeded')}
            className="rounded bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-slate-200 transition"
          >
            Simulate Payment Success (Pro)
          </button>
          <button
            onClick={() => simulateWebhook('customer.subscription.deleted')}
            className="rounded bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-slate-200 transition"
          >
            Simulate Subscription Cancellation
          </button>
          <button
            onClick={() => simulateWebhook('charge.refunded')}
            className="rounded bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-slate-200 transition"
          >
            Simulate Refund
          </button>
        </div>
      </div>
    </div>
  );
};
