import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { buildSupportDependencyReport } from './support-dependency-report.mjs'
import { parseDependencies } from './dependency-footprint-check.mjs'

test('observability support dependency report shows bridges moved out of starter', async () => {
  const starterPom = await readFile('ai-assistant-server/pom.xml', 'utf8')
  const supportPom = await readFile('ai-assistant-observability-support/pom.xml', 'utf8')

  const report = buildSupportDependencyReport({
    starterDependencies: parseDependencies(starterPom),
    supportDependencies: parseDependencies(supportPom),
  })

  assert.equal(report.findings.length, 0)
  assert.match(report.text, /micrometer-tracing-bridge-otel\s+starter: absent\s+support: optional/)
  assert.match(report.text, /opentelemetry-exporter-otlp\s+starter: absent\s+support: optional/)
  assert.match(report.text, /logstash-logback-encoder\s+starter: absent\s+support: optional/)
})
