import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useMessageSelection } from './useMessageSelection';

describe('useMessageSelection', () => {
  it('toggles select mode and clears selection when leaving select mode', () => {
    const selection = useMessageSelection({
      messages: ref(['a', 'b', 'c']),
      clearRenderCache: vi.fn(),
    });

    selection.toggleSelectMode();
    selection.toggleMsgSelection(1);
    expect(selection.selectMode.value).toBe(true);
    expect(selection.selectedMsgIndices.value.has(1)).toBe(true);

    selection.toggleSelectMode();
    expect(selection.selectMode.value).toBe(false);
    expect(selection.selectedMsgIndices.value.size).toBe(0);
  });

  it('toggles individual message indices immutably', () => {
    const selection = useMessageSelection({
      messages: ref(['a', 'b', 'c']),
      clearRenderCache: vi.fn(),
    });

    const initial = selection.selectedMsgIndices.value;
    selection.toggleMsgSelection(2);
    expect(selection.selectedMsgIndices.value).not.toBe(initial);
    expect(selection.selectedMsgIndices.value.has(2)).toBe(true);

    selection.toggleMsgSelection(2);
    expect(selection.selectedMsgIndices.value.has(2)).toBe(false);
  });

  it('deletes selected messages from highest index to lowest index', () => {
    const messages = ref(['a', 'b', 'c', 'd']);
    const clearRenderCache = vi.fn();
    const selection = useMessageSelection({ messages, clearRenderCache });

    selection.toggleSelectMode();
    selection.toggleMsgSelection(1);
    selection.toggleMsgSelection(3);
    selection.deleteSelectedMessages();

    expect(messages.value).toEqual(['a', 'c']);
    expect(selection.selectMode.value).toBe(false);
    expect(selection.selectedMsgIndices.value.size).toBe(0);
    expect(clearRenderCache).toHaveBeenCalledTimes(1);
  });

  it('ignores invalid selected indices but still exits select mode', () => {
    const messages = ref(['a']);
    const clearRenderCache = vi.fn();
    const selection = useMessageSelection({ messages, clearRenderCache });

    selection.toggleSelectMode();
    selection.toggleMsgSelection(-1);
    selection.toggleMsgSelection(10);
    selection.deleteSelectedMessages();

    expect(messages.value).toEqual(['a']);
    expect(selection.selectMode.value).toBe(false);
    expect(selection.selectedMsgIndices.value.size).toBe(0);
    expect(clearRenderCache).toHaveBeenCalledTimes(1);
  });
});
