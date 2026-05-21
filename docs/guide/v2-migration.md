# v2 Migration Guide

This page tracks planned breaking changes for the next major version. It is safe
to follow these recommendations in v1.x; the old imports still work until the
major release removes them.

## Frontend Entry Points

Prefer narrow secondary entries for new integrations:

| Current v1 import | v2-ready import | Notes |
| --- | --- | --- |
| `@ai-assistant/vue` for core plugin use | `@ai-assistant/vue/core` | Use for the Vue plugin, `AiAssistant`, `AiAssistantOptions`, and `useAiAssistant`. |
| `@ai-assistant/vue` Admin helpers | `@ai-assistant/vue/admin` | Keeps admin-only helpers out of the default public surface. |
| `@ai-assistant/vue` MCP helpers | `@ai-assistant/vue/mcp` | Keeps MCP client / stream / auto-plugin helpers grouped together. |
| `@ai-assistant/vue` form fill helpers | `@ai-assistant/vue/form-fill` | Keeps parser / matcher / filler APIs in the form-fill feature entry. |
| `@ai-assistant/vue` screenshot helpers | `@ai-assistant/vue/screenshot` | Keeps screenshot and screen-capture helpers isolated. |
| `@ai-assistant/vue/wc` | `@ai-assistant/vue/wc` | Web Component entry remains unchanged. |

## Planned Removal Order

1. Mark advanced main-entry exports as deprecated in v1.x.
2. Move all docs and examples to secondary entries.
3. Keep `@ai-assistant/vue` focused on the default plugin, stable API helpers, and compatibility re-exports.
4. Remove advanced compatibility re-exports only in v2.

## Backend / Starter Direction

The Spring Boot starter keeps the current dependency behavior in v1.x. Future
v2 work may split low-frequency capabilities into feature artifacts:

- Observability / OpenAPI / structured logging support.
- Headless fetch support.
- Connector support.
- RAG support.
- Export / file support after a clear compatibility plan exists.

Before any artifact is split, the project should keep both verification paths:

- **core-only**: base chat wiring starts without low-frequency optional deps.
- **full feature set**: standalone service still brings batteries-included behavior.

## OpenAPI Type Generation

Use the committed static snapshot for deterministic frontend type checks:

```bash
node scripts/generate-frontend-types.mjs --spec-file docs/api/openapi.json --check
```

When server DTOs change, update `docs/api/openapi.json`, regenerate
`ai-assistant-ui/src/types/api-generated.d.ts`, and commit both files together.
