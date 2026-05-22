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

test('observability support module depends on the starter it augments', async () => {
  const pom = await readFile('ai-assistant-observability-support/pom.xml', 'utf8')

  assert.match(pom, /<artifactId>ai-assistant-spring-boot-starter<\/artifactId>/)
})

test('standalone service keeps OpenAPI support by depending on the support artifact', async () => {
  const pom = await readFile('ai-assistant-service/pom.xml', 'utf8')

  assert.match(pom, /<artifactId>ai-assistant-observability-support<\/artifactId>/)
})
