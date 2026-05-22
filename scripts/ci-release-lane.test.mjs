import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('frontend CI uses release-check as the package export gate', async () => {
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8')

  assert.match(workflow, /Type check \+ Publish Build \+ Release Check/)
  assert.match(workflow, /node scripts\/project-health-check\.mjs --release-check-full/)
  assert.doesNotMatch(workflow, /Package exports smoke check/)
})

test('repository CI uses the fast release lane while frontend owns the full release lane', async () => {
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8')

  assert.match(workflow, /Run fast release checks/)
  assert.match(workflow, /node scripts\/project-health-check\.mjs --release-check-fast/)
  assert.match(workflow, /Type check \+ Publish Build \+ Release Check/)
  assert.match(workflow, /node scripts\/project-health-check\.mjs --release-check-full/)
})

test('frontend PR comment includes observability support dependency boundary', async () => {
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8')

  assert.match(workflow, /support-dependency-report\.mjs --markdown-out \.ci-reports\/support-dependencies\.md/)
  assert.match(workflow, /command-registry-report\.mjs --markdown-out \.ci-reports\/command-registry\.md/)
  assert.match(workflow, /node scripts\/ci-metrics-comment\.mjs/)
})

test('CI release lanes avoid duplicating checks owned by project-health-check', async () => {
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8')

  assert.doesNotMatch(workflow, /Run repo script tests/)
  assert.doesNotMatch(workflow, /Check static OpenAPI generated types/)
  assert.doesNotMatch(workflow, /Check dependency footprint policy/)
})
