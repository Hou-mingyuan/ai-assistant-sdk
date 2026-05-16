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

You **delete** the hand-written `ChatRequest` interface in `utils/api.ts`
and re-export from the generated file. From that moment on, any
`ChatRequest.java` change that hits the front-end without a regenerated
`api-generated.d.ts` fails the type checker.

## Tuning knobs

The generator script supports the following flags:

| Flag | Default | Notes |
|---|---|---|
| `--url` | `http://localhost:8080/ai-assistant/v3/api-docs` | OpenAPI JSON endpoint |
| `--out` | `ai-assistant-ui/src/types/api-generated.d.ts` | Output `.d.ts` path |
| `--token` | none | Sent as `X-AI-Token` header if your spec is auth-gated |
| `--pin` | `openapi-typescript@7` | Pin the codegen version. Bump deliberately and commit a regenerated file in the same PR |
| `--dry-run` | off | Fetch + validate spec, but do NOT write the `.d.ts`. CI uses this. |

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

The cheapest guard is a drift check in CI:

```yaml
# .github/workflows/ci.yml (snippet — add after backend test job)
- name: Check OpenAPI / TS drift
  if: github.event_name == 'pull_request'
  run: |
    cd ai-assistant-service && mvn -B -DskipTests spring-boot:run &
    SERVICE_PID=$!
    sleep 25  # crude wait; better: poll /actuator/health
    cd ..
    node scripts/generate-frontend-types.mjs --dry-run
    kill $SERVICE_PID
```

A stricter version regenerates the file and `git diff --exit-code`-checks
it; that's the configuration we recommend once the workflow is stable.

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

* **Now** (this commit, Phase 6 of the audit): scaffolding in place — the
  auto-config bean, the generator script, this doc.
* **Next**: hand-migrate `utils/api.ts` to the generated types, one DTO
  at a time, starting with `ChatRequest` and `ChatResponse`. Each
  migration is its own commit.
* **Later**: wire the `--dry-run` drift check into CI as a required check.
* **Eventually**: replace the standalone-service spec endpoint with a
  static-spec snapshot (`docs/api/openapi.json`) regenerated at release
  time, so codegen no longer requires a running backend.
