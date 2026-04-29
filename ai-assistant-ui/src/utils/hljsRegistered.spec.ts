import { describe, expect, it } from 'vitest';

import hljs from './hljsRegistered';

describe('hljsRegistered', () => {
  it('registers the commonly used code block languages', () => {
    [
      'javascript',
      'typescript',
      'json',
      'python',
      'java',
      'go',
      'rust',
      'cpp',
      'sql',
      'yaml',
      'xml',
      'css',
      'bash',
      'markdown',
    ].forEach((language) => {
      expect(hljs.getLanguage(language), language).toBeTruthy();
    });
  });

  it('registers common aliases used by fenced Markdown code blocks', () => {
    ['js', 'ts', 'tsx', 'py', 'rs', 'cs', 'kt', 'rb', 'yml', 'html', 'scss', 'sh', 'md'].forEach(
      (alias) => {
        expect(hljs.getLanguage(alias), alias).toBeTruthy();
      },
    );
  });

  it('does not silently register unrelated languages', () => {
    expect(hljs.getLanguage('brainfuck')).toBeUndefined();
  });

  it('can highlight registered aliases without throwing', () => {
    const result = hljs.highlight('const value: string = "ok";', { language: 'ts' });

    expect(result.language).toBe('ts');
    expect(result.value).toContain('value');
  });
});
