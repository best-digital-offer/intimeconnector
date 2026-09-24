export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  tier: 'free' | 'starter' | 'pro' | 'business';
  price_monthly: number;
  actions_limit: number;
  connections_limit: number;
  features: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  provider: 'stripe' | 'razorpay' | 'paypal' | 'paddle' | 'manual';
  provider_subscription_id?: string;
  created_at: string;
  updated_at: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type AuthType = 'none' | 'bearer' | 'api_key' | 'basic';

export interface Connection {
  id: string;
  user_id: string;
  name: string;
  description: string;
  endpoint_url: string;
  http_method: HttpMethod;
  auth_type: AuthType;
  headers: Record<string, string>;
  query_params: Record<string, string>;
  timeout_ms: number;
  retry_count: number;
  status: 'active' | 'paused' | 'error';
  last_tested_at?: string;
  last_test_status?: number;
  created_at: string;
  updated_at: string;
}

export interface ConnectionCredential {
  id: string;
  connection_id: string;
  secret_type: AuthType;
  encrypted_secret: string; // AES-256-GCM ciphertext hex
  iv: string; // 12-byte initialization vector hex
  auth_tag: string; // 16-byte authentication tag hex
  masked_preview: string; // e.g. "sk_live_•••••••92AB"
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export type TransformationRuleType =
  | 'rename_field'
  | 'remove_field'
  | 'create_field'
  | 'constant_value'
  | 'combine_fields'
  | 'split_fields'
  | 'trim_text'
  | 'lowercase'
  | 'uppercase'
  | 'to_number'
  | 'to_boolean'
  | 'format_date'
  | 'create_array'
  | 'set_default'
  | 'conditional';

export interface TransformationRule {
  id: string;
  type: TransformationRuleType;
  source_field?: string;
  target_field?: string;
  value?: string | number | boolean;
  separator?: string;
  fields?: string[];
  date_format?: string;
  condition_field?: string;
  condition_operator?: 'equals' | 'not_equals' | 'contains' | 'exists';
  condition_value?: string;
}

export interface Transformation {
  id: string;
  user_id: string;
  connection_id?: string;
  name: string;
  description: string;
  mode: 'visual' | 'template' | 'ai_prompt';
  rules: TransformationRule[];
  template_json?: string;
  ai_system_instructions?: string;
  sample_input: string;
  sample_output?: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface TransformationVersion {
  id: string;
  transformation_id: string;
  version_num: number;
  snapshot: Omit<Transformation, 'id'>;
  created_at: string;
}

export type RequestStatus = 'success' | 'failed' | 'timeout' | 'blocked' | 'retrying';

export interface ExecutionRequest {
  id: string;
  user_id: string;
  connection_id: string;
  transformation_id?: string;
  action_type: 'web_dashboard' | 'mcp_tool' | 'api_key' | 'test_run';
  status: RequestStatus;
  http_status?: number;
  duration_ms: number;
  endpoint_domain: string;
  endpoint_path: string;
  masked_request_payload: string; // Sensitive fields redacted
  safe_response_preview: string; // Truncated/redacted response preview
  error_message?: string;
  idempotency_key?: string;
  correlation_id: string;
  attempts_count: number;
  created_at: string;
}

export interface RequestAttempt {
  id: string;
  request_id: string;
  attempt_number: number;
  status: 'success' | 'failed';
  http_status?: number;
  error_message?: string;
  latency_ms: number;
  created_at: string;
}

export interface Usage {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  actions_count: number;
  actions_limit: number;
  updated_at: string;
}

export interface UsageEvent {
  id: string;
  user_id: string;
  request_id: string;
  action_name: string;
  consumed_units: number;
  created_at: string;
}

export interface OAuthClient {
  id: string;
  client_id: string;
  client_secret_hash: string;
  client_name: string;
  redirect_uris: string[];
  is_active: boolean;
  created_at: string;
}

export interface OAuthToken {
  id: string;
  user_id: string;
  client_id: string;
  token_hash: string;
  token_type: 'Bearer';
  scopes: string[];
  expires_at: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  id: string;
  user_id?: string;
  event_type: 'ssrf_blocked' | 'rate_limit_exceeded' | 'auth_failure' | 'invalid_token' | 'idor_attempt' | 'oversized_payload';
  severity: SecuritySeverity;
  details: Record<string, unknown>;
  ip_address: string;
  blocked: boolean;
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string; // e.g. "jtc_live_a1b2"
  key_hash: string;
  scopes: string[];
  last_used_at?: string;
  expires_at?: string;
  is_revoked: boolean;
  created_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string;
}

export interface SupportTicket {
  id: string;
  user_id: string;
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved';
  priority: 'low' | 'normal' | 'high';
  created_at: string;
}

export interface AdminAction {
  id: string;
  admin_user_id: string;
  action: string;
  target_user_id?: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface SystemSettings {
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}
