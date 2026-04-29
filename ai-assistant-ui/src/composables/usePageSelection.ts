import { ref, onMounted, onUnmounted } from 'vue';

export interface PageSelectionState {
  text: string;
  x: number;
  y: number;
  show: boolean;
}

/**
 * Captures text selection on the host page (outside the assistant panel).
 * Shows a floating mini-toolbar near the selection for quick actions.
 */
export function usePageSelection(wrapperRef: { value: HTMLElement | null | undefined }) {
  const selection = ref<PageSelectionState>({ text: '', x: 0, y: 0, show: false });
  let hideTimer: ReturnType<typeof setTimeout> | null = null;

  function dismiss() {
    selection.value = { text: '', x: 0, y: 0, show: false };
  }

  function onMouseUp(e: MouseEvent) {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }

    const target = e.target;
    if (target instanceof Element) {
      if (target.closest('.ai-assistant-wrapper') || target.closest('.ai-page-sel-bar')) return;
    }

    hideTimer = setTimeout(() => {
      hideTimer = null;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        dismiss();
        return;
      }
      const text = sel.toString().trim();
      if (!text || text.length < 2) {
        dismiss();
        return;
      }

      if (wrapperRef.value) {
        const range = sel.getRangeAt(0);
        if (wrapperRef.value.contains(range.commonAncestorContainer)) {
          dismiss();
          return;
        }
      }

      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) {
        dismiss();
        return;
      }

      const pad = 8;
      let x = rect.left + rect.width / 2;
      let y = rect.top - 44;
      if (y < pad) y = rect.bottom + 8;
      if (x < pad) x = pad;
      if (x > window.innerWidth - 200) x = window.innerWidth - 200;

      selection.value = { text, x, y, show: true };
    }, 150);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && selection.value.show) {
      dismiss();
    }
  }

  function onScroll() {
    if (selection.value.show) dismiss();
  }

  onMounted(() => {
    document.addEventListener('mouseup', onMouseUp, true);
    document.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  });

  onUnmounted(() => {
    document.removeEventListener('mouseup', onMouseUp, true);
    document.removeEventListener('keydown', onKeyDown, true);
    window.removeEventListener('scroll', onScroll, true);
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  });

  return { selection, dismissSelection: dismiss };
}
