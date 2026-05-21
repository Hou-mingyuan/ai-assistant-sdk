import test from 'node:test'
import assert from 'node:assert/strict'

import { normalizeSpecText, parseArgs } from './refresh-openapi-snapshot.mjs'

test('parseArgs accepts live URL, output paths, and codegen pin', () => {
  const args = parseArgs([
    'node',
    'scripts/refresh-openapi-snapshot.mjs',
    '--url',
    'http://localhost:8080/v3/api-docs',
    '--out',
    'docs/api/openapi.json',
    '--types-out',
    'ai-assistant-ui/src/types/api-generated.d.ts',
    '--pin',
    'openapi-typescript@7.0.0',
  ])

  assert.equal(args.url, 'http://localhost:8080/v3/api-docs')
  assert.equal(args.out, 'docs/api/openapi.json')
  assert.equal(args.typesOut, 'ai-assistant-ui/src/types/api-generated.d.ts')
  assert.equal(args.pin, 'openapi-typescript@7.0.0')
})

test('parseArgs can refresh from an existing spec file without regenerating types', () => {
  const args = parseArgs([
    'node',
    'scripts/refresh-openapi-snapshot.mjs',
    '--spec-file',
    'tmp/openapi.json',
    '--skip-types',
  ])

  assert.equal(args.specFile, 'tmp/openapi.json')
  assert.equal(args.skipTypes, true)
})

test('normalizeSpecText pretty-prints JSON with trailing newline', () => {
  assert.equal(
    normalizeSpecText('{"info":{"title":"API"},"openapi":"3.1.0"}'),
    '{\n  "info": {\n    "title": "API"\n  },\n  "openapi": "3.1.0"\n}\n',
  )
})
