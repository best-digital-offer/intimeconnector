import React, { useState, useEffect } from 'react';
import { Plan } from '../types';
import {
  SlidersHorizontal,
  Users,
  Activity,
  ShieldAlert,
  Server,
  Edit2,
  Check,
  RefreshCw,
} from 'lucide-react';
import { api } from '../services/apiClient';

interface AdminViewProps {
  plans: Plan[];
  onRefreshPlans: () => void;
}

export const AdminView: React.FC<AdminViewProps> = ({ plans, onRefreshPlans }) => {
  const [metrics, setMetrics] = useState<any | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [planLimitInput, setPlanLimitInput] = useState<number>(0);
  const [planPriceInput, setPlanPriceInput] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [m, u] = await Promise.all([api.getAdminMetrics(), api.getAdminUsers()]);
      setMetrics(m.metrics);
      setUsers(u.users);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditPlan = (plan: Plan) => {
    setEditingPlanId(plan.id);
    setPlanLimitInput(plan.actions_limit);
    setPlanPriceInput(plan.price_monthly);
  };

  const handleSavePlan = async (planId: string) => {
    setLoading(true);
    try {
      await api.updatePlan(planId, {
        actions_limit: planLimitInput,
        price_monthly: planPriceInput,
      });
      setEditingPlanId(null);
      onRefreshPlans();
    } catch (err: unknown) {
      alert((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <SlidersHorizontal className="h-5 w-5 text-purple-400" />
          System Administration & Operations
        </h1>
        <p className="text-xs text-slate-400">
          Global platform health, dynamic plan quota configuration, and tenant account oversight.
        </p>
      </div>

      {/* Metrics Row */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Accounts</span>
            <div className="mt-1 text-2xl font-bold text-white">{metrics.totalUsers}</div>
            <div className="text-[11px] text-slate-400">{metrics.activeSubscriptions} active subscriptions</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Connections</span>
            <div className="mt-1 text-2xl font-bold text-cyan-400">{metrics.totalConnections}</div>
            <div className="text-[11px] text-slate-400">{metrics.totalTransformations} transformations</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Requests</span>
            <div className="mt-1 text-2xl font-bold text-emerald-400">{metrics.successfulRequests}</div>
            <div className="text-[11px] text-slate-400">{metrics.failedRequests} failed/blocked</div>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <span className="text-[10px] text-slate-500 uppercase block font-semibold">Security Interceptions</span>
            <div className="mt-1 text-2xl font-bold text-rose-400">{metrics.totalSecurityEvents}</div>
            <div className="text-[11px] text-slate-400">SSRF and rate-limit guard triggers</div>
          </div>
        </div>
      )}

      {/* Dynamic Plans Configuration Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-3.5 flex justify-between items-center">
          <div>
            <h2 className="text-sm font-semibold text-white">Dynamic Plan Quotas & Pricing</h2>
            <p className="text-xs text-slate-400">Modify plan tiers in database without code changes</p>
          </div>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-medium text-slate-400">
            <tr>
              <th className="px-5 py-3">Plan Name</th>
              <th className="px-5 py-3">Monthly Price</th>
              <th className="px-5 py-3">Monthly Actions Quota</th>
              <th className="px-5 py-3">Connections Limit</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {plans.map((p) => {
              const isEditing = editingPlanId === p.id;
              return (
                <tr key={p.id} className="hover:bg-slate-800/40 transition">
                  <td className="px-5 py-3 font-semibold text-white">{p.name}</td>
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        value={planPriceInput}
                        onChange={(e) => setPlanPriceInput(Number(e.target.value))}
                        className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      />
                    ) : (
                      `$${p.price_monthly}/mo`
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {isEditing ? (
                      <input
                        type="number"
                        value={planLimitInput}
                        onChange={(e) => setPlanLimitInput(Number(e.target.value))}
                        className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                      />
                    ) : (
                      `${p.actions_limit.toLocaleString()} actions`
                    )}
                  </td>
                  <td className="px-5 py-3">{p.connections_limit} connections</td>
                  <td className="px-5 py-3 text-right">
                    {isEditing ? (
                      <button
                        onClick={() => handleSavePlan(p.id)}
                        disabled={loading}
                        className="rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1 font-semibold text-white text-[11px] transition flex items-center gap-1 ml-auto"
                      >
                        <Check className="h-3 w-3" />
                        Save
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEditPlan(p)}
                        className="rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition"
                      >
                        Configure
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-white">Registered Users & Tenants</h2>
          <p className="text-xs text-slate-400">Account profiles, assigned plans, and action usage</p>
        </div>

        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-medium text-slate-400">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Current Plan</th>
              <th className="px-5 py-3">Monthly Actions</th>
              <th className="px-5 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-800/40 transition">
                <td className="px-5 py-3 font-semibold text-white">{u.name}</td>
                <td className="px-5 py-3 text-slate-400 font-mono text-[11px]">{u.email}</td>
                <td className="px-5 py-3">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                      u.role === 'admin'
                        ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-3 font-medium text-cyan-400">{u.plan_name}</td>
                <td className="px-5 py-3">{u.actions_count} actions</td>
                <td className="px-5 py-3 text-slate-400">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
