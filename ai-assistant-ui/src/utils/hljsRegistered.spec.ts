import { describe, expect, it } from 'vitest';

import hljs, { ensureLanguage } from './hljsRegistered';

describe('hljsRegistered (core)', () => {
  it('eagerly registers the core code block languages', () => {
    ['javascript', 'typescript', 'json', 'python', 'bash', 'shell', 'xml'].forEach((language) => {
      expect(hljs.getLanguage(language), language).toBeTruthy();
    });
  });

  it('eagerly registers the core aliases used in fenced Markdown blocks', () => {
    ['js', 'ts', 'tsx', 'py', 'sh', 'zsh', 'html', 'xhtml'].forEach((alias) => {
      expect(hljs.getLanguage(alias), alias).toBeTruthy();
    });
  });

  it('does not register unrelated languages', () => {
    expect(hljs.getLanguage('brainfuck')).toBeUndefined();
  });

  it('can highlight registered aliases without throwing', () => {
    const result = hljs.highlight('const value: string = "ok";', { language: 'ts' });

    expect(result.language).toBe('ts');
    expect(result.value).toContain('value');
  });
});

describe('hljsRegistered (extended, lazy-loaded)', () => {
  it('does not register extended languages eagerly', () => {
    expect(hljs.getLanguage('rust')).toBeUndefined();
    expect(hljs.getLanguage('csharp')).toBeUndefined();
    expect(hljs.getLanguage('kotlin')).toBeUndefined();
    expect(hljs.getLanguage('sql')).toBeUndefined();
  });

  it('returns false synchronously for an unknown alias', () => {
    expect(ensureLanguage('totally-unknown-lang')).toBe(false);
  });

  it('triggers async load for a known extended alias and registers it', async () => {
    expect(ensureLanguage('rust')).toBe(false);
    const start = Date.now();
    while (!hljs.getLanguage('rust')) {
      if (Date.now() - start > 5000) {
        throw new Error('rust extended language failed to register within 5s');
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    expect(hljs.getLanguage('rust')).toBeTruthy();
    expect(hljs.getLanguage('rs')).toBeTruthy();
  });
});
