#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { parseDependencies } from './dependency-footprint-check.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const OBSERVABILITY_BOUNDARY = [
  {
    groupId: 'org.springdoc',
    artifactId: 'springdoc-openapi-starter-webmvc-ui',
    expectedStarter: 'optional',
    expectedSupport: 'direct',
  },
  {
    groupId: 'io.micrometer',
    artifactId: 'micrometer-tracing-bridge-otel',
    expectedStarter: 'absent',
    expectedSupport: 'optional',
  },
  {
    groupId: 'io.opentelemetry',
    artifactId: 'opentelemetry-exporter-otlp',
    expectedStarter: 'absent',
    expectedSupport: 'optional',
  },
  {
    groupId: 'net.logstash.logback',
    artifactId: 'logstash-logback-encoder',
    expectedStarter: 'absent',
    expectedSupport: 'optional',
  },
]

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2))
  const starterPom = readFileSync(path.join(root, 'ai-assistant-server/pom.xml'), 'utf8')
  const supportPom = readFileSync(
    path.join(root, 'ai-assistant-observability-support/pom.xml'),
    'utf8',
  )
  const report = buildSupportDependencyReport({
    starterDependencies: parseDependencies(starterPom),
    supportDependencies: parseDependencies(supportPom),
  })

  console.log(report.text)
  if (args.markdownOut) {
    writeFileSync(path.resolve(root, args.markdownOut), report.markdown, 'utf8')
    console.log(`Markdown report written to ${args.markdownOut}`)
  }
  if (report.findings.length > 0) {
    console.error('')
    for (const finding of report.findings) {
      console.error(`[${finding.severity.toUpperCase()}] ${finding.message}`)
    }
    process.exit(1)
  }
}

export function buildSupportDependencyReport({
  starterDependencies,
  supportDependencies,
  boundary = OBSERVABILITY_BOUNDARY,
}) {
  const rows = boundary.map((dep) => {
    const key = `${dep.groupId}:${dep.artifactId}`
    return {
      ...dep,
      key,
      starter: dependencyStatus(starterDependencies, key),
      support: dependencyStatus(supportDependencies, key),
    }
  })

  const findings = rows.flatMap((row) => {
    const rowFindings = []
    if (row.starter !== row.expectedStarter) {
      rowFindings.push({
        severity: 'high',
        message: `${row.artifactId} expected starter ${row.expectedStarter}, got ${row.starter}`,
      })
    }
    if (row.support !== row.expectedSupport) {
      rowFindings.push({
        severity: 'high',
        message: `${row.artifactId} expected support ${row.expectedSupport}, got ${row.support}`,
      })
    }
    return rowFindings
  })

  return {
    findings,
    text: renderReport(rows),
    markdown: renderMarkdown(rows),
  }
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--markdown-out') {
      out.markdownOut = argv[++i]
    }
  }
  return out
}

function dependencyStatus(dependencies, key) {
  const dep = dependencies.find((item) => `${item.groupId}:${item.artifactId}` === key)
  if (!dep) return 'absent'
  return dep.optional ? 'optional' : 'direct'
}

function renderReport(rows) {
  const lines = ['Observability support dependency boundary', '']
  for (const row of rows) {
    lines.push(`${row.artifactId} starter: ${row.starter} support: ${row.support}`)
  }
  return lines.join('\n')
}

function renderMarkdown(rows) {
  const lines = [
    '### Observability Support Dependency Boundary',
    '',
    '| Artifact | Starter | Support | Expected |',
    '| --- | --- | --- | --- |',
  ]
  for (const row of rows) {
    lines.push(
      `| \`${row.artifactId}\` | \`${row.starter}\` | \`${row.support}\` | \`starter ${row.expectedStarter} / support ${row.expectedSupport}\` |`,
    )
  }
  lines.push('')
  return lines.join('\n')
}
