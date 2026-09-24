import { Connection, ExecutionRequest, RequestAttempt } from '../db/schema';
import { db } from '../db/store';
import { decryptCredential, generateCorrelationId, redactSensitiveData } from '../security/crypto';
import { validateTargetUrl } from '../security/ssrf';

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

const MAX_RESPONSE_BYTES = 512 * 1024; // 512 KB

export async function executeExternalRequest(options: ExecuteOptions): Promise<ExecutionResult> {
  const { userId, connection, payload, transformationId, actionType = 'web_dashboard', idempotencyKey } = options;
  const correlationId = generateCorrelationId();
  const requestId = `req_${correlationId.replace('req_', '')}`;

  // 1. Idempotency Check: if same user + idempotency key was executed successfully in last 24h, return cached result
  if (idempotencyKey) {
    const existingReq = db.getRequestsByUserId(userId, 50).find(
      (r) => r.idempotency_key === idempotencyKey && r.status === 'success'
    );
    if (existingReq) {
      return {
        success: true,
        httpStatus: existingReq.http_status,
        durationMs: existingReq.duration_ms,
        requestId: existingReq.id,
        correlationId: existingReq.correlation_id,
        safeResponsePreview: existingReq.safe_response_preview,
        attemptsCount: existingReq.attempts_count,
      };
    }
  }

  // 2. Entitlement & Usage Check (skip for test_run)
  if (actionType !== 'test_run') {
    const usage = db.getUsageByUserId(userId);
    if (usage.actions_count >= usage.actions_limit) {
      const errorMsg = `Plan monthly limit reached (${usage.actions_count}/${usage.actions_limit} actions). Please upgrade your plan.`;
      db.createRequest({
        id: requestId,
        user_id: userId,
        connection_id: connection.id,
        transformation_id: transformationId,
        action_type: actionType,
        status: 'blocked',
        duration_ms: 0,
        endpoint_domain: new URL(connection.endpoint_url).hostname,
        endpoint_path: new URL(connection.endpoint_url).pathname,
        masked_request_payload: JSON.stringify(redactSensitiveData(payload || {})),
        safe_response_preview: JSON.stringify({ error: errorMsg }),
        error_message: errorMsg,
        idempotency_key: idempotencyKey,
        correlation_id: correlationId,
        attempts_count: 0,
        created_at: new Date().toISOString(),
      });

      return {
        success: false,
        durationMs: 0,
        requestId,
        correlationId,
        safeResponsePreview: JSON.stringify({ error: errorMsg }),
        errorMessage: errorMsg,
        attemptsCount: 0,
      };
    }
  }

  // 3. Strict SSRF check on target endpoint
  const ssrfCheck = await validateTargetUrl(connection.endpoint_url);
  if (!ssrfCheck.isValid) {
    const errorMsg = `Security Block: ${ssrfCheck.reason}`;
    db.logSecurityEvent({
      user_id: userId,
      event_type: 'ssrf_blocked',
      severity: 'high',
      details: { url: connection.endpoint_url, reason: ssrfCheck.reason },
      ip_address: '127.0.0.1',
      blocked: true,
    });

    db.createRequest({
      id: requestId,
      user_id: userId,
      connection_id: connection.id,
      transformation_id: transformationId,
      action_type: actionType,
      status: 'blocked',
      duration_ms: 0,
      endpoint_domain: connection.endpoint_url.slice(0, 30),
      endpoint_path: '',
      masked_request_payload: JSON.stringify(redactSensitiveData(payload || {})),
      safe_response_preview: JSON.stringify({ error: errorMsg }),
      error_message: errorMsg,
      idempotency_key: idempotencyKey,
      correlation_id: correlationId,
      attempts_count: 0,
      created_at: new Date().toISOString(),
    });

    return {
      success: false,
      durationMs: 0,
      requestId,
      correlationId,
      safeResponsePreview: JSON.stringify({ error: errorMsg }),
      errorMessage: errorMsg,
      attemptsCount: 0,
    };
  }

  // 4. Resolve and decrypt credentials
  const credential = db.getCredentialByConnectionId(connection.id);
  let decryptedSecret = '';
  if (credential) {
    try {
      decryptedSecret = decryptCredential(credential.encrypted_secret, credential.iv, credential.auth_tag);
    } catch (err) {
      console.error('[RequestEngine] Failed to decrypt credential:', err);
    }
  }

  // 5. Construct URL & Query Params
  const targetUrl = new URL(connection.endpoint_url);
  if (connection.query_params) {
    for (const [k, v] of Object.entries(connection.query_params)) {
      targetUrl.searchParams.set(k, v);
    }
  }

  // 6. Build Headers with secure auth injection
  const headers: Record<string, string> = {
    'User-Agent': 'Just-In-Time-Connector/1.0 (+https://justintimeconnector.io)',
    ...connection.headers,
  };

  if (connection.auth_type === 'bearer' && decryptedSecret) {
    headers['Authorization'] = `Bearer ${decryptedSecret}`;
  } else if (connection.auth_type === 'api_key' && decryptedSecret) {
    headers['X-API-Key'] = decryptedSecret;
  } else if (connection.auth_type === 'basic' && decryptedSecret) {
    headers['Authorization'] = `Basic ${Buffer.from(decryptedSecret).toString('base64')}`;
  }

  // 7. Prepare request body
  let body: string | undefined;
  if (connection.http_method !== 'GET' && connection.http_method !== 'DELETE') {
    if (typeof payload === 'object') {
      body = JSON.stringify(payload);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
    } else if (typeof payload === 'string') {
      body = payload;
    }
  }

  const maxRetries = Math.min(connection.retry_count || 1, 3);
  const timeoutMs = Math.min(connection.timeout_ms || 8000, 15000);

  let attemptNumber = 0;
  let finalStatus: 'success' | 'failed' | 'timeout' = 'failed';
  let finalHttpStatus: number | undefined;
  let safePreview = '';
  let finalError = '';
  const startTime = Date.now();

  const attempts: RequestAttempt[] = [];

  while (attemptNumber < maxRetries) {
    attemptNumber++;
    const attemptStart = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(targetUrl.toString(), {
        method: connection.http_method,
        headers,
        body,
        signal: controller.signal,
        redirect: 'follow',
      });
      clearTimeout(timer);

      finalHttpStatus = response.status;
      const attemptDuration = Date.now() - attemptStart;

      // Read response body safely with byte limit
      const rawText = await response.text();
      const truncated = rawText.length > MAX_RESPONSE_BYTES ? rawText.slice(0, MAX_RESPONSE_BYTES) + '... [TRUNCATED]' : rawText;

      try {
        const parsed = JSON.parse(truncated);
        safePreview = JSON.stringify(redactSensitiveData(parsed), null, 2);
      } catch {
        safePreview = truncated.slice(0, 1000);
      }

      const isSuccess = response.ok;
      attempts.push({
        id: `att_${correlationId}_${attemptNumber}`,
        request_id: requestId,
        attempt_number: attemptNumber,
        status: isSuccess ? 'success' : 'failed',
        http_status: response.status,
        latency_ms: attemptDuration,
        created_at: new Date().toISOString(),
      });

      if (isSuccess) {
        finalStatus = 'success';
        break;
      }

      // Check if status is retryable (429, 502, 503, 504)
      const isRetryable = [429, 502, 503, 504].includes(response.status);
      if (!isRetryable || attemptNumber >= maxRetries) {
        finalError = `HTTP ${response.status}: ${response.statusText}`;
        break;
      }

      // Exponential backoff wait before retry: 250ms, 500ms, 1000ms
      await new Promise((r) => setTimeout(r, Math.pow(2, attemptNumber) * 200));
    } catch (err: unknown) {
      clearTimeout(timer);
      const attemptDuration = Date.now() - attemptStart;
      const isTimeout = (err as Error).name === 'AbortError';
      const msg = isTimeout ? 'Request timed out' : (err as Error).message;

      attempts.push({
        id: `att_${correlationId}_${attemptNumber}`,
        request_id: requestId,
        attempt_number: attemptNumber,
        status: 'failed',
        error_message: msg,
        latency_ms: attemptDuration,
        created_at: new Date().toISOString(),
      });

      if (attemptNumber >= maxRetries) {
        finalStatus = isTimeout ? 'timeout' : 'failed';
        finalError = msg;
        break;
      }
      await new Promise((r) => setTimeout(r, Math.pow(2, attemptNumber) * 200));
    }
  }

  const totalDuration = Date.now() - startTime;

  // Mask payload before storing
  const maskedPayload = JSON.stringify(redactSensitiveData(payload || {}));

  // Store request record in db
  const requestRecord: ExecutionRequest = {
    id: requestId,
    user_id: userId,
    connection_id: connection.id,
    transformation_id: transformationId,
    action_type: actionType,
    status: finalStatus,
    http_status: finalHttpStatus,
    duration_ms: totalDuration,
    endpoint_domain: targetUrl.hostname,
    endpoint_path: targetUrl.pathname,
    masked_request_payload: maskedPayload,
    safe_response_preview: safePreview,
    error_message: finalError || undefined,
    idempotency_key: idempotencyKey,
    correlation_id: correlationId,
    attempts_count: attemptNumber,
    created_at: new Date().toISOString(),
  };

  db.createRequest(requestRecord);

  // Update connection last tested status
  connection.last_tested_at = new Date().toISOString();
  connection.last_test_status = finalHttpStatus || (finalStatus === 'success' ? 200 : 500);

  // Consume unit of usage if successful and not a test run
  if (finalStatus === 'success' && actionType !== 'test_run') {
    db.recordUsage(userId, requestId, `execute_${connection.name}`);
  }

  return {
    success: finalStatus === 'success',
    httpStatus: finalHttpStatus,
    durationMs: totalDuration,
    requestId,
    correlationId,
    safeResponsePreview: safePreview,
    errorMessage: finalError || undefined,
    attemptsCount: attemptNumber,
  };
}
