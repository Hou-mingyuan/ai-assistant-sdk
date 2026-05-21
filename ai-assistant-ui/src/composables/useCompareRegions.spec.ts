import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';

import { useCompareRegions } from './useCompareRegions';

const t = computed(() => ({
  compareDialogMsgLabel: 'Msg #{idx} ({role})',
  compareDialogSelectionTag: 'selection',
}));

function createCompareRegions() {
  const messages = ref([
    { role: 'user', content: 'first user' },
    { role: 'assistant', content: 'assistant live', contentArchive: 'assistant archived' },
    { role: 'assistant', content: 'second assistant' },
    { role: 'assistant', content: 'third assistant' },
    { role: 'assistant', content: 'fourth assistant' },
  ]);
  return useCompareRegions({ messages, t });
}

describe('useCompareRegions', () => {
  it('toggles whole-message marks and relabels remaining slots', () => {
    const compare = createCompareRegions();

    compare.mark(0);
    compare.mark(1);
    expect(compare.compareSet.value.map((side) => side.label)).toEqual([
      '[A] Msg #1 (user)',
      '[B] Msg #2 (assistant)',
    ]);

    compare.mark(0);

    expect(compare.compareSet.value).toHaveLength(1);
    expect(compare.compareSet.value[0]).toMatchObject({
      msgIndex: 1,
      content: 'assistant archived',
      label: '[A] Msg #2 (assistant)',
    });
    expect(compare.compareSlotOf(0)).toBe(-1);
    expect(compare.compareSlotOf(1)).toBe(0);
  });

  it('adds selection marks as distinct slots for the same message', () => {
    const compare = createCompareRegions();

    compare.mark(1, 'first selected paragraph');
    compare.mark(1, 'second selected paragraph');

    expect(compare.compareSet.value).toEqual([
      {
        msgIndex: 1,
        content: 'first selected paragraph',
        label: '[A] Msg #2 (assistant) · selection',
      },
      {
        msgIndex: 1,
        content: 'second selected paragraph',
        label: '[B] Msg #2 (assistant) · selection',
      },
    ]);
  });

  it('opens the dialog when comparing with an existing side', () => {
    const compare = createCompareRegions();

    compare.mark(0);
    compare.compareWith(1);

    expect(compare.compareDialogOpen.value).toBe(true);
    expect(compare.compareSet.value.map((side) => side.content)).toEqual([
      'first user',
      'assistant archived',
    ]);
  });

  it('caps the compare set at four sides', () => {
    const compare = createCompareRegions();

    compare.mark(0);
    compare.mark(1);
    compare.mark(2);
    compare.mark(3);
    compare.mark(4);

    expect(compare.compareSet.value).toHaveLength(4);
    expect(compare.compareSet.value.at(-1)?.msgIndex).toBe(3);
  });

  it('swaps slots with fresh labels and clears the open dialog', () => {
    const compare = createCompareRegions();

    compare.mark(0);
    compare.mark(1);
    compare.compareDialogOpen.value = true;

    compare.swapPair(0, 1);
    expect(compare.compareSet.value.map((side) => side.label)).toEqual([
      '[A] Msg #2 (assistant)',
      '[B] Msg #1 (user)',
    ]);

    compare.clearSet();
    expect(compare.compareSet.value).toEqual([]);
    expect(compare.compareDialogOpen.value).toBe(false);
  });
});
