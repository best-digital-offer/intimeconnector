import React, { useState } from 'react';
import { LogIn, UserPlus, Lock, Mail, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { api } from '../services/apiClient';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await api.login(email, password);
        const me = await api.getMe();
        onSuccess(me.user);
      } else {
        await api.signup(email, password, name);
        const me = await api.getMe();
        onSuccess(me.user);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
              <Zap className="h-4 w-4" />
            </div>
            <h2 className="text-base font-bold text-white">
              {isLogin ? 'Sign In to Just-in-Time Connector' : 'Create Your SaaS Account'}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-3 text-rose-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {!isLogin && (
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Your Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 pl-9 pr-3 py-2 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Quick Demo Logins */}
          <p className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-[11px] leading-relaxed text-slate-400">
            Accounts are created and authenticated securely with Supabase Auth. No demo credentials are embedded in the application.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 p-2.5 font-bold text-slate-950 transition flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : isLogin ? (
              <>
                <LogIn className="h-4 w-4" />
                Sign In
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Register Account
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2 text-slate-400">
          {isLogin ? (
            <button onClick={() => setIsLogin(false)} className="hover:text-cyan-400 text-xs">
              Don&rsquo;t have an account? <span className="underline font-semibold">Sign up free</span>
            </button>
          ) : (
            <button onClick={() => setIsLogin(true)} className="hover:text-cyan-400 text-xs">
              Already have an account? <span className="underline font-semibold">Sign in</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
