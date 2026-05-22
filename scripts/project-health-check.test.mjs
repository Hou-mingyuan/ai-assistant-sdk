import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('release-check builds the frontend before reading bundle dist output', async () => {
  const source = await readFile('scripts/project-health-check.mjs', 'utf8')

  const buildStep = source.indexOf("name: 'frontend build (for release-check bundle baseline)'")
  const bundleStep = source.indexOf("name: 'bundle size watchdog'")

  assert.notEqual(buildStep, -1)
  assert.notEqual(bundleStep, -1)
  assert.ok(buildStep < bundleStep)
  assert.match(source, /if \(runReleaseCheck\)[\s\S]*?args: \['run', 'build'\]/)
})

test('release-check reports support dependency boundaries', async () => {
  const source = await readFile('scripts/project-health-check.mjs', 'utf8')

  assert.match(source, /const runSupportDependencyReport =/)
  assert.match(source, /name: 'support dependency boundary report'/)
  assert.match(source, /support-dependency-report\.mjs/)
})
