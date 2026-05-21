import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

describe('package secondary exports', () => {
  it('exposes optional feature groups as secondary entries', () => {
    expect(packageJson.exports).toMatchObject({
      './admin': {
        types: './dist/entries/admin.d.ts',
        import: './dist/admin.mjs',
      },
      './core': {
        types: './dist/entries/core.d.ts',
        import: './dist/core.mjs',
      },
      './form-fill': {
        types: './dist/entries/form-fill.d.ts',
        import: './dist/form-fill.mjs',
      },
      './mcp': {
        types: './dist/entries/mcp.d.ts',
        import: './dist/mcp.mjs',
      },
      './plugin': {
        types: './dist/vite-plugin.d.ts',
        import: './dist/plugin.mjs',
      },
      './screenshot': {
        types: './dist/entries/screenshot.d.ts',
        import: './dist/screenshot.mjs',
      },
      './wc': {
        import: './dist/ai-assistant-wc.mjs',
        require: './dist/ai-assistant-wc.umd.cjs',
      },
    });
  });
});
