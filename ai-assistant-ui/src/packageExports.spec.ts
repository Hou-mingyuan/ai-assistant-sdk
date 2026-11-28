import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';

describe('package exports contract', () => {
  it('declares matching ESM, UMD, and declaration entries for core, form-fill, and plugin subpaths', () => {
    expect(packageJson.exports).toMatchObject({
      './core': {
        types: './dist/entries/core.d.ts',
        import: './dist/core.mjs',
        require: './dist/core.umd.cjs',
      },
      './form-fill': {
        types: './dist/entries/form-fill.d.ts',
        import: './dist/form-fill.mjs',
        require: './dist/form-fill.umd.cjs',
      },
      './plugin': {
        types: './dist/vite-plugin.d.ts',
        import: './dist/plugin.mjs',
        require: './dist/plugin.umd.cjs',
      },
      './wc': {
        import: './dist/ai-assistant-wc.mjs',
        require: './dist/ai-assistant-wc.umd.cjs',
      },
    });
    expect(packageJson.exports).not.toHaveProperty('./admin');
    expect(packageJson.exports).not.toHaveProperty('./mcp');
    expect(packageJson.exports).not.toHaveProperty('./screenshot');
  });
});
