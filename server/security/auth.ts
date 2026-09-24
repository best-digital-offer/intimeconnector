import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/store';
import { Profile } from '../db/schema';
import { hashToken } from './crypto';

// Session token store: token -> { userId, expiresAt }
interface SessionData {
  userId: string;
  expiresAt: number;
}

const sessions = new Map<string, SessionData>();

export function createSession(userId: string, ttlMs = 7 * 24 * 3600 * 1000): string {
  const token = `sess_${crypto.randomBytes(32).toString('base64url')}`;
  sessions.set(token, {
    userId,
    expiresAt: Date.now() + ttlMs,
  });
  return token;
}

export function revokeSession(token: string): void {
  sessions.delete(token);
}

/**
 * Resolves a Profile from a Bearer token (session token, API key, or OAuth access token)
 */
export function resolveUserFromToken(rawHeader?: string): Profile | null {
  if (!rawHeader) return null;

  const parts = rawHeader.trim().split(' ');
  const token = parts.length === 2 && parts[0].toLowerCase() === 'bearer' ? parts[1] : parts[0];
  if (!token) return null;

  // 1. Check active session
  if (token.startsWith('sess_')) {
    const session = sessions.get(token);
    if (session && session.expiresAt > Date.now()) {
      const user = db.getProfileById(session.userId);
      if (user) return user;
    }
  }

  // 2. Check personal API key (jtc_live_...)
  if (token.startsWith('jtc_live_')) {
    const keyHash = hashToken(token);
    const apiKey = db.getApiKeyByHash(keyHash);
    if (apiKey) {
      apiKey.last_used_at = new Date().toISOString();
      const user = db.getProfileById(apiKey.user_id);
      if (user) return user;
    }
  }

  // 3. Fallback for demo convenience: if user ID is directly passed in header (e.g. during development/testing)
  if (token.startsWith('usr_')) {
    const user = db.getProfileById(token);
    if (user) return user;
  }

  return null;
}

export interface AuthenticatedRequest extends Request {
  user?: Profile;
}

/**
 * Express middleware to require authentication
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const user = resolveUserFromToken(authHeader);

  if (!user) {
    db.logSecurityEvent({
      event_type: 'auth_failure',
      severity: 'medium',
      details: { path: req.path, method: req.method },
      ip_address: req.ip || '127.0.0.1',
      blocked: true,
    });
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'A valid Bearer session token or API key is required.',
    });
  }

  req.user = user;
  next();
}

/**
 * Require admin role
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin privileges required.',
    });
  }
  next();
}
