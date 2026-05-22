import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('observability support quick start documents each opt-in path', async () => {
  const doc = await readFile('docs/guide/observability-support-quick-start.md', 'utf8')

  assert.match(doc, /OpenAPI/)
  assert.match(doc, /Tracing/)
  assert.match(doc, /JSON logging/)
  assert.match(doc, /ai-assistant-observability-support/)
})

test('observability support quick start is linked from the guide sidebar', async () => {
  const config = await readFile('docs/.vitepress/config.ts', 'utf8')

  assert.match(config, /Observability Support Quick Start/)
  assert.match(config, /\/guide\/observability-support-quick-start/)
})

test('observability split doc records OpenAPI implementation migration status', async () => {
  const doc = await readFile('docs/guide/observability-support-split.md', 'utf8')

  assert.match(doc, /OpenAPI implementation migration status/)
  assert.match(doc, /`AiAssistantOpenApiAutoConfiguration` now lives/)
  assert.match(doc, /compatibility shim/)
})

test('public docs point OpenAPI auto-configuration users to the support artifact', async () => {
  const quickStart = await readFile('docs/guide/observability-support-quick-start.md', 'utf8')
  const readme = await readFile('README.md', 'utf8')

  assert.match(quickStart, /AiAssistantOpenApiAutoConfiguration/)
  assert.match(quickStart, /base starter no longer ships that\s+implementation/)
  assert.match(quickStart, /Starter only/)
  assert.match(quickStart, /With support artifact/)
  assert.match(quickStart, /Starter-only POM/)
  assert.match(quickStart, /Support-enabled POM/)
  assert.match(readme, /Observability support/)
  assert.match(readme, /ai-assistant-observability-support/)
})
