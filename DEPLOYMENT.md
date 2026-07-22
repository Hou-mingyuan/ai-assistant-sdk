# AI Assistant SDK — Deployment & Operations

This document is the **repository-root** deployment entry. Detailed paths live in the VitePress site; use this for Docker smoke, production compose, and runbook links.

| Goal | Detailed guide |
| --- | --- |
| Choose Starter vs standalone service | [docs/guide/deployment-checklists.md](docs/guide/deployment-checklists.md) |
| Embed in existing Spring Boot app | [docs/guide/quick-start.md](docs/guide/quick-start.md) |
| Run official Docker image | [docs/guide/standalone-service.md](docs/guide/standalone-service.md) |
| Frontend → remote backend | [docs/guide/frontend-standalone.md](docs/guide/frontend-standalone.md) |
| Kubernetes / Helm | [docs/guide/kubernetes.md](docs/guide/kubernetes.md) |
| Pre-launch security | [docs/guide/production-checklist.md](docs/guide/production-checklist.md) · [SECURITY.md](SECURITY.md) |

## 1. Deployment Modes

| Mode | When to use |
| --- | --- |
| **Spring Boot Starter** | Reuse host auth, tenant DB, same JVM as business APIs |
| **Standalone Docker service** | Multiple apps share one AI gateway; no Java backend changes |
| **Helm on Kubernetes** | Production with HPA, Ingress, Secrets |

Do **not** mix Starter and standalone URLs in one frontend without aligning `baseUrl`, tokens, and CORS.

## 2. Docker Compose (local / demo)

### Prerequisites

- Docker Desktop or Docker Engine + Compose v2
- Node.js 22 when running the repository smoke scripts
- No provider key is required for the explicit deterministic Demo mode; a valid key is required only for a real provider

### Quick start

```bash
copy .env.example .env
# .env.example starts in explicit Demo mode. For a real provider, set provider, base URL, model and key.
docker compose up -d --build
```

Default endpoints:

```text
http://localhost:8080/ai-assistant/health
http://localhost:8080/ai-assistant/chat
http://localhost:8080/ai-assistant/stream
http://localhost:8080/actuator/health
```

### Published image (no local build)

```bash
docker compose -f docker-compose.ghcr.yml up -d
```

### Production compose overlay

```bash
docker compose -f docker-compose.prod.yml up -d
```

Set explicit `AI_ASSISTANT_ALLOWED_ORIGINS`, strong `AI_ASSISTANT_ACCESS_TOKEN`, and disable admin/MCP/connector management unless protected. See [`.env.example`](.env.example).

## 3. Demo / portfolio flow

Full walkthrough: **[docs/DEMO.md](docs/DEMO.md)** (Chinese, portfolio-oriented).

### Zero-key smoke (no LLM billing)

The service starts with the explicit deterministic `demo` provider when `AI_ASSISTANT_API_KEY` is empty. Both blocking chat and SSE are exercised through the real application stack; the response is visibly marked as Demo/mock output.

```bash
cp .env.example .env
docker compose up -d --build
node scripts/smoke-zero-key.mjs http://localhost:8080/ai-assistant
```

`POST /chat` and `POST /stream` return HTTP 200 in Demo mode. Health/config responses include Demo/mock metadata, and chat responses include `meta.provider=demo`, so this path cannot be mistaken for a live model.

See [docs/DEMO.md](./docs/DEMO.md#单独运行零密钥-smoke) for the eight-check matrix aligned with `scripts/smoke-zero-key.mjs`.

### One-click Playground demo (`docker-compose.demo.yml`)

```powershell
.\scripts\demo-standalone.ps1
```

```bash
./scripts/demo-standalone.sh
```

Opens **http://localhost:3000/** (backend proxied at `/ai-assistant`). Runs `scripts/smoke-demo-compose.mjs` after `up`.

### Real-provider streaming demo (API key required)

1. Set `AI_ASSISTANT_API_KEY` in `.env` and restart compose.
2. Open the Playground floating assistant → ask a question → confirm SSE on `/stream`.
3. Optional: RAG (`AI_ASSISTANT_RAG_ENABLED=true`) and sample doc ingest via Admin API (dev only).

### Auth-enabled smoke

```bash
node scripts/smoke-standalone-service.mjs http://localhost:8080/ai-assistant change-me
```

Replace `change-me` with your configured `AI_ASSISTANT_ACCESS_TOKEN` when auth is enabled.

## 4. Operations runbook

### Health checks

```bash
curl -sf http://localhost:8080/ai-assistant/health
curl -sf http://localhost:8080/actuator/health
node scripts/project-health-check.mjs --docs   # documentation site
```

### Common issues

| Symptom | Action |
| --- | --- |
| `api-key must be configured` | Set `AI_ASSISTANT_API_KEY` in `.env` or `application.yml` |
| 401 Unauthorized | Send `X-AI-Token`; disable query-token auth in prod |
| CORS errors | Set `AI_ASSISTANT_ALLOWED_ORIGINS` to exact browser origin |
| SSE stalls behind nginx | Disable proxy buffering on stream paths |
| Rate limit inconsistent across pods | Enable Redis + `AI_ASSISTANT_RATE_LIMIT_DISTRIBUTED` or gateway quotas |

Full FAQ: [docs/guide/troubleshooting.md](docs/guide/troubleshooting.md).

### Upgrade

```bash
git pull
# Pin AI_ASSISTANT_IMAGE_TAG in .env for prod — avoid floating latest
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Review [CHANGELOG](CHANGELOG.md) and [production-checklist](docs/guide/production-checklist.md) for new env vars.

### Logs & observability

- Structured JSON logs: `SPRING_PROFILES_ACTIVE=json`
- Optional OpenAPI / tracing: [docs/guide/observability-support-quick-start.md](docs/guide/observability-support-quick-start.md)

## 5. CI & release

- **CI** (`.github/workflows/ci.yml`): lint, tests, OWASP, npm audit, Trivy, multi-replica config lint on PRs.
- **Publish** (`publish.yml`): npm + GitHub Packages on release tags.

## Related docs

- [README.md](README.md) — overview and quick start
- [PERFORMANCE.md](PERFORMANCE.md) — tuning and capacity notes
- [SECURITY.md](SECURITY.md) — vulnerability reporting
