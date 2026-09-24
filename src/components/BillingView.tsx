import React, { useState } from 'react';
import type { Plan, Subscription, Usage } from '../types';
import { CreditCard, Check, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';

interface BillingViewProps {
  plans: Plan[];
  subscription: Subscription | null;
  currentPlan: Plan | null;
  usage: Usage | null;
  onCheckout: (planId: string) => Promise<any>;
  onCancel: () => Promise<void>;
}

export const BillingView: React.FC<BillingViewProps> = ({ plans, subscription, currentPlan, usage, onCheckout, onCancel }) => {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const usagePercent = usage ? Math.min(100, Math.round((usage.actions_count / Math.max(1, usage.actions_limit)) * 100)) : 0;

  const handleSelectPlan = async (planId: string) => {
    setLoadingPlanId(planId);
    try {
      const res = await onCheckout(planId);
      if (!res?.checkoutUrl) throw new Error('Checkout URL was not returned.');
      window.location.assign(res.checkoutUrl);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Unable to start checkout.');
    } finally { setLoadingPlanId(null); }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel renewal for this subscription?')) return;
    setCancelling(true);
    try { await onCancel(); window.location.reload(); }
    catch (err: unknown) { alert(err instanceof Error ? err.message : 'Unable to cancel subscription.'); }
    finally { setCancelling(false); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2"><CreditCard className="h-5 w-5 text-cyan-400" /> Subscription & Usage</h1>
        <p className="text-xs text-slate-400">Billing is completed on the external website. ChatGPT does not process subscription checkout.</p>
      </div>

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-4 text-xs text-indigo-300 flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
        <div><span className="font-semibold text-white">External billing</span><p className="text-slate-300 mt-1">Checkout is handled by the configured external payment provider. No payment events are simulated in the application.</p></div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-800 pb-4">
          <div><span className="text-xs font-semibold uppercase text-cyan-400 tracking-wider">Current plan</span><h2 className="text-xl font-bold text-white">{currentPlan?.name || 'Free'}</h2></div>
          <div className="text-right"><span className="text-xs text-slate-400">Monthly</span><div className="text-2xl font-bold text-white">${currentPlan?.price_monthly || 0}/mo</div></div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-medium"><span className="text-slate-300">{usage?.actions_count ?? 0} / {usage?.actions_limit ?? 25} actions</span><span className="text-cyan-400">{usagePercent}% used</span></div>
          <div className="h-3 rounded-full bg-slate-950 border border-slate-800 overflow-hidden"><div className="h-full bg-gradient-to-r from-cyan-500 to-indigo-600" style={{ width: `${usagePercent}%` }} /></div>
          <div className="flex justify-between text-[11px] text-slate-500"><span>Usage resets automatically</span><span>{subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—'}</span></div>
        </div>
        {subscription?.provider === 'stripe' && subscription.status === 'active' && <button onClick={handleCancel} disabled={cancelling} className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">{cancelling ? 'Cancelling…' : 'Cancel at period end'}</button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map(plan => {
          const current = subscription?.plan_id === plan.id || (!subscription && plan.id === 'plan_free');
          return <div key={plan.id} className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <div className="space-y-4">
              <h3 className="text-base font-bold text-white">{plan.name}</h3>
              <div className="flex items-baseline gap-1"><span className="text-3xl font-extrabold text-white">${plan.price_monthly}</span><span className="text-xs text-slate-400">/month</span></div>
              <div className="rounded-lg bg-slate-950/60 p-2.5 border border-slate-800/80 text-xs"><div className="font-semibold text-white">{plan.actions_limit.toLocaleString()} actions/mo</div><div className="text-[11px] text-slate-400">{plan.connections_limit} connections</div></div>
              <ul className="space-y-2 text-xs text-slate-300">{plan.features.map((feature, index) => <li key={index} className="flex items-start gap-2"><Check className="h-4 w-4 shrink-0 text-cyan-400" /><span>{feature}</span></li>)}</ul>
            </div>
            <div className="pt-6">{current ? <button disabled className="w-full rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5 text-xs font-bold text-cyan-300">Current Plan</button> : <button onClick={() => handleSelectPlan(plan.id)} disabled={loadingPlanId === plan.id} className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 p-2.5 text-xs font-bold text-slate-950 flex items-center justify-center gap-2">{loadingPlanId === plan.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <><span>Upgrade to {plan.name}</span><ExternalLink className="h-3 w-3" /></>}</button>}</div>
          </div>;
        })}
      </div>
    </div>
  );
};