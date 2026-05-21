# OpenAPI → TypeScript codegen

> Use the OpenAPI 3.1 specification served by the AI Assistant backend to
> generate type-safe TypeScript types for the frontend. Goal: stop
> hand-mirroring `ChatRequest`-style DTOs between Java and TypeScript.

## Why this exists

The external audit (2026-05-16) flagged the front-end / back-end API drift
risk: every time `ChatRequest.java` grows a field (e.g. `pageContext`,
`sessionId`), the corresponding `utils/api.ts` interface in
`ai-assistant-ui` has to be updated by hand. There is no compile-time
check, so a server-only change can ship to `main` without the front-end
client catching up.

The setup described here closes that gap by making **the Java code the
source of truth** and the TypeScript types regenerated from it.

## Quick start

### 1. Opt in to OpenAPI on the server side

`springdoc-openapi` is already on the classpath of `ai-assistant-server`
(declared as `optional` so it does not balloon the Starter for hosts that
don't want it). For the host that *does* want the spec exposed:

* The standalone service (`ai-assistant-service`) inherits the dependency
  automatically.
* A host that integrates the Starter directly needs to add the dependency
  as **non-optional**:

  ```xml
  <dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.8.17</version>
  </dependency>
  ```

Then enable the auto-configuration:

```yaml
ai-assistant:
  openapi:
    enabled: true
```

When the application starts, you should see:

```text
o.s.b.a.AutoConfigurationReportLoggingInitializer  : ...
  com.aiassistant.autoconfigure.AiAssistantOpenApiAutoConfiguration matched
```

And the spec is reachable at:

```text
http://localhost:8080/ai-assistant/v3/api-docs        # JSON
http://localhost:8080/ai-assistant/swagger-ui.html    # interactive UI
```

⚠️ **Both endpoints leak your full API shape**. Gate them behind your
normal auth (the standalone service already does, via `AdminAuthFilter`
and `AiAssistantAuthFilter`). For production, either disable the
auto-config or expose `/v3/api-docs` only to internal CI.

### 2. Generate the front-end types

With the service running and reachable, from the repository root:

```bash
node scripts/generate-frontend-types.mjs
```

This will:

1. `fetch()` the OpenAPI JSON from `http://localhost:8080/ai-assistant/v3/api-docs`
2. Cache it at `.openapi-tmp/openapi.json` (gitignored)
3. Spawn `npx --yes openapi-typescript@7 <spec> -o ai-assistant-ui/src/types/api-generated.d.ts`

Result: a generated `.d.ts` file you commit alongside the server change.

### 3. Consume the types from the front-end client

In `ai-assistant-ui/src/utils/api.ts` (or any caller):

```ts
import type { components, paths } from '@/types/api-generated';

export type ChatRequest = components['schemas']['ChatRequest'];
export type ChatResponse = components['schemas']['ChatResponse'];
// or operation-specific:
export type ChatEndpointBody = paths['/chat']['post']['requestBody']['content']['application/json'];
export type ChatEndpointResponse =
  paths['/chat']['post']['responses']['200']['content']['application/json'];
```

The current front-end client already follows this pattern for the chat
wire contract: `ChatPayload` and `ChatResult` in `utils/api.ts` are aliases
of generated `ChatRequest` / `ChatResponse` schemas. From that moment on,
any `ChatRequest.java` or `ChatResponse.java` change that hits the
front-end without a regenerated `api-generated.d.ts` fails the type checker.

## Tuning knobs

The generator script supports the following flags:

| Flag | Default | Notes |
|---|---|---|
| `--url` | `http://localhost:8080/ai-assistant/v3/api-docs` | OpenAPI JSON endpoint |
| `--spec-file` | none | Read a committed/static OpenAPI JSON snapshot instead of fetching a live endpoint |
| `--out` | `ai-assistant-ui/src/types/api-generated.d.ts` | Output `.d.ts` path |
| `--token` | none | Sent as `X-AI-Token` header if your spec is auth-gated |
| `--pin` | `openapi-typescript@7` | Pin the codegen version. Bump deliberately and commit a regenerated file in the same PR |
| `--dry-run` | off | Fetch + validate spec only; does not run codegen or compare output. |
| `--check` | off | Generate to `.openapi-tmp/api-generated.check.d.ts` and fail if it differs from `--out`. CI should use this. |

## Recommended PR rules

* Any server PR that touches `ChatRequest`, `MessageItem`, `ChatResponse`,
  `ChatRequest.MessageItem`, `PageContext`, or any other request/response
  DTO **must** include a regenerated `api-generated.d.ts`. The reviewer
  should see the spec diff and the TS diff in the same PR.
* If the codegen output is too noisy, narrow the spec with springdoc
  filters (`springdoc.group-configs[*]`) and re-pin the script's `--pin`.
* For breaking changes (field removed, type changed), the front-end PR
  must compile *before* the server PR is merged. Easy guardrail: pin the
  PR `ai-assistant-ui` to the spec hash from this run and require manual
  re-pinning.

## CI integration

CI 先使用一个不启动后端的轻量 guard：

```bash
node scripts/openapi-type-sync-guard.mjs --base origin/main --head HEAD
```

它检查当前已经纳入 `api-generated.d.ts` 的聊天契约文件：

- `AiAssistantController.java`
- `SseStreamController.java`
- `ChatRequest.java`
- `ChatResponse.java`

如果这些文件发生变化，但 `ai-assistant-ui/src/types/api-generated.d.ts` 没有同步变化，PR 会失败。这个 guard 不会运行 codegen，只负责防止最常见的“后端契约改了但前端类型快照没跟”。

`generate-frontend-types.mjs` 也支持静态 spec 输入：

```bash
node scripts/generate-frontend-types.mjs \
  --spec-file docs/api/openapi.json \
  --check
```

这为后续“提交 `docs/api/openapi.json` 快照 → CI 从快照生成并比对 `api-generated.d.ts`”铺好入口，不需要每次 CI 都启动后端服务。

当前 CI 的 repository job 已在 PR 上同时运行轻量变更 guard 和静态 spec 类型比对：

```bash
node scripts/openapi-type-sync-guard.mjs --base origin/<base> --head HEAD
node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check
```

更完整的 live-spec drift check 可以作为后续增强：

```yaml
# .github/workflows/ci.yml (snippet — add after backend test job)
- name: Check OpenAPI / TS drift
  if: github.event_name == 'pull_request'
  run: |
    cd ai-assistant-service && mvn -B -DskipTests spring-boot:run &
    SERVICE_PID=$!
    sleep 25  # crude wait; better: poll /actuator/health
    cd ..
    node scripts/generate-frontend-types.mjs --check
    kill $SERVICE_PID
```

`--check` never overwrites the committed `.d.ts`; it writes a temporary
generated file and compares it against `--out`. A mismatch fails CI and
means the PR must run `node scripts/generate-frontend-types.mjs`, review
the `.d.ts` diff, and commit it with the server contract change.

## Limitations and known gotchas

1. **SSE & WebSocket streams are not in the OpenAPI 3.1 schema.** The
   spec only describes the *initial* HTTP request; the streaming protocol
   (delta frames, `[DONE]`, ping events) lives in
   `docs/guide/chat.md` and must continue to be hand-mirrored. The
   composables `useSendStream` / `useChatOrchestrator` are the only TS
   consumers.
2. **Header tokens (`X-AI-Token`, `X-Admin-Token`, `X-Tenant-Id`) are
   already declared** as security schemes on the generated spec
   (`AiAssistantOpenApiAutoConfiguration`), so the codegen produces
   typed `headers` slots automatically.
3. **springdoc may emit `additionalProperties: true`** for free-form
   `Map<String, Object>` fields. If you see `Record<string, unknown>` in
   the generated types where you wanted a concrete shape, add a
   `@Schema(implementation = ...)` annotation on the server side rather
   than post-processing the `.d.ts`.
4. **The script intentionally does not add `openapi-typescript` to
   `ai-assistant-ui/package.json`** — that would re-introduce the
   "everyone has to install another build dep just to run the front-end"
   problem we already avoided for mermaid. `npx --yes` keeps the dep
   ephemeral.

## Roadmap

* **Now**: scaffolding is in place — the auto-config bean, the generator
  script, this doc, and the initial `ChatRequest` / `ChatResponse`
  front-end type aliases.
* **Next**: migrate the remaining hand-written response types in
  `utils/api.ts` one DTO at a time (`ModelsListResult`,
  `UrlPreviewResult`, prompt templates, export responses).
* **Later**: migrate the remaining REST helper types to `api-generated.d.ts`
  schemas as their server DTOs are added to the static snapshot.
* **Eventually**: regenerate the static snapshot at release time, so codegen
  stays aligned with the live backend without requiring a running service in
  pull-request CI.
