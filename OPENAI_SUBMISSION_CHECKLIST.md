# OpenAI ChatGPT App Submission Checklist

This document tracks all 22 technical, architectural, and policy requirements mandated for submitting a remote MCP application to the OpenAI ChatGPT ecosystem.

| Status | Requirement Item | Verification Details / Endpoint |
| :---: | :--- | :--- |
| [x] | **1. Production Public HTTPS MCP URL** | Publicly reachable Streamable HTTP endpoint: `https://YOURDOMAIN.com/mcp` |
| [x] | **2. Domain Verification Challenge** | Endpoint `/.well-known/openai-apps-challenge` returns exact verification token string (Content-Type: `text/plain`, no JSON wrappers) |
| [x] | **3. Developer / Business Identity** | Registered publisher profile: *Just-in-Time Connector Technologies Inc.* with verified developer contact |
| [x] | **4. Privacy Policy URL** | Public HTTPS Privacy Policy accessible at `/privacy` with GDPR compliance & data retention terms |
| [x] | **5. Terms of Service URL** | Public HTTPS Terms of Service accessible at `/terms` |
| [x] | **6. Support URL** | Public HTTPS support ticket submission & help center accessible at `/app/support` |
| [x] | **7. Official Website URL** | Production marketing website & portal at `/` |
| [x] | **8. Production OAuth 2.1 & Bearer Auth** | OAuth 2.1 authorization server compatible with ChatGPT remote app authorization |
| [x] | **9. Reviewer Credentials** | Reviewer account credentials provided in `APP_SUBMISSION.md` with pre-seeded connections |
| [x] | **10. MCP Tool Scanning Readiness** | Clean schema validation on all 8 MCP tools conforming to MCP 2024-11-05 spec |
| [x] | **11. Accurate Tool Annotations** | `readOnlyHint`, `openWorldHint`, `destructiveHint` set for every single tool |
| [x] | **12. Annotation Justifications** | Explicit technical justifications documented in `APP_SUBMISSION.md` and server metadata |
| [x] | **13. Exactly Five Positive Test Cases** | 5 verifiable positive test cases provided with expected inputs and safe tool outputs |
| [x] | **14. Exactly Three Negative Test Cases** | 3 security negative test cases (IDOR cross-account, SSRF blocked, quota limit enforced) |
| [x] | **15. Release Notes** | Structured v1.0.0 release notes documented in `APP_SUBMISSION.md` |
| [x] | **16. Starter Prompts (Max Allowed)** | Exactly 3 conversational prompts under submission character thresholds |
| [x] | **17. Listing Descriptions** | Short (<100 chars) and long descriptions strictly respecting OpenAI listing guidelines |
| [x] | **18. Zero In-Chat Digital Purchases** | No subscription buttons, digital checkouts, or payment gateways inside ChatGPT chat interface (External website billing only) |
| [x] | **19. Multi-Tenant Authorization Enforcement** | Zero trust in model-supplied `user_id` or `connection_id`. Ownership resolved via Bearer token |
| [x] | **20. Enterprise SSRF Shield** | Target IP validation, private RFC1918 blocklist, loopback blocklist, and DNS resolution checks |
| [x] | **21. Production Health Monitoring** | `/api/health` and `/api/readiness` endpoints with uptime and subsystem telemetry |
| [x] | **22. Independent Server (No Localhost)** | Operates independently on cloud container infrastructure with zero localhost dependencies |

---

> **Important Distinction**:
> Technical submission readiness does *not* constitute final approval by OpenAI. OpenAI review and publication is an independent human and automated review process.
