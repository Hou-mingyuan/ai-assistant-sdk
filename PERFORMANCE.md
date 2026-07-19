# Performance & Capacity

Repository-root summary for operators and integrators. Configuration details: [docs/guide/configuration.md](docs/guide/configuration.md). Security trade-offs: [SECURITY.md](SECURITY.md).

## Backend

| Area | Default behavior | Production note |
| --- | --- | --- |
| Chat payload | `chat-history-max-chars` truncates from the end | Lower for cost/latency; raise only with quota headroom |
| Total request size | `chat-max-total-chars` validates full package | Pair with gateway body limits |
| URL fetch | ~900 KB HTML cap, short TTL cache, SSRF DNS cache ~5 min | Disable with `url-fetch-enabled=false` if unused |
| Rate limit | Process-local per IP/token | Multi-replica: Redis (`RedisRateLimitFilter`) or edge gateway |
| Session / RAG / memory | In-memory defaults | Multi-replica: Redis session store + external vector DB (see [production-checklist](docs/guide/production-checklist.md)) |
| SSE | GZIP via `SseCompressionFilter` | Disable proxy buffering on `/stream` and `/sse` |
| LLM calls | Retries (`llm-max-retries`), timeout (`timeout-seconds`) | Tune to provider SLA; avoid unbounded waits |
| File upload | `multipart-max-file-size`, `file-max-extracted-chars` | Set per use case before enabling heavy export |

## Frontend (`@ai-assistant/vue`)

| Area | Default | Tuning |
| --- | --- | --- |
| Message list | Mount last **60** messages | Increase only on desktop; uses `content-visibility: auto` |
| Browser memory | **200** messages, ~**4M** chars total, **120k** input cap | Adjust via component options or disable limits for demos |
| Markdown | LRU cache; 8 core + 13 lazy highlight languages | Stream last bubble skips highlight for FPS |
| Layout | `resize` / visualViewport batched with rAF | Custom panel sizes re-clamped after drag |

## Multi-replica warnings

On startup, the service warns when Kubernetes-style hostnames are detected but these remain in-memory:

- `InMemoryVectorStore` (RAG)
- Default `SessionStore` / `ConversationMemory`
- Per-pod token quota (`quota × replicas`)

Replace with Redis + shared vector store before scaling horizontally. CI runs `multi-replica config lint` on PRs (strict) and on `main` (warn).

## Load testing suggestions

1. Baseline single instance with `rate-limit` at expected peak RPM.
2. Hit `/stream` with concurrent clients; watch CPU, heap, and upstream 429s.
3. Scale to N replicas only after session/RAG backends are shared.
4. Run `node scripts/smoke-standalone-service.mjs` after deploy (no model cost).
5. Optional k6 health smoke: `k6 run performance/k6-smoke.js` — see [PERFORMANCE_REPORT.md](PERFORMANCE_REPORT.md).

## Related

- [DEPLOYMENT.md](DEPLOYMENT.md) — deploy modes and runbook
- [README.md](README.md) — feature overview (性能与风险 section)
- [docs/guide/production-checklist.md](docs/guide/production-checklist.md) — limits and resource caps
