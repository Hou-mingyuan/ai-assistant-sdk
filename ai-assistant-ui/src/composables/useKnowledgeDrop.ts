import { nextTick, ref, type ComputedRef, type Ref } from 'vue';

export const QUICK_INGEST_KB_NAME = 'Quick Ingest';
export const DEFAULT_KB_PICKER_AUTO_DISMISS_MS = 12000;

export interface KnowledgeDropBase {
  id: string;
  name: string;
}

export interface KnowledgeDropStore<TBase extends KnowledgeDropBase> {
  bases: Ref<TBase[]>;
  createBase: (name: string) => TBase;
  addDoc: (kbId: string, file: File) => void;
}

interface KnowledgeDropLabels {
  kbDropIngested?: string;
  kbDropNewKbName?: string;
}

interface UseKnowledgeDropDeps<TBase extends KnowledgeDropBase> {
  knowledgeBase: KnowledgeDropStore<TBase>;
  t: ComputedRef<KnowledgeDropLabels>;
  setToast: (text: string, ms: number) => void;
  focusPicker?: () => void;
  autoDismissMs?: number;
}

export function useKnowledgeDrop<TBase extends KnowledgeDropBase>(
  deps: UseKnowledgeDropDeps<TBase>,
) {
  const kbPickerVisible = ref(false);
  const kbPickerFiles = ref<File[]>([]);
  const autoDismissMs = deps.autoDismissMs ?? DEFAULT_KB_PICKER_AUTO_DISMISS_MS;
  let kbPickerDismissTimer: ReturnType<typeof setTimeout> | null = null;

  function formatIngestToast(count: number, name: string): string {
    const template = deps.t.value.kbDropIngested;
    if (template) {
      return template.replace('{count}', String(count)).replace('{name}', name);
    }
    return `Added ${count} file(s) to ${name}`;
  }

  function clearDismissTimer() {
    if (kbPickerDismissTimer == null) return;
    clearTimeout(kbPickerDismissTimer);
    kbPickerDismissTimer = null;
  }

  function findOrCreateQuickIngestKb(): TBase {
    const existing = deps.knowledgeBase.bases.value.find((kb) => kb.name === QUICK_INGEST_KB_NAME);
    if (existing) return existing;
    return deps.knowledgeBase.createBase(QUICK_INGEST_KB_NAME);
  }

  function ingestIntoKb(kbId: string, files: File[]) {
    const kb = deps.knowledgeBase.bases.value.find((base) => base.id === kbId);
    if (!kb) return;
    for (const file of files) {
      deps.knowledgeBase.addDoc(kb.id, file);
    }
    deps.setToast(formatIngestToast(files.length, kb.name), 3200);
  }

  function closeKbPicker() {
    kbPickerVisible.value = false;
    kbPickerFiles.value = [];
    clearDismissTimer();
  }

  function openKbPicker(files: File[]) {
    kbPickerFiles.value = files;
    kbPickerVisible.value = true;
    clearDismissTimer();
    kbPickerDismissTimer = setTimeout(closeKbPicker, autoDismissMs);
    void nextTick(() => deps.focusPicker?.());
  }

  function onKbPickerPick(kbId: string) {
    const files = kbPickerFiles.value;
    closeKbPicker();
    if (files.length === 0) return;
    ingestIntoKb(kbId, files);
  }

  function onKbPickerCreateNew() {
    const files = kbPickerFiles.value;
    closeKbPicker();
    if (files.length === 0) return;
    const name = (deps.t.value.kbDropNewKbName || 'New KB').toString();
    const kb = deps.knowledgeBase.createBase(name);
    for (const file of files) {
      deps.knowledgeBase.addDoc(kb.id, file);
    }
    deps.setToast(formatIngestToast(files.length, kb.name), 3200);
  }

  function onKbPickerKeydown(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      closeKbPicker();
      return;
    }
    if (e.key === 'n' || e.key === 'N' || e.key === '0') {
      e.preventDefault();
      onKbPickerCreateNew();
      return;
    }
    const n = Number(e.key);
    if (Number.isInteger(n) && n >= 1 && n <= 9) {
      const kb = deps.knowledgeBase.bases.value[n - 1];
      if (kb) {
        e.preventDefault();
        onKbPickerPick(kb.id);
      }
    }
  }

  function ingestFilesIntoKb(files: File[]) {
    if (!files.length) return;
    const bases = deps.knowledgeBase.bases.value;
    if (bases.length === 0 || (bases.length === 1 && bases[0]?.name === QUICK_INGEST_KB_NAME)) {
      const kb = findOrCreateQuickIngestKb();
      ingestIntoKb(kb.id, files);
      return;
    }
    openKbPicker(files);
  }

  function dispose() {
    clearDismissTimer();
  }

  return {
    kbPickerVisible,
    kbPickerFiles,
    findOrCreateQuickIngestKb,
    ingestIntoKb,
    openKbPicker,
    closeKbPicker,
    onKbPickerPick,
    onKbPickerCreateNew,
    onKbPickerKeydown,
    ingestFilesIntoKb,
    dispose,
  };
}
