/** 面板标题栏拖拽移动：延迟起拖避免挡文本选中，rAF 合并位移提交。 */
import { ref, onUnmounted, type Ref } from 'vue';

const DRAG_CLICK_PX = 8;

export function usePanelDrag(
  fabLeft: Ref<number | null>,
  fabTop: Ref<number | null>,
  isOpen: Ref<boolean>,
  ensurePanelInViewport: () => void,
  saveFabPos: () => void,
  syncFabPixelFromWrapperDom: () => void,
) {
  const panelDragging = ref(false);
  const panelHeaderDraggedWhileOpen = ref(false);
  const drag = ref<{ pointerId: number; lastX: number; lastY: number } | null>(null);
  let pendingDx = 0,
    pendingDy = 0,
    flushRaf = 0;
  let tentative: {
    pointerId: number;
    startX: number;
    startY: number;
    headerEl: HTMLElement;
  } | null = null;

  function flushFrame() {
    flushRaf = 0;
    if (pendingDx === 0 && pendingDy === 0) return;
    const dx = pendingDx,
      dy = pendingDy;
    pendingDx = 0;
    pendingDy = 0;
    if (fabLeft.value === null || fabTop.value === null) return;
    fabLeft.value += dx;
    fabTop.value += dy;
    if (isOpen.value) panelHeaderDraggedWhileOpen.value = true;
    ensurePanelInViewport();
  }

  function onMove(e: PointerEvent) {
    if (!drag.value || e.pointerId !== drag.value.pointerId) return;
    if (fabLeft.value === null || fabTop.value === null) return;
    const d = drag.value;
    pendingDx += e.clientX - d.lastX;
    pendingDy += e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    if (!flushRaf) flushRaf = requestAnimationFrame(flushFrame);
  }

  function onUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    if (!drag.value || e.pointerId !== drag.value.pointerId) return;
    drag.value = null;
    panelDragging.value = false;
    if (flushRaf) {
      cancelAnimationFrame(flushRaf);
      flushRaf = 0;
    }
    flushFrame();
    saveFabPos();
  }

  function startDragSession(e: PointerEvent, headerEl: HTMLElement) {
    e.preventDefault();
    if (fabLeft.value === null || fabTop.value === null) syncFabPixelFromWrapperDom();
    if (fabLeft.value === null || fabTop.value === null) return;
    drag.value = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    panelDragging.value = true;
    headerEl.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
  }

  function cleanupTentative() {
    if (!tentative) return;
    window.removeEventListener('pointermove', onTentativeMove);
    window.removeEventListener('pointerup', onTentativeUp, true);
    window.removeEventListener('pointercancel', onTentativeUp, true);
    tentative = null;
  }

  function onTentativeMove(e: PointerEvent) {
    if (!tentative || e.pointerId !== tentative.pointerId) return;
    if (Math.hypot(e.clientX - tentative.startX, e.clientY - tentative.startY) < DRAG_CLICK_PX)
      return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      cleanupTentative();
      return;
    }
    const el = tentative.headerEl;
    cleanupTentative();
    startDragSession(e, el);
  }

  function onTentativeUp(e: PointerEvent) {
    if (!tentative || e.pointerId !== tentative.pointerId) return;
    cleanupTentative();
  }

  function onPanelHeaderPointerDown(e: PointerEvent) {
    if (!isOpen.value || e.button !== 0) return;
    const target = e.target;
    if (target instanceof Element && target.closest('.ai-header-actions')) return;
    const headerEl = e.currentTarget as HTMLElement;
    if (target instanceof Element && target.closest('.ai-title')) {
      tentative = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, headerEl };
      window.addEventListener('pointermove', onTentativeMove);
      window.addEventListener('pointerup', onTentativeUp, true);
      window.addEventListener('pointercancel', onTentativeUp, true);
      return;
    }
    startDragSession(e, headerEl);
  }

  function cleanup() {
    cleanupTentative();
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp, true);
    window.removeEventListener('pointercancel', onUp, true);
    if (flushRaf) {
      cancelAnimationFrame(flushRaf);
      flushRaf = 0;
    }
    pendingDx = 0;
    pendingDy = 0;
    drag.value = null;
    panelDragging.value = false;
  }

  onUnmounted(cleanup);

  return {
    panelDragging,
    panelHeaderDraggedWhileOpen,
    onPanelHeaderPointerDown,
    cleanupPanelDrag: cleanup,
  };
}
