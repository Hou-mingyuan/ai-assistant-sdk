import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('observability support module owns OpenAPI support auto-configuration metadata', async () => {
  const imports = await readFile(
    'ai-assistant-observability-support/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports',
    'utf8',
  )

  assert.match(imports, /com\.aiassistant\.autoconfigure\.AiAssistantOpenApiAutoConfiguration/)
})

test('starter auto-configuration metadata no longer pulls OpenAPI support by default', async () => {
  const imports = await readFile(
    'ai-assistant-server/src/main/resources/META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports',
    'utf8',
  )

  assert.doesNotMatch(imports, /com\.aiassistant\.autoconfigure\.AiAssistantOpenApiAutoConfiguration/)
})

test('starter no longer owns tracing and structured logging bridge dependencies', async () => {
  const pom = await readFile('ai-assistant-server/pom.xml', 'utf8')

  assert.doesNotMatch(pom, /<artifactId>micrometer-tracing-bridge-otel<\/artifactId>/)
  assert.doesNotMatch(pom, /<artifactId>opentelemetry-exporter-otlp<\/artifactId>/)
  assert.doesNotMatch(pom, /<artifactId>logstash-logback-encoder<\/artifactId>/)
})

test('observability support module depends on the starter it augments', async () => {
  const pom = await readFile('ai-assistant-observability-support/pom.xml', 'utf8')

  assert.match(pom, /<artifactId>ai-assistant-spring-boot-starter<\/artifactId>/)
})

test('observability support module brings springdoc for OpenAPI support', async () => {
  const pom = await readFile('ai-assistant-observability-support/pom.xml', 'utf8')

  assert.match(pom, /<artifactId>springdoc-openapi-starter-webmvc-ui<\/artifactId>/)
})

test('observability support module documents optional tracing and structured logging bridges', async () => {
  const pom = await readFile('ai-assistant-observability-support/pom.xml', 'utf8')

  assert.match(pom, /<artifactId>micrometer-tracing-bridge-otel<\/artifactId>[\s\S]*?<optional>true<\/optional>/)
  assert.match(pom, /<artifactId>opentelemetry-exporter-otlp<\/artifactId>[\s\S]*?<optional>true<\/optional>/)
  assert.match(pom, /<artifactId>logstash-logback-encoder<\/artifactId>[\s\S]*?<optional>true<\/optional>/)
})

test('standalone service keeps OpenAPI support by depending on the support artifact', async () => {
  const pom = await readFile('ai-assistant-service/pom.xml', 'utf8')

  assert.match(pom, /<artifactId>ai-assistant-observability-support<\/artifactId>/)
})

test('standalone service relies on support artifact instead of direct springdoc wiring', async () => {
  const servicePom = await readFile('ai-assistant-service/pom.xml', 'utf8')
  const supportPom = await readFile('ai-assistant-observability-support/pom.xml', 'utf8')

  assert.doesNotMatch(servicePom, /<artifactId>springdoc-openapi-starter-webmvc-ui<\/artifactId>/)
  assert.match(servicePom, /<artifactId>ai-assistant-observability-support<\/artifactId>/)
  assert.match(supportPom, /<artifactId>springdoc-openapi-starter-webmvc-ui<\/artifactId>/)
})
