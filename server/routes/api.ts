import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/store';
import { AuthenticatedRequest, createSession, requireAdmin, requireAuth, revokeSession } from '../security/auth';
import { hashPassword, verifyPassword, generateApiKey, hashToken } from '../security/crypto';
import { checkRateLimit } from '../security/rateLimiter';
import { validateTargetUrl } from '../security/ssrf';
import { executeExternalRequest } from '../services/requestEngine';
import { executeTransformation, extractWithGemini } from '../services/transformationEngine';
import { billingEngine } from '../services/billingEngine';
import { handleMcpRequest } from '../services/mcpService';

export const apiRouter = Router();

// ==========================================
// OBSERVABILITY & HEALTH ENDPOINTS
// ==========================================

apiRouter.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      database: 'connected',
      mcp_server: 'online',
      ssrf_shield: 'active',
      encryption_engine: 'aes-256-gcm',
    },
  });
});

apiRouter.get('/readiness', (req: Request, res: Response) => {
  res.status(200).json({ ready: true, uptime: process.uptime() });
});

// ==========================================
// OPENAI DOMAIN VERIFICATION
// ==========================================
// Required per spec: returns EXACT verification token without JSON formatting
export function handleOpenAiAppsChallenge(req: Request, res: Response) {
  const token =
    process.env.OPENAI_APP_VERIFICATION_TOKEN ||
    'openai-apps-challenge-jitc-verif-2026-prod-token';
  res.setHeader('Content-Type', 'text/plain');
  res.status(200).send(token);
}

// ==========================================
// MCP STREAMABLE HTTP ENDPOINT
// ==========================================
apiRouter.all('/mcp', handleMcpRequest);

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

apiRouter.post('/auth/signup', (req: Request, res: Response) => {
  const { email, password, name } = req.body || {};

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Valid email and password (min 8 chars) required.' });
  }

  const existing = db.getProfileByEmail(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const now = new Date().toISOString();
  const userId = `usr_${crypto.randomBytes(6).toString('hex')}`;
  const passwordHash = hashPassword(password);

  const newProfile = db.createProfile({
    id: userId,
    email: email.trim().toLowerCase(),
    password_hash: passwordHash,
    name: name?.trim() || email.split('@')[0],
    role: 'user',
    created_at: now,
    updated_at: now,
  });

  // Provision free plan subscription & usage
  db.setSubscription({
    id: `sub_${crypto.randomBytes(6).toString('hex')}`,
    user_id: userId,
    plan_id: 'plan_free',
    status: 'active',
    current_period_start: now,
    current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    cancel_at_period_end: false,
    provider: 'manual',
    created_at: now,
    updated_at: now,
  });

  db.getUsageByUserId(userId);

  const sessionToken = createSession(userId);

  res.status(201).json({
    token: sessionToken,
    user: {
      id: newProfile.id,
      email: newProfile.email,
      name: newProfile.name,
      role: newProfile.role,
    },
  });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required.' });
  }

  const profile = db.getProfileByEmail(email);
  if (!profile || !verifyPassword(password, profile.password_hash)) {
    db.logSecurityEvent({
      event_type: 'auth_failure',
      severity: 'medium',
      details: { email },
      ip_address: req.ip || '127.0.0.1',
      blocked: true,
    });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const sessionToken = createSession(profile.id);

  res.status(200).json({
    token: sessionToken,
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
    },
  });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const sub = db.getSubscriptionByUserId(user.id);
  const plan = sub ? db.getPlanById(sub.plan_id) : db.getPlans()[0];
  const usage = db.getUsageByUserId(user.id);

  res.status(200).json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    subscription: {
      plan,
      status: sub?.status,
      period_end: sub?.current_period_end,
      cancel_at_period_end: sub?.cancel_at_period_end,
    },
    usage,
  });
});

apiRouter.post('/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.includes('sess_')) {
    const token = authHeader.replace('Bearer ', '').trim();
    revokeSession(token);
  }
  res.status(200).json({ success: true });
});

// ==========================================
// PROFILE & ACCOUNT MANAGEMENT
// ==========================================

apiRouter.patch('/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { name } = req.body || {};
  const updated = db.updateProfile(req.user!.id, { name });
  res.status(200).json({ success: true, user: updated });
});

apiRouter.delete('/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  db.deleteProfile(userId);
  db.logAudit({
    user_id: userId,
    action: 'account.deleted',
    resource_type: 'profile',
    metadata: { reason: 'User requested self-deletion' },
    ip_address: req.ip || '127.0.0.1',
  });
  res.status(200).json({ success: true, message: 'Account and associated data completely removed.' });
});

// ==========================================
// CONNECTIONS
// ==========================================

apiRouter.get('/connections', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const connections = db.getConnectionsByUserId(req.user!.id);
  const enriched = connections.map((c) => {
    const cred = db.getCredentialByConnectionId(c.id);
    return {
      ...c,
      credential_masked: cred?.masked_preview,
    };
  });
  res.status(200).json({ connections: enriched });
});

apiRouter.post('/connections', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const {
    name,
    description,
    endpoint_url,
    http_method = 'POST',
    auth_type = 'none',
    secret,
    headers = {},
    query_params = {},
    timeout_ms = 8000,
    retry_count = 2,
  } = req.body || {};

  if (!name || !endpoint_url) {
    return res.status(400).json({ error: 'Name and endpoint URL are required.' });
  }

  // Check connection limit by plan
  const userConns = db.getConnectionsByUserId(userId);
  const sub = db.getSubscriptionByUserId(userId);
  const plan = sub ? db.getPlanById(sub.plan_id) : db.getPlans()[0];
  if (plan && userConns.length >= plan.connections_limit) {
    return res.status(403).json({
      error: `Connection limit reached (${plan.connections_limit} connections). Upgrade your plan to add more.`,
    });
  }

  // Validate target URL against SSRF
  const ssrf = await validateTargetUrl(endpoint_url);
  if (!ssrf.isValid) {
    return res.status(400).json({ error: `Security check failed: ${ssrf.reason}` });
  }

  const connId = `conn_${crypto.randomBytes(6).toString('hex')}`;
  const now = new Date().toISOString();

  const { connection, credential } = db.createConnection(
    {
      id: connId,
      user_id: userId,
      name: name.trim(),
      description: description?.trim() || '',
      endpoint_url: endpoint_url.trim(),
      http_method,
      auth_type,
      headers,
      query_params,
      timeout_ms: Number(timeout_ms) || 8000,
      retry_count: Number(retry_count) || 2,
      status: 'active',
      created_at: now,
      updated_at: now,
    },
    secret
  );

  db.logAudit({
    user_id: userId,
    action: 'connection.created',
    resource_type: 'connection',
    resource_id: connId,
    metadata: { name: connection.name, endpoint: connection.endpoint_url },
    ip_address: req.ip || '127.0.0.1',
  });

  res.status(201).json({
    connection: {
      ...connection,
      credential_masked: credential?.masked_preview,
    },
  });
});

apiRouter.get('/connections/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const connection = db.getConnectionById(req.params.id, req.user!.id);
  if (!connection) {
    return res.status(404).json({ error: 'Connection not found.' });
  }
  const cred = db.getCredentialByConnectionId(connection.id);
  res.status(200).json({
    connection: {
      ...connection,
      credential_masked: cred?.masked_preview,
    },
  });
});

apiRouter.patch('/connections/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;
  const { secret, ...updates } = req.body || {};

  if (updates.endpoint_url) {
    const ssrf = await validateTargetUrl(updates.endpoint_url);
    if (!ssrf.isValid) {
      return res.status(400).json({ error: `Security check failed: ${ssrf.reason}` });
    }
  }

  const updated = db.updateConnection(id, userId, updates, secret);
  if (!updated) {
    return res.status(404).json({ error: 'Connection not found.' });
  }

  const cred = db.getCredentialByConnectionId(id);
  res.status(200).json({
    connection: {
      ...updated,
      credential_masked: cred?.masked_preview,
    },
  });
});

apiRouter.delete('/connections/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteConnection(req.params.id, req.user!.id);
  if (!success) {
    return res.status(404).json({ error: 'Connection not found.' });
  }
  res.status(200).json({ success: true });
});

apiRouter.post('/connections/:id/test', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const connection = db.getConnectionById(req.params.id, req.user!.id);
  if (!connection) {
    return res.status(404).json({ error: 'Connection not found.' });
  }

  const result = await executeExternalRequest({
    userId: req.user!.id,
    connection,
    payload: req.body?.payload || { ping: 'jitc_test_probe', timestamp: new Date().toISOString() },
    actionType: 'test_run',
  });

  res.status(200).json(result);
});

// ==========================================
// TRANSFORMATIONS
// ==========================================

apiRouter.get('/transformations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const transformations = db.getTransformationsByUserId(req.user!.id);
  res.status(200).json({ transformations });
});

apiRouter.post('/transformations', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const {
    name,
    description,
    connection_id,
    mode = 'visual',
    rules = [],
    template_json,
    ai_system_instructions,
    sample_input = '',
    sample_output = '',
  } = req.body || {};

  if (!name) {
    return res.status(400).json({ error: 'Transformation name is required.' });
  }

  const now = new Date().toISOString();
  const transId = `trans_${crypto.randomBytes(6).toString('hex')}`;

  const created = db.createTransformation({
    id: transId,
    user_id: userId,
    connection_id,
    name: name.trim(),
    description: description?.trim() || '',
    mode,
    rules,
    template_json,
    ai_system_instructions,
    sample_input,
    sample_output,
    version: 1,
    created_at: now,
    updated_at: now,
  });

  res.status(201).json({ transformation: created });
});

apiRouter.patch('/transformations/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updateTransformation(req.params.id, req.user!.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ error: 'Transformation not found.' });
  }
  res.status(200).json({ transformation: updated });
});

apiRouter.delete('/transformations/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const success = db.deleteTransformation(req.params.id, req.user!.id);
  if (!success) {
    return res.status(404).json({ error: 'Transformation not found.' });
  }
  res.status(200).json({ success: true });
});

apiRouter.post('/transformations/preview', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { transformation, raw_input } = req.body || {};
  if (!raw_input) {
    return res.status(400).json({ error: 'raw_input is required for preview.' });
  }

  try {
    const dummyTrans = {
      id: 'trans_preview',
      user_id: req.user!.id,
      name: 'Preview',
      description: '',
      mode: transformation?.mode || 'visual',
      rules: transformation?.rules || [],
      template_json: transformation?.template_json,
      ai_system_instructions: transformation?.ai_system_instructions,
      sample_input: '',
      version: 1,
      created_at: '',
      updated_at: '',
    };
    const output = await executeTransformation(dummyTrans, raw_input);
    res.status(200).json({ output });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: `Transformation error: ${msg}` });
  }
});

apiRouter.post('/transformations/ai-extract', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { text, schemaGuide } = req.body || {};
  if (!text) {
    return res.status(400).json({ error: 'text is required for extraction.' });
  }

  try {
    const extracted = await extractWithGemini(text, schemaGuide);
    res.status(200).json({ extracted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ==========================================
// REQUEST EXECUTION ENGINE
// ==========================================

apiRouter.post('/execute', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { connection_id, transformation_id, input_data, idempotency_key } = req.body || {};

  if (!connection_id) {
    return res.status(400).json({ error: 'connection_id is required.' });
  }

  const connection = db.getConnectionById(connection_id, userId);
  if (!connection) {
    return res.status(404).json({ error: 'Connection not found.' });
  }

  // Optional rate limiting check per user
  const rl = checkRateLimit(userId, { max: 120, windowMs: 60000 });
  if (!rl.allowed) {
    db.logSecurityEvent({
      user_id: userId,
      event_type: 'rate_limit_exceeded',
      severity: 'medium',
      details: { connection_id },
      ip_address: req.ip || '127.0.0.1',
      blocked: true,
    });
    return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
  }

  // Transform payload if transformation specified
  let payloadToSend = input_data;
  let trans = transformation_id ? db.getTransformationById(transformation_id, userId) : undefined;
  if (!trans) {
    trans = db.getTransformationsByUserId(userId).find((t) => t.connection_id === connection.id);
  }

  if (trans && input_data) {
    payloadToSend = await executeTransformation(trans, input_data);
  }

  const result = await executeExternalRequest({
    userId,
    connection,
    payload: payloadToSend,
    transformationId: trans?.id,
    actionType: 'web_dashboard',
    idempotencyKey: idempotency_key || req.headers['idempotency-key']?.toString(),
  });

  res.status(result.success ? 200 : 400).json(result);
});

// ==========================================
// REQUEST HISTORY & AUDIT
// ==========================================

apiRouter.get('/requests', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const requests = db.getRequestsByUserId(req.user!.id, limit);
  res.status(200).json({ requests });
});

apiRouter.get('/requests/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const reqRecord = db.getRequestById(req.params.id, req.user!.id);
  if (!reqRecord) {
    return res.status(404).json({ error: 'Request record not found.' });
  }
  res.status(200).json({ request: reqRecord });
});

// ==========================================
// USAGE & BILLING
// ==========================================

apiRouter.get('/usage', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const usage = db.getUsageByUserId(req.user!.id);
  res.status(200).json({ usage });
});

apiRouter.get('/billing', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const plans = db.getPlans();
  const sub = db.getSubscriptionByUserId(req.user!.id);
  const currentPlan = sub ? db.getPlanById(sub.plan_id) : plans[0];
  const usage = db.getUsageByUserId(req.user!.id);

  res.status(200).json({
    plans,
    subscription: sub,
    currentPlan,
    usage,
  });
});

apiRouter.post('/billing/checkout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { plan_id } = req.body || {};
  if (!plan_id) {
    return res.status(400).json({ error: 'plan_id is required.' });
  }

  try {
    const result = await billingEngine.createCheckout(req.user!.id, plan_id);
    res.status(200).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: msg });
  }
});

apiRouter.post('/billing/webhook', async (req: Request, res: Response) => {
  const event = req.body;
  if (!event || !event.type) {
    return res.status(400).json({ error: 'Invalid webhook event format.' });
  }

  try {
    const handled = await billingEngine.handleWebhook(event);
    res.status(200).json(handled);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

apiRouter.post('/billing/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const ok = await billingEngine.cancelSubscription(req.user!.id);
  res.status(200).json({ success: ok });
});

// ==========================================
// API KEYS
// ==========================================

apiRouter.get('/api-keys', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const keys = db.getApiKeysByUserId(req.user!.id);
  res.status(200).json({
    api_keys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      key_prefix: k.key_prefix,
      scopes: k.scopes,
      last_used_at: k.last_used_at,
      is_revoked: k.is_revoked,
      created_at: k.created_at,
    })),
  });
});

apiRouter.post('/api-keys', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const { name = 'Default API Key' } = req.body || {};
  const { rawKey, keyPrefix, keyHash } = generateApiKey();
  const userId = req.user!.id;
  const now = new Date().toISOString();

  const apiKey = db.createApiKey({
    id: `key_${crypto.randomBytes(6).toString('hex')}`,
    user_id: userId,
    name: name.trim(),
    key_prefix: keyPrefix,
    key_hash: keyHash,
    scopes: ['connections:read', 'execute', 'profile:read'],
    is_revoked: false,
    created_at: now,
  });

  db.logAudit({
    user_id: userId,
    action: 'api_key.created',
    resource_type: 'api_key',
    resource_id: apiKey.id,
    metadata: { name: apiKey.name, prefix: keyPrefix },
    ip_address: req.ip || '127.0.0.1',
  });

  // RAW KEY IS DISPLAYED ONCE TO USER AND NEVER STORED
  res.status(201).json({
    api_key: {
      id: apiKey.id,
      name: apiKey.name,
      raw_key: rawKey,
      key_prefix: keyPrefix,
      scopes: apiKey.scopes,
      created_at: apiKey.created_at,
    },
  });
});

apiRouter.delete('/api-keys/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const ok = db.revokeApiKey(req.params.id, req.user!.id);
  if (!ok) {
    return res.status(404).json({ error: 'API key not found.' });
  }
  res.status(200).json({ success: true, message: 'API key revoked.' });
});

// ==========================================
// SECURITY AUDIT & SSRF TESTING TOOLS
// ==========================================

apiRouter.get('/security/events', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const events = db.getSecurityEvents(req.user!.role === 'admin' ? undefined : req.user!.id);
  res.status(200).json({ events });
});

apiRouter.post('/security/test-ssrf', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const { test_url } = req.body || {};
  if (!test_url) {
    return res.status(400).json({ error: 'test_url is required.' });
  }

  const result = await validateTargetUrl(test_url);

  if (!result.isValid) {
    db.logSecurityEvent({
      user_id: req.user!.id,
      event_type: 'ssrf_blocked',
      severity: 'high',
      details: { url: test_url, reason: result.reason },
      ip_address: req.ip || '127.0.0.1',
      blocked: true,
    });
  }

  res.status(200).json({
    tested_url: test_url,
    is_safe: result.isValid,
    reason: result.reason,
    resolved_ip: result.resolvedIp,
  });
});

// ==========================================
// ADMIN DASHBOARD ROUTES
// ==========================================

apiRouter.get('/admin/metrics', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const metrics = db.getSystemMetrics();
  res.status(200).json({ metrics });
});

apiRouter.get('/admin/users', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const users = db.getProfiles().map((p) => {
    const sub = db.getSubscriptionByUserId(p.id);
    const plan = sub ? db.getPlanById(sub.plan_id) : undefined;
    const usage = db.getUsageByUserId(p.id);
    return {
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      plan_name: plan?.name || 'Free',
      actions_count: usage?.actions_count || 0,
      created_at: p.created_at,
    };
  });
  res.status(200).json({ users });
});

apiRouter.patch('/admin/plans/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const updated = db.updatePlan(req.params.id, req.body);
  if (!updated) {
    return res.status(404).json({ error: 'Plan not found.' });
  }
  res.status(200).json({ plan: updated });
});
