# Just-in-Time Connector — ChatGPT App Submission Package

## 1. Application Listing Details

- **Display Name**: Just-in-Time Connector
- **Short Description**: Secure API actions from natural language.
- **Long Description**:
  Connect your APIs once and execute actions through natural-language instructions. Transform unstructured information into validated, structured payloads and securely send them to your saved webhooks and APIs without Zapier or Make.
- **Developer / Publisher**: Just-in-Time Connector Technologies Inc.
- **Category**: Productivity / Developer Tools / Automation
- **Capabilities**:
  - Remote MCP Server integration
  - Real-time payload transformation
  - Safe external API & webhook execution
  - Request status tracking & audit logging
- **Website URL**: `https://ais-dev-y2gsdidnuoyq24p7m3f5k7-389074655418.asia-southeast1.run.app`
- **Support URL**: `https://ais-dev-y2gsdidnuoyq24p7m3f5k7-389074655418.asia-southeast1.run.app/app/support`
- **Privacy Policy URL**: `https://ais-dev-y2gsdidnuoyq24p7m3f5k7-389074655418.asia-southeast1.run.app/privacy`
- **Terms of Service URL**: `https://ais-dev-y2gsdidnuoyq24p7m3f5k7-389074655418.asia-southeast1.run.app/terms`
- **Remote MCP Endpoint**: `https://ais-dev-y2gsdidnuoyq24p7m3f5k7-389074655418.asia-southeast1.run.app/mcp`
- **Domain Verification Challenge**: `https://ais-dev-y2gsdidnuoyq24p7m3f5k7-389074655418.asia-southeast1.run.app/.well-known/openai-apps-challenge`

---

## 2. Authentication & Security Architecture

- **Auth Method**: OAuth 2.1 & Bearer Token Authentication
- **Token Resolution**: The remote MCP server expects `Authorization: Bearer <token>` in incoming headers. Tokens are authenticated against the database and strictly mapped to the owner's profile.
- **Credential Storage**: Credentials (Bearer tokens, API keys, basic auth) are encrypted at rest using **AES-256-GCM envelope encryption** with distinct random initialization vectors (IV) and 128-bit authentication tags.
- **Zero-Exposure Policy**: Secrets are never rendered in client bundles, logs, or MCP tool responses.
- **SSRF Shielding**: Target URLs must pass rigorous DNS resolution verification blocking RFC1918 private ranges, AWS/GCP metadata endpoints (`169.254.169.254`), loopbacks (`127.0.0.1`, `::1`), and local domains.

---

## 3. Starter Prompts

1. *"Send this lead to my CRM."*
2. *"Transform this text and send it to my webhook."*
3. *"Show me my recent API requests."*

---

## 4. MCP Tools & Accurate Annotations

| Tool Name | readOnlyHint | openWorldHint | destructiveHint | Justification |
| :--- | :---: | :---: | :---: | :--- |
| `get_profile` | **true** | **false** | **false** | Reads only authenticated user account stats from internal database without external calls or side-effects. |
| `list_connections` | **true** | **false** | **false** | Fetches user's saved connection metadata without revealing secrets or invoking external APIs. |
| `get_connection` | **true** | **false** | **false** | Retrieves a single connection's public parameters without altering state. |
| `transform_payload` | **true** | **false** | **false** | In-memory dry run: parses raw input into structured JSON without outbound network requests. |
| `test_connection` | **false** | **true** | **false** | Performs outbound network ping to user-configured endpoint (`openWorld=true`), but does not modify state (`destructive=false`). |
| `send_webhook` | **false** | **true** | **true** | Sends mutating data (`POST`/`PUT`/`DELETE`) to an external webhook or API and consumes quota (`destructiveHint=true`). |
| `get_request_status` | **true** | **false** | **false** | Reads status metadata of a previous request ID from database. |
| `list_recent_requests` | **true** | **false** | **false** | Queries recent request history for the authenticated user without external interaction. |

---

## 5. Reviewer Demo Credentials

- **Reviewer Test Account**: `pamarthikrishnasai@gmail.com`
- **Reviewer Password**: `Password123!`
- **Sample Production Key**: `jtc_live_7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d`
- **Pre-configured Connections**:
  1. *HubSpot CRM Webhook* (`https://httpbin.org/post`)
  2. *HTTPBin Echo API* (`https://httpbin.org/anything`)
  3. *Slack Alerts Webhook* (`https://httpbin.org/post`)

---

## 6. Positive Test Cases (Exactly 5)

### Test Case 1: Inspect Available Connections
- **Prompt**: *"What connections do I have configured in my Just-in-Time Connector account?"*
- **Invoked Tool**: `list_connections()`
- **Expected Outcome**: Returns safe list of user's active connections (*HubSpot CRM Webhook*, *HTTPBin Echo API*, *Slack Alerts Webhook*) with endpoint domain, method, and active status. No secret credentials exposed.

### Test Case 2: Transform Data Without Sending
- **Prompt**: *"Transform this client summary into my CRM lead format without sending it: 'Alice Walker from Stark Industries wants 100 enterprise seats for cloud automation. Contact at alice@stark.io'"*
- **Invoked Tool**: `transform_payload(raw_input="...", transformation_id="trans_crm_001")`
- **Expected Outcome**: Returns structured JSON with `name="Alice Walker"`, `company="Stark Industries"`, `email="alice@stark.io"`, `priority="HIGH"`, `source="just-in-time-connector"`. Zero external requests fired.

### Test Case 3: Test a Connection Health
- **Prompt**: *"Can you test my CRM connection to check if it's reachable?"*
- **Invoked Tool**: `test_connection(connection_id="conn_crm_001")`
- **Expected Outcome**: Safely pings endpoint, returns status `HEALTHY`, HTTP 200, and latency in milliseconds.

### Test Case 4: Execute Natural-Language Lead Ingestion
- **Prompt**: *"Send this lead to my CRM: 'Bob Vance from Vance Refrigeration requested a pricing quote for 25 units. Contact: bob@vancerefrig.com'"*
- **Invoked Tool**: `send_webhook(connection_id="conn_crm_001", data="...")`
- **Expected Outcome**: System extracts data, applies transformation rules, executes authenticated POST to endpoint, records audit log, deducts quota, and confirms success with request ID and response preview.

### Test Case 5: View Recent Request History
- **Prompt**: *"Show me the status of my latest request."*
- **Invoked Tool**: `list_recent_requests(limit=1)` followed by `get_request_status(request_id="...")`
- **Expected Outcome**: Returns concise summary containing request ID, target domain (`httpbin.org`), status code 200, execution time, and timestamp.

---

## 7. Negative Test Cases (Exactly 3)

### Negative Case 1: Cross-Account Access (IDOR Prevention)
- **Action**: An authenticated user attempts to invoke `get_connection` or `send_webhook` with a `connection_id` belonging to another tenant (`user_B`).
- **Expected Result**: Server strictly enforces ownership (`assertResourceOwnership`) and returns `404 Not Found` or `Access Denied`. No data or existence leak.

### Negative Case 2: SSRF Attack Against Cloud Metadata
- **Action**: An attacker attempts to configure or invoke a connection targeting `http://169.254.169.254/latest/meta-data/` or `http://localhost:6379/`.
- **Expected Result**: Outbound request engine intercepts target URL before socket connection, resolves DNS, flags reserved link-local / loopback IP, logs high-severity `ssrf_blocked` security event, and immediately terminates request.

### Negative Case 3: Quota Limit Enforcement
- **Action**: A user on the Free plan who has exhausted their 25 monthly actions attempts to call `send_webhook`.
- **Expected Result**: Server detects `actions_count >= actions_limit` prior to HTTP dispatch, blocks execution, logs status `blocked`, and prompts user to upgrade on the external website (`https://yourdomain.com/app/billing`) without initiating digital purchases inside ChatGPT.

---

## 8. Release Notes (v1.0.0)

- Initial production release of Just-in-Time Connector.
- Remote MCP server implementation conforming to Streamable HTTP protocol specification (v2024-11-05).
- 8 specialized tools with accurate annotations and safety justifications.
- Deterministic and Gemini-powered hybrid transformation engine.
- AES-256-GCM envelope credential encryption.
- Multi-layered SSRF defense system with DNS resolution verification.
- Externalized billing architecture strictly compliant with OpenAI monetization policies.
