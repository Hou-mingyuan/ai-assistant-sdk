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
