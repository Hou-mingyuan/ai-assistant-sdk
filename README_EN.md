# AI Assistant SDK

An embeddable assistant SDK for Java 21 / Spring Boot 3 and Vue 3. The repository ships a Spring Boot Starter, standalone service, Java client, Vue component, Web Component, Playground, and deployment templates.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Java](https://img.shields.io/badge/Java-21-orange.svg?logo=openjdk&logoColor=white)](https://openjdk.org/)
[![Spring Boot](https://img.shields.io/badge/Spring%20Boot-3.x-6DB33F.svg?logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![Vue](https://img.shields.io/badge/Vue-3.x-42B883.svg?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![CI](https://github.com/Hou-mingyuan/ai-assistant-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/Hou-mingyuan/ai-assistant-sdk/actions)

[简体中文](./README.md) · [Quick Start](docs/guide/quick-start.md) · [Capability Matrix](docs/CAPABILITY-MATRIX.md) · [API](docs/api/index.md) · [Deployment](DEPLOYMENT.md) · [Security](SECURITY.md)

<p align="center">
  <img src="docs/assets/demo.png" alt="AI Assistant SDK zero-key Playground running locally" width="760" />
</p>

> Version `1.0.1` is a release candidate, not a blanket production-readiness claim. REST/SSE, the Starter, standalone service, Java client, Vue package, and Web Component are the stable core. See the [capability matrix](docs/CAPABILITY-MATRIX.md) for the exact RAG, Agent, MCP, WebSocket, Admin, and Artifact boundaries.

## Choose an integration path

| Path | Best for | Entry point |
| --- | --- | --- |
| Spring Boot Starter | Reusing host authentication, tenancy, and business beans | The tracked `ai-assistant-demo` host or your existing Spring Boot app |
| Standalone service | Sharing one AI gateway or avoiding backend changes | `cp .env.example .env`, then `docker compose up -d --build` |

Both paths expose the same REST/SSE contract. Do not mix both backends in one frontend instance unless URLs, tokens, and CORS are aligned.

## Zero-key quick start

Prerequisites: Docker Engine/Desktop with Compose v2. Node.js 22 is needed for the automated smoke command. No account or external model key is required.

Supported hosts are Windows 11, Linux, and macOS, with at least 2 CPUs, 4 GB of available memory, and 6 GB of available disk space.

```bash
cp .env.example .env
docker compose up -d --build
node scripts/smoke-zero-key.mjs http://localhost:8080/ai-assistant
```

On Windows Command Prompt, use `copy .env.example .env` for the first command.

`.env.example` selects the deterministic `demo` provider. It exercises the real HTTP and SSE stack without contacting an external model:

- Provider health is `UP` with `mode=demo` and `mock=true`.
- `/chat` and `/stream` return an explicit Demo marker and `meta.provider=demo`.
- Demo output is only for zero-key demonstrations and tests; it is not presented as real AI output.

Endpoints:

```text
GET  http://localhost:8080/ai-assistant/health
POST http://localhost:8080/ai-assistant/chat
POST http://localhost:8080/ai-assistant/stream
GET  http://localhost:8080/actuator/health/liveness
```

Stop with `docker compose down`.

## Playground

Run the standalone service and Vue Playground together:

```powershell
# Windows
.\scripts\demo-standalone.ps1
```

```bash
# Linux / macOS
./scripts/demo-standalone.sh
```

Open `http://localhost:3000/`. The UI explicitly shows whether it is using Demo or a real provider and includes chat, Admin status, and form-fill examples. See the [demo guide](docs/DEMO.md).

## Starter integration

Prerequisites: JDK 21, Maven 3.9+, and Node.js 22. The tracked `ai-assistant-demo` module is a runnable host and defaults to Demo mode. The one-command script installs locked frontend dependencies, builds the real Web Component, packages the host, and starts it:

```powershell
# Windows
.\scripts\demo-starter.ps1
```

```bash
# Linux / macOS
bash scripts/demo-starter.sh
```

Equivalent manual commands:

```bash
npm --prefix ai-assistant-ui ci
npm --prefix ai-assistant-ui run build:publish
mvn -pl ai-assistant-demo -am -DskipTests package
java -jar ai-assistant-demo/target/ai-assistant-demo-1.0.1.jar
```

Open `http://localhost:8080/`, or run its real HTTP integration test:

```bash
mvn -pl ai-assistant-demo -am test
```

Add the Starter to your own Spring Boot 3 application:

```xml
<dependency>
  <groupId>com.aiassistant</groupId>
  <artifactId>ai-assistant-spring-boot-starter</artifactId>
  <version>1.0.1</version>
</dependency>
```

Zero-key development configuration:

```yaml
ai-assistant:
  provider: demo
  context-path: /ai-assistant
```

Real-provider configuration:

```yaml
ai-assistant:
  provider: openai
  base-url: ${AI_ASSISTANT_BASE_URL:https://api.openai.com/v1}
  api-key: ${AI_ASSISTANT_API_KEY}
  model: ${AI_ASSISTANT_MODEL:gpt-4o-mini}
  access-token: ${AI_ASSISTANT_ACCESS_TOKEN}
  allowed-origins: ${AI_ASSISTANT_ALLOWED_ORIGINS}
```

An unreachable provider, rejected credential, or upstream rate limit is returned as a diagnosable error. It never silently falls back to a Demo success response.

## Vue 3 and Web Component

Vue 3:

```bash
npm install @ai-assistant/vue
```

```ts
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

app.use(AiAssistant, {
  baseUrl: '/ai-assistant',
  accessToken: 'a short-lived token supplied by the host',
  tenantId: 'tenant-a',
  locale: 'en',
  theme: 'auto',
})
```

Place `<AiAssistant />` in a template, or set `autoMountToBody: true`.

Web Component:

```ts
import '@ai-assistant/vue/wc'
import '@ai-assistant/vue/dist/style.css'
```

```html
<ai-assistant
  base-url="/ai-assistant"
  tenant-id="tenant-a"
  locale="en"
></ai-assistant>
```

The Web Component uses the same backend, auth/tenant headers, and SSE contract. See the [frontend recipes](docs/guide/frontend-recipes.md).

## Stable scope

- Synchronous chat, translation, summarization, and SSE streaming.
- Structured errors, request IDs, timeouts, cancellation, and retry feedback.
- `X-AI-Token`, `X-Tenant-Id`, CORS, SSRF protection, upload limits, PII masking, injection warnings, and rate limiting.
- Java client, Vue plugin/composable, and `<ai-assistant>` Web Component.
- Multi-round Function Calling execution; business tool schemas, permissions, and side effects remain the host's responsibility.
- Health/liveness/readiness endpoints, runtime configuration summary, and optional metrics/tracing support.

Local in-memory RAG, caller-planned Agent execution, the MCP JSON-RPC subset, WebSocket, Admin, and Artifact preview are not v1 stable commitments. The repository does not ship Milvus/Pinecone/Qdrant implementations or an autonomous LLM ReAct planner.

## Security boundary

Demo defaults are for local zero-key use. Before exposing a real provider, set at least:

```text
AI_ASSISTANT_PROVIDER=<real provider>
AI_ASSISTANT_API_KEY=<injected by a secret store>
AI_ASSISTANT_ACCESS_TOKEN=<strong random value>
AI_ASSISTANT_ALLOWED_ORIGINS=https://your-frontend.example
AI_ASSISTANT_ALLOW_QUERY_TOKEN_AUTH=false
```

Admin, MCP, connector management, headless fetching, and RAG are disabled by default. `X-Tenant-Id` establishes request-scoped tenant context; it does not replace host login, RBAC, or resource ownership checks. Follow the [production checklist](docs/guide/production-checklist.md).

## Modules

| Module | Purpose |
| --- | --- |
| `ai-assistant-server` | Spring Boot Starter and core services |
| `ai-assistant-service` | Standalone Spring Boot service and Docker image |
| `ai-assistant-client` | Java client |
| `ai-assistant-ui` | `@ai-assistant/vue`, composables, and Web Component |
| `ai-assistant-vue-playground` | Demo, Admin, and form-fill Playground |
| `ai-assistant-demo` | Minimal Starter host and real HTTP integration test |
| `ai-assistant-observability-support` | Optional OpenAPI, tracing, and logging bridges |
| `e2e` | Playwright browser acceptance tests |
| `docs` | VitePress documentation site |

### Observability support

`ai-assistant-observability-support` is optional. OpenAPI can be added as a direct dependency; Tracing and JSON logging remain optional bridges and are not pulled in by the base Starter. See the [observability quick start](docs/guide/observability-support-quick-start.md) for Starter-only and support-enabled POMs.

## Verification

Recommended environment: Windows 11, Linux, or macOS; JDK 21; Maven 3.9+; Node.js 22 with npm; Docker Compose v2 for containers.

```bash
mvn test
mvn -f ai-assistant-client/pom.xml verify

cd ai-assistant-ui
npm ci
npm run lint
npm run format:check
npm test
npm run build:publish

cd ../ai-assistant-vue-playground
npm ci
npm test
npm run build

cd ../docs
npm ci
npm run build

cd ../e2e
npm ci
npx playwright install chromium
npm test
```

Documentation: [Quick Start](docs/guide/quick-start.md) · [Capability Matrix](docs/CAPABILITY-MATRIX.md) · [API](docs/api/index.md) · [Deployment](DEPLOYMENT.md) · [Security](SECURITY.md) · [Performance](PERFORMANCE.md) · [Troubleshooting](docs/guide/troubleshooting.md) · [CHANGELOG](CHANGELOG.md)

## License

[MIT](./LICENSE) © [Hou-mingyuan](https://github.com/Hou-mingyuan)
