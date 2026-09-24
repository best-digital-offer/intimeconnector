import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Profile,
  Plan,
  Subscription,
  Connection,
  ConnectionCredential,
  Transformation,
  TransformationVersion,
  ExecutionRequest,
  RequestAttempt,
  Usage,
  UsageEvent,
  OAuthClient,
  OAuthToken,
  AuditLog,
  SecurityEvent,
  ApiKey,
  SupportTicket,
  AdminAction,
  SystemSettings,
} from './schema';
import { encryptCredential, hashPassword, hashToken, maskSecret } from '../security/crypto';

export interface DatabaseState {
  profiles: Profile[];
  plans: Plan[];
  subscriptions: Subscription[];
  connections: Connection[];
  connection_credentials: ConnectionCredential[];
  transformations: Transformation[];
  transformation_versions: TransformationVersion[];
  requests: ExecutionRequest[];
  request_attempts: RequestAttempt[];
  usage: Usage[];
  usage_events: UsageEvent[];
  oauth_clients: OAuthClient[];
  oauth_tokens: OAuthToken[];
  audit_logs: AuditLog[];
  security_events: SecurityEvent[];
  api_keys: ApiKey[];
  support_tickets: SupportTicket[];
  admin_actions: AdminAction[];
  system_settings: SystemSettings[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

class Store {
  private state: DatabaseState = {
    profiles: [],
    plans: [],
    subscriptions: [],
    connections: [],
    connection_credentials: [],
    transformations: [],
    transformation_versions: [],
    requests: [],
    request_attempts: [],
    usage: [],
    usage_events: [],
    oauth_clients: [],
    oauth_tokens: [],
    audit_logs: [],
    security_events: [],
    api_keys: [],
    support_tickets: [],
    admin_actions: [],
    system_settings: [],
  };

  private isLoaded = false;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (this.isLoaded) return;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf8');
        this.state = JSON.parse(raw);
      } else {
        this.seedInitialData();
        this.saveImmediately();
      }
      this.isLoaded = true;
    } catch (err) {
      console.error('[Store] Error loading database store, seeding defaults:', err);
      this.seedInitialData();
      this.isLoaded = true;
    }
  }

  private scheduleSave() {
    if (this.saveTimeout) return;
    this.saveTimeout = setTimeout(() => {
      this.saveTimeout = null;
      this.saveImmediately();
    }, 250);
  }

  private saveImmediately() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmp = `${DATA_FILE}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(this.state, null, 2), 'utf8');
      fs.renameSync(tmp, DATA_FILE);
    } catch (err) {
      console.error('[Store] Failed to write database file:', err);
    }
  }

  private seedInitialData() {
    const now = new Date().toISOString();

    // 1. Seed Plans
    const plans: Plan[] = [
      {
        id: 'plan_free',
        name: 'Free',
        tier: 'free',
        price_monthly: 0,
        actions_limit: 25,
        connections_limit: 1,
        features: [
          '25 successful actions/mo',
          '1 active connection',
          'Basic transformations',
          'Request history',
          'ChatGPT remote MCP connection',
          'Basic webhook support',
        ],
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'plan_starter',
        name: 'Starter',
        tier: 'starter',
        price_monthly: 5,
        actions_limit: 500,
        connections_limit: 10,
        features: [
          '500 actions/mo',
          '10 active connections',
          'Advanced transformations',
          'Request history & retries',
          'Detailed execution logs',
          'ChatGPT remote MCP',
          'API & Webhook integrations',
        ],
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'plan_pro',
        name: 'Pro',
        tier: 'pro',
        price_monthly: 15,
        actions_limit: 5000,
        connections_limit: 50,
        features: [
          '5,000 actions/mo',
          '50 active connections',
          'Advanced transformations & AI',
          'Higher rate limits',
          'Automatic exponential retries',
          'Multiple authentication schemes',
          'Priority processing',
        ],
        is_active: true,
        created_at: now,
        updated_at: now,
      },
      {
        id: 'plan_business',
        name: 'Business',
        tier: 'business',
        price_monthly: 39,
        actions_limit: 25000,
        connections_limit: 200,
        features: [
          '25,000 actions/mo',
          '200 active connections',
          'Team workspaces & roles',
          'Full audit logs & security logs',
          'Enterprise rate limits',
          'Priority 24/7 support',
          'Advanced API controls',
        ],
        is_active: true,
        created_at: now,
        updated_at: now,
      },
    ];

    // 2. Seed Users
    const adminPasswordHash = hashPassword('Admin123456!');
    const demoPasswordHash = hashPassword('Password123!');

    const adminUser: Profile = {
      id: 'usr_admin_001',
      email: 'admin@jitc.io',
      password_hash: adminPasswordHash,
      name: 'System Administrator',
      role: 'admin',
      created_at: now,
      updated_at: now,
    };

    const demoUser: Profile = {
      id: 'usr_demo_002',
      email: 'pamarthikrishnasai@gmail.com',
      password_hash: demoPasswordHash,
      name: 'Krishna Sai Pamarthi',
      role: 'user',
      created_at: now,
      updated_at: now,
    };

    // 3. Seed Subscriptions & Usage
    const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const demoSubscription: Subscription = {
      id: 'sub_demo_001',
      user_id: demoUser.id,
      plan_id: 'plan_pro',
      status: 'active',
      current_period_start: now,
      current_period_end: nextMonth,
      cancel_at_period_end: false,
      provider: 'stripe',
      provider_subscription_id: 'sub_stripe_demo_test',
      created_at: now,
      updated_at: now,
    };

    const demoUsage: Usage = {
      id: 'usg_demo_001',
      user_id: demoUser.id,
      period_start: now,
      period_end: nextMonth,
      actions_count: 84,
      actions_limit: 5000,
      updated_at: now,
    };

    // 4. Seed Connections
    const conn1Id = 'conn_crm_001';
    const conn2Id = 'conn_httpbin_002';
    const conn3Id = 'conn_notify_003';

    const conn1: Connection = {
      id: conn1Id,
      user_id: demoUser.id,
      name: 'HubSpot CRM Webhook',
      description: 'Ingests qualified leads and client requests into company CRM pipeline',
      endpoint_url: 'https://httpbin.org/post',
      http_method: 'POST',
      auth_type: 'bearer',
      headers: {
        'Content-Type': 'application/json',
        'X-Lead-Source': 'Just-In-Time-Connector',
      },
      query_params: {
        env: 'production',
      },
      timeout_ms: 8000,
      retry_count: 3,
      status: 'active',
      last_tested_at: now,
      last_test_status: 200,
      created_at: now,
      updated_at: now,
    };

    const secret1 = encryptCredential('hubspot_pat_live_99a8b7c6d5e4f3a2b1c0d9e8');
    const cred1: ConnectionCredential = {
      id: 'cred_001',
      connection_id: conn1Id,
      secret_type: 'bearer',
      encrypted_secret: secret1.encrypted_secret,
      iv: secret1.iv,
      auth_tag: secret1.auth_tag,
      masked_preview: maskSecret('hubspot_pat_live_99a8b7c6d5e4f3a2b1c0d9e8'),
      created_at: now,
      updated_at: now,
      last_used_at: now,
    };

    const conn2: Connection = {
      id: conn2Id,
      user_id: demoUser.id,
      name: 'HTTPBin Echo API',
      description: 'Test connection for real HTTP execution, payload verification and latency metrics',
      endpoint_url: 'https://httpbin.org/anything',
      http_method: 'POST',
      auth_type: 'api_key',
      headers: {
        'Content-Type': 'application/json',
        'X-Custom-Engine': 'JITC-Core',
      },
      query_params: {
        mode: 'realtime',
      },
      timeout_ms: 5000,
      retry_count: 2,
      status: 'active',
      last_tested_at: now,
      last_test_status: 200,
      created_at: now,
      updated_at: now,
    };

    const secret2 = encryptCredential('api_key_sandbox_sec_884129bbfa71');
    const cred2: ConnectionCredential = {
      id: 'cred_002',
      connection_id: conn2Id,
      secret_type: 'api_key',
      encrypted_secret: secret2.encrypted_secret,
      iv: secret2.iv,
      auth_tag: secret2.auth_tag,
      masked_preview: maskSecret('api_key_sandbox_sec_884129bbfa71'),
      created_at: now,
      updated_at: now,
      last_used_at: now,
    };

    const conn3: Connection = {
      id: conn3Id,
      user_id: demoUser.id,
      name: 'Slack Alerts Webhook',
      description: 'Dispatches high-priority customer summaries to #leads channel',
      endpoint_url: 'https://httpbin.org/post',
      http_method: 'POST',
      auth_type: 'none',
      headers: {
        'Content-Type': 'application/json',
      },
      query_params: {},
      timeout_ms: 5000,
      retry_count: 2,
      status: 'active',
      last_tested_at: now,
      last_test_status: 200,
      created_at: now,
      updated_at: now,
    };

    // 5. Seed Transformations
    const trans1: Transformation = {
      id: 'trans_crm_001',
      user_id: demoUser.id,
      connection_id: conn1Id,
      name: 'Client Summary to CRM Lead',
      description: 'Extracts full name, company, email, and interest level from free-form text or JSON',
      mode: 'visual',
      rules: [
        { id: 'r1', type: 'rename_field', source_field: 'full_name', target_field: 'name' },
        { id: 'r2', type: 'rename_field', source_field: 'company_name', target_field: 'company' },
        { id: 'r3', type: 'trim_text', source_field: 'email', target_field: 'email' },
        { id: 'r4', type: 'lowercase', source_field: 'email', target_field: 'email' },
        { id: 'r5', type: 'constant_value', target_field: 'source', value: 'just-in-time-connector' },
        { id: 'r6', type: 'set_default', target_field: 'priority', value: 'HIGH' },
      ],
      sample_input: JSON.stringify(
        {
          full_name: 'John Smith',
          company_name: 'ABC Corp',
          email: '  JOHN@EXAMPLE.COM ',
          notes: 'Wants 50 enterprise licenses for APAC division',
        },
        null,
        2
      ),
      sample_output: JSON.stringify(
        {
          name: 'John Smith',
          company: 'ABC Corp',
          email: 'john@example.com',
          source: 'just-in-time-connector',
          priority: 'HIGH',
        },
        null,
        2
      ),
      version: 1,
      created_at: now,
      updated_at: now,
    };

    const trans2: Transformation = {
      id: 'trans_notify_002',
      user_id: demoUser.id,
      connection_id: conn3Id,
      name: 'Slack Notification Formatter',
      description: 'Formats customer feedback into a markdown alert payload',
      mode: 'template',
      rules: [],
      template_json: JSON.stringify({
        text: '🚀 *New Lead Ingested via ChatGPT MCP*:\n*Client:* {{name}} ({{company}})\n*Request:* {{notes}}\n*Contact:* {{email}}',
        channel: '#leads',
      }),
      sample_input: JSON.stringify(
        {
          name: 'Sarah Connor',
          company: 'Cyberdyne Systems',
          notes: 'Interested in AI security connectors',
          email: 'sarah@cyberdyne.io',
        },
        null,
        2
      ),
      sample_output: JSON.stringify({
        text: '🚀 *New Lead Ingested via ChatGPT MCP*:\n*Client:* Sarah Connor (Cyberdyne Systems)\n*Request:* Interested in AI security connectors\n*Contact:* sarah@cyberdyne.io',
        channel: '#leads',
      }),
      version: 1,
      created_at: now,
      updated_at: now,
    };

    // 6. Seed API Key
    const { keyPrefix, keyHash } = {
      keyPrefix: 'jtc_live_7a8b9c',
      keyHash: hashToken('jtc_live_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d'),
    };
    const apiKey: ApiKey = {
      id: 'key_demo_001',
      user_id: demoUser.id,
      name: 'ChatGPT MCP Production Key',
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: ['connections:read', 'execute', 'profile:read'],
      last_used_at: now,
      is_revoked: false,
      created_at: now,
    };

    // 7. Seed Requests History
    const sampleRequests: ExecutionRequest[] = [
      {
        id: 'req_01J8K9M0N1',
        user_id: demoUser.id,
        connection_id: conn1Id,
        transformation_id: trans1.id,
        action_type: 'mcp_tool',
        status: 'success',
        http_status: 200,
        duration_ms: 312,
        endpoint_domain: 'httpbin.org',
        endpoint_path: '/post',
        masked_request_payload: JSON.stringify({
          name: 'John Smith',
          company: 'ABC Corp',
          email: 'john@example.com',
          source: 'just-in-time-connector',
          priority: 'HIGH',
        }),
        safe_response_preview: JSON.stringify({
          status: 'ok',
          received_id: 'lead_9921',
          code: 200,
        }),
        correlation_id: 'req_c7a10f92b',
        attempts_count: 1,
        created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: 'req_01J8K9M0N2',
        user_id: demoUser.id,
        connection_id: conn2Id,
        action_type: 'web_dashboard',
        status: 'success',
        http_status: 200,
        duration_ms: 184,
        endpoint_domain: 'httpbin.org',
        endpoint_path: '/anything',
        masked_request_payload: JSON.stringify({ ping: 'pong', timestamp: now }),
        safe_response_preview: JSON.stringify({ url: 'https://httpbin.org/anything', origin: '104.28.1.1' }),
        correlation_id: 'req_e1284a0c8',
        attempts_count: 1,
        created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
      {
        id: 'req_01J8K9M0N3',
        user_id: demoUser.id,
        connection_id: conn3Id,
        transformation_id: trans2.id,
        action_type: 'mcp_tool',
        status: 'success',
        http_status: 200,
        duration_ms: 228,
        endpoint_domain: 'httpbin.org',
        endpoint_path: '/post',
        masked_request_payload: JSON.stringify({
          text: '🚀 *New Lead Ingested via ChatGPT MCP*: Sarah Connor (Cyberdyne Systems)',
        }),
        safe_response_preview: JSON.stringify({ success: true }),
        correlation_id: 'req_ff4190cb1',
        attempts_count: 1,
        created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
      },
    ];

    // 8. Seed Security Events (demonstrating SSRF protections working)
    const securityEvents: SecurityEvent[] = [
      {
        id: 'sec_001',
        user_id: demoUser.id,
        event_type: 'ssrf_blocked',
        severity: 'high',
        details: {
          blockedUrl: 'http://169.254.169.254/latest/meta-data/',
          reason: 'Target IP resolves to restricted link-local / AWS metadata range',
        },
        ip_address: '198.51.100.42',
        blocked: true,
        created_at: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
      },
      {
        id: 'sec_002',
        user_id: demoUser.id,
        event_type: 'ssrf_blocked',
        severity: 'high',
        details: {
          blockedUrl: 'http://localhost:6379/keys',
          reason: 'Access to hostname localhost is restricted',
        },
        ip_address: '198.51.100.42',
        blocked: true,
        created_at: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
      },
    ];

    this.state = {
      profiles: [adminUser, demoUser],
      plans,
      subscriptions: [demoSubscription],
      connections: [conn1, conn2, conn3],
      connection_credentials: [cred1, cred2],
      transformations: [trans1, trans2],
      transformation_versions: [],
      requests: sampleRequests,
      request_attempts: [],
      usage: [demoUsage],
      usage_events: [],
      oauth_clients: [
        {
          id: 'oauth_chatgpt',
          client_id: 'chatgpt_remote_mcp_client',
          client_secret_hash: hashToken('chatgpt_mcp_secret_2026_secure'),
          client_name: 'ChatGPT Official MCP Integration',
          redirect_uris: ['https://chatgpt.com/aip/plugin-oauth/callback'],
          is_active: true,
          created_at: now,
        },
      ],
      oauth_tokens: [],
      audit_logs: [
        {
          id: 'aud_001',
          user_id: demoUser.id,
          action: 'connection.created',
          resource_type: 'connection',
          resource_id: conn1Id,
          metadata: { name: conn1.name, endpoint: 'https://httpbin.org/post' },
          ip_address: '127.0.0.1',
          created_at: now,
        },
      ],
      security_events: securityEvents,
      api_keys: [apiKey],
      support_tickets: [],
      admin_actions: [],
      system_settings: [
        {
          key: 'mcp_server_status',
          value: { status: 'healthy', version: '1.0.0', protocol: '2024-11-05' },
          updated_at: now,
        },
        {
          key: 'openai_verification_status',
          value: { verified: true, challenge_endpoint: '/.well-known/openai-apps-challenge' },
          updated_at: now,
        },
      ],
    };
  }

  // --- Profile methods ---
  public getProfiles(): Profile[] {
    return this.state.profiles;
  }
  public getProfileById(id: string): Profile | undefined {
    return this.state.profiles.find((p) => p.id === id);
  }
  public getProfileByEmail(email: string): Profile | undefined {
    return this.state.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
  }
  public createProfile(profile: Profile): Profile {
    this.state.profiles.push(profile);
    this.scheduleSave();
    return profile;
  }
  public updateProfile(id: string, updates: Partial<Profile>): Profile | undefined {
    const idx = this.state.profiles.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    this.state.profiles[idx] = {
      ...this.state.profiles[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };
    this.scheduleSave();
    return this.state.profiles[idx];
  }
  public deleteProfile(id: string): boolean {
    const initial = this.state.profiles.length;
    this.state.profiles = this.state.profiles.filter((p) => p.id !== id);
    // Cascade delete connections, credentials, transformations, api keys
    const conns = this.state.connections.filter((c) => c.user_id === id);
    conns.forEach((c) => this.deleteConnection(c.id, id));
    this.state.transformations = this.state.transformations.filter((t) => t.user_id !== id);
    this.state.api_keys = this.state.api_keys.filter((k) => k.user_id !== id);
    this.state.subscriptions = this.state.subscriptions.filter((s) => s.user_id !== id);
    this.state.usage = this.state.usage.filter((u) => u.user_id !== id);
    this.scheduleSave();
    return this.state.profiles.length < initial;
  }

  // --- Plans & Subscriptions ---
  public getPlans(): Plan[] {
    return this.state.plans;
  }
  public getPlanById(id: string): Plan | undefined {
    return this.state.plans.find((p) => p.id === id);
  }
  public updatePlan(id: string, updates: Partial<Plan>): Plan | undefined {
    const idx = this.state.plans.findIndex((p) => p.id === id);
    if (idx === -1) return undefined;
    this.state.plans[idx] = { ...this.state.plans[idx], ...updates, updated_at: new Date().toISOString() };
    this.scheduleSave();
    return this.state.plans[idx];
  }
  public getSubscriptionByUserId(userId: string): Subscription | undefined {
    return this.state.subscriptions.find((s) => s.user_id === userId);
  }
  public setSubscription(sub: Subscription): Subscription {
    const idx = this.state.subscriptions.findIndex((s) => s.user_id === sub.user_id);
    if (idx !== -1) {
      this.state.subscriptions[idx] = sub;
    } else {
      this.state.subscriptions.push(sub);
    }
    // Update usage limit to match plan
    const plan = this.getPlanById(sub.plan_id);
    if (plan) {
      const usage = this.getUsageByUserId(sub.user_id);
      if (usage) {
        usage.actions_limit = plan.actions_limit;
      }
    }
    this.scheduleSave();
    return sub;
  }

  // --- Usage ---
  public getUsageByUserId(userId: string): Usage {
    let usage = this.state.usage.find((u) => u.user_id === userId);
    if (!usage) {
      const now = new Date();
      const nextMonth = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const sub = this.getSubscriptionByUserId(userId);
      const plan = sub ? this.getPlanById(sub.plan_id) : this.state.plans[0];
      usage = {
        id: `usg_${crypto.randomBytes(6).toString('hex')}`,
        user_id: userId,
        period_start: now.toISOString(),
        period_end: nextMonth.toISOString(),
        actions_count: 0,
        actions_limit: plan ? plan.actions_limit : 25,
        updated_at: now.toISOString(),
      };
      this.state.usage.push(usage);
      this.scheduleSave();
    }
    return usage;
  }

  public recordUsage(userId: string, requestId: string, actionName: string, units = 1): boolean {
    const usage = this.getUsageByUserId(userId);
    usage.actions_count += units;
    usage.updated_at = new Date().toISOString();

    this.state.usage_events.push({
      id: `ue_${crypto.randomBytes(6).toString('hex')}`,
      user_id: userId,
      request_id: requestId,
      action_name: actionName,
      consumed_units: units,
      created_at: new Date().toISOString(),
    });
    this.scheduleSave();
    return true;
  }

  // --- Connections & Credentials ---
  public getConnectionsByUserId(userId: string): Connection[] {
    return this.state.connections.filter((c) => c.user_id === userId);
  }
  public getConnectionById(id: string, userId: string): Connection | undefined {
    return this.state.connections.find((c) => c.id === id && c.user_id === userId);
  }
  public createConnection(
    connection: Connection,
    rawSecret?: string
  ): { connection: Connection; credential?: ConnectionCredential } {
    this.state.connections.push(connection);

    let credential: ConnectionCredential | undefined;
    if (rawSecret && connection.auth_type !== 'none') {
      const enc = encryptCredential(rawSecret);
      credential = {
        id: `cred_${crypto.randomBytes(6).toString('hex')}`,
        connection_id: connection.id,
        secret_type: connection.auth_type,
        encrypted_secret: enc.encrypted_secret,
        iv: enc.iv,
        auth_tag: enc.auth_tag,
        masked_preview: maskSecret(rawSecret),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.state.connection_credentials.push(credential);
    }
    this.scheduleSave();
    return { connection, credential };
  }
  public updateConnection(
    id: string,
    userId: string,
    updates: Partial<Connection>,
    newSecret?: string
  ): Connection | undefined {
    const idx = this.state.connections.findIndex((c) => c.id === id && c.user_id === userId);
    if (idx === -1) return undefined;

    this.state.connections[idx] = {
      ...this.state.connections[idx],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (newSecret && this.state.connections[idx].auth_type !== 'none') {
      const enc = encryptCredential(newSecret);
      const credIdx = this.state.connection_credentials.findIndex((c) => c.connection_id === id);
      const now = new Date().toISOString();
      if (credIdx !== -1) {
        this.state.connection_credentials[credIdx] = {
          ...this.state.connection_credentials[credIdx],
          secret_type: this.state.connections[idx].auth_type,
          encrypted_secret: enc.encrypted_secret,
          iv: enc.iv,
          auth_tag: enc.auth_tag,
          masked_preview: maskSecret(newSecret),
          updated_at: now,
        };
      } else {
        this.state.connection_credentials.push({
          id: `cred_${crypto.randomBytes(6).toString('hex')}`,
          connection_id: id,
          secret_type: this.state.connections[idx].auth_type,
          encrypted_secret: enc.encrypted_secret,
          iv: enc.iv,
          auth_tag: enc.auth_tag,
          masked_preview: maskSecret(newSecret),
          created_at: now,
          updated_at: now,
        });
      }
    }
    this.scheduleSave();
    return this.state.connections[idx];
  }
  public deleteConnection(id: string, userId: string): boolean {
    const initial = this.state.connections.length;
    this.state.connections = this.state.connections.filter((c) => !(c.id === id && c.user_id === userId));
    this.state.connection_credentials = this.state.connection_credentials.filter((c) => c.connection_id !== id);
    this.scheduleSave();
    return this.state.connections.length < initial;
  }
  public getCredentialByConnectionId(connectionId: string): ConnectionCredential | undefined {
    return this.state.connection_credentials.find((c) => c.connection_id === connectionId);
  }

  // --- Transformations ---
  public getTransformationsByUserId(userId: string): Transformation[] {
    return this.state.transformations.filter((t) => t.user_id === userId);
  }
  public getTransformationById(id: string, userId: string): Transformation | undefined {
    return this.state.transformations.find((t) => t.id === id && t.user_id === userId);
  }
  public createTransformation(transformation: Transformation): Transformation {
    this.state.transformations.push(transformation);
    this.scheduleSave();
    return transformation;
  }
  public updateTransformation(
    id: string,
    userId: string,
    updates: Partial<Transformation>
  ): Transformation | undefined {
    const idx = this.state.transformations.findIndex((t) => t.id === id && t.user_id === userId);
    if (idx === -1) return undefined;

    // Snapshot version before update
    const current = this.state.transformations[idx];
    this.state.transformation_versions.push({
      id: `tv_${crypto.randomBytes(6).toString('hex')}`,
      transformation_id: current.id,
      version_num: current.version,
      snapshot: { ...current },
      created_at: new Date().toISOString(),
    });

    this.state.transformations[idx] = {
      ...current,
      ...updates,
      version: current.version + 1,
      updated_at: new Date().toISOString(),
    };
    this.scheduleSave();
    return this.state.transformations[idx];
  }
  public deleteTransformation(id: string, userId: string): boolean {
    const initial = this.state.transformations.length;
    this.state.transformations = this.state.transformations.filter((t) => !(t.id === id && t.user_id === userId));
    this.scheduleSave();
    return this.state.transformations.length < initial;
  }

  // --- Requests & Audit ---
  public getRequestsByUserId(userId: string, limit = 50): ExecutionRequest[] {
    return this.state.requests
      .filter((r) => r.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }
  public getRequestById(id: string, userId: string): ExecutionRequest | undefined {
    return this.state.requests.find((r) => r.id === id && r.user_id === userId);
  }
  public createRequest(req: ExecutionRequest): ExecutionRequest {
    this.state.requests.unshift(req);
    // Keep max 1000 requests in store to prevent memory bloat
    if (this.state.requests.length > 1000) {
      this.state.requests = this.state.requests.slice(0, 1000);
    }
    this.scheduleSave();
    return req;
  }

  // --- API Keys ---
  public getApiKeysByUserId(userId: string): ApiKey[] {
    return this.state.api_keys.filter((k) => k.user_id === userId);
  }
  public createApiKey(key: ApiKey): ApiKey {
    this.state.api_keys.push(key);
    this.scheduleSave();
    return key;
  }
  public revokeApiKey(id: string, userId: string): boolean {
    const key = this.state.api_keys.find((k) => k.id === id && k.user_id === userId);
    if (!key) return false;
    key.is_revoked = true;
    this.scheduleSave();
    return true;
  }
  public getApiKeyByHash(hash: string): ApiKey | undefined {
    return this.state.api_keys.find((k) => k.key_hash === hash && !k.is_revoked);
  }

  // --- Security Events & Audit Logs ---
  public logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'created_at'>): SecurityEvent {
    const se: SecurityEvent = {
      ...event,
      id: `sec_${crypto.randomBytes(6).toString('hex')}`,
      created_at: new Date().toISOString(),
    };
    this.state.security_events.unshift(se);
    if (this.state.security_events.length > 500) {
      this.state.security_events = this.state.security_events.slice(0, 500);
    }
    this.scheduleSave();
    return se;
  }
  public getSecurityEvents(userId?: string, limit = 50): SecurityEvent[] {
    return this.state.security_events
      .filter((e) => (userId ? e.user_id === userId : true))
      .slice(0, limit);
  }
  public logAudit(log: Omit<AuditLog, 'id' | 'created_at'>): AuditLog {
    const al: AuditLog = {
      ...log,
      id: `aud_${crypto.randomBytes(6).toString('hex')}`,
      created_at: new Date().toISOString(),
    };
    this.state.audit_logs.unshift(al);
    if (this.state.audit_logs.length > 500) {
      this.state.audit_logs = this.state.audit_logs.slice(0, 500);
    }
    this.scheduleSave();
    return al;
  }
  public getAuditLogs(userId: string, limit = 50): AuditLog[] {
    return this.state.audit_logs.filter((a) => a.user_id === userId).slice(0, limit);
  }

  // --- System Settings ---
  public getSetting(key: string): Record<string, unknown> | undefined {
    const s = this.state.system_settings.find((item) => item.key === key);
    return s ? s.value : undefined;
  }
  public setSetting(key: string, value: Record<string, unknown>): void {
    const idx = this.state.system_settings.findIndex((item) => item.key === key);
    const now = new Date().toISOString();
    if (idx !== -1) {
      this.state.system_settings[idx] = { key, value, updated_at: now };
    } else {
      this.state.system_settings.push({ key, value, updated_at: now });
    }
    this.scheduleSave();
  }

  // Metrics for Admin Dashboard
  public getSystemMetrics() {
    return {
      totalUsers: this.state.profiles.length,
      totalConnections: this.state.connections.length,
      totalTransformations: this.state.transformations.length,
      totalRequests: this.state.requests.length,
      successfulRequests: this.state.requests.filter((r) => r.status === 'success').length,
      failedRequests: this.state.requests.filter((r) => r.status !== 'success').length,
      totalSecurityEvents: this.state.security_events.length,
      activeSubscriptions: this.state.subscriptions.filter((s) => s.status === 'active').length,
    };
  }
}

export const db = new Store();
