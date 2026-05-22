# Observability Support Quick Start

`ai-assistant-observability-support` is the optional observability add-on for
hosts that want OpenAPI, tracing, or structured JSON logging without putting
those bridge dependencies back into the base starter.

## Add The Support Artifact

```xml
<dependency>
  <groupId>com.aiassistant</groupId>
  <artifactId>ai-assistant-observability-support</artifactId>
  <version>${ai-assistant.version}</version>
</dependency>
```

The artifact directly brings OpenAPI support and keeps tracing / logging bridge
coordinates optional. Add runtime configuration only for the capabilities you
actually use.

## OpenAPI

Enable OpenAPI when you want `/v3/api-docs` and Swagger UI wiring:

```properties
ai-assistant.openapi.enabled=true
```

Keep the endpoint behind the same authentication and network boundary as your
host application. The support artifact imports the OpenAPI auto-configuration;
the base starter no longer imports it by default.

`AiAssistantOpenApiAutoConfiguration` now lives in this support artifact. If you
previously imported that starter-internal class directly, depend on
`ai-assistant-observability-support`; the base starter no longer ships that
implementation.

### Starter only

When a host only depends on `ai-assistant-spring-boot-starter`, OpenAPI support is
absent even if `ai-assistant.openapi.enabled=true` is present. This keeps the
base starter free of springdoc implementation classes.

Starter-only POM:

```xml
<dependency>
  <groupId>com.aiassistant</groupId>
  <artifactId>ai-assistant-spring-boot-starter</artifactId>
  <version>${ai-assistant.version}</version>
</dependency>
```

### With support artifact

After adding `ai-assistant-observability-support`, the same property imports
`AiAssistantOpenApiAutoConfiguration` and exposes the springdoc endpoints:

Support-enabled POM:

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

```properties
ai-assistant.openapi.enabled=true
```

## Tracing

Tracing remains opt-in. Add and configure the exporter that matches your
platform, for example OTLP:

```properties
management.tracing.enabled=true
management.otlp.tracing.endpoint=https://otel-collector.example.com/v1/traces
```

The support artifact documents the Micrometer and OpenTelemetry bridge
coordinates, but it does not force tracing on for every host.

## JSON Logging

Structured JSON logging also remains opt-in. Use the support artifact together
with your chosen Logback profile or include:

```xml
<include resource="logback-ai-assistant-json.xml"/>
```

Confirm that sensitive fields are masked before enabling JSON logs in production.
If your platform already owns log shipping, prefer the platform default and keep
the Logstash encoder disabled.
