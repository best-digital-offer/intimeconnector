import { Router } from 'express';
import crypto from 'node:crypto';
import { getSupabasePublic, getSupabaseAdmin } from '../db/supabase.js';
import { hashToken } from '../security/crypto.js';
import { checkRateLimit } from '../security/rateLimiter.js';

export const oauthRouter = Router();
const baseUrl = () => process.env.MCP_BASE_URL || process.env.APP_BASE_URL || '';
const b64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');
const pkceValid = (verifier: string, challenge: string) => b64url(crypto.createHash('sha256').update(verifier).digest()) === challenge;
const esc = (value: string) => value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const validRedirectUri = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === 'https:') return true;
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
  } catch { return false; }
};

oauthRouter.get('/.well-known/oauth-protected-resource', (_req,res) => res.json({ resource: baseUrl() + '/mcp', authorization_servers: [process.env.OAUTH_ISSUER || baseUrl()] }));
oauthRouter.get('/.well-known/oauth-authorization-server', (_req,res) => {
  const issuer = process.env.OAUTH_ISSUER || baseUrl();
  res.json({ issuer, authorization_endpoint: issuer + '/oauth/authorize', token_endpoint: issuer + '/oauth/token', registration_endpoint: issuer + '/oauth/register', revocation_endpoint: issuer + '/oauth/revoke', response_types_supported: ['code'], grant_types_supported: ['authorization_code'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: ['mcp'] });
});
oauthRouter.get('/.well-known/openid-configuration', (_req,res) => {
  const issuer = process.env.OAUTH_ISSUER || baseUrl();
  res.json({ issuer, authorization_endpoint: issuer + '/oauth/authorize', token_endpoint: issuer + '/oauth/token', registration_endpoint: issuer + '/oauth/register' });
});

oauthRouter.post('/oauth/register', async (req,res) => {
  const body = req.body || {};
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((v: unknown) => typeof v === 'string').slice(0,20) : [];
  if (!body.client_name || redirectUris.length === 0 || redirectUris.some((uri: string) => !validRedirectUri(uri))) return res.status(400).json({error:'invalid_client_metadata'});
  const id = 'client_' + crypto.randomBytes(12).toString('hex');
  const { error } = await getSupabaseAdmin().from('oauth_clients').insert({ id, client_id:id, client_name:String(body.client_name).slice(0,200), redirect_uris:redirectUris, is_active:true, created_at:new Date().toISOString() });
  if (error) return res.status(400).json({error:'client_registration_failed'});
  res.status(201).json({client_id:id, client_name:body.client_name, redirect_uris:redirectUris, grant_types:['authorization_code'], response_types:['code'], token_endpoint_auth_method:'none'});
});

oauthRouter.get('/oauth/authorize', async (req,res) => {
  const q = req.query as Record<string,string>;
  const rl = checkRateLimit(`oauth:authorize:${req.ip || 'unknown'}`, { max: 30, windowMs: 60_000 });
  if (!rl.allowed) return res.status(429).send('Too many authorization requests.');
  if (q.response_type !== 'code' || q.code_challenge_method !== 'S256' || !q.client_id || !q.redirect_uri || !q.code_challenge || !validRedirectUri(q.redirect_uri)) return res.status(400).send('Invalid OAuth authorization request.');
  const { data: client } = await getSupabaseAdmin().from('oauth_clients').select('*').eq('client_id',q.client_id).eq('is_active',true).maybeSingle();
  if (!client || !Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(q.redirect_uri)) return res.status(400).send('Invalid OAuth client or redirect URI.');
  const hidden = (name:string,value:string) => '<input type="hidden" name="' + name + '" value="' + esc(value) + '">';
  const html = '<!doctype html><html><head><meta charset="utf-8"><title>Authorize Just-in-Time Connector</title></head><body style="font-family:system-ui;max-width:480px;margin:40px auto"><h1>Authorize Just-in-Time Connector</h1><p>Sign in to authorize access to your saved connections.</p><form method="post" action="/oauth/login">' + hidden('client_id',q.client_id) + hidden('redirect_uri',q.redirect_uri) + hidden('code_challenge',q.code_challenge) + hidden('state',q.state || '') + '<label>Email<br><input name="email" type="email" autocomplete="username" required style="width:100%;padding:8px"></label><br><label>Password<br><input name="password" type="password" autocomplete="current-password" required style="width:100%;padding:8px"></label><br><button type="submit">Authorize</button></form></body></html>';
  res.type('html').send(html);
});

oauthRouter.post('/oauth/login', async (req,res) => {
  const {email,password,client_id,redirect_uri,code_challenge,state} = req.body || {};
  if (!client_id || !redirect_uri || !code_challenge || typeof code_challenge !== 'string' || code_challenge.length > 200) return res.status(400).send('Invalid OAuth request.');
  const rl = checkRateLimit(`oauth:login:${req.ip || 'unknown'}`, { max: 10, windowMs: 60_000 });
  if (!rl.allowed) return res.status(429).send('Too many login attempts.');
  const { data: client } = await getSupabaseAdmin().from('oauth_clients').select('*').eq('client_id',String(client_id)).eq('is_active',true).maybeSingle();
  if (!validRedirectUri(String(redirect_uri)) || !client || !Array.isArray(client.redirect_uris) || !client.redirect_uris.includes(String(redirect_uri))) return res.status(400).send('Invalid OAuth client.');
  const { data, error } = await getSupabasePublic().auth.signInWithPassword({ email:String(email), password:String(password) });
  if (error || !data.user) return res.status(401).send('Invalid credentials.');
  const code = 'oc_' + b64url(crypto.randomBytes(32));
  const { error: codeError } = await getSupabaseAdmin().from('oauth_authorization_codes').insert({ code_hash:hashToken(code), user_id:data.user.id, client_id:String(client_id), redirect_uri:String(redirect_uri), code_challenge:String(code_challenge), scope:'mcp', expires_at:new Date(Date.now()+5*60*1000).toISOString(), created_at:new Date().toISOString() });
  if (codeError) return res.status(500).send('Unable to create authorization code.');
  const target = new URL(String(redirect_uri)); target.searchParams.set('code',code); if(state) target.searchParams.set('state',String(state));
  res.redirect(target.toString());
});

oauthRouter.post('/oauth/token', async (req,res) => {
  const {grant_type,code,redirect_uri,client_id,code_verifier} = req.body || {};
  const rl = checkRateLimit(`oauth:token:${req.ip || 'unknown'}`, { max: 30, windowMs: 60_000 });
  if (!rl.allowed) return res.status(429).json({error:'slow_down'});
  if (grant_type !== 'authorization_code' || !code || !redirect_uri || !client_id || !code_verifier) return res.status(400).json({error:'invalid_request'});
  const { data: record } = await getSupabaseAdmin().from('oauth_authorization_codes').select('*').eq('code_hash',hashToken(String(code))).eq('client_id',String(client_id)).maybeSingle();
  if (!record || record.used_at || new Date(record.expires_at).getTime() < Date.now() || record.redirect_uri !== String(redirect_uri) || !pkceValid(String(code_verifier),String(record.code_challenge))) return res.status(400).json({error:'invalid_grant'});
  const accessToken = 'jtc_oauth_' + b64url(crypto.randomBytes(32));
  const { data: consumed } = await getSupabaseAdmin().from('oauth_authorization_codes').update({used_at:new Date().toISOString()}).eq('id',record.id).is('used_at',null).select('id').maybeSingle();
  if (!consumed) return res.status(400).json({error:'invalid_grant'});
  const { error } = await getSupabaseAdmin().from('oauth_tokens').insert({ id:'ot_' + crypto.randomBytes(8).toString('hex'), user_id:record.user_id, client_id:String(client_id), token_hash:hashToken(accessToken), token_type:'Bearer', scopes:['mcp'], expires_at:new Date(Date.now()+60*60*1000).toISOString(), created_at:new Date().toISOString() });
  if (error) return res.status(500).json({error:'token_issue_failed'});
  res.json({access_token:accessToken,token_type:'Bearer',expires_in:3600,scope:'mcp'});
});

oauthRouter.post('/oauth/revoke', async (req,res) => {
  const token = String(req.body?.token || '');
  if (token) await getSupabaseAdmin().from('oauth_tokens').delete().eq('token_hash',hashToken(token));
  res.status(200).json({});
});