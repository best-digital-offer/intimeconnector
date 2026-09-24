import React from 'react';
import { User, Subscription, Usage } from '../types';
import {
  ShieldCheck,
  Zap,
  Radio,
  ExternalLink,
  ChevronDown,
  User as UserIcon,
  LogOut,
  Sliders,
  Sparkles,
} from 'lucide-react';

interface NavbarProps {
  user: User | null;
  subscription: Subscription | null;
  usage: Usage | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  onToggleLanding: () => void;
  isLanding: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  subscription,
  usage,
  onOpenAuth,
  onLogout,
  onNavigate,
  onToggleLanding,
  isLanding,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const usagePercent = usage ? Math.min(100, Math.round((usage.actions_count / usage.actions_limit) * 100)) : 0;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => onToggleLanding()}
            className="flex items-center gap-2.5 text-left transition hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-cyan-500 to-indigo-600 shadow-md shadow-cyan-500/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                Just-in-Time Connector
                <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-cyan-400 border border-cyan-500/30 uppercase">
                  Remote MCP
                </span>
              </span>
              <p className="text-[11px] text-slate-400">Natural-Language to Secure API Action</p>
            </div>
          </button>

          {/* System status pill */}
          <div className="hidden md:flex items-center gap-3 border-l border-slate-800 pl-4 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium text-emerald-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              MCP Online
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 text-cyan-400" />
              SSRF Guard Active
            </span>
          </div>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleLanding}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition flex items-center gap-1.5 ${
              isLanding
                ? 'bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60 border border-slate-800'
            }`}
          >
            {isLanding ? (
              <>
                <Sliders className="h-3.5 w-3.5" />
                Go to Dashboard
              </>
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5" />
                Landing Page
              </>
            )}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
              {/* Usage Mini Pill */}
              <div
                onClick={() => onNavigate('billing')}
                className="hidden sm:flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-1.5 hover:border-slate-700 transition"
              >
                <div className="text-right">
                  <div className="text-[10px] uppercase font-semibold text-cyan-400">
                    {subscription?.plan_id === 'plan_business'
                      ? 'Business'
                      : subscription?.plan_id === 'plan_pro'
                      ? 'Pro Plan'
                      : subscription?.plan_id === 'plan_starter'
                      ? 'Starter Plan'
                      : 'Free Plan'}
                  </div>
                  <div className="text-[11px] font-medium text-slate-300">
                    {usage?.actions_count ?? 0} / {usage?.actions_limit ?? 25} actions
                  </div>
                </div>
                <div className="h-7 w-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="w-full bg-gradient-to-t from-cyan-500 to-indigo-500 transition-all duration-500"
                    style={{ height: `${usagePercent}%` }}
                  />
                </div>
              </div>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 hover:border-slate-700 hover:bg-slate-800 transition"
                >
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600/30 text-indigo-400 font-semibold text-xs border border-indigo-500/30">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden md:inline font-medium max-w-[120px] truncate">{user.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                </button>

                {dropdownOpen && (
                  <div
                    className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-slate-900 p-1.5 text-xs shadow-xl shadow-black/50 z-50"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <div className="border-b border-slate-800 px-3 py-2 text-slate-300">
                      <p className="font-semibold text-white truncate">{user.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{user.email}</p>
                      <span className="mt-1 inline-block rounded bg-indigo-950 px-1.5 py-0.5 text-[10px] text-indigo-300 font-medium border border-indigo-800/40">
                        {user.role === 'admin' ? 'Administrator' : 'Standard User'}
                      </span>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => onNavigate('dashboard')}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                      >
                        <Zap className="h-3.5 w-3.5 text-cyan-400" />
                        Dashboard
                      </button>
                      <button
                        onClick={() => onNavigate('apikeys')}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                      >
                        <UserIcon className="h-3.5 w-3.5 text-indigo-400" />
                        API Keys & Tokens
                      </button>
                      <button
                        onClick={() => onNavigate('mcp')}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        ChatGPT Remote MCP
                      </button>
                      <button
                        onClick={() => onNavigate('admin')}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white transition"
                      >
                        <Sliders className="h-3.5 w-3.5 text-purple-400" />
                        Admin Controls
                      </button>
                    </div>

                    <div className="border-t border-slate-800 pt-1">
                      <button
                        onClick={onLogout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-500/20 hover:from-cyan-400 hover:to-indigo-500 transition"
            >
              Sign In / Register
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
