import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';

import { usePageSelectionActions } from './usePageSelectionActions';

describe('usePageSelectionActions', () => {
  it('uses selected text as a chat prompt without auto-sending for ask', () => {
    const dismissSelection = vi.fn();
    const send = vi.fn();
    const mode = ref<'translate' | 'summarize' | 'chat'>('translate');
    const input = ref('');
    const isOpen = ref(false);

    const actions = usePageSelectionActions({
      getSelectionText: () => 'selected text',
      dismissSelection,
      mode,
      input,
      isOpen,
      send,
      nextTickFn: (cb) => cb(),
    });

    actions.onPageSelAction('ask');

    expect(dismissSelection).toHaveBeenCalled();
    expect(mode.value).toBe('chat');
    expect(input.value).toBe('selected text');
    expect(isOpen.value).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('switches to translate and sends after the next tick', () => {
    const send = vi.fn();
    const nextTickFn = vi.fn((cb: () => void) => cb());
    const mode = ref<'translate' | 'summarize' | 'chat'>('chat');
    const input = ref('');
    const isOpen = ref(false);

    const actions = usePageSelectionActions({
      getSelectionText: () => 'hello',
      dismissSelection: vi.fn(),
      mode,
      input,
      isOpen,
      send,
      nextTickFn,
    });

    actions.onPageSelAction('translate');

    expect(mode.value).toBe('translate');
    expect(input.value).toBe('hello');
    expect(isOpen.value).toBe(true);
    expect(nextTickFn).toHaveBeenCalled();
    expect(send).toHaveBeenCalled();
  });

  it('dismisses an empty selection without changing input or sending', () => {
    const dismissSelection = vi.fn();
    const send = vi.fn();
    const mode = ref<'translate' | 'summarize' | 'chat'>('chat');
    const input = ref('existing');
    const isOpen = ref(false);

    const actions = usePageSelectionActions({
      getSelectionText: () => '',
      dismissSelection,
      mode,
      input,
      isOpen,
      send,
      nextTickFn: (cb) => cb(),
    });

    actions.onPageSelAction('summarize');

    expect(dismissSelection).toHaveBeenCalled();
    expect(mode.value).toBe('chat');
    expect(input.value).toBe('existing');
    expect(isOpen.value).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });
});
