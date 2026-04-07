# Changelog

## [Unreleased]

### Added
- **Vision / image understanding**: `ChatRequest.imageData` field + `buildRequestBody` multimodal content for vision models; frontend supports paste & drag images into chat
- **Drag & drop file upload**: visual overlay indicator, works in all modes (translate/summarize/chat); image files go to vision, others to file parsing
- **Prompt templates**: `promptTemplates` config with `{{var}}` placeholder support; template cards in empty state, variable input on click
- **TTS read-aloud**: `SpeechSynthesis` API, 🔊/⏹ toggle on assistant bubbles
- **Voice input**: `webkitSpeechRecognition` microphone button with real-time interim results
- **Response feedback**: 👍👎 toggle on assistant bubbles, `@feedback` event for host integration
- **Auto session title**: first reply extracts 30-char title shown in panel header
- **Multi-session tabs**: `useMultiSession` composable with localStorage persistence, tab bar UI, new/switch/delete sessions
- **Session fork**: right-click "Fork from here" creates new session with messages up to that point
- **Server-side session persistence**: `SessionStore` (in-memory, replaceable via `@ConditionalOnMissingBean`) + REST CRUD at `/sessions`
- **WebSocket channel**: optional `AiAssistantWebSocketHandler` at `/ws` (enable via `ai-assistant.websocket-enabled=true`); frontend `wsStreamChat` async generator
- **Per-action rate limiting**: `ai-assistant.rate-limit-per-action` map config (chat/stream/export/url-preview/file each get independent quotas)
- **Smart mode switch**: `smartModeSwitch` option auto-detects translate/summarize/chat from input content (CJK-Latin ratio, length heuristics, keyword hints)
- **Function Calling / Tool Use**: `ToolDefinition` interface + `ToolRegistry` auto-discovery; `LlmService` implements multi-round tool calling loop (up to 5 rounds); `ChatCompletionClient.completeRaw` for raw JSON response parsing; register tools as Spring Beans
- **Workflow orchestration**: `useWorkflow` composable runs multi-step workflows (translate→summarize→chat etc.); supports step chaining (`{{input}}`), per-step callbacks, progress tracking
- **Plugin system**: `usePluginRegistry` composable with `registerPlugin`/`unregisterPlugin`; plugins render as buttons in header/footer/context menu; `PluginContext` provides input, messages, setInput, addMessage
- **Streaming Markdown optimization**: `renderStreamIncremental` appends escaped text for small deltas (<80 chars) without full `marked.parse`, falling back to full parse when code blocks appear or delta is large

### Security
- **SSRF redirect bypass fix**: `UrlFetchService` now manually follows redirects with per-hop IP validation instead of `HttpClient.Redirect.NORMAL`
- CORS wildcard (`*`) now emits a startup WARN log
- `ExportRequest` now has `@NotBlank`/`@NotEmpty`/`@Size` validation annotations

### Fixed
- **Resource leak**: `FileParserService.readDocx`/`readDoc` now properly close both Document and Extractor objects
- **RateLimitFilter race condition**: replaced separate `isExceeded` + `increment` with atomic `tryAcquire`
- **Stream error swallowing**: `OpenAiCompatibleChatClient.completeStream` no longer converts errors to `"Error: ..."` text; errors propagate correctly
- `/chat` and `/file/*` endpoints now return HTTP 400 for validation errors and 503 for LLM failures (previously always 200)
- `/stream` input validation failure now returns HTTP 400 instead of 200 with error text in the stream
- Frontend `autoMountToBody` child app now properly unmounts when parent app unmounts
- Frontend `onUnmounted` now cleans up Fab drag event listeners
- `ChatRequest.text` now has `@Size(max=300000)` and `history` has `@Size(max=500)` to prevent oversized payloads before controller-level validation
- Frontend image paste/drop limited to 5MB; `WebSocketHandler` error messages properly JSON-escaped

### Performance
- **`UrlFetchService` pattern precompilation**: 7 inline `Pattern.compile` calls moved to `static final` constants (WIDTH_ATTR, HEIGHT_ATTR, ALT_ATTR, ID_CLASS_ATTR, CHARSET_ATTR)
- `AssistantExportService.wrapParagraphByMeasurement`: O(n²) → O(n log n) via binary search
- Export image prefetch: `parallelStream` replaced with bounded 4-thread `ExecutorService`
- `UrlFetchService.fetchCache`: `synchronized LinkedHashMap` → `ConcurrentHashMap` (lock-free)
- `ExportImageSniff.imagePixelSize`: reads dimensions via `ImageReader` without decoding full image pixels
- Frontend `useMessageMemoryCap`: `shift()` loop → single `slice()` operation

### Improved
- `AssistantExportService` registered as Spring Bean (replaceable via `@ConditionalOnMissingBean`)
- `UrlFetchService` accepts optional `HttpClient` injection for testability
- `LlmService` API key rotation with 30s cooldown on failed keys (sync + stream paths)
- `UsageStats` daily counters auto-evict entries older than 90 days
- `AiAssistantProperties.resolveModel` now supports `volcengine`/`doubao` provider with default model `doubao-1.5-pro-32k`
- Frontend `streamChat` now accepts optional `AbortSignal` for request cancellation
- `AssistantExportService.java` reformatted (removed ~90 redundant blank lines)
- Removed unused `RateEntry.isExceeded` method
- `RateEntry.count` simplified from `AtomicInteger` to `int` (already `synchronized`)
- `UsageStats.getSnapshot` uses `LinkedHashMap` for predictable JSON key order
- `RateLimitFilter` Javadoc warns about X-Forwarded-For spoofing when not behind a reverse proxy

### Infrastructure
- Added GitHub Actions CI workflow (`ci.yml`): frontend npm ci+lint+test+build, backend mvn verify
- Added GitHub Actions publish workflow (`publish.yml`): release-triggered npm publish + mvn deploy
- Vite build: added `terser` minification and `cssCodeSplit: false` for smaller bundle

### Refactored
- Extracted `SessionTabs.vue` from `AiAssistant.vue` (component split to reduce main file size)

- Vue `app.config.errorHandler` global error boundary: catches AI assistant component errors without crashing host app
- `createStreamTracker` utility: tracks TTFB, total duration, chunk count, average frame interval
- i18n: added Japanese (`ja`) and Korean (`ko`) locale support (30+ UI strings each)
- Version sync script: `node scripts/sync-version.js <version>` updates package.json + pom.xml simultaneously

- `.github/release.yml` auto-generates release notes from PR labels
- `Dockerfile` + `docker-compose.yml` for one-command demo: `AI_ASSISTANT_API_KEY=sk-xxx docker compose up`
- VitePress docs site scaffold (`docs/`) with guide, API reference, and changelog pages; CI builds docs

### Accessibility
- `SessionTabs`: added `role="tablist"`, `role="tab"`, `aria-selected` attributes

### Documentation
- Added JavaDoc to `ChatCompletionClient`, `LlmService`, `UrlFetchService`, `FileParserService`, `AssistantExportService`
- Added TSDoc to all exported frontend API functions (`postChat`, `streamChat`, `fetchModels`, `fetchUrlPreview`, `uploadFile`, `postServerExport`)

### Tests
- Added `smartModeDetect.spec.ts` (8 tests): keyword, CJK-Latin ratio, length, question detection
- Added `usePluginRegistry.spec.ts` (3 tests): register, replace, unregister
- Added `SessionStoreTest.java` (6 tests): CRUD, sort order, eviction at 50 cap
- Added `RateLimitFilterTest.java` (4 tests): under/over limit, OPTIONS passthrough, health bypass
- Added 20 frontend unit tests across 4 spec files:
  - `api.spec.ts` (6 tests): postChat, fetchModels, fetchUrlPreview
  - `pageContextDom.spec.ts` (3 tests): augmentMessageWithPageContext
  - `useSessionSearch.spec.ts` (3 tests): search and virtual rendering
  - `urlEmbed.spec.ts` (8 tests): URL extraction and image detection
