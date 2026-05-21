import { ref, type ComputedRef, type Ref } from 'vue';

export interface CompareRegionsMessage {
  role: string;
  content?: string;
  contentArchive?: string;
}

export interface CompareSide {
  msgIndex: number;
  content: string;
  label: string;
}

interface CompareRegionsLabels {
  compareDialogMsgLabel?: string;
  compareDialogSelectionTag?: string;
}

interface UseCompareRegionsDeps<TMessage extends CompareRegionsMessage> {
  messages: Ref<TMessage[]>;
  t: ComputedRef<CompareRegionsLabels>;
  maxSides?: number;
}

export const DEFAULT_MAX_COMPARE_SIDES = 4;

export function useCompareRegions<TMessage extends CompareRegionsMessage>(
  deps: UseCompareRegionsDeps<TMessage>,
) {
  const maxSides = deps.maxSides ?? DEFAULT_MAX_COMPARE_SIDES;
  const compareSet = ref<CompareSide[]>([]);
  const compareDialogOpen = ref(false);

  function buildCompareLabel(
    idx: number,
    role: string,
    slotLetter: string,
    isSelection = false,
  ): string {
    const fmt = deps.t.value.compareDialogMsgLabel || 'Msg #{idx} ({role})';
    const base = fmt.replace('{idx}', String(idx + 1)).replace('{role}', role);
    const selSuffix = isSelection
      ? ` · ${deps.t.value.compareDialogSelectionTag || 'selection'}`
      : '';
    return `[${slotLetter}] ${base}${selSuffix}`;
  }

  function reLabelCompareSet() {
    compareSet.value = compareSet.value.map((side, slotIdx) => {
      const stripped = side.label.replace(/^\[[A-Z]\]\s/, '');
      const letter = String.fromCharCode(65 + slotIdx);
      return { ...side, label: `[${letter}] ${stripped}` };
    });
  }

  function isInCompareSet(idx: number): boolean {
    return compareSet.value.some((side) => side.msgIndex === idx);
  }

  function compareSlotOf(idx: number): number {
    return compareSet.value.findIndex((side) => side.msgIndex === idx);
  }

  function getMessageContent(message: TMessage): string {
    return message.contentArchive ?? message.content ?? '';
  }

  function addSide(idx: number, content: string, isSelection: boolean) {
    const message = deps.messages.value[idx];
    if (!message || compareSet.value.length >= maxSides) return;
    const letter = String.fromCharCode(65 + compareSet.value.length);
    compareSet.value.push({
      msgIndex: idx,
      content,
      label: buildCompareLabel(idx, message.role, letter, isSelection),
    });
  }

  function mark(idx: number, selectionText = '') {
    const message = deps.messages.value[idx];
    if (!message) return;
    const selection = selectionText.trim();

    if (selection) {
      addSide(idx, selection, true);
      return;
    }

    const existingSlot = compareSlotOf(idx);
    if (existingSlot >= 0) {
      compareSet.value.splice(existingSlot, 1);
      reLabelCompareSet();
      return;
    }

    addSide(idx, getMessageContent(message), false);
  }

  function compareWith(idx: number, selectionText = '') {
    if (idx < 0 || compareSet.value.length === 0) return;
    const message = deps.messages.value[idx];
    if (!message) return;
    const selection = selectionText.trim();
    const shouldAdd = selection ? true : !isInCompareSet(idx);

    if (shouldAdd) {
      addSide(idx, selection || getMessageContent(message), !!selection);
    }
    if (compareSet.value.length >= 2) {
      compareDialogOpen.value = true;
    }
  }

  function swapPair(slotA: number, slotB: number) {
    const arr = compareSet.value;
    if (slotA < 0 || slotB < 0 || slotA >= arr.length || slotB >= arr.length) return;
    const tmp = arr[slotA];
    arr[slotA] = arr[slotB]!;
    arr[slotB] = tmp!;
    reLabelCompareSet();
  }

  function clearSet() {
    compareSet.value = [];
    compareDialogOpen.value = false;
  }

  return {
    maxSides,
    compareSet,
    compareDialogOpen,
    buildCompareLabel,
    isInCompareSet,
    compareSlotOf,
    mark,
    compareWith,
    swapPair,
    clearSet,
  };
}
