import test from 'node:test'
import assert from 'node:assert/strict'

import {
  classifyDiffNames,
  parsePorcelainNames,
  summarizeLineEndingNoise,
} from './line-ending-noise-check.mjs'

test('classifyDiffNames separates content diffs from line-ending-only diffs', () => {
  const result = classifyDiffNames(
    ['src/a.ts', 'src/b.ts', 'src/c.ts'],
    ['src/b.ts', 'src/c.ts'],
  )

  assert.deepEqual(result.contentDiffs, ['src/b.ts', 'src/c.ts'])
  assert.deepEqual(result.lineEndingOnlyDiffs, ['src/a.ts'])
})

test('classifyDiffNames normalizes slashes, removes duplicates, and sorts', () => {
  const result = classifyDiffNames(
    ['src\\b.ts', 'src/a.ts', 'src/a.ts'],
    ['src\\b.ts'],
  )

  assert.deepEqual(result.contentDiffs, ['src/b.ts'])
  assert.deepEqual(result.lineEndingOnlyDiffs, ['src/a.ts'])
})

test('summarizeLineEndingNoise merges staged and unstaged summaries', () => {
  const result = summarizeLineEndingNoise({
    unstaged: ['ui/A.vue', 'ui/B.vue'],
    unstagedIgnoringEol: ['ui/B.vue'],
    staged: ['server/A.java', 'server/B.java'],
    stagedIgnoringEol: ['server/A.java'],
  })

  assert.deepEqual(result.contentDiffs, ['server/A.java', 'ui/B.vue'])
  assert.deepEqual(result.lineEndingOnlyDiffs, ['server/B.java', 'ui/A.vue'])
})

test('summarizeLineEndingNoise treats status-only tracked changes as line-ending noise', () => {
  const result = summarizeLineEndingNoise({
    status: ['src/no-patch.ts', 'src/content.ts'],
    unstaged: ['src/content.ts'],
    unstagedIgnoringEol: ['src/content.ts'],
  })

  assert.deepEqual(result.contentDiffs, ['src/content.ts'])
  assert.deepEqual(result.lineEndingOnlyDiffs, ['src/no-patch.ts'])
})

test('parsePorcelainNames ignores untracked files and handles rename targets', () => {
  const result = parsePorcelainNames(`
 M src/a.ts
M  src/b.ts
R  src/old.ts -> src/new.ts
?? src/untracked.ts
`)

  assert.deepEqual(result, ['src/a.ts', 'src/b.ts', 'src/new.ts'])
})
