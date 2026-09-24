import crypto from 'node:crypto';

// Get or derive a 32-byte encryption key from environment
function getMasterKey(): Buffer {
  const envKey = process.env.ENCRYPTION_KEY;
  if (!envKey) throw new Error('ENCRYPTION_KEY is required for credential encryption.');
  if (Buffer.byteLength(envKey, 'utf8') === 32) {
    return Buffer.from(envKey, 'utf8');
  }
  // Deterministically hash to 32 bytes if not exact length
  return crypto.createHash('sha256').update(envKey).digest();
}

/**
 * Encrypt sensitive credential using AES-256-GCM
 */
export function encryptCredential(plaintext: string): {
  encrypted_secret: string;
  iv: string;
  auth_tag: string;
} {
  const key = getMasterKey();
  const iv = crypto.randomBytes(12); // standard 96-bit IV for AES-GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    encrypted_secret: encrypted,
    iv: iv.toString('hex'),
    auth_tag: authTag,
  };
}

/**
 * Decrypt sensitive credential using AES-256-GCM with authentication tag check
 */
export function decryptCredential(
  encrypted_secret: string,
  ivHex: string,
  authTagHex: string
): string {
  const key = getMasterKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted_secret, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generates a masked preview of a secret (e.g. sk_live_••••••92AB)
 */
export function maskSecret(secret: string): string {
  if (!secret) return '';
  if (secret.length <= 8) {
    return '••••' + secret.slice(-2);
  }
  const prefix = secret.slice(0, 4);
  const suffix = secret.slice(-4);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Hash API keys or tokens with SHA-256
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate a new random API key (e.g. jtc_live_01J...)
 */
export function generateApiKey(): { rawKey: string; keyPrefix: string; keyHash: string } {
  const randomBytes = crypto.randomBytes(24).toString('base64url');
  const rawKey = `jtc_live_${randomBytes}`;
  const keyPrefix = rawKey.slice(0, 14);
  const keyHash = hashToken(rawKey);
  return { rawKey, keyPrefix, keyHash };
}

/**
 * Simple password hash using scrypt + salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64);
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, key] = combinedHash.split(':');
    if (!salt || !key) return false;
    const derivedKey = crypto.scryptSync(password, salt, 64);
    const keyBuffer = Buffer.from(key, 'hex');
    return crypto.timingSafeEqual(derivedKey, keyBuffer);
  } catch {
    return false;
  }
}

/**
 * Redact sensitive fields from objects or JSON strings before logging or storing
 */
const SENSITIVE_KEYS = new Set([
  'authorization',
  'auth',
  'api_key',
  'apikey',
  'token',
  'bearer',
  'secret',
  'password',
  'pass',
  'client_secret',
  'access_token',
  'refresh_token',
  'private_key',
]);

export function redactSensitiveData(data: unknown): unknown {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('secret') || lowerKey.includes('token') || lowerKey.includes('password')) {
      clean[key] = typeof value === 'string' ? maskSecret(value) : '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = redactSensitiveData(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

export function generateCorrelationId(): string {
  return `req_${crypto.randomBytes(8).toString('hex')}`;
}
