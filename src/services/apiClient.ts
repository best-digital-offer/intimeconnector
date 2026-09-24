import { supabase } from '../lib/supabase';

class ApiClient {
  private async accessToken(): Promise<string | null> {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  public async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = await this.accessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(endpoint, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        await supabase.auth.signOut();
      }
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }

    return data as T;
  }

  public async login(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: data.user, session: data.session };
  }

  public async signup(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name: name?.trim() || email.split('@')[0] } }
    });
    if (error) throw error;
    return { user: data.user, session: data.session };
  }

  public async getMe() {
    return this.request<{ user: any; subscription: any; usage: any }>('/api/auth/me');
  }

  public async logout() {
    await supabase.auth.signOut();
  }

  public async getConnections() { return this.request<{ connections: any[] }>('/api/connections'); }
  public async createConnection(data: any) { return this.request<{ connection: any }>('/api/connections', { method: 'POST', body: JSON.stringify(data) }); }
  public async updateConnection(id: string, data: any) { return this.request<{ connection: any }>(`/api/connections/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  public async deleteConnection(id: string) { return this.request<{ success: boolean }>(`/api/connections/${id}`, { method: 'DELETE' }); }
  public async testConnection(id: string, payload?: any) { return this.request<any>(`/api/connections/${id}/test`, { method: 'POST', body: JSON.stringify({ payload }) }); }

  public async getTransformations() { return this.request<{ transformations: any[] }>('/api/transformations'); }
  public async createTransformation(data: any) { return this.request<{ transformation: any }>('/api/transformations', { method: 'POST', body: JSON.stringify(data) }); }
  public async updateTransformation(id: string, data: any) { return this.request<{ transformation: any }>(`/api/transformations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }); }
  public async deleteTransformation(id: string) { return this.request<{ success: boolean }>(`/api/transformations/${id}`, { method: 'DELETE' }); }
  public async previewTransformation(transformation: any, raw_input: string) { return this.request<{ output: any }>('/api/transformations/preview', { method: 'POST', body: JSON.stringify({ transformation, raw_input }) }); }
  public async aiExtract(text: string, schemaGuide?: string) { return this.request<{ extracted: any }>('/api/transformations/ai-extract', { method: 'POST', body: JSON.stringify({ text, schemaGuide }) }); }

  public async execute(data: { connection_id: string; transformation_id?: string; input_data: any; idempotency_key?: string }) {
    return this.request<any>('/api/execute', { method: 'POST', body: JSON.stringify(data), headers: data.idempotency_key ? { 'Idempotency-Key': data.idempotency_key } : undefined });
  }

  public async getRequests(limit = 50) { return this.request<{ requests: any[] }>(`/api/requests?limit=${limit}`); }
  public async getRequestById(id: string) { return this.request<{ request: any }>(`/api/requests/${id}`); }
  public async getBilling() { return this.request<any>('/api/billing'); }
  public async createCheckout(plan_id: string) { return this.request<any>('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan_id }) }); }
  public async cancelSubscription() { return this.request<any>('/api/billing/cancel', { method: 'POST' }); }

  public async getApiKeys() { return this.request<{ api_keys: any[] }>('/api/api-keys'); }
  public async createApiKey(name: string) { return this.request<{ api_key: any }>('/api/api-keys', { method: 'POST', body: JSON.stringify({ name }) }); }
  public async revokeApiKey(id: string) { return this.request<{ success: boolean }>(`/api/api-keys/${id}`, { method: 'DELETE' }); }

  public async getSecurityEvents() { return this.request<{ events: any[] }>('/api/security/events'); }
  public async testSsrf(test_url: string) { return this.request<any>('/api/security/test-ssrf', { method: 'POST', body: JSON.stringify({ test_url }) }); }
  public async getAdminMetrics() { return this.request<{ metrics: any }>('/api/admin/metrics'); }
  public async getAdminUsers() { return this.request<{ users: any[] }>('/api/admin/users'); }
  public async updatePlan(planId: string, updates: any) { return this.request<any>(`/api/admin/plans/${planId}`, { method: 'PATCH', body: JSON.stringify(updates) }); }
  public async callMcp(body: any) { return this.request<any>('/mcp', { method: 'POST', body: JSON.stringify(body) }); }
}

export const api = new ApiClient();
