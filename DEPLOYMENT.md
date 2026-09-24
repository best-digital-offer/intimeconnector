# Just-in-Time Connector — Deployment Guide

## 1. Prerequisites

- Node.js 20+
- A dedicated Supabase project for Just-in-Time Connector
- A dedicated Vercel project linked to this repository
- A production domain with HTTPS
- Stripe account for external billing
- Optional AI provider key for natural-language extraction

Do **not** reuse another product's Supabase or Vercel project.

## 2. Supabase

Create the project, then apply:

`supabase/migrations/0001_jitc_schema.sql`
`supabase/migrations/0002_oauth_codes.sql`

The schema includes profiles, plans, subscriptions, connections, encrypted credential metadata, transformations, requests, usage, OAuth clients/tokens, audit/security events, API keys and support/admin tables.

The database trigger creates a profile and free-plan subscription after Supabase Auth creates a user.

## 3. Vercel environment variables

Configure production values from `.env.example`.

Required backend variables:

- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ENCRYPTION_KEY
- APP_BASE_URL
- MCP_BASE_URL
- OAUTH_ISSUER

Required frontend variables:

- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY

For production billing add:

- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_STARTER
- STRIPE_PRICE_PRO
- STRIPE_PRICE_BUSINESS

Add the actual Stripe price IDs to the database `plans.stripe_price_id`.

Never commit real values.

## 4. Build

`npm install`

`npm run build`

`npm run lint`

`npm run test`

Vercel uses `vercel.json`, the Vite output directory, and `api/index.ts` for the serverless API/MCP entrypoint.

## 5. Supabase Auth

Enable email/password authentication in the dedicated Supabase project.

The web client uses Supabase Auth directly and sends the current access token to the backend. The backend validates the token server-side before loading account-owned data.

## 6. OAuth / MCP

Publish the following on the production domain:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`
- `/.well-known/openid-configuration`
- `/oauth/register`
- `/oauth/authorize`
- `/oauth/token`
- `/oauth/revoke`
- `/mcp`

The authorization flow uses authorization code + PKCE S256 and stores one-time authorization-code hashes server-side.

## 7. Domain verification

Set `OPENAI_APP_VERIFICATION_TOKEN` only in Vercel production environment variables.

Verify:

`https://YOURDOMAIN.com/.well-known/openai-apps-challenge`

The endpoint returns the configured token as plain text and returns 404 when unconfigured.

## 8. Security verification

Before launch, test:

- private IPv4/IPv6 targets
- localhost and metadata ranges
- redirect to private targets
- oversized request and response bodies
- duplicate idempotency keys
- exceeded quota
- expired OAuth token
- missing token
- cross-account connection IDs
- secret redaction
- Stripe signature failure
- duplicate Stripe webhook events
- account deletion

## 9. Billing

Billing is external to the ChatGPT experience.

Checkout is created server-side with Stripe. The webhook endpoint verifies Stripe signatures from the raw request body before updating the subscription entitlement.

## 10. Operational notes

Use the Vercel deployment logs for runtime errors and Supabase logs/database metrics for persistence issues.

This repository is technically prepared for deployment, but production-specific environment configuration, domain verification, MCP scanning, reviewer credentials and OpenAI review must still be completed before submission.
