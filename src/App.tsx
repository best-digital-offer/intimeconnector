import React, { useState, useEffect } from 'react';
import {
  User,
  Subscription,
  Usage,
  Connection,
  Transformation,
  ExecutionRequest,
  SecurityEvent,
  Plan,
  ApiKeyItem,
} from './types';
import { api } from './services/apiClient';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ConnectionsView } from './components/ConnectionsView';
import { TransformationsView } from './components/TransformationsView';
import { TestCenterView } from './components/TestCenterView';
import { RequestsView } from './components/RequestsView';
import { BillingView } from './components/BillingView';
import { ApiKeysView } from './components/ApiKeysView';
import { SecurityView } from './components/SecurityView';
import { McpSubmissionView } from './components/McpSubmissionView';
import { DocsView } from './components/DocsView';
import { AdminView } from './components/AdminView';
import { LandingPageView } from './components/LandingPageView';
import { AuthModal } from './components/AuthModal';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [transformations, setTransformations] = useState<Transformation[]>([]);
  const [requests, setRequests] = useState<ExecutionRequest[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isLanding, setIsLanding] = useState<boolean>(false);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [selectedRequest, setSelectedRequest] = useState<ExecutionRequest | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Initial Data Load
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const me = await api.getMe();
      setUser(me.user);
      setSubscription(me.subscription);
      setUsage(me.usage);
      const [billingRes, connRes, transRes, reqRes, secRes, keysRes] = await Promise.allSettled([
        api.getBilling(),
        api.getConnections(),
        api.getTransformations(),
        api.getRequests(),
        api.getSecurityEvents(),
        api.getApiKeys(),
      ]);

      if (billingRes.status === 'fulfilled') {
        setPlans(billingRes.value.plans || []);
        if (billingRes.value.subscription) setSubscription(billingRes.value.subscription);
        if (billingRes.value.usage) setUsage(billingRes.value.usage);
      }

      if (connRes.status === 'fulfilled') {
        setConnections(connRes.value.connections || []);
      }

      if (transRes.status === 'fulfilled') {
        setTransformations(transRes.value.transformations || []);
      }

      if (reqRes.status === 'fulfilled') {
        setRequests(reqRes.value.requests || []);
      }

      if (secRes.status === 'fulfilled') {
        setSecurityEvents(secRes.value.events || []);
      }

      if (keysRes.status === 'fulfilled') {
        setApiKeys(keysRes.value.api_keys || []);
      }
    } catch (err) {
      setUser(null);
      setIsLanding(true);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setSubscription(null);
    setUsage(null);
    setConnections([]);
    setTransformations([]);
    setRequests([]);
    setApiKeys([]);
    setIsLanding(true);
  };

  const handleSaveConnection = async (data: any) => {
    if (data.id) {
      await api.updateConnection(data.id, data);
    } else {
      await api.createConnection(data);
    }
    const res = await api.getConnections();
    setConnections(res.connections);
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return;
    await api.deleteConnection(id);
    const res = await api.getConnections();
    setConnections(res.connections);
  };

  const handleTestConnection = async (id: string) => {
    return api.testConnection(id);
  };

  const handleSaveTransformation = async (data: any) => {
    if (data.id) {
      await api.updateTransformation(data.id, data);
    } else {
      await api.createTransformation(data);
    }
    const res = await api.getTransformations();
    setTransformations(res.transformations);
  };

  const handleDeleteTransformation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this transformation?')) return;
    await api.deleteTransformation(id);
    const res = await api.getTransformations();
    setTransformations(res.transformations);
  };

  const handleExecuteRequest = async (data: any) => {
    const res = await api.execute(data);
    // Refresh requests & usage
    const [reqRes, meRes] = await Promise.all([api.getRequests(), api.getMe()]);
    setRequests(reqRes.requests);
    setUsage(meRes.usage);
    return res;
  };

  const handleCreateApiKey = async (name: string) => {
    const res = await api.createApiKey(name);
    const updated = await api.getApiKeys();
    setApiKeys(updated.api_keys);
    return res;
  };

  const handleRevokeApiKey = async (id: string) => {
    if (!confirm('Revoke this API key? This action is irreversible.')) return;
    await api.revokeApiKey(id);
    const updated = await api.getApiKeys();
    setApiKeys(updated.api_keys);
  };

  const handleTestSsrf = async (url: string) => {
    const res = await api.testSsrf(url);
    const secRes = await api.getSecurityEvents();
    setSecurityEvents(secRes.events);
    return res;
  };

  const currentPlan = plans.find((p) => p.id === subscription?.plan_id) || plans[0] || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Navigation */}
      <Navbar
        user={user}
        subscription={subscription}
        usage={usage}
        onOpenAuth={() => setAuthModalOpen(true)}
        onLogout={handleLogout}
        onNavigate={(tab) => {
          setIsLanding(false);
          setActiveTab(tab);
        }}
        onToggleLanding={() => setIsLanding(!isLanding)}
        isLanding={isLanding}
      />

      {isLanding ? (
        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
          <LandingPageView
            plans={plans}
            onOpenApp={() => setIsLanding(false)}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        </main>
      ) : (
        <div className="mx-auto flex max-w-7xl">
          {/* Sidebar */}
          <Sidebar
            activeTab={activeTab}
            onSelectTab={(tab) => setActiveTab(tab)}
            connectionsCount={connections.length}
            securityEventsCount={securityEvents.length}
            isAdmin={user?.role === 'admin'}
          />

          {/* Main Dashboard Area */}
          <main className="flex-1 p-6 md:p-8 overflow-y-auto max-w-5xl">
            {activeTab === 'dashboard' && (
              <DashboardView
                connections={connections}
                requests={requests}
                securityEvents={securityEvents}
                usage={usage}
                subscription={subscription}
                onNavigate={(tab) => setActiveTab(tab)}
                onSelectRequest={(req) => setSelectedRequest(req)}
              />
            )}

            {activeTab === 'connections' && (
              <ConnectionsView
                connections={connections}
                onSaveConnection={handleSaveConnection}
                onDeleteConnection={handleDeleteConnection}
                onTestConnection={handleTestConnection}
                planConnectionLimit={currentPlan?.connections_limit || 1}
              />
            )}

            {activeTab === 'transformations' && (
              <TransformationsView
                transformations={transformations}
                connections={connections}
                onSaveTransformation={handleSaveTransformation}
                onDeleteTransformation={handleDeleteTransformation}
                onPreviewTransformation={(trans, input) => api.previewTransformation(trans, input)}
              />
            )}

            {activeTab === 'testcenter' && (
              <TestCenterView
                connections={connections}
                transformations={transformations}
                onExecute={handleExecuteRequest}
              />
            )}

            {activeTab === 'requests' && (
              <RequestsView
                requests={requests}
                connections={connections}
                selectedRequest={selectedRequest}
                onSelectRequest={(req) => setSelectedRequest(req)}
              />
            )}

            {activeTab === 'billing' && (
              <BillingView
                plans={plans}
                subscription={subscription}
                currentPlan={currentPlan}
                usage={usage}
                onCheckout={(planId) => api.createCheckout(planId)}
                onCancel={() => api.cancelSubscription()}
              />
            )}

            {activeTab === 'apikeys' && (
              <ApiKeysView
                apiKeys={apiKeys}
                onCreateKey={handleCreateApiKey}
                onRevokeKey={handleRevokeApiKey}
              />
            )}

            {activeTab === 'security' && (
              <SecurityView
                securityEvents={securityEvents}
                onTestSsrf={handleTestSsrf}
              />
            )}

            {activeTab === 'mcp' && (
              <McpSubmissionView onCallMcp={(body) => api.callMcp(body)} />
            )}

            {activeTab === 'docs' && <DocsView />}

            {activeTab === 'admin' && (
              <AdminView
                plans={plans}
                onRefreshPlans={async () => {
                  const b = await api.getBilling();
                  setPlans(b.plans);
                }}
              />
            )}
          </main>
        </div>
      )}

      {/* Authentication Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={(newUser) => {
          setUser(newUser);
          loadInitialData();
          setIsLanding(false);
        }}
      />
    </div>
  );
};

export default App;
