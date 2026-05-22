import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCommandRegistryReport } from './command-registry-report.mjs'

test('command registry report renders family sources for CI artifacts', () => {
  const report = buildCommandRegistryReport()

  assert.match(report, /### Command Registry Families/)
  assert.match(report, /\| app \| app \| Application commands \|/)
  assert.match(report, /\| workflow \| workflow \| Workflow commands \|/)
})
