#!/usr/bin/env node

/**
 * dependency-footprint-check
 * --------------------------
 * Static policy guard for the starter dependency footprint. It keeps low-frequency
 * capabilities optional while documenting the current PDF/Office required deps.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const OPTIONAL_POLICY = new Set([
  'org.springframework.boot:spring-boot-starter-web',
  'org.springframework.boot:spring-boot-starter-webflux',
  'org.springframework.boot:spring-boot-starter-websocket',
  'org.springframework.boot:spring-boot-starter-actuator',
  'org.springframework.boot:spring-boot-starter-data-redis',
  'org.springframework.boot:spring-boot-starter-jdbc',
  'io.github.resilience4j:resilience4j-spring-boot3',
  'io.github.resilience4j:resilience4j-reactor',
  'io.micrometer:micrometer-tracing-bridge-otel',
  'io.opentelemetry:opentelemetry-exporter-otlp',
  'com.microsoft.playwright:playwright',
  'org.springdoc:springdoc-openapi-starter-webmvc-ui',
  'net.logstash.logback:logstash-logback-encoder',
])

const DOCUMENTED_REQUIRED = new Set([
  'org.apache.pdfbox:pdfbox',
  'org.apache.poi:poi',
  'org.apache.poi:poi-ooxml',
  'org.apache.poi:poi-scratchpad',
])

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli()
}

function runCli() {
  const pom = readFileSync(path.join(root, 'ai-assistant-server/pom.xml'), 'utf8')
  const findings = checkDependencyFootprint(parseDependencies(pom))
  if (findings.length === 0) {
    console.log('dependency-footprint-check: no issues found')
    return
  }
  console.error('dependency-footprint-check findings:\n')
  for (const finding of findings) {
    console.error(`[${finding.severity.toUpperCase()}] ${finding.rule}: ${finding.message}`)
  }
  process.exit(1)
}

export function parseDependencies(xml) {
  return [...xml.matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)]
    .map((match) => match[1])
    .map((block) => ({
      groupId: textOf(block, 'groupId'),
      artifactId: textOf(block, 'artifactId'),
      optional: textOf(block, 'optional') === 'true',
    }))
    .filter((dep) => dep.groupId && dep.artifactId)
}

export function checkDependencyFootprint(dependencies) {
  const findings = []
  for (const dep of dependencies) {
    const key = `${dep.groupId}:${dep.artifactId}`
    if (OPTIONAL_POLICY.has(key) && !dep.optional) {
      findings.push({
        severity: 'high',
        rule: 'optional-regression',
        message: `${key} must remain optional in ai-assistant-spring-boot-starter`,
      })
    }
    if (DOCUMENTED_REQUIRED.has(key) && dep.optional) {
      findings.push({
        severity: 'warn',
        rule: 'documented-required-made-optional',
        message: `${key} is currently documented as required; update dependency-footprint.md before changing it`,
      })
    }
  }
  return findings
}

function textOf(block, tag) {
  return block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1]?.trim() ?? ''
}
