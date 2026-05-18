import { describe, expect, it, beforeEach } from 'vitest';

import { useKnowledgeBase, type KnowledgeBase } from './useKnowledgeBase';

describe('useKnowledgeBase', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads persisted knowledge bases lazily when prompt state is accessed', () => {
    const storageKey = 'kb-lazy-test';
    const knowledgeBase = useKnowledgeBase(storageKey);
    const base: KnowledgeBase = {
      id: 'kb1',
      name: 'Ops Handbook',
      createdAt: 1,
      enabled: true,
      docs: [
        {
          id: 'doc1',
          name: 'ops.md',
          size: 123,
          uploadedAt: 1,
          status: 'ready',
        },
      ],
    };

    localStorage.setItem(storageKey, JSON.stringify([base]));

    expect(knowledgeBase.bases.value).toEqual([]);
    expect(knowledgeBase.ragPromptFragment.value).toContain('Ops Handbook');
    expect(knowledgeBase.bases.value).toEqual([base]);
  });
});
