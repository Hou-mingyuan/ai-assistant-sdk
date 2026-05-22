import test from 'node:test'
import assert from 'node:assert/strict'

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
