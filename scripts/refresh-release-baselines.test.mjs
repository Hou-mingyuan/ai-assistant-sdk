import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

import { BASELINE_REFRESH_STEPS } from './refresh-release-baselines.mjs'

test('release baseline refresh includes bundle size baseline update', () => {
  assert.deepEqual(BASELINE_REFRESH_STEPS, [
    {
      name: 'bundle size baseline',
      command: 'scripts/bundle-size-check.mjs',
      args: ['--update-baseline'],
    },
  ])
})

test('dependency footprint guide documents release baseline refresh script', async () => {
  const guide = await readFile('docs/guide/dependency-footprint.md', 'utf8')

  assert.match(guide, /refresh-release-baselines\.mjs/)
  assert.match(guide, /scripts\/\.bundle-size-baseline\.json/)
})
