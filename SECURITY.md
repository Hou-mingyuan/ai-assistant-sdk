# Security Policy

## Supported Versions

**AI Assistant SDK** is maintained on the `main` branch and the latest tagged release. Security fixes land on `main` first.

| Version | Supported |
| --- | --- |
| Latest release / `main` | Yes |
| Older tags | Best effort |

## Reporting a Vulnerability

Do **not** open a public issue with exploit details, API keys, access tokens, or tenant data samples.

Preferred channels:

1. GitHub **Private vulnerability reporting** or **Security Advisory** for [Hou-mingyuan/ai-assistant-sdk](https://github.com/Hou-mingyuan/ai-assistant-sdk), if enabled.
2. Otherwise, open a public issue asking for a private contact channel **without** technical exploit details.

Include affected version/commit, reproduction steps, impact, and redacted logs.

## Scope

### In scope

- Authentication bypass around `X-AI-Token` / admin tokens.
- SSRF or unsafe outbound fetch via `UrlFetchService` / link preview.
- PII leakage in logs, exports, or session stores when masking is enabled.
- Prompt injection handling gaps that allow privilege escalation across tenants.
- RAG / connector / MCP endpoints exposed without intended auth boundaries.
- Dependency issues reachable through shipped defaults or CI gates.

### Out of scope

- Compromise of your own LLM provider API keys outside this SDK.
- Vulnerabilities in third-party model APIs (OpenAI, DeepSeek, etc.).
- Misconfiguration of `allowed-origins: *` or missing `access-token` in production (documented as operator responsibility).
- Client-side XSS in host applications unrelated to SDK Markdown rendering.

## Secret Handling

- Never commit `.env`, real `api-key`, `access-token`, `admin-token`, or `runtime-config-secret-key`.
- Use [`.env.example`](.env.example) as the template; inject secrets via environment variables or Kubernetes Secrets.
- Production baseline (see also [docs/guide/production-checklist.md](docs/guide/production-checklist.md)):

| Setting | Requirement |
| --- | --- |
| `AI_ASSISTANT_API_KEY` | Real provider key, not in frontend bundles |
| `AI_ASSISTANT_ACCESS_TOKEN` | Strong random value; clients send `X-AI-Token` |
| `AI_ASSISTANT_ALLOWED_ORIGINS` | Explicit origins; **not** `*` |
| `AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH` | `false` in production |
| `AI_ASSISTANT_URL_FETCH_SSRF_PROTECTION` | `true` unless tightly controlled |
| Admin / MCP / connector management | Disabled unless behind trusted network + extra auth |

## Built-in Protections

- **PII masking** (`pii-masking-enabled`, default on): phone, ID, bank card, email, IP patterns.
- **Prompt injection detection** (log/audit; does not block by default).
- **SSRF checks** on URL fetch with size/time limits and optional headless fetch off by default.
- **Rate limiting** per IP/token (process-local; use Redis or gateway for multi-replica).
- **Markdown output** sanitized in the Vue UI (DOMPurify).

## Dependency & Image Audit

CI (`.github/workflows/ci.yml`) runs OWASP Dependency-Check, `npm audit`, and Trivy on release paths. Locally:

```bash
cd ai-assistant-server && mvn org.owasp:dependency-check-maven:check
cd ai-assistant-ui && npm audit
```

## Disclosure

Maintainers aim to acknowledge valid reports within **7 days** and coordinate remediation before public disclosure (best effort for this community project).

## Related Docs

- [DEPLOYMENT.md](DEPLOYMENT.md) — Docker / Helm deployment and runbook
- [docs/guide/production-checklist.md](docs/guide/production-checklist.md) — pre-launch checklist
- [docs/guide/troubleshooting.md](docs/guide/troubleshooting.md) — 401 / CORS / model errors
