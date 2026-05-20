import { describe, expect, it } from 'vitest';

import {
  findCodeElementForCodeActionTarget,
  getCodeLanguage,
  updateCodeActionButtonLabel,
  updateCodeFoldToggleState,
} from './codeBlockDom';

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

  it('syncs folded button text and accessible state', () => {
    const button = document.createElement('button');
    button.textContent = 'Fold';
    button.setAttribute('aria-label', 'Fold');
    button.setAttribute('aria-expanded', 'true');

    updateCodeFoldToggleState(button, true, 'Fold', 'Unfold');
    expect(button.textContent).toBe('Unfold');
    expect(button.getAttribute('aria-label')).toBe('Unfold');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    updateCodeFoldToggleState(button, false, 'Fold', 'Unfold');
    expect(button.textContent).toBe('Fold');
    expect(button.getAttribute('aria-label')).toBe('Fold');
    expect(button.getAttribute('aria-expanded')).toBe('true');
  });

  it('syncs code action button text and accessible label', () => {
    const button = document.createElement('button');
    button.textContent = 'Copy';
    button.setAttribute('aria-label', 'Copy');

    updateCodeActionButtonLabel(button, 'Copied');
    expect(button.textContent).toBe('Copied');
    expect(button.getAttribute('aria-label')).toBe('Copied');
  });
});
