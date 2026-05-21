import test from 'node:test'
import assert from 'node:assert/strict'

import { groupBundleFiles, summarizeGroups } from './bundle-composition-report.mjs'

test('groupBundleFiles classifies main, wc, style, worker, secondary, and chunks', () => {
  const grouped = groupBundleFiles({
    'ai-assistant.mjs': { size: 100, gzip: 50 },
    'ai-assistant-wc.umd.cjs': { size: 90, gzip: 45 },
    'style.css': { size: 80, gzip: 40 },
    'assets/markdownHljs.worker.js': { size: 70, gzip: 35 },
    'admin.mjs': { size: 60, gzip: 30 },
    'PromptTemplateDialog-abc.js': { size: 50, gzip: 25 },
  })

  assert.equal(grouped.main.files.length, 1)
  assert.equal(grouped.webComponent.files.length, 1)
  assert.equal(grouped.styles.files.length, 1)
  assert.equal(grouped.workers.files.length, 1)
  assert.equal(grouped.secondaryEntries.files.length, 1)
  assert.equal(grouped.featureChunks.files.length, 1)
})

test('summarizeGroups sorts groups by gzip size descending', () => {
  const summary = summarizeGroups({
    a: { files: ['a'], size: 100, gzip: 20 },
    b: { files: ['b'], size: 100, gzip: 40 },
  })

  assert.deepEqual(
    summary.map((row) => row.name),
    ['b', 'a'],
  )
})
