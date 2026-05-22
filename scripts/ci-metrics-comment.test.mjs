import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

import { buildCiMetricsComment } from './ci-metrics-comment.mjs'

test('ci metrics comment combines bundle coverage and support dependency sections', () => {
  const body = buildCiMetricsComment({
    bundleMarkdown: '### Bundle Size\n\nbundle ok\n',
    coverageMarkdown: '### Coverage\n\ncoverage ok\n',
    supportDependenciesMarkdown: '### Observability Support Dependency Boundary\n\nsupport ok\n',
    runUrl: 'https://github.com/example/repo/actions/runs/123',
    runNumber: '42',
  })

  assert.match(body, /<!-- ci-metrics-sticky -->/)
  assert.match(body, /### Bundle Size/)
  assert.match(body, /### Coverage/)
  assert.match(body, /### Observability Support Dependency Boundary/)
  assert.match(body, /run #42/)
})

test('ci metrics comment CLI writes combined markdown from report files', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'ci-metrics-comment-'))
  try {
    const bundle = path.join(dir, 'bundle.md')
    const coverage = path.join(dir, 'coverage.md')
    const support = path.join(dir, 'support.md')
    const out = path.join(dir, 'combined.md')
    await writeFile(bundle, '### Bundle Size\n\nbundle ok\n', 'utf8')
    await writeFile(coverage, '### Coverage\n\ncoverage ok\n', 'utf8')
    await writeFile(support, '### Observability Support Dependency Boundary\n\nsupport ok\n', 'utf8')

    execFileSync(process.execPath, [
      'scripts/ci-metrics-comment.mjs',
      '--bundle',
      bundle,
      '--coverage',
      coverage,
      '--support-dependencies',
      support,
      '--out',
      out,
      '--run-url',
      'https://github.com/example/repo/actions/runs/123',
      '--run-number',
      '42',
    ])

    const body = await readFile(out, 'utf8')
    assert.match(body, /bundle ok/)
    assert.match(body, /coverage ok/)
    assert.match(body, /support ok/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
