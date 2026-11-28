import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const spec = JSON.parse(readFileSync(resolve('docs/api/openapi.json'), 'utf8'))

test('OpenAPI snapshot excludes removed admin endpoints', () => {
  const adminPaths = Object.keys(spec.paths ?? {}).filter((p) => p.startsWith('/admin/'))
  assert.deepEqual(adminPaths, [])
})
