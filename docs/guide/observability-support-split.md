# Observability Support Split

This page is a v2 preflight checklist for splitting observability-related
support from the default starter surface without surprising existing users.

## Candidate Scope

Move only low-frequency observability support first:

- OpenAPI metadata auto-configuration (`AiAssistantOpenApiAutoConfiguration`).
- Springdoc dependency guidance and Swagger UI exposure.
- Micrometer tracing / OpenTelemetry bridge dependencies.
- Logstash JSON logging resources and production logging docs.

Do not include PDF/Office export, RAG, connectors, or headless browser support
in this first artifact. Those capabilities have different runtime risks and
should stay on their own split plans.

## Compatibility Plan

The first migration step is now in place: `ai-assistant-observability-support`
owns the Spring Boot auto-configuration metadata for OpenAPI support. The
starter still contains the implementation class so existing source references
remain stable, but hosts must add the support artifact to auto-import it.

- `core-only` path keeps proving base chat wiring starts without OpenAPI,
  tracing, logstash, Redis, JDBC, or Playwright classes.
- `observability-support` path proves OpenAPI metadata registers only when
  explicitly enabled and support classes are present.
- Standalone service can keep depending on the full feature set so batteries
  included behavior remains unchanged.

## Maven Usage

Starter hosts that want generated OpenAPI metadata should add the support
artifact alongside the starter and keep `ai-assistant.openapi.enabled=true`
explicit:

```xml
<dependency>
  <groupId>com.aiassistant</groupId>
  <artifactId>ai-assistant-spring-boot-starter</artifactId>
  <version>${ai-assistant.version}</version>
</dependency>
<dependency>
  <groupId>com.aiassistant</groupId>
  <artifactId>ai-assistant-observability-support</artifactId>
  <version>${ai-assistant.version}</version>
</dependency>
```

## Future Module Shape

Candidate Maven artifact:

```text
com.aiassistant:ai-assistant-observability-support
```

Expected contents:

- Observability auto-configuration imports.
- Springdoc / tracing / logstash optional dependency bridge.
- Documentation for exposing `/v3/api-docs` safely.
- Tests proving host-provided `OpenAPI` beans still win.

## Done Criteria

- Core starter tests pass without observability support classes.
- Observability support tests pass with explicit opt-in.
- Standalone service package still includes OpenAPI and production logging
  behavior.
- Migration guide points users to the new artifact before any v2 removal.
