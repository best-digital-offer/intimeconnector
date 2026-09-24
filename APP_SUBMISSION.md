# Just-in-Time Connector — OpenAI / ChatGPT Submission Package

## Status

**Technical preparation:** in progress / deployment-specific values not yet configured.

**OpenAI approval:** not claimed. Approval is a separate review process.

## Listing

**Display name:** Just-in-Time Connector

**Short description:** Secure API actions by AI.

**Long description:** Connect APIs once, transform information into structured payloads, and execute secure actions through saved connections from the web application or an authenticated remote MCP server.

**Website:** https://YOURDOMAIN.com

**Support:** https://YOURDOMAIN.com/support

**Privacy:** https://YOURDOMAIN.com/privacy

**Terms:** https://YOURDOMAIN.com/terms

**MCP:** https://api.YOURDOMAIN.com/mcp

**Authentication:** OAuth 2.1-style authorization-code + PKCE flow with bearer-token validation and server-side account authorization.

## MCP tools

1. get_profile
2. list_connections
3. get_connection
4. transform_payload
5. test_connection
6. send_webhook
7. get_request_status
8. list_recent_requests

Tool annotations and justifications are maintained in `server/services/mcpService.ts`. The implementation deliberately avoids returning credentials, raw secrets, unnecessary customer PII, or database credentials through MCP.

## Starter prompts

- Send this lead to my CRM.
- Transform this text and send it to my webhook.
- Show my recent API requests.

## Positive test cases

1. List the authenticated account's connections.
2. Transform a lead using a saved transformation.
3. Test a saved connection.
4. Send a lead through a saved connection.
5. Read recent request status metadata.

## Negative test cases

1. Attempt to access another user's connection — authorization must fail.
2. Attempt to use a private/internal outbound URL — SSRF protection must block it.
3. Attempt an external action after the configured quota is exhausted — server-side entitlement must block execution.

## Reviewer setup

Production reviewer credentials and the production MCP URL must be added only after the real deployment, OAuth provider configuration, domain verification, privacy/terms/support URLs, and MCP scan are complete.

## Release notes

### Initial production candidate

- Supabase-backed persistence and Row Level Security migration.
- Supabase Auth access-token validation.
- Encrypted connection credentials.
- SSRF validation, redirect validation, quotas, idempotency and response-size limits.
- Official MCP TypeScript SDK based remote handler.
- OAuth discovery, PKCE authorization code flow and bearer token validation.
- External Stripe checkout architecture.
- Vercel serverless entrypoint and deployment configuration.

