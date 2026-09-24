export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
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
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  provider: string;
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
  credential_masked?: string;
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

export interface TransformationRule {
  id: string;
  type: string;
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

export interface ExecutionRequest {
  id: string;
  user_id: string;
  connection_id: string;
  transformation_id?: string;
  action_type: 'web_dashboard' | 'mcp_tool' | 'api_key' | 'test_run';
  status: 'success' | 'failed' | 'timeout' | 'blocked' | 'retrying';
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

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at?: string;
  is_revoked: boolean;
  created_at: string;
}

export interface SecurityEvent {
  id: string;
  user_id?: string;
  event_type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, unknown>;
  ip_address: string;
  blocked: boolean;
  created_at: string;
}
