import { describe, expect, it } from 'vitest';

import { findCodeElementForCodeActionTarget, getCodeLanguage } from './codeBlockDom';

describe('codeBlockDom', () => {
  it('finds code for toolbar buttons rendered beside the pre element', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <div class="ai-code-wrap">
        <div class="ai-code-toolbar">
          <button type="button" class="ai-code-copy" data-copy="true">Copy</button>
        </div>
        <pre><code class="language-ts">const ok = true;</code></pre>
      </div>
    `;

    const target = host.querySelector('.ai-code-copy');
    expect(target).toBeInstanceOf(HTMLElement);

    const code = findCodeElementForCodeActionTarget(target as HTMLElement);
    expect(code?.textContent).toBe('const ok = true;');
    expect(getCodeLanguage(code)).toBe('ts');
  });

  it('keeps supporting buttons rendered inside the pre element', () => {
    const host = document.createElement('div');
    host.innerHTML = `
      <pre>
        <button type="button" class="ai-code-cmp-btn">+</button>
        <code class="language-js">console.log("ok");</code>
      </pre>
    `;

    const target = host.querySelector('.ai-code-cmp-btn');
    expect(target).toBeInstanceOf(HTMLElement);

    const code = findCodeElementForCodeActionTarget(target as HTMLElement);
    expect(code?.textContent).toContain('console.log');
    expect(getCodeLanguage(code)).toBe('js');
  });
});
