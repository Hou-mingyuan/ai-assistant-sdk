import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from './generate-frontend-types.mjs';

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
