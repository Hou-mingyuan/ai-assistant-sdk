/** 面板八向缩放逻辑：pointer 事件驱动，固定对边/对角锚点，rAF 合并提交。 */
import { ref, onUnmounted, type Ref } from 'vue';

export type PanelResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface PanelRect {
  wl: number;
  wt: number;
  w: number;
  h: number;
}

export function computeRectFromResizePointer(
  edge: PanelResizeEdge,
  r0: PanelRect,
  ex: number,
  ey: number,
  clamp: (w: number, h: number) => { w: number; h: number },
): PanelRect {
  const { wl: wl0, wt: wt0, w: w0, h: h0 } = r0;
  let wl = wl0,
    wt = wt0,
    w = w0,
    h = h0;
  switch (edge) {
    case 'se':
      w = ex - wl0;
      h = ey - wt0;
      break;
    case 'sw':
      w = wl0 + w0 - ex;
      h = ey - wt0;
      wl = ex;
      break;
    case 'ne':
      w = ex - wl0;
      h = wt0 + h0 - ey;
      wt = ey;
      break;
    case 'nw':
      w = wl0 + w0 - ex;
      h = wt0 + h0 - ey;
      wl = ex;
      wt = ey;
      break;
    case 'e':
      w = ex - wl0;
      break;
    case 'w':
      w = wl0 + w0 - ex;
      wl = ex;
      break;
    case 's':
      h = ey - wt0;
      break;
    case 'n':
      h = wt0 + h0 - ey;
      wt = ey;
      break;
  }
  const cl = clamp(w, h);
  w = cl.w;
  h = cl.h;
  switch (edge) {
    case 'se':
      wl = wl0;
      wt = wt0;
      break;
    case 'sw':
      wl = wl0 + w0 - w;
      wt = wt0;
      break;
    case 'ne':
      wl = wl0;
      wt = wt0 + h0 - h;
      break;
    case 'nw':
      wl = wl0 + w0 - w;
      wt = wt0 + h0 - h;
      break;
    case 'e':
      wl = wl0;
      wt = wt0;
      break;
    case 'w':
      wl = wl0 + w0 - w;
      wt = wt0;
      break;
    case 's':
      wl = wl0;
      wt = wt0;
      break;
    case 'n':
      wl = wl0;
      wt = wt0 + h0 - h;
      break;
  }
  return { wl, wt, w, h };
}

export function usePanelResize(
  panelUserSize: Ref<{ w: number; h: number } | null>,
  getPanelScreenRect: () => PanelRect | null,
  syncFabToPanelRect: (wl: number, wt: number, w: number, h: number) => void,
  ensurePanelInViewport: () => void,
  saveFabPos: () => void,
  clampPanelSize: (w: number, h: number) => { w: number; h: number },
  isOpen: Ref<boolean>,
) {
  let resizeDrag: {
    pointerId: number;
    edge: PanelResizeEdge;
    r0: PanelRect;
  } | null = null;
  let pendingRect: PanelRect | null = null;
  let flushRaf = 0;
  const panelResizedThisSession = ref(false);

  function flushFrame() {
    flushRaf = 0;
    if (!pendingRect || !resizeDrag) return;
    panelUserSize.value = { w: pendingRect.w, h: pendingRect.h };
    syncFabToPanelRect(pendingRect.wl, pendingRect.wt, pendingRect.w, pendingRect.h);
    ensurePanelInViewport();
  }

  function onPointerMove(e: PointerEvent) {
    if (!resizeDrag || e.pointerId !== resizeDrag.pointerId) return;
    const r = computeRectFromResizePointer(
      resizeDrag.edge,
      resizeDrag.r0,
      e.clientX,
      e.clientY,
      clampPanelSize,
    );
    pendingRect = r;
    if (!flushRaf) flushRaf = requestAnimationFrame(flushFrame);
  }

  function onPointerUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
    if (!resizeDrag || e.pointerId !== resizeDrag.pointerId) return;
    const d = resizeDrag;
    resizeDrag = null;
    if (flushRaf) {
      cancelAnimationFrame(flushRaf);
      flushRaf = 0;
    }
    pendingRect = null;
    const r = computeRectFromResizePointer(d.edge, d.r0, e.clientX, e.clientY, clampPanelSize);
    panelUserSize.value = { w: r.w, h: r.h };
    syncFabToPanelRect(r.wl, r.wt, r.w, r.h);
    if (isOpen.value) {
      panelResizedThisSession.value = true;
      ensurePanelInViewport();
      saveFabPos();
    }
  }

  function onPointerDown(e: PointerEvent, edge: PanelResizeEdge) {
    if (e.button !== 0) return;
    const r0 = getPanelScreenRect();
    if (!r0) return;
    resizeDrag = { pointerId: e.pointerId, edge, r0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
  }

  function cleanup() {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp, true);
    window.removeEventListener('pointercancel', onPointerUp, true);
    if (flushRaf) {
      cancelAnimationFrame(flushRaf);
      flushRaf = 0;
    }
    resizeDrag = null;
    pendingRect = null;
  }

  onUnmounted(cleanup);

  return {
    panelResizedThisSession,
    onPanelResizePointerDown: onPointerDown,
    cleanupPanelResize: cleanup,
  };
}
