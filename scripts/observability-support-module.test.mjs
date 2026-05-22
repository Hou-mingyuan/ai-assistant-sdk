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

test('observability support module depends on the starter it augments', async () => {
  const pom = await readFile('ai-assistant-observability-support/pom.xml', 'utf8')

  assert.match(pom, /<artifactId>ai-assistant-spring-boot-starter<\/artifactId>/)
})
