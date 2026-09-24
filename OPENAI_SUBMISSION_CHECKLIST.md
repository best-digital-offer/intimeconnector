# OpenAI / ChatGPT Submission Checklist

> This checklist separates technical preparation from actual OpenAI approval.

## Production infrastructure

- [ ] Production HTTPS MCP URL configured
- [ ] Custom production domain configured
- [ ] Domain ownership verified
- [ ] OpenAI challenge endpoint configured and verified
- [ ] Production Vercel deployment verified
- [ ] Production Supabase project configured
- [ ] Database migration applied
- [ ] Production environment variables configured
- [ ] No development credentials or demo users in production

## Identity and legal

- [ ] Developer identity verified
- [ ] Business identity verified, if publishing as a company
- [ ] Privacy Policy published
- [ ] Terms of Service published
- [ ] Support page published
- [ ] Data retention and deletion policy published

## MCP / OAuth

- [ ] Official MCP SDK deployed
- [ ] Streamable HTTP endpoint responds in production
- [ ] OAuth authorization-server metadata available
- [ ] Protected-resource metadata available
- [ ] PKCE S256 flow tested
- [ ] Access-token validation tested
- [ ] Cross-account authorization tested
- [ ] Tool descriptions reviewed for least privilege
- [ ] Tool annotations reviewed against actual behavior
- [ ] MCP Inspector / equivalent official inspection completed

## Test package

- [ ] Exactly 5 positive submission tests prepared
- [ ] Exactly 3 negative submission tests prepared
- [ ] Production demo recording prepared
- [ ] Release notes prepared
- [ ] Reviewer credentials prepared outside source control

## Security

- [ ] SSRF private/link-local/metadata ranges blocked
- [ ] Redirect destinations revalidated
- [ ] Secrets encrypted at rest
- [ ] Secrets redacted from logs and MCP responses
- [ ] Rate limiting active
- [ ] Quota enforcement is server-side
- [ ] Idempotency enforced at database level
- [ ] CSP/CORS/HSTS/security headers reviewed
- [ ] Account deletion tested
- [ ] Billing webhook signature verification tested

## Approval status

**Do not mark this file as approved/published until OpenAI review has actually completed.**
