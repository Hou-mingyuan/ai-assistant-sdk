import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  assertSnapshotMatches,
  normalizeSpecText,
  parseArgs,
  summarizeSpecDrift,
} from './refresh-openapi-snapshot.mjs'

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

test('parseArgs supports dry-run snapshot checks', () => {
  const args = parseArgs(['node', 'scripts/refresh-openapi-snapshot.mjs', '--check'])

  assert.equal(args.check, true)
})

test('normalizeSpecText pretty-prints JSON with trailing newline', () => {
  assert.equal(
    normalizeSpecText('{"info":{"title":"API"},"openapi":"3.1.0"}'),
    '{\n  "info": {\n    "title": "API"\n  },\n  "openapi": "3.1.0"\n}\n',
  )
})

test('assertSnapshotMatches accepts normalized equivalent JSON text', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openapi-refresh-'))
  const file = join(dir, 'openapi.json')
  await writeFile(file, '{\r\n  "openapi": "3.1.0"\r\n}\r\n', 'utf8')
  try {
    await assertSnapshotMatches(file, '{\n  "openapi": "3.1.0"\n}\n')
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('summarizeSpecDrift reports added and removed paths and schemas', () => {
  const summary = summarizeSpecDrift(
    JSON.stringify({
      openapi: '3.1.0',
      paths: { '/old': {} },
      components: { schemas: { OldDto: {} } },
    }),
    JSON.stringify({
      openapi: '3.1.0',
      paths: { '/new': {} },
      components: { schemas: { NewDto: {} } },
    }),
  )

  assert.match(summary, /paths added: \/new/)
  assert.match(summary, /paths removed: \/old/)
  assert.match(summary, /schemas added: NewDto/)
  assert.match(summary, /schemas removed: OldDto/)
})
