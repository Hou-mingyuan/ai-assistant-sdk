import { ref, type Ref } from 'vue';

interface UseMessageSelectionDeps<TMessage> {
  messages: Ref<TMessage[]>;
  clearRenderCache: () => void;
}

export function useMessageSelection<TMessage>(deps: UseMessageSelectionDeps<TMessage>) {
  const selectMode = ref(false);
  const selectedMsgIndices = ref<Set<number>>(new Set());

  function clearSelection() {
    selectedMsgIndices.value = new Set();
  }

  function toggleSelectMode() {
    selectMode.value = !selectMode.value;
    if (!selectMode.value) clearSelection();
  }

  function toggleMsgSelection(globalIdx: number) {
    const next = new Set(selectedMsgIndices.value);
    if (next.has(globalIdx)) next.delete(globalIdx);
    else next.add(globalIdx);
    selectedMsgIndices.value = next;
  }

  function deleteSelectedMessages() {
    if (selectedMsgIndices.value.size === 0) return;

    const sorted = [...selectedMsgIndices.value].sort((a, b) => b - a);
    for (const idx of sorted) {
      if (idx >= 0 && idx < deps.messages.value.length) {
        deps.messages.value.splice(idx, 1);
      }
    }

    clearSelection();
    selectMode.value = false;
    deps.clearRenderCache();
  }

  return {
    selectMode,
    selectedMsgIndices,
    clearSelection,
    toggleSelectMode,
    toggleMsgSelection,
    deleteSelectedMessages,
  };
}
