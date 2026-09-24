import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { requireAdmin, requireAuth, type AuthenticatedRequest } from '../security/auth.js';
import { db } from '../db/store.js';
import { generateApiKey, hashToken } from '../security/crypto.js';
import { checkRateLimit } from '../security/rateLimiter.js';
import { validateTargetUrl } from '../security/ssrf.js';
import { executeExternalRequest } from '../services/requestEngine.js';
import { executeTransformation, extractWithGemini } from '../services/transformationEngine.js';
import { billingEngine } from '../services/billingEngine.js';

export const apiRouter = Router();

function clientIp(req: Request) { return req.ip || ''; }

async function requireApiKeyScope(req: AuthenticatedRequest, res: Response, scope: string) {
  const token = req.accessToken || '';
  if (!token.startsWith('jtc_live_')) return true;
  const key = await db.getApiKeyByHash(hashToken(token));
  if (!key || !Array.isArray(key.scopes) || !key.scopes.includes(scope)) {
    res.status(403).json({ error: 'API key scope does not permit this operation.' });
    return false;
  }
  return true;
}
function jsonLimitString(value: unknown, max = 20000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...[truncated]` : text;
}

export function handleOpenAiAppsChallenge(_req: Request, res: Response) {
  const token = process.env.OPENAI_APP_VERIFICATION_TOKEN;
  if (!token) return res.status(404).send('Not configured');
  res.type('text/plain').status(200).send(token);
}

apiRouter.get('/health', async (_req, res) => {
  try {
    const plans = await db.getPlans();
    res.status(200).json({ status:'healthy', timestamp:new Date().toISOString(), services:{ database: plans.length > 0 ? 'connected':'degraded', mcp_server:'online', ssrf_shield:'active', encryption_engine:'aes-256-gcm' }});
  } catch {
    res.status(503).json({ status:'degraded', timestamp:new Date().toISOString() });
  }
});

apiRouter.get('/readiness', async (_req,res) => {
  try { await db.getPlans(); res.status(200).json({ready:true}); }
  catch { res.status(503).json({ready:false}); }
});

apiRouter.post('/auth/signup', async (req,res) => {
  return res.status(400).json({ error:'Use Supabase Auth signup from the web app.' });
});

apiRouter.post('/auth/login', async (req,res) => {
  return res.status(400).json({ error:'Use Supabase Auth login from the web app.' });
});

apiRouter.get('/auth/me', requireAuth, async (req: AuthenticatedRequest,res) => {
  const user=req.user!;
  const sub=await db.getSubscriptionByUserId(user.id);
  const plan=sub ? await db.getPlanById(sub.plan_id) : await db.getPlanById('plan_free');
  const usage=await db.getUsageByUserId(user.id);
  res.json({user,subscription:{...sub,plan},usage});
});

apiRouter.post('/auth/logout', requireAuth, async (_req,res) => res.status(200).json({success:true}));

apiRouter.patch('/profile', requireAuth, async (req:AuthenticatedRequest,res) => {
  const updated=await db.updateProfile(req.user!.id,{name:String(req.body?.name||'').trim()});
  res.json({success:true,user:updated});
});

apiRouter.delete('/profile', requireAuth, async (req:AuthenticatedRequest,res) => {
  try {
    const sub = await db.getSubscriptionByUserId(req.user!.id);
    if (sub?.provider === 'stripe' && sub.provider_subscription_id) {
      const cancelled = await billingEngine.cancelSubscription(req.user!.id);
      if (!cancelled) return res.status(409).json({error:'Subscription cancellation must complete before account deletion.'});
    }
    await db.deleteProfile(req.user!.id);
    res.json({success:true});
  } catch {
    res.status(500).json({error:'Unable to delete account safely.'});
  }
});

apiRouter.get('/connections', requireAuth, async (req:AuthenticatedRequest,res) => {
  if (!(await requireApiKeyScope(req, res, 'connections:read'))) return;
  const connections=await db.getConnectionsByUserId(req.user!.id);
  const enriched=await Promise.all(connections.map(async c=>({ ...c, credential_masked:(await db.getCredentialByConnectionId(c.id))?.masked_preview })));
  res.json({connections:enriched});
});

apiRouter.post('/connections', requireAuth, async (req:AuthenticatedRequest,res) => {
  const {name,description='',endpoint_url,http_method='POST',auth_type='none',secret,headers:rawHeaders={},query_params={},timeout_ms=8000,retry_count=2}=req.body||{};
  const headers = Object.fromEntries(Object.entries(rawHeaders || {}).filter(([key]) => !['authorization','proxy-authorization','cookie','set-cookie','host','content-length'].includes(key.toLowerCase())));
  if(!name||!endpoint_url) return res.status(400).json({error:'Name and endpoint URL are required.'});
  if(!['GET','POST','PUT','PATCH','DELETE'].includes(http_method)) return res.status(400).json({error:'Unsupported HTTP method.'});
  if(!['none','bearer','api_key','basic'].includes(auth_type)) return res.status(400).json({error:'Unsupported authentication method.'});
  const sub=await db.getSubscriptionByUserId(req.user!.id);
  const plan=sub ? await db.getPlanById(sub.plan_id) : await db.getPlanById('plan_free');
  const current=await db.getConnectionsByUserId(req.user!.id);
  if(plan && current.length>=plan.connections_limit) return res.status(403).json({error:'Connection limit reached for your plan.'});
  const ssrf=await validateTargetUrl(endpoint_url);
  if(!ssrf.isValid) return res.status(400).json({error:`Security check failed: ${ssrf.reason}`});
  if (!rawHeaders || typeof rawHeaders !== 'object' || Array.isArray(rawHeaders)) return res.status(400).json({error:'Headers must be an object.'});
  if (!query_params || typeof query_params !== 'object' || Array.isArray(query_params)) return res.status(400).json({error:'Query parameters must be an object.'});
  const connection={
    id:`conn_${crypto.randomBytes(8).toString('hex')}`,user_id:req.user!.id,name:String(name).trim().slice(0,100),
    description:String(description).trim(),endpoint_url:String(endpoint_url).trim(),http_method,auth_type,
    headers,query_params,timeout_ms:Math.min(Math.max(Number(timeout_ms)||8000,1000),15000),
    retry_count:Math.min(Math.max(Number(retry_count)||0,0),3),status:'active',created_at:new Date().toISOString(),updated_at:new Date().toISOString()
  } as any;
  const created=await db.createConnection(connection,secret);
  res.status(201).json({connection:{...created.connection,credential_masked:created.credential?.masked_preview}});
});

apiRouter.get('/connections/:id', requireAuth, async (req:AuthenticatedRequest,res) => {
  if (!(await requireApiKeyScope(req, res, 'connections:read'))) return;
  const c=await db.getConnectionById(req.params.id,req.user!.id);
  if(!c) return res.status(404).json({error:'Connection not found.'});
  res.json({connection:{...c,credential_masked:(await db.getCredentialByConnectionId(c.id))?.masked_preview}});
});

apiRouter.patch('/connections/:id', requireAuth, async (req:AuthenticatedRequest,res) => {
  const { secret, ...body } = req.body || {};
  const allowed = ['name','description','endpoint_url','http_method','auth_type','headers','query_params','timeout_ms','retry_count','status'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body, key)) updates[key] = body[key];
  if (updates.http_method && !['GET','POST','PUT','PATCH','DELETE'].includes(String(updates.http_method))) return res.status(400).json({error:'Unsupported HTTP method.'});
  if (updates.auth_type && !['none','bearer','api_key','basic'].includes(String(updates.auth_type))) return res.status(400).json({error:'Unsupported authentication method.'});
  if (updates.endpoint_url) {
    const ssrf=await validateTargetUrl(String(updates.endpoint_url));
    if(!ssrf.isValid)return res.status(400).json({error:`Security check failed: ${ssrf.reason}`});
  }
  if (updates.headers !== undefined) {
    if (!updates.headers || typeof updates.headers !== 'object' || Array.isArray(updates.headers)) return res.status(400).json({error:'Headers must be an object.'});
    const source = updates.headers as Record<string, unknown>;
    updates.headers = Object.fromEntries(Object.entries(source).filter(([key]) => !['authorization','proxy-authorization','cookie','set-cookie','host','content-length'].includes(key.toLowerCase())));
  }
  if (updates.query_params !== undefined && (!updates.query_params || typeof updates.query_params !== 'object' || Array.isArray(updates.query_params))) return res.status(400).json({error:'Query parameters must be an object.'});
  if (updates.name !== undefined && !String(updates.name).trim()) return res.status(400).json({error:'Connection name cannot be empty.'});
  if (updates.timeout_ms !== undefined) updates.timeout_ms = Math.min(Math.max(Number(updates.timeout_ms) || 8000, 1000), 15000);
  if (updates.retry_count !== undefined) updates.retry_count = Math.min(Math.max(Number(updates.retry_count) || 0, 0), 3);
  if (updates.status && !['active','paused','error'].includes(String(updates.status))) return res.status(400).json({error:'Unsupported connection status.'});
  const updated=await db.updateConnection(req.params.id,req.user!.id,updates as any,secret);
  if(!updated)return res.status(404).json({error:'Connection not found.'});
  res.json({connection:{...updated,credential_masked:(await db.getCredentialByConnectionId(updated.id))?.masked_preview}});
});

apiRouter.delete('/connections/:id', requireAuth, async (req:AuthenticatedRequest,res) => {
  const ok=await db.deleteConnection(req.params.id,req.user!.id); if(!ok)return res.status(404).json({error:'Connection not found.'}); res.json({success:true});
});

apiRouter.post('/connections/:id/test', requireAuth, async (req:AuthenticatedRequest,res) => {
  const rl=checkRateLimit(`test:${req.user!.id}`,{max:20,windowMs:60000});
  if(!rl.allowed)return res.status(429).json({error:'Test rate limit exceeded.'});
  const c=await db.getConnectionById(req.params.id,req.user!.id); if(!c)return res.status(404).json({error:'Connection not found.'});
  const result=await executeExternalRequest({userId:req.user!.id,connection:c,payload:req.body?.payload||{ping:'jitc_test_probe'},actionType:'test_run'});
  res.status(result.success?200:400).json(result);
});

apiRouter.get('/transformations', requireAuth, async (req:AuthenticatedRequest,res)=>res.json({transformations:await db.getTransformationsByUserId(req.user!.id)}));

apiRouter.post('/transformations', requireAuth, async (req:AuthenticatedRequest,res) => {
  const b=req.body||{};
  if(!b.name) return res.status(400).json({error:'Transformation name is required.'});
  if(b.connection_id && !(await db.getConnectionById(String(b.connection_id),req.user!.id))) return res.status(403).json({error:'Transformation connection is not owned by this account.'});
  const transformation:any={id:`trans_${crypto.randomBytes(8).toString('hex')}`,user_id:req.user!.id,connection_id:b.connection_id,name:String(b.name).trim(),description:String(b.description||'').trim(),mode:b.mode||'visual',rules:Array.isArray(b.rules)?b.rules:[],template_json:b.template_json,ai_system_instructions:b.ai_system_instructions,sample_input:String(b.sample_input||''),sample_output:String(b.sample_output||''),version:1,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};
  res.status(201).json({transformation:await db.createTransformation(transformation)});
});

apiRouter.patch('/transformations/:id', requireAuth, async (req:AuthenticatedRequest,res)=>{
  const body = req.body || {};
  const allowed = ['connection_id','name','description','mode','rules','template_json','ai_system_instructions','sample_input','sample_output'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) if (Object.prototype.hasOwnProperty.call(body, key)) updates[key] = body[key];
  if (updates.connection_id !== undefined && updates.connection_id !== null && !(await db.getConnectionById(String(updates.connection_id), req.user!.id))) return res.status(403).json({error:'Transformation connection is not owned by this account.'});
  if (updates.mode && !['visual','template','ai_prompt'].includes(String(updates.mode))) return res.status(400).json({error:'Unsupported transformation mode.'});
  if (updates.rules !== undefined && !Array.isArray(updates.rules)) return res.status(400).json({error:'Transformation rules must be an array.'});
  const u=await db.updateTransformation(req.params.id,req.user!.id,updates as any);
  if(!u)return res.status(404).json({error:'Transformation not found.'});
  res.json({transformation:u});
});
apiRouter.delete('/transformations/:id', requireAuth, async (req:AuthenticatedRequest,res)=>{const ok=await db.deleteTransformation(req.params.id,req.user!.id);if(!ok)return res.status(404).json({error:'Transformation not found.'});res.json({success:true});});

apiRouter.post('/transformations/preview', requireAuth, async (req:AuthenticatedRequest,res) => {
  const b=req.body||{}; if(!b.raw_input)return res.status(400).json({error:'raw_input is required for preview.'});
  const transformation:any={id:'trans_preview',user_id:req.user!.id,name:'Preview',description:'',mode:b.transformation?.mode||'visual',rules:Array.isArray(b.transformation?.rules)?b.transformation.rules:[],template_json:b.transformation?.template_json,ai_system_instructions:b.transformation?.ai_system_instructions,sample_input:'',version:1,created_at:'',updated_at:''};
  try{res.json({output:await executeTransformation(transformation,b.raw_input)});}catch(e){res.status(400).json({error:'Transformation failed.'});}
});

apiRouter.post('/transformations/ai-extract', requireAuth, async (req:AuthenticatedRequest,res) => {
  const rl=checkRateLimit(`ai-extract:${req.user!.id}`,{max:20,windowMs:60000});
  if(!rl.allowed)return res.status(429).json({error:'AI extraction rate limit exceeded.'});
  if(!req.body?.text)return res.status(400).json({error:'text is required.'});
  try{res.json({extracted:await extractWithGemini(String(req.body.text),req.body.schemaGuide)});}catch{res.status(500).json({error:'AI transformation failed.'});}
});

apiRouter.post('/execute', requireAuth, async (req:AuthenticatedRequest,res) => {
  if (!(await requireApiKeyScope(req, res, 'execute'))) return;
  const {connection_id,transformation_id,input_data,idempotency_key}=req.body||{};
  if(!connection_id)return res.status(400).json({error:'connection_id is required.'});
  const rl=checkRateLimit(req.user!.id,{max:Number(process.env.RATE_LIMIT_MAX_REQUESTS||120),windowMs:Number(process.env.RATE_LIMIT_WINDOW_MS||60000)});
  if(!rl.allowed)return res.status(429).json({error:'Rate limit exceeded.'});
  const c=await db.getConnectionById(connection_id,req.user!.id);if(!c)return res.status(404).json({error:'Connection not found.'});
  let t=transformation_id?await db.getTransformationById(transformation_id,req.user!.id):undefined;
  if(!t)t=(await db.getTransformationsByUserId(req.user!.id)).find(x=>x.connection_id===c.id);
  const payload=t?await executeTransformation(t,input_data):input_data;
  const result=await executeExternalRequest({userId:req.user!.id,connection:c,payload,transformationId:t?.id,actionType:'web_dashboard',idempotencyKey:idempotency_key||String(req.headers['idempotency-key']||'')||undefined});
  res.status(result.success?200:400).json(result);
});

apiRouter.get('/requests', requireAuth, async (req:AuthenticatedRequest,res)=>{const limit=Math.min(Math.max(Number(req.query.limit||50),1),100);res.json({requests:await db.getRequestsByUserId(req.user!.id,limit)});});
apiRouter.get('/requests/:id', requireAuth, async (req:AuthenticatedRequest,res)=>{const r=await db.getRequestById(req.params.id,req.user!.id);if(!r)return res.status(404).json({error:'Request record not found.'});res.json({request:r});});
apiRouter.get('/usage', requireAuth, async (req:AuthenticatedRequest,res)=>res.json({usage:await db.getUsageByUserId(req.user!.id)}));

apiRouter.get('/billing', requireAuth, async (req:AuthenticatedRequest,res)=>{
  const plans=await db.getPlans(); const sub=await db.getSubscriptionByUserId(req.user!.id); const currentPlan=sub?await db.getPlanById(sub.plan_id):plans[0]; const usage=await db.getUsageByUserId(req.user!.id);
  res.json({plans,subscription:sub,currentPlan,usage});
});

apiRouter.post('/billing/checkout', requireAuth, async (req:AuthenticatedRequest,res)=>{const rl=checkRateLimit(`checkout:${req.user!.id}`,{max:5,windowMs:60000});if(!rl.allowed)return res.status(429).json({error:'Checkout rate limit exceeded.'});try{res.json(await billingEngine.createCheckout(req.user!.id,String(req.body?.plan_id||'')));}catch(e){res.status(400).json({error:e instanceof Error?e.message:'Unable to create checkout.'});}});
apiRouter.post('/billing/webhook', async (req,res)=>{try{const result=await billingEngine.handleWebhook(req);res.json(result);}catch(e){res.status(400).json({error:e instanceof Error?e.message:'Webhook rejected.'});}});
apiRouter.post('/billing/cancel', requireAuth, async (req:AuthenticatedRequest,res)=>{try{res.json({success:await billingEngine.cancelSubscription(req.user!.id)});}catch(e){res.status(400).json({error:e instanceof Error?e.message:'Unable to cancel subscription.'});}});

apiRouter.get('/api-keys', requireAuth, async (req:AuthenticatedRequest,res)=>res.json({api_keys:(await db.getApiKeysByUserId(req.user!.id)).map(k=>({id:k.id,name:k.name,key_prefix:k.key_prefix,scopes:k.scopes,last_used_at:k.last_used_at,is_revoked:k.is_revoked,created_at:k.created_at}))}));
apiRouter.post('/api-keys', requireAuth, async (req:AuthenticatedRequest,res)=>{
  const requestedScopes=Array.isArray(req.body?.scopes) ? req.body.scopes.map((s:unknown)=>String(s)) : ['connections:read','execute','profile:read'];
  const allowedScopes=['connections:read','execute','profile:read'];
  if(requestedScopes.some((s:string)=>!allowedScopes.includes(s))) return res.status(400).json({error:'Invalid API key scope.'});
  const {rawKey:keyRaw,keyPrefix:prefix,keyHash:hash}=generateApiKey();
  const key:any={id:`key_${crypto.randomBytes(8).toString('hex')}`,user_id:req.user!.id,name:String(req.body?.name||'API Key').trim().slice(0,100),key_prefix:prefix,key_hash:hash,scopes:[...new Set(requestedScopes)],is_revoked:false,created_at:new Date().toISOString()};
  const created=await db.createApiKey(key); await db.logAudit({user_id:req.user!.id,action:'api_key.created',resource_type:'api_key',resource_id:key.id,metadata:{name:key.name,prefix:prefix},ip_address:clientIp(req)});
  res.status(201).json({api_key:{id:created.id,name:created.name,raw_key:keyRaw,key_prefix:prefix,scopes:created.scopes,created_at:created.created_at}});
});
apiRouter.delete('/api-keys/:id', requireAuth, async (req:AuthenticatedRequest,res)=>{if(!await db.revokeApiKey(req.params.id,req.user!.id))return res.status(404).json({error:'API key not found.'});res.json({success:true});});

apiRouter.get('/security/events', requireAuth, async (req:AuthenticatedRequest,res)=>res.json({events:await db.getSecurityEvents(req.user!.role==='admin'?undefined:req.user!.id)}));
apiRouter.post('/security/test-ssrf', requireAuth, async (req:AuthenticatedRequest,res)=>{
  if(!req.body?.test_url)return res.status(400).json({error:'test_url is required.'});
  const result=await validateTargetUrl(String(req.body.test_url));
  if(!result.isValid) await db.logSecurityEvent({user_id:req.user!.id,event_type:'ssrf_blocked',severity:'high',details:{url:String(req.body.test_url),reason:result.reason},ip_address:clientIp(req),blocked:true});
  res.json({tested_url:String(req.body.test_url),is_safe:result.isValid,reason:result.reason});
});

apiRouter.get('/admin/metrics', requireAuth, requireAdmin, async (_req,res)=>res.json({metrics:await db.getSystemMetrics()}));
apiRouter.get('/admin/users', requireAuth, requireAdmin, async (_req,res)=>{
  const users=await (async()=>{const result:any[]=[]; for(const p of await db.getProfiles()) { const sub=await db.getSubscriptionByUserId(p.id); const plan=sub?await db.getPlanById(sub.plan_id):undefined; const usage=await db.getUsageByUserId(p.id); result.push({id:p.id,name:p.name,email:p.email,role:p.role,plan_name:plan?.name||'Free',actions_count:usage.actions_count,created_at:p.created_at}); } return result;})();
  res.json({users});
});
apiRouter.patch('/admin/plans/:id', requireAuth, requireAdmin, async (req,res)=>{const p=await db.updatePlan(req.params.id,req.body||{});if(!p)return res.status(404).json({error:'Plan not found.'});res.json({plan:p});});
