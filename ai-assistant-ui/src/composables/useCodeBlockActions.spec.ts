import { computed, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { useCodeBlockActions } from './useCodeBlockActions';

function eventWithTarget(target: HTMLElement) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'target', { value: target });
  return event;
}

function codeBlockHost(extraButtonAttrs = 'data-copy="true"') {
  const host = document.createElement('div');
  host.innerHTML = `
    <div class="ai-code-wrap">
      <div class="ai-code-toolbar">
        <button type="button" class="ai-code-action" ${extraButtonAttrs}>Copy</button>
      </div>
      <pre><code class="language-ts">const answer = 42;</code></pre>
    </div>
  `;
  return host;
}

describe('useCodeBlockActions', () => {
  it('marks code snippets for compare from the hover button', () => {
    const markCompare = vi.fn();
    const toast = vi.fn();
    const timerCallbacks: Array<() => void> = [];
    const host = codeBlockHost('data-ai-cmp-msg="0"');
    const button = host.querySelector('.ai-code-action') as HTMLElement;
    button.classList.add('ai-code-cmp-btn');
    const event = eventWithTarget(button);
    const preventDefault = vi.spyOn(event, 'preventDefault');
    const stopPropagation = vi.spyOn(event, 'stopPropagation');

    const actions = useCodeBlockActions({
      messages: ref([{ role: 'assistant', content: 'message' }]),
      compareSet: ref([]),
      maxCompareSides: 4,
      markCompare,
      openCodeInIde: undefined,
      t: computed(() => ({ msgCtxCompareSetFull: 'Full', codeCopied: 'Copied', copyCode: 'Copy' })),
      setToast: toast,
      setTimeoutFn: (cb) => {
        timerCallbacks.push(cb);
        return 7;
      },
      clipboardWrite: vi.fn(),
    });

    expect(actions.handleBodyClick(event)).toBe(true);
    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
    expect(markCompare).toHaveBeenCalledWith(0, 'const answer = 42;');
    expect(toast).not.toHaveBeenCalled();
    expect(button.classList.contains('ai-code-cmp-btn-added')).toBe(true);

    timerCallbacks[0]?.();
    expect(button.classList.contains('ai-code-cmp-btn-added')).toBe(false);
  });

  it('shows a toast instead of marking compare when compare set is full', () => {
    const markCompare = vi.fn();
    const toast = vi.fn();
    const host = codeBlockHost('data-ai-cmp-msg="0"');
    const button = host.querySelector('.ai-code-action') as HTMLElement;
    button.classList.add('ai-code-cmp-btn');

    const actions = useCodeBlockActions({
      messages: ref([{ role: 'assistant', content: 'message' }]),
      compareSet: ref([1, 2, 3, 4]),
      maxCompareSides: 4,
      markCompare,
      openCodeInIde: undefined,
      t: computed(() => ({
        msgCtxCompareSetFull: 'Compare set is full',
        codeCopied: 'Copied',
        copyCode: 'Copy',
      })),
      setToast: toast,
      clipboardWrite: vi.fn(),
    });

    expect(actions.handleBodyClick(eventWithTarget(button))).toBe(true);
    expect(markCompare).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith('Compare set is full', 2400);
  });

  it('opens a code block in the host IDE integration', () => {
    const openCodeInIde = vi.fn();
    const host = codeBlockHost('data-ide="true"');
    const button = host.querySelector('[data-ide]') as HTMLElement;

    const actions = useCodeBlockActions({
      messages: ref([]),
      compareSet: ref([]),
      maxCompareSides: 4,
      markCompare: vi.fn(),
      openCodeInIde,
      t: computed(() => ({ codeCopied: 'Copied', copyCode: 'Copy' })),
      setToast: vi.fn(),
      clipboardWrite: vi.fn(),
    });

    expect(actions.handleBodyClick(eventWithTarget(button))).toBe(true);
    expect(openCodeInIde).toHaveBeenCalledWith({ code: 'const answer = 42;', language: 'ts' });
  });

  it('toggles folded code block state and accessible label', () => {
    const host = codeBlockHost('data-fold-toggle="true" aria-expanded="true" aria-label="Fold"');
    const button = host.querySelector('[data-fold-toggle]') as HTMLElement;
    const wrap = host.querySelector('.ai-code-wrap') as HTMLElement;

    const actions = useCodeBlockActions({
      messages: ref([]),
      compareSet: ref([]),
      maxCompareSides: 4,
      markCompare: vi.fn(),
      openCodeInIde: undefined,
      t: computed(() => ({
        codeFold: 'Fold',
        codeUnfold: 'Unfold',
        codeCopied: 'Copied',
        copyCode: 'Copy',
      })),
      setToast: vi.fn(),
      clipboardWrite: vi.fn(),
    });

    expect(actions.handleBodyClick(eventWithTarget(button))).toBe(true);
    expect(wrap.classList.contains('ai-code-folded')).toBe(true);
    expect(button.textContent).toBe('Unfold');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });

  it('copies code text and restores the copy button label later', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    const timerCallbacks: Array<() => void> = [];
    const host = codeBlockHost();
    const button = host.querySelector('[data-copy]') as HTMLElement;

    const actions = useCodeBlockActions({
      messages: ref([]),
      compareSet: ref([]),
      maxCompareSides: 4,
      markCompare: vi.fn(),
      openCodeInIde: undefined,
      t: computed(() => ({ codeCopied: 'Copied', copyCode: 'Copy' })),
      setToast: vi.fn(),
      setTimeoutFn: (cb) => {
        timerCallbacks.push(cb);
        return 11;
      },
      clipboardWrite,
    });

    expect(actions.handleBodyClick(eventWithTarget(button))).toBe(true);
    await Promise.resolve();

    expect(clipboardWrite).toHaveBeenCalledWith('const answer = 42;');
    expect(button.textContent).toBe('Copied');
    expect(button.getAttribute('aria-label')).toBe('Copied');

    timerCallbacks[0]?.();
    expect(button.textContent).toBe('Copy');
  });
});
