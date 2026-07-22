import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  loadSpecText,
  openApiSourceDigest,
  parseArgs,
  stampGeneratedTypesContent,
} from './generate-frontend-types.mjs';

test('parseArgs enables drift-check mode without writing to the output file', () => {
  const args = parseArgs([
    'node',
    'scripts/generate-frontend-types.mjs',
    '--check',
    '--url',
    'http://localhost:8080/spec.json',
    '--out',
    'ai-assistant-ui/src/types/api-generated.d.ts',
  ]);

  assert.equal(args.check, true);
  assert.equal(args.dryRun, false);
  assert.equal(args.url, 'http://localhost:8080/spec.json');
});

test('parseArgs accepts a local OpenAPI spec file', () => {
  const args = parseArgs([
    'node',
    'scripts/generate-frontend-types.mjs',
    '--spec-file',
    'docs/api/openapi.json',
    '--check',
  ]);

  assert.equal(args.specFile, 'docs/api/openapi.json');
  assert.equal(args.check, true);
});

test('loadSpecText reads from specFile without fetching the live URL', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'openapi-spec-'));
  const specPath = join(dir, 'openapi.json');
  await writeFile(specPath, '{"openapi":"3.1.0"}', 'utf8');
  try {
    const spec = await loadSpecText({
      specFile: specPath,
      url: 'http://127.0.0.1:1/should-not-fetch',
      token: null,
    });

    assert.equal(spec, '{"openapi":"3.1.0"}');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('OpenAPI digest is stable across JSON formatting differences', () => {
  const compact = '{"openapi":"3.1.0","info":{"title":"API"}}';
  const pretty = '{\n  "openapi": "3.1.0",\n  "info": { "title": "API" }\n}\n';

  assert.equal(openApiSourceDigest(compact), openApiSourceDigest(pretty));
});

test('generated types carry and replace the reviewed OpenAPI digest', () => {
  const first = stampGeneratedTypesContent(
    '/** generated */\nexport interface paths {}\n',
    '{"openapi":"3.1.0","info":{"title":"A"}}',
  );
  const second = stampGeneratedTypesContent(
    first,
    '{"openapi":"3.1.0","info":{"title":"B"}}',
  );

  assert.match(first, /^\/\*\* OpenAPI source SHA-256: [a-f0-9]{64} \*\//);
  assert.notEqual(first.split('\n')[0], second.split('\n')[0]);
  assert.equal(second.match(/OpenAPI source SHA-256/g)?.length, 1);
});
