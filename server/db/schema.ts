export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  email: string;
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
  stripe_price_id?: string;
  usage_count_mode?: 'attempted' | 'successful';
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'expired';
  current_period_start?: string;
  current_period_end?: string;
  cancel_at_period_end: boolean;
  provider: string;
  provider_customer_id?: string;
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
  encrypted_secret: string;
  iv: string;
  auth_tag: string;
  masked_preview: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export type TransformationRuleType =
  | 'rename_field' | 'remove_field' | 'create_field' | 'constant_value'
  | 'combine_fields' | 'split_fields' | 'trim_text' | 'lowercase'
  | 'uppercase' | 'to_number' | 'to_boolean' | 'format_date'
  | 'create_array' | 'set_default' | 'conditional';

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
  snapshot: Record<string, unknown>;
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
  masked_request_payload: string;
  safe_response_preview: string;
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

export interface AuditLog {
  id: string;
  user_id?: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  metadata: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityEvent {
  id: string;
  user_id?: string;
  event_type: string;
  severity: SecuritySeverity;
  details: Record<string, unknown>;
  ip_address?: string;
  blocked: boolean;
  created_at: string;
}

export interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  scopes: string[];
  last_used_at?: string;
  expires_at?: string;
  is_revoked: boolean;
  created_at: string;
}
