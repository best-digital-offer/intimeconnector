import React from 'react';
import {
  LayoutDashboard,
  PlugZap,
  Wand2,
  FlaskConical,
  History,
  CreditCard,
  KeyRound,
  ShieldAlert,
  Bot,
  BookOpen,
  SlidersHorizontal,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onSelectTab: (tab: string) => void;
  connectionsCount?: number;
  securityEventsCount?: number;
  isAdmin?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  connectionsCount = 0,
  securityEventsCount = 0,
  isAdmin = false,
}) => {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'connections', label: 'Connections', icon: PlugZap, badge: connectionsCount },
    { id: 'transformations', label: 'Transformations', icon: Wand2 },
    { id: 'testcenter', label: 'Test Center', icon: FlaskConical },
    { id: 'requests', label: 'Request History', icon: History },
    { id: 'billing', label: 'Usage & Billing', icon: CreditCard },
    { id: 'apikeys', label: 'API Credentials', icon: KeyRound },
    {
      id: 'security',
      label: 'Security & SSRF',
      icon: ShieldAlert,
      badge: securityEventsCount > 0 ? securityEventsCount : undefined,
      badgeVariant: 'warning',
    },
    { id: 'mcp', label: 'ChatGPT Remote MCP', icon: Bot, isHighlighted: true },
    { id: 'docs', label: 'Documentation', icon: BookOpen },
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-800 bg-slate-950/60 p-4 flex flex-col justify-between h-[calc(100vh-4rem)] sticky top-16 overflow-y-auto">
      <div className="space-y-6">
        <div>
          <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Platform</p>
          <nav className="mt-2 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`group flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/15 to-indigo-500/10 text-cyan-400 border border-cyan-500/30'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  } ${item.isHighlighted && !isActive ? 'text-amber-300 hover:text-amber-200' : ''}`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 transition ${
                        isActive
                          ? 'text-cyan-400'
                          : item.isHighlighted
                          ? 'text-amber-400'
                          : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                        item.badgeVariant === 'warning'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}

                  {item.isHighlighted && !item.badge && (
                    <span className="rounded bg-gradient-to-r from-amber-500/20 to-orange-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-300 border border-amber-500/30 uppercase">
                      New
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {isAdmin && (
          <div>
            <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Administration</p>
            <nav className="mt-2 space-y-1">
              <button
                onClick={() => onSelectTab('admin')}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  activeTab === 'admin'
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4 text-purple-400" />
                <span>Admin Panel</span>
              </button>
            </nav>
          </div>
        )}
      </div>

      {/* Endpoint badge */}
      <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-[11px] text-slate-400">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            MCP Server URI
          </span>
          <span className="text-[10px] text-slate-500">v1.0.0</span>
        </div>
        <p className="font-mono text-[10px] text-cyan-400 bg-slate-950 p-1.5 rounded border border-slate-800 break-all select-all">
          /mcp
        </p>
        <p className="text-[10px] text-slate-500 mt-1">Conforms to Streamable HTTP MCP (2024-11-05)</p>
      </div>
    </aside>
  );
};
