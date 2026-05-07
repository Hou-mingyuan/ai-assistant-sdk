# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Root aggregator `pom.xml` for unified multi-module Maven builds
- `LICENSE` file (MIT)
- `ApiKeyRotator` — extracted thread-safe API key rotation with per-key cooldown
- `LlmResponseCache` — extracted LLM response cache, now backed by Caffeine with GZip compression
- `LlmRequestBuilder` — extracted prompt resolution and OpenAI request body construction
- `ConnectionDiagnostics.vue` — extracted diagnostics panel component
- `ChatInputArea.vue` — extracted chat input area component
- Unit tests for `ApiKeyRotator` and `LlmResponseCache`
- OpenAPI `@Operation` / `@ApiResponse` annotations on all core API endpoints
- OWASP Dependency-Check + npm audit + Trivy security scans in CI (PR stage)
- WebSocket client heartbeat timeout detection (45s)
- Configurable API version prefix (`ai-assistant.api-version` property)
- Lazy-loaded highlight.js language support for less common languages

### Changed
- **Tech stack upgrade**: Java 17→21, Spring Boot 3.4.12→3.5.0, Vite 5→6, Vitest 2→3, TypeScript 5.4→5.8, Node 20→22
- Virtual Threads enabled via `spring.threads.virtual.enabled=true`
- `OpenAiEmbeddingProvider` — added 60s timeout + empty input guard
- `BatchController` — per-item text length limit (300,000 chars)
- `LlmService` — safe `ArrayNode` type checking before cast (2 locations)
- `TokenUsageTracker` — reservation release cannot go negative
- `UrlFetchService` — `CompletableFuture` uses dedicated virtual thread executor
- `AiAssistant.vue` `send()` — `baseUrl` guard prevents calls without endpoint
- `PersonalizeDialog.vue` — unique `titleId` per instance (multi-widget safe)
- `web-component.ts` — attribute removal resets option to default
- Scroll listener cleanup on `onUnmounted` (prevents memory leak)
- Clipboard copy with `.catch()` error handling
- `ensureLanguage()` failure recovery (clears loading flag for retry)
- `runPlugin()` now async with try-catch (prevents unhandled rejection)
- `ChatInputArea` button titles internationalized (4 languages)
- `formatRelativeTime` uses `Intl.RelativeTimeFormat` for locale-aware display
- Docs updated: Java 17→21 references in troubleshooting, README, guide
- **LlmService** refactored from 1161 to 888 lines using Facade pattern (single-responsibility extraction)
- **AiAssistantProperties** reduced from 888 to ~450 lines using Lombok `@Getter/@Setter`
- Prompt injection detection expanded from 5 to 26 patterns (role override, identity manipulation, system prompt extraction, jailbreak techniques, delimiter attacks, constraint removal, encoding tricks)
- `marked` global side-effect replaced with isolated `Marked` instances (no module-level mutation)
- i18n messages now use `satisfies Record<Locale, I18nMessages>` for compile-time type safety
- Dockerfile refactored to use root POM for unified multi-module build
- highlight.js split into core (8 languages, always loaded) + extended (13 languages, lazy-loaded on demand)
- ESLint `@typescript-eslint/no-explicit-any` elevated from `warn` to `error`
- JaCoCo coverage thresholds raised (instruction: 0.40→0.70, branch: 0.30→0.60)

### Dependencies
- Added: Lombok (optional), Caffeine (cache)
