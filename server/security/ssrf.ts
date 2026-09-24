import dns from 'node:dns/promises';
import { isIP } from 'node:net';

export interface SsrfValidationResult {
  isValid: boolean;
  reason?: string;
  resolvedIp?: string;
  sanitizedUrl?: URL;
}

// Check IPv4 private/reserved ranges
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed treated as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8
  if (a === 0) return true;

  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;

  // 10.0.0.0/8 (Private RFC1918)
  if (a === 10) return true;

  // 172.16.0.0/12 (Private RFC1918: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;

  // 192.168.0.0/16 (Private RFC1918)
  if (a === 192 && b === 168) return true;

  // 169.254.0.0/16 (Link-local & Cloud Metadata endpoint 169.254.169.254)
  if (a === 169 && b === 254) return true;

  // 100.64.0.0/10 (Carrier-grade NAT)
  if (a === 100 && b >= 64 && b <= 127) return true;

  // 192.0.2.0/24 (TEST-NET-1), 198.51.100.0/24 (TEST-NET-2), 203.0.113.0/24 (TEST-NET-3)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  if (a === 203 && b === 0 && parts[2] === 113) return true;

  // 224.0.0.0/4 (Multicast) & 240.0.0.0/4 (Reserved)
  if (a >= 224) return true;

  return false;
}

// Check IPv6 private/reserved ranges
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  // Loopback ::1
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;

  // Unspecified ::
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // Unique Local Address fc00::/7 (fc00:: to fdff::)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  // Link-local fe80::/10
  if (
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  ) {
    return true;
  }

  // IPv4-mapped IPv6 ::ffff:127.0.0.1
  if (normalized.includes('::ffff:')) {
    const ipv4Part = normalized.split('::ffff:')[1];
    if (ipv4Part && isIP(ipv4Part) === 4) {
      return isPrivateIPv4(ipv4Part);
    }
  }

  return false;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  'instance-data',
  'metadata.internal',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const ALLOWED_PORTS = new Set((process.env.ALLOWED_OUTBOUND_PORTS || '443').split(',').map((value) => value.trim()).filter(Boolean));

/**
 * Validate an outbound target URL against SSRF threats
 */
export async function validateTargetUrl(rawUrl: string): Promise<SsrfValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.length > 2048) {
    return { isValid: false, reason: 'Empty or invalid URL supplied' };
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { isValid: false, reason: 'Invalid URL format' };
  }

  // Enforce protocol
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return {
      isValid: false,
      reason: `Disallowed protocol '${parsed.protocol}'. Only HTTPS (or HTTP in dev) is supported.`,
    };
  }

  // In production, force HTTPS unless test environment
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && parsed.protocol !== 'https:') {
    return {
      isValid: false,
      reason: 'HTTPS is strictly required for all external endpoints in production.',
    };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check blocked domain/hostname list
  if (BLOCKED_HOSTNAMES.has(hostname) || (hostname.endsWith('.') && BLOCKED_HOSTNAMES.has(hostname.slice(0, -1)))) {
    return { isValid: false, reason: `Access to hostname '${hostname}' is restricted.` };
  }

  if (
    hostname.endsWith('.internal') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.corp') ||
    hostname.endsWith('.lan')
  ) {
    return { isValid: false, reason: `Access to internal domain '${hostname}' is prohibited.` };
  }

  // Check port
  const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');
  if (!ALLOWED_PORTS.has(port)) {
    return { isValid: false, reason: `Port '${port}' is not allowed for external connectors.` };
  }

  // Check if hostname is direct IP
  const directIpType = isIP(hostname);
  if (directIpType === 4) {
    if (isPrivateIPv4(hostname)) {
      return {
        isValid: false,
        reason: `Target IP '${hostname}' resolves to a restricted private or link-local range.`,
        resolvedIp: hostname,
      };
    }
    return { isValid: true, sanitizedUrl: parsed, resolvedIp: hostname };
  }

  if (directIpType === 6) {
    if (isPrivateIPv6(hostname)) {
      return {
        isValid: false,
        reason: `Target IPv6 '${hostname}' resolves to a restricted local range.`,
        resolvedIp: hostname,
      };
    }
    return { isValid: true, sanitizedUrl: parsed, resolvedIp: hostname };
  }

  const configuredHosts = (process.env.OUTBOUND_ALLOWED_HOSTS || '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean);
  if (configuredHosts.length > 0 && !configuredHosts.some((allowed) => hostname === allowed || hostname.endsWith('.' + allowed))) {
    return { isValid: false, reason: 'Host is not on the outbound allow-list.' };
  }

  // Perform DNS resolution check
  try {
    const lookupResult = await dns.lookup(hostname, { all: true });
    if (!lookupResult || lookupResult.length === 0) {
      return { isValid: false, reason: `Could not resolve DNS for hostname '${hostname}'.` };
    }

    for (const record of lookupResult) {
      if (record.family === 4 && isPrivateIPv4(record.address)) {
        return {
          isValid: false,
          reason: `DNS resolution for '${hostname}' returned private IP '${record.address}'. Blocked for security.`,
          resolvedIp: record.address,
        };
      }
      if (record.family === 6 && isPrivateIPv6(record.address)) {
        return {
          isValid: false,
          reason: `DNS resolution for '${hostname}' returned private IPv6 '${record.address}'. Blocked for security.`,
          resolvedIp: record.address,
        };
      }
    }

    return {
      isValid: true,
      sanitizedUrl: parsed,
      resolvedIp: lookupResult[0].address,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      isValid: false,
      reason: `DNS resolution failed: ${msg}`,
    };
  }
}
