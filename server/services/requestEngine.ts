import type { Connection, ExecutionRequest, RequestAttempt } from '../db/schema.js';
import { db } from '../db/store.js';
import { decryptCredential, generateCorrelationId, redactSensitiveData } from '../security/crypto.js';
import { validateTargetUrl } from '../security/ssrf.js';

export interface ExecuteOptions {
  userId: string;
  connection: Connection;
  payload?: Record<string, unknown> | string;
  transformationId?: string;
  actionType?: 'web_dashboard' | 'mcp_tool' | 'api_key' | 'test_run';
  idempotencyKey?: string;
}

export interface ExecutionResult {
  success: boolean;
  httpStatus?: number;
  durationMs: number;
  requestId: string;
  correlationId: string;
  safeResponsePreview: string;
  errorMessage?: string;
  attemptsCount: number;
}

const MAX_RESPONSE_BYTES = Math.min(Number(process.env.MAX_RESPONSE_BYTES || 524288), 5242880);
const MAX_REDIRECTS = 3;

async function readLimitedBody(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > MAX_RESPONSE_BYTES) {
      const keep = value.slice(0, value.byteLength - (total - MAX_RESPONSE_BYTES));
      if (keep.byteLength) chunks.push(keep);
      await reader.cancel();
      const text = new TextDecoder().decode(concat(chunks));
      return text + '...[TRUNCATED]';
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(concat(chunks));
}

function concat(chunks: Uint8Array[]) {
  const size = chunks.reduce((n, c) => n + c.byteLength, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { out.set(chunk, offset); offset += chunk.byteLength; }
  return out;
}

function safePreview(text: string): string {
  try {
    return JSON.stringify(redactSensitiveData(JSON.parse(text)), null, 2).slice(0, 12000);
  } catch {
    return text.slice(0, 2000);
  }
}

function buildHeaders(connection: Connection, secret: string): Record<string,string> {
  const blocked = new Set(['authorization','proxy-authorization','cookie','set-cookie','host','content-length']);
  const headers: Record<string,string> = {};
  for (const [key,value] of Object.entries(connection.headers || {})) {
    if (!blocked.has(key.toLowerCase())) headers[key] = String(value);
  }
  if (connection.auth_type === 'bearer' && secret) headers.Authorization = `Bearer ${secret}`;
  if (connection.auth_type === 'api_key' && secret) headers['X-API-Key'] = secret;
  if (connection.auth_type === 'basic' && secret) headers.Authorization = `Basic ${Buffer.from(secret).toString('base64')}`;
  headers['User-Agent'] = 'Just-in-Time-Connector/1.0';
  return headers;
}

async function fetchWithValidatedRedirects(
  initialUrl: URL,
  init: RequestInit
): Promise<{ response: Response; url: URL }> {
  let url = initialUrl;
  for (let redirectCount = 0; ; redirectCount++) {
    const response = await fetch(url.toString(), { ...init, redirect: 'manual' });
    if (![301,302,303,307,308].includes(response.status)) return { response, url };

    if (redirectCount >= MAX_REDIRECTS) throw new Error('Redirect limit exceeded.');
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirect response did not include a Location header.');
    const next = new URL(location, url);
    const check = await validateTargetUrl(next.toString());
    if (!check.isValid) throw new Error(`Redirect blocked: ${check.reason}`);
    url = next;
  }
}

export async function executeExternalRequest(options: ExecuteOptions): Promise<ExecutionResult> {
  const { userId, connection, payload, transformationId, actionType = 'web_dashboard', idempotencyKey } = options;
  const correlationId = generateCorrelationId();
  const requestId = `req_${correlationId.replace('req_','')}`;

  if (idempotencyKey) {
    const existing = await db.getRequestByIdempotencyKey(userId, idempotencyKey);
    if (existing) {
      return {
        success: existing.status === 'success',
        httpStatus: existing.http_status,
        durationMs: existing.duration_ms,
        requestId: existing.id,
        correlationId: existing.correlation_id,
        safeResponsePreview: existing.safe_response_preview,
        errorMessage: existing.error_message,
        attemptsCount: existing.attempts_count
      };
    }
  }

  const target = new URL(connection.endpoint_url);
  const maskedPayload = JSON.stringify(redactSensitiveData(payload || {}));
  const baseRecord: ExecutionRequest = {
    id: requestId, user_id: userId, connection_id: connection.id, transformation_id: transformationId,
    action_type: actionType, status: 'retrying', duration_ms: 0,
    endpoint_domain: target.hostname, endpoint_path: target.pathname,
    masked_request_payload: maskedPayload, safe_response_preview: '',
    idempotency_key: idempotencyKey, correlation_id: correlationId,
    attempts_count: 0, created_at: new Date().toISOString()
  };

  try {
    await db.createRequest(baseRecord);
  } catch (error) {
    if (idempotencyKey) {
      const existing = await db.getRequestByIdempotencyKey(userId, idempotencyKey);
      if (existing) return {
        success: existing.status === 'success', httpStatus: existing.http_status, durationMs: existing.duration_ms,
        requestId: existing.id, correlationId: existing.correlation_id, safeResponsePreview: existing.safe_response_preview,
        errorMessage: existing.error_message, attemptsCount: existing.attempts_count
      };
    }
    throw error;
  }

  if (actionType !== 'test_run') {
    const quota = await db.reserveUsage(userId, requestId, `execute_${connection.name}`);
    if (!quota.allowed) {
      const message = `Monthly action limit reached (${quota.actionsCount}/${quota.actionsLimit}).`;
      await db.updateRequest(requestId, userId, { status: 'blocked', error_message: message, safe_response_preview: JSON.stringify({error: message}) });
      return { success:false, durationMs:0, requestId, correlationId, safeResponsePreview: JSON.stringify({error:message}), errorMessage:message, attemptsCount:0 };
    }
  }

  const ssrf = await validateTargetUrl(connection.endpoint_url);
  if (!ssrf.isValid) {
    const message = `Security Block: ${ssrf.reason}`;
    await db.logSecurityEvent({ user_id:userId, event_type:'ssrf_blocked', severity:'high', details:{url:connection.endpoint_url,reason:ssrf.reason}, ip_address:'', blocked:true });
    await db.updateRequest(requestId,userId,{status:'blocked',error_message:message,safe_response_preview:JSON.stringify({error:message})});
    return {success:false,durationMs:0,requestId,correlationId,safeResponsePreview:JSON.stringify({error:message}),errorMessage:message,attemptsCount:0};
  }

  const credential = await db.getCredentialByConnectionId(connection.id);
  let secret = '';
  if (credential) {
    secret = decryptCredential(credential.encrypted_secret, credential.iv, credential.auth_tag);
  }

  const headers = buildHeaders(connection, secret);
  const timeoutMs = Math.min(Math.max(Number(connection.timeout_ms || process.env.OUTBOUND_TIMEOUT_MS || 8000),1000),15000);
  const requestedRetries = Math.min(Math.max(Number(connection.retry_count || 0),0),3);
  const maxAttempts = connection.http_method === 'GET' || idempotencyKey ? Math.max(1, requestedRetries + 1) : 1;

  let finalStatus: RequestStatus = 'failed';
  let finalHttpStatus: number | undefined;
  let finalPreview = '';
  let finalError = '';
  let attemptsCount = 0;
  const started = Date.now();

  for (let attempt=1; attempt<=maxAttempts; attempt++) {
    attemptsCount = attempt;
    const attemptStarted = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const url = new URL(target.toString());
      for(const [k,v] of Object.entries(connection.query_params || {})) url.searchParams.set(k,String(v));

      let body: string | undefined;
      if (connection.http_method !== 'GET' && connection.http_method !== 'DELETE') {
        body = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
        if (!headers['Content-Type']) headers['Content-Type']='application/json';
      }

      const { response, url: finalUrl } = await fetchWithValidatedRedirects(url, {
        method: connection.http_method,
        headers,
        body,
        signal: controller.signal
      });
      finalHttpStatus = response.status;
      const text = await readLimitedBody(response);
      finalPreview = safePreview(text);
      const latency = Date.now()-attemptStarted;
      await db.createRequestAttempt({
        id:`att_${correlationId}_${attempt}`, request_id:requestId, attempt_number:attempt,
        status:response.ok?'success':'failed', http_status:response.status, latency_ms:latency, created_at:new Date().toISOString()
      } as RequestAttempt);

      if (response.ok) { finalStatus='success'; break; }

      finalError = `HTTP ${response.status}: ${response.statusText}`;
      const retryable = [408,425,429,500,502,503,504].includes(response.status) && attempt<maxAttempts;
      if (!retryable) break;
      await new Promise(r=>setTimeout(r,Math.min(2000,250*(2**(attempt-1)))));
    } catch(error) {
      const message = error instanceof Error ? error.message : 'External request failed.';
      const isTimeout = error instanceof Error && error.name==='AbortError';
      finalStatus = isTimeout ? 'timeout' : 'failed';
      finalError = isTimeout ? 'Request timed out.' : message;
      await db.createRequestAttempt({
        id:`att_${correlationId}_${attempt}`, request_id:requestId, attempt_number:attempt,
        status:'failed', error_message:finalError, latency_ms:Date.now()-attemptStarted, created_at:new Date().toISOString()
      } as RequestAttempt).catch(()=>undefined);
      if (attempt<maxAttempts) {
        await new Promise(r=>setTimeout(r,Math.min(2000,250*(2**(attempt-1)))));
      }
    } finally {
      clearTimeout(timer);
    }
  }

  const durationMs = Date.now()-started;
  await db.updateRequest(requestId,userId,{
    status: finalStatus, http_status: finalHttpStatus, duration_ms: durationMs,
    safe_response_preview: finalPreview, error_message: finalError || undefined, attempts_count: attemptsCount
  });

  return {success:finalStatus==='success',httpStatus:finalHttpStatus,durationMs,requestId,correlationId,safeResponsePreview:finalPreview,errorMessage:finalError||undefined,attemptsCount};
}

type RequestStatus = 'success' | 'failed' | 'timeout' | 'blocked' | 'retrying';
