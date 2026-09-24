import crypto from 'node:crypto';
import type {
  Profile, Plan, Subscription, Connection, ConnectionCredential,
  Transformation, TransformationVersion, ExecutionRequest, RequestAttempt,
  Usage, UsageEvent, AuditLog, SecurityEvent, ApiKey
} from './schema';
import { getSupabaseAdmin } from './supabase';
import { encryptCredential, maskSecret } from '../security/crypto';

function now() { return new Date().toISOString(); }
function id(prefix: string) { return `${prefix}_${crypto.randomBytes(8).toString('hex')}`; }

function fail<T>(error: { message?: string; details?: string } | null, fallback: T): T {
  if (error) throw new Error(error.message || error.details || 'Database operation failed');
  return fallback;
}

class Store {
  async getProfileById(userId: string): Promise<Profile | undefined> {
    const { data, error } = await getSupabaseAdmin().from('profiles').select('*').eq('id', userId).maybeSingle();
    return fail(error, data || undefined);
  }

  async getProfileByEmail(email: string): Promise<Profile | undefined> {
    const { data, error } = await getSupabaseAdmin().from('profiles').select('*').ilike('email', email.trim()).maybeSingle();
    return fail(error, data || undefined);
  }

  async createProfile(profile: Profile): Promise<Profile> {
    const { data, error } = await getSupabaseAdmin().from('profiles').insert(profile).select('*').single();
    return fail(error, data as Profile);
  }

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<Profile | undefined> {
    const { data, error } = await getSupabaseAdmin().from('profiles').update({ ...updates, updated_at: now() }).eq('id', userId).select('*').maybeSingle();
    return fail(error, data || undefined);
  }

  async deleteProfile(userId: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return true;
  }

  async claimBillingWebhook(eventId: string, eventType: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from('billing_webhook_events').insert({
      event_id: eventId,
      event_type: eventType,
      received_at: now()
    });
    if (!error) return true;
    if (error.code === '23505') return false;
    throw new Error(error.message);
  }

  async getProfiles(): Promise<Profile[]> {
    const { data, error } = await getSupabaseAdmin().from('profiles').select('*').order('created_at', { ascending: false });
    return fail(error, (data || []) as Profile[]);
  }

  async getPlans(): Promise<Plan[]> {
    const { data, error } = await getSupabaseAdmin().from('plans').select('*').eq('is_active', true).order('price_monthly');
    return fail(error, (data || []) as Plan[]);
  }

  async getPlanById(planId: string): Promise<Plan | undefined> {
    const { data, error } = await getSupabaseAdmin().from('plans').select('*').eq('id', planId).maybeSingle();
    return fail(error, data as Plan | undefined);
  }

  async updatePlan(planId: string, updates: Partial<Plan>): Promise<Plan | undefined> {
    const allowed = {
      name: updates.name, price_monthly: updates.price_monthly, actions_limit: updates.actions_limit,
      connections_limit: updates.connections_limit, features: updates.features, is_active: updates.is_active,
      stripe_price_id: (updates as any).stripe_price_id, usage_count_mode: (updates as any).usage_count_mode
    };
    const { data, error } = await getSupabaseAdmin().from('plans').update({ ...allowed, updated_at: now() }).eq('id', planId).select('*').maybeSingle();
    return fail(error, data as Plan | undefined);
  }

  async getSubscriptionByUserId(userId: string): Promise<Subscription | undefined> {
    const { data, error } = await getSupabaseAdmin().from('subscriptions').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    return fail(error, data as Subscription | undefined);
  }

  async setSubscription(sub: Subscription): Promise<Subscription> {
    const { data, error } = await getSupabaseAdmin().from('subscriptions').upsert(sub, { onConflict: 'id' }).select('*').single();
    if (error) throw new Error(error.message);
    const plan = await this.getPlanById(sub.plan_id);
    if (plan) {
      const current = await this.getUsageByUserId(sub.user_id);
      if (current) {
        await getSupabaseAdmin().from('usage').update({ actions_limit: plan.actions_limit, updated_at: now() }).eq('id', current.id);
      }
    }
    return data as Subscription;
  }

  async getUsageByUserId(userId: string): Promise<Usage> {
    const { data, error } = await getSupabaseAdmin().from('usage').select('*').eq('user_id', userId).order('period_start', { ascending: false }).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (data) return data as Usage;
    const sub = await this.getSubscriptionByUserId(userId);
    const plan = sub ? await this.getPlanById(sub.plan_id) : await this.getPlanById('plan_free');
    const record: Usage = {
      id: id('usg'), user_id: userId, period_start: now(),
      period_end: new Date(Date.now()+30*24*3600*1000).toISOString(),
      actions_count: 0, actions_limit: plan?.actions_limit || 25, updated_at: now()
    };
    const { data: created, error: createError } = await getSupabaseAdmin().from('usage').insert(record).select('*').single();
    return fail(createError, created as Usage);
  }

  async reserveUsage(userId: string, requestId: string, actionName: string, units = 1) {
    const { data, error } = await getSupabaseAdmin().rpc('reserve_usage', {
      p_user_id: userId, p_request_id: requestId, p_action_name: actionName, p_units: units
    });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return { allowed: Boolean(row?.allowed), actionsCount: Number(row?.actions_count || 0), actionsLimit: Number(row?.actions_limit || 0) };
  }

  async getConnectionsByUserId(userId: string): Promise<Connection[]> {
    const { data, error } = await getSupabaseAdmin().from('connections').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return fail(error, (data || []) as Connection[]);
  }

  async getConnectionById(connectionId: string, userId: string): Promise<Connection | undefined> {
    const { data, error } = await getSupabaseAdmin().from('connections').select('*').eq('id', connectionId).eq('user_id', userId).maybeSingle();
    return fail(error, data as Connection | undefined);
  }

  async createConnection(connection: Connection, rawSecret?: string): Promise<{ connection: Connection; credential?: ConnectionCredential }> {
    const { data, error } = await getSupabaseAdmin().from('connections').insert(connection).select('*').single();
    if (error) throw new Error(error.message);
    let credential: ConnectionCredential | undefined;
    if (rawSecret && connection.auth_type !== 'none') {
      const enc = encryptCredential(rawSecret);
      credential = {
        id: id('cred'), connection_id: connection.id, secret_type: connection.auth_type,
        encrypted_secret: enc.encrypted_secret, iv: enc.iv, auth_tag: enc.auth_tag,
        masked_preview: maskSecret(rawSecret), created_at: now(), updated_at: now()
      };
      const { error: credError } = await getSupabaseAdmin().from('connection_credentials').insert(credential);
      if (credError) throw new Error(credError.message);
    }
    return { connection: data as Connection, credential };
  }

  async updateConnection(connectionId: string, userId: string, updates: Partial<Connection>, newSecret?: string): Promise<Connection | undefined> {
    const { data, error } = await getSupabaseAdmin().from('connections').update({ ...updates, updated_at: now() }).eq('id', connectionId).eq('user_id', userId).select('*').maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return undefined;
    if (newSecret && data.auth_type !== 'none') {
      const enc = encryptCredential(newSecret);
      const credential: Partial<ConnectionCredential> = {
        secret_type: data.auth_type,
        encrypted_secret: enc.encrypted_secret, iv: enc.iv, auth_tag: enc.auth_tag,
        masked_preview: maskSecret(newSecret), updated_at: now()
      };
      const { error: credError } = await getSupabaseAdmin().from('connection_credentials').upsert({ id: id('cred'), connection_id: connectionId, created_at: now(), ...credential }, { onConflict: 'connection_id' });
      if (credError) throw new Error(credError.message);
    }
    return data as Connection;
  }

  async deleteConnection(connectionId: string, userId: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from('connections').delete().eq('id', connectionId).eq('user_id', userId);
    return fail(error, true);
  }

  async getCredentialByConnectionId(connectionId: string): Promise<ConnectionCredential | undefined> {
    const { data, error } = await getSupabaseAdmin().from('connection_credentials').select('*').eq('connection_id', connectionId).maybeSingle();
    return fail(error, data as ConnectionCredential | undefined);
  }

  async getTransformationsByUserId(userId: string): Promise<Transformation[]> {
    const { data, error } = await getSupabaseAdmin().from('transformations').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return fail(error, (data || []) as Transformation[]);
  }

  async getTransformationById(id_: string, userId: string): Promise<Transformation | undefined> {
    const { data, error } = await getSupabaseAdmin().from('transformations').select('*').eq('id', id_).eq('user_id', userId).maybeSingle();
    return fail(error, data as Transformation | undefined);
  }

  async createTransformation(transformation: Transformation): Promise<Transformation> {
    const { data, error } = await getSupabaseAdmin().from('transformations').insert(transformation).select('*').single();
    return fail(error, data as Transformation);
  }

  async updateTransformation(transformationId: string, userId: string, updates: Partial<Transformation>): Promise<Transformation | undefined> {
    const current = await this.getTransformationById(transformationId, userId);
    if (!current) return undefined;
    const snapshot: TransformationVersion = {
      id: id('tv'), transformation_id: current.id, version_num: current.version,
      snapshot: current as any, created_at: now()
    };
    await getSupabaseAdmin().from('transformation_versions').insert(snapshot);
    const { data, error } = await getSupabaseAdmin().from('transformations').update({ ...updates, version: current.version + 1, updated_at: now() }).eq('id', transformationId).eq('user_id', userId).select('*').maybeSingle();
    return fail(error, data as Transformation | undefined);
  }

  async deleteTransformation(transformationId: string, userId: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from('transformations').delete().eq('id', transformationId).eq('user_id', userId);
    return fail(error, true);
  }

  async getRequestsByUserId(userId: string, limit = 50): Promise<ExecutionRequest[]> {
    const { data, error } = await getSupabaseAdmin().from('requests').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    return fail(error, (data || []) as ExecutionRequest[]);
  }

  async getRequestById(requestId: string, userId: string): Promise<ExecutionRequest | undefined> {
    const { data, error } = await getSupabaseAdmin().from('requests').select('*').eq('id', requestId).eq('user_id', userId).maybeSingle();
    return fail(error, data as ExecutionRequest | undefined);
  }

  async getRequestByIdempotencyKey(userId: string, key: string): Promise<ExecutionRequest | undefined> {
    const { data, error } = await getSupabaseAdmin().from('requests').select('*').eq('user_id', userId).eq('idempotency_key', key).maybeSingle();
    return fail(error, data as ExecutionRequest | undefined);
  }

  async createRequest(request: ExecutionRequest): Promise<ExecutionRequest> {
    const { data, error } = await getSupabaseAdmin().from('requests').insert(request).select('*').single();
    return fail(error, data as ExecutionRequest);
  }

  async updateRequest(requestId: string, userId: string, updates: Partial<ExecutionRequest>): Promise<ExecutionRequest | undefined> {
    const { data, error } = await getSupabaseAdmin().from('requests').update(updates).eq('id', requestId).eq('user_id', userId).select('*').maybeSingle();
    return fail(error, data as ExecutionRequest | undefined);
  }

  async createRequestAttempt(attempt: RequestAttempt): Promise<RequestAttempt> {
    const { data, error } = await getSupabaseAdmin().from('request_attempts').insert(attempt).select('*').single();
    return fail(error, data as RequestAttempt);
  }

  async getApiKeysByUserId(userId: string): Promise<ApiKey[]> {
    const { data, error } = await getSupabaseAdmin().from('api_keys').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    return fail(error, (data || []) as ApiKey[]);
  }

  async createApiKey(key: ApiKey): Promise<ApiKey> {
    const { data, error } = await getSupabaseAdmin().from('api_keys').insert(key).select('*').single();
    return fail(error, data as ApiKey);
  }

  async revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const { error } = await getSupabaseAdmin().from('api_keys').update({ is_revoked: true }).eq('id', keyId).eq('user_id', userId);
    return fail(error, true);
  }

  async getApiKeyByHash(hash: string): Promise<ApiKey | undefined> {
    const { data, error } = await getSupabaseAdmin().from('api_keys').select('*').eq('key_hash', hash).eq('is_revoked', false).gt('expires_at', new Date().toISOString()).maybeSingle();
    return fail(error, data as ApiKey | undefined);
  }

  async logSecurityEvent(event: Omit<SecurityEvent,'id'|'created_at'>): Promise<SecurityEvent> {
    const row = { ...event, id: id('sec'), created_at: now() };
    const { data, error } = await getSupabaseAdmin().from('security_events').insert(row).select('*').single();
    return fail(error, data as SecurityEvent);
  }

  async getSecurityEvents(userId?: string, limit=50): Promise<SecurityEvent[]> {
    let q=getSupabaseAdmin().from('security_events').select('*').order('created_at',{ascending:false}).limit(limit);
    if(userId) q=q.eq('user_id',userId);
    const {data,error}=await q;
    return fail(error,(data||[]) as SecurityEvent[]);
  }

  async logAudit(log: Omit<AuditLog,'id'|'created_at'>): Promise<AuditLog> {
    const row={...log,id:id('aud'),created_at:now()};
    const {data,error}=await getSupabaseAdmin().from('audit_logs').insert(row).select('*').single();
    return fail(error,data as AuditLog);
  }

  async getAuditEventById(resourceId: string): Promise<AuditLog | undefined> {
    const { data, error } = await getSupabaseAdmin().from('audit_logs').select('*').eq('resource_type','billing').eq('resource_id',resourceId).maybeSingle();
    return fail(error, data as AuditLog | undefined);
  }

  async getSystemMetrics() {
    const admin = getSupabaseAdmin();
    const [u,c,t,r,s,sub] = await Promise.all([
      admin.from('profiles').select('*',{count:'exact',head:true}),
      admin.from('connections').select('*',{count:'exact',head:true}),
      admin.from('transformations').select('*',{count:'exact',head:true}),
      admin.from('requests').select('status',{count:'exact',head:true}).eq('status','success'),
      admin.from('security_events').select('*',{count:'exact',head:true}),
      admin.from('subscriptions').select('*',{count:'exact',head:true}).eq('status','active')
    ]);
    return {
      totalUsers:u.count||0,totalConnections:c.count||0,totalTransformations:t.count||0,totalRequests:r.count||0,
      successfulRequests:r.count||0,failedRequests:Math.max(0,(await admin.from('requests').select('id',{count:'exact',head:true}).in('status',['failed','timeout']).then(x=>x.count||0))),totalSecurityEvents:s.count||0,activeSubscriptions:sub.count||0
    };
  }
}

export const db = new Store();
