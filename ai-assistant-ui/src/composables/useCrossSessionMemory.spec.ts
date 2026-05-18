import { describe, expect, it, beforeEach } from 'vitest';

import { useCrossSessionMemory, type MemoryItem } from './useCrossSessionMemory';

describe('useCrossSessionMemory', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads persisted memory lazily when first accessed', () => {
    const storageKey = 'memory-lazy-test';
    const memory = useCrossSessionMemory(storageKey);
    const item: MemoryItem = {
      id: 'm1',
      text: 'prefers concise answers',
      createdAt: 1,
      source: 'manual',
    };

    localStorage.setItem(storageKey, JSON.stringify([item]));

    expect(memory.items.value).toEqual([]);
    expect(memory.memoryPromptFragment.value).toContain('prefers concise answers');
    expect(memory.items.value).toEqual([item]);
  });
});
