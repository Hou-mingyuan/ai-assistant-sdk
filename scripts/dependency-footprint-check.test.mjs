import test from 'node:test'
import assert from 'node:assert/strict'

import {
  checkDependencyFootprint,
  parseDependencies,
} from './dependency-footprint-check.mjs'

test('parseDependencies reads groupId, artifactId, and optional flag', () => {
  const deps = parseDependencies(`
<dependencies>
  <dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-web</artifactId>
    <optional>true</optional>
  </dependency>
  <dependency>
    <groupId>org.apache.pdfbox</groupId>
    <artifactId>pdfbox</artifactId>
  </dependency>
</dependencies>
`)

  assert.deepEqual(deps, [
    {
      groupId: 'org.springframework.boot',
      artifactId: 'spring-boot-starter-web',
      optional: true,
    },
    {
      groupId: 'org.apache.pdfbox',
      artifactId: 'pdfbox',
      optional: false,
    },
  ])
})

test('checkDependencyFootprint reports optional dependency regressions', () => {
  const findings = checkDependencyFootprint([
    {
      groupId: 'org.springframework.boot',
      artifactId: 'spring-boot-starter-web',
      optional: false,
    },
  ])

  assert.deepEqual(findings.map((f) => f.rule), ['optional-regression'])
})

test('checkDependencyFootprint accepts documented required PDF and Office dependencies', () => {
  const findings = checkDependencyFootprint([
    { groupId: 'org.apache.pdfbox', artifactId: 'pdfbox', optional: false },
    { groupId: 'org.apache.poi', artifactId: 'poi', optional: false },
  ])

  assert.deepEqual(findings, [])
})
