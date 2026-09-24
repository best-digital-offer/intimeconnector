# Just-in-Time Connector — Production Deployment Guide

## 1. Prerequisites
- Node.js >= 20.x
- PostgreSQL 15+ or Supabase project instance
- Custom domain with TLS/HTTPS certificate
- Stripe/Billing provider account for external subscriptions

---

## 2. Environment Variables Configuration

Copy `.env.example` to `.env.production` and populate production secrets:

```bash
cp .env.example .env.production
```

Key secrets:
- `ENCRYPTION_KEY`: 32-byte hex-encoded key for AES-256-GCM credential envelope encryption.
- `SESSION_SECRET`: High-entropy 64-character string for session cryptographic signing.
- `DATABASE_URL`: Connection string for PostgreSQL database.
- `OPENAI_APP_VERIFICATION_TOKEN`: Exact token provided in OpenAI Developer Portal challenge screen.
- `GEMINI_API_KEY`: Google GenAI API key for natural language reasoning.

---

## 3. Database Migration (PostgreSQL / Supabase)

To provision relational PostgreSQL tables in production:

```sql
-- Run migrations in your PostgreSQL / Supabase SQL Editor:
CREATE TABLE profiles (
  id VARCHAR(64) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(32) DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE plans (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  tier VARCHAR(32) NOT NULL,
  price_monthly NUMERIC(10,2) NOT NULL,
  actions_limit INT NOT NULL,
  connections_limit INT NOT NULL,
  features JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id VARCHAR(64) REFERENCES plans(id),
  status VARCHAR(32) NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  provider VARCHAR(64) DEFAULT 'stripe',
  provider_subscription_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE connections (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES profiles(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  endpoint_url TEXT NOT NULL,
  http_method VARCHAR(16) NOT NULL,
  auth_type VARCHAR(32) NOT NULL,
  headers JSONB DEFAULT '{}',
  query_params JSONB DEFAULT '{}',
  timeout_ms INT DEFAULT 8000,
  retry_count INT DEFAULT 2,
  status VARCHAR(32) DEFAULT 'active',
  last_tested_at TIMESTAMPTZ,
  last_test_status INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE connection_credentials (
  id VARCHAR(64) PRIMARY KEY,
  connection_id VARCHAR(64) REFERENCES connections(id) ON DELETE CASCADE,
  secret_type VARCHAR(32) NOT NULL,
  encrypted_secret TEXT NOT NULL,
  iv VARCHAR(64) NOT NULL,
  auth_tag VARCHAR(64) NOT NULL,
  masked_preview VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE transformations (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id VARCHAR(64) REFERENCES connections(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  mode VARCHAR(32) NOT NULL,
  rules JSONB DEFAULT '[]',
  template_json TEXT,
  ai_system_instructions TEXT,
  sample_input TEXT,
  sample_output TEXT,
  version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE requests (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES profiles(id) ON DELETE CASCADE,
  connection_id VARCHAR(64) REFERENCES connections(id) ON DELETE CASCADE,
  transformation_id VARCHAR(64),
  action_type VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  http_status INT,
  duration_ms INT NOT NULL,
  endpoint_domain VARCHAR(255),
  endpoint_path TEXT,
  masked_request_payload TEXT,
  safe_response_preview TEXT,
  error_message TEXT,
  idempotency_key VARCHAR(128),
  correlation_id VARCHAR(64) NOT NULL,
  attempts_count INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE usage (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) REFERENCES profiles(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  actions_count INT DEFAULT 0,
  actions_limit INT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE security_events (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64),
  event_type VARCHAR(64) NOT NULL,
  severity VARCHAR(32) NOT NULL,
  details JSONB DEFAULT '{}',
  ip_address VARCHAR(64) NOT NULL,
  blocked BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Build and Launch

```bash
# 1. Install production dependencies
npm install

# 2. Build Vite frontend bundle
npm run build

# 3. Start production server
NODE_ENV=production npm run start
```

---

## 5. Domain Verification & OpenAI Challenge

1. In OpenAI Developer Console, request app challenge token.
2. Set `OPENAI_APP_VERIFICATION_TOKEN=your_token` in environment.
3. Test locally or via curl:
   ```bash
   curl -i https://YOURDOMAIN.com/.well-known/openai-apps-challenge
   ```
4. Verify HTTP 200 with raw token as text body.

---

## 6. MCP Inspector Verification

Test the remote Streamable HTTP MCP server using the official MCP inspector:

```bash
npx @modelcontextprotocol/inspector --transport http https://YOURDOMAIN.com/mcp
```

Confirm that all 8 tools are discovered, schemas validate, and tool calls work with your Bearer API key.

---

## 7. Security Hardening Checklist

- [x] TLS 1.3 enforced with HSTS.
- [x] AES-256-GCM envelope encryption for connection credentials.
- [x] SSRF guard active (DNS resolution validation, loopback & private IP blocking).
- [x] Sliding window rate limiter active (120 reqs/min standard).
- [x] Idempotency cache active.
- [x] Response payload truncation (512 KB safeguard).
- [x] Security logging enabled for all anomalous requests.

---

## 8. Backup & Rollback

- **Database Backup**: Automated daily snapshot via PostgreSQL / Supabase CLI.
- **Rollback Procedure**: In case of regression, point DNS to previous container tag or deploy prior git commit hash using atomic blue/green deployment.
