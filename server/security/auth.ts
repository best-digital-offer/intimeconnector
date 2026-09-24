import type { Request, Response, NextFunction } from 'express';
import type { Profile } from '../db/schema.js';
import { getAuthenticatedSupabaseUser, getSupabaseAdmin } from '../db/supabase.js';
import { db } from '../db/store.js';
import { hashToken } from './crypto.js';

export interface AuthenticatedRequest extends Request {
  user?: Profile;
  accessToken?: string;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.trim().split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

export async function resolveUserFromToken(token?: string): Promise<Profile | null> {
  if (!token) return null;

  if (token.startsWith('jtc_oauth_')) {
    const { data: oauthToken } = await getSupabaseAdmin().from('oauth_tokens').select('*').eq('token_hash', hashToken(token)).gt('expires_at', new Date().toISOString()).maybeSingle();
    if (!oauthToken) return null;
    return (await db.getProfileById(oauthToken.user_id)) || null;
  }

  if (token.startsWith('jtc_live_')) {
    const apiKey = await db.getApiKeyByHash(hashToken(token));
    if (!apiKey) return null;
    const profile = await db.getProfileById(apiKey.user_id);
    return profile || null;
  }

  const authUser = await getAuthenticatedSupabaseUser(token);
  if (!authUser) return null;

  const profile = await db.getProfileById(authUser.id);
  if (!profile) return null;

  if (profile.email !== authUser.email) {
    return (await db.updateProfile(authUser.id, { email: authUser.email || profile.email })) || profile;
  }
  return profile;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = bearerToken(req);
  if (token?.startsWith('jtc_oauth_')) {
    return res.status(403).json({ error: 'OAuth access tokens are restricted to the MCP endpoint.' });
  }

  if (token?.startsWith('jtc_live_')) {
    const allowed = (
      (req.method === 'GET' && req.path === '/auth/me') ||
      (req.method === 'GET' && (req.path === '/connections' || /^\/connections\/[^/]+$/.test(req.path))) ||
      (req.method === 'POST' && req.path === '/execute')
    );
    if (!allowed) return res.status(403).json({ error: 'This API key is restricted to its documented API operations.' });
  }

  const user = await resolveUserFromToken(token || undefined);

  if (!user) {
    await db.logSecurityEvent({
      event_type: 'auth_failure',
      severity: 'medium',
      details: { path: req.path, method: req.method },
      ip_address: req.ip || '',
      blocked: true,
    }).catch(() => undefined);

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'A valid Supabase access token or personal API key is required.',
    });
  }

  req.user = user;
  req.accessToken = token || undefined;
  return next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden', message: 'Admin privileges required.' });
  }
  return next();
}
