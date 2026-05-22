import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('frontend CI uses release-check as the package export gate', async () => {
  const workflow = await readFile('.github/workflows/ci.yml', 'utf8')

  assert.match(workflow, /Type check \+ Publish Build \+ Release Check/)
  assert.match(workflow, /node scripts\/project-health-check\.mjs --release-check/)
  assert.doesNotMatch(workflow, /Package exports smoke check/)
})
