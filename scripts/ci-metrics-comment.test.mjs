import test from 'node:test'
import assert from 'node:assert/strict'

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
