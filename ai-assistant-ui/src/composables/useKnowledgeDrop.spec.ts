import { computed, ref } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QUICK_INGEST_KB_NAME, useKnowledgeDrop } from './useKnowledgeDrop';

interface TestKb {
  id: string;
  name: string;
  docs: File[];
}

function makeFile(name: string): File {
  return new File(['x'], name, { type: 'text/plain' });
}

function makeKnowledgeBase(initial: TestKb[] = []) {
  const bases = ref<TestKb[]>(initial);
  let nextId = 1;
  return {
    bases,
    createBase: vi.fn((name: string) => {
      const kb = { id: `kb-${nextId++}`, name, docs: [] };
      bases.value.push(kb);
      return kb;
    }),
    addDoc: vi.fn((kbId: string, file: File) => {
      bases.value.find((kb) => kb.id === kbId)?.docs.push(file);
    }),
  };
}

function createKnowledgeDrop(initial: TestKb[] = []) {
  const knowledgeBase = makeKnowledgeBase(initial);
  const setToast = vi.fn();
  const focusPicker = vi.fn();
  const drop = useKnowledgeDrop({
    knowledgeBase,
    t: computed(() => ({
      kbDropIngested: 'Added {count} to {name}',
      kbDropNewKbName: 'New Knowledge',
    })),
    setToast,
    focusPicker,
    autoDismissMs: 1000,
  });
  return { drop, knowledgeBase, setToast, focusPicker };
}

describe('useKnowledgeDrop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-creates Quick Ingest when no knowledge base exists', () => {
    const { drop, knowledgeBase, setToast } = createKnowledgeDrop();
    const file = makeFile('a.txt');

    drop.ingestFilesIntoKb([file]);

    expect(knowledgeBase.createBase).toHaveBeenCalledWith(QUICK_INGEST_KB_NAME);
    expect(knowledgeBase.addDoc).toHaveBeenCalledWith('kb-1', file);
    expect(setToast).toHaveBeenCalledWith('Added 1 to Quick Ingest', 3200);
  });

  it('uses an existing Quick Ingest base without opening the picker', () => {
    const quick = { id: 'quick', name: QUICK_INGEST_KB_NAME, docs: [] };
    const { drop, knowledgeBase } = createKnowledgeDrop([quick]);
    const file = makeFile('a.txt');

    drop.ingestFilesIntoKb([file]);

    expect(drop.kbPickerVisible.value).toBe(false);
    expect(knowledgeBase.createBase).not.toHaveBeenCalled();
    expect(knowledgeBase.addDoc).toHaveBeenCalledWith('quick', file);
  });

  it('opens and auto-dismisses the picker when multiple bases exist', async () => {
    const { drop, focusPicker } = createKnowledgeDrop([
      { id: 'kb-a', name: 'A', docs: [] },
      { id: 'kb-b', name: 'B', docs: [] },
    ]);
    const files = [makeFile('a.txt')];

    drop.ingestFilesIntoKb(files);
    await vi.runAllTicks();

    expect(drop.kbPickerVisible.value).toBe(true);
    expect(drop.kbPickerFiles.value).toEqual(files);
    expect(focusPicker).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    expect(drop.kbPickerVisible.value).toBe(false);
    expect(drop.kbPickerFiles.value).toEqual([]);
  });

  it('picks an existing base and closes the picker', () => {
    const { drop, knowledgeBase } = createKnowledgeDrop([
      { id: 'kb-a', name: 'A', docs: [] },
      { id: 'kb-b', name: 'B', docs: [] },
    ]);
    const file = makeFile('a.txt');

    drop.openKbPicker([file]);
    drop.onKbPickerPick('kb-b');

    expect(drop.kbPickerVisible.value).toBe(false);
    expect(drop.kbPickerFiles.value).toEqual([]);
    expect(knowledgeBase.addDoc).toHaveBeenCalledWith('kb-b', file);
  });

  it('creates a new base from pending picker files', () => {
    const { drop, knowledgeBase, setToast } = createKnowledgeDrop([
      { id: 'kb-a', name: 'A', docs: [] },
      { id: 'kb-b', name: 'B', docs: [] },
    ]);
    const files = [makeFile('a.txt'), makeFile('b.txt')];

    drop.openKbPicker(files);
    drop.onKbPickerCreateNew();

    expect(knowledgeBase.createBase).toHaveBeenCalledWith('New Knowledge');
    expect(knowledgeBase.addDoc).toHaveBeenCalledTimes(2);
    expect(setToast).toHaveBeenCalledWith('Added 2 to New Knowledge', 3200);
  });

  it('handles picker keyboard shortcuts', () => {
    const { drop, knowledgeBase } = createKnowledgeDrop([
      { id: 'kb-a', name: 'A', docs: [] },
      { id: 'kb-b', name: 'B', docs: [] },
    ]);
    const preventDefault = vi.fn();
    const file = makeFile('a.txt');

    drop.openKbPicker([file]);
    drop.onKbPickerKeydown({ key: '2', preventDefault } as unknown as KeyboardEvent);
    expect(knowledgeBase.addDoc).toHaveBeenCalledWith('kb-b', file);
    expect(preventDefault).toHaveBeenCalledTimes(1);

    drop.openKbPicker([file]);
    drop.onKbPickerKeydown({ key: 'Escape', preventDefault } as unknown as KeyboardEvent);
    expect(drop.kbPickerVisible.value).toBe(false);
  });
});
