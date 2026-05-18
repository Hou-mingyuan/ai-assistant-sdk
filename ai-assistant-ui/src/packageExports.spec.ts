import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

describe('package secondary exports', () => {
  it('exposes optional feature groups as secondary entries', () => {
    expect(packageJson.exports).toMatchObject({
      './admin': {
        types: './dist/entries/admin.d.ts',
        import: './dist/admin.mjs',
      },
      './form-fill': {
        types: './dist/entries/form-fill.d.ts',
        import: './dist/form-fill.mjs',
      },
      './mcp': {
        types: './dist/entries/mcp.d.ts',
        import: './dist/mcp.mjs',
      },
      './screenshot': {
        types: './dist/entries/screenshot.d.ts',
        import: './dist/screenshot.mjs',
      },
    });
  });
});
