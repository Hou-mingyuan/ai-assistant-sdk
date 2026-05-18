/**
 * Panel geometry: resize handles, header drag, viewport clamping, quadrant alignment.
 * Extracted from AiAssistant.vue to reduce its script size by ~500 lines.
 */
import { ref, computed, type Ref } from 'vue';
import { usePanelResize, type PanelResizeEdge } from './usePanelResize';

export type { PanelResizeEdge };

type FabScreenQuadrant = 'tl' | 'tr' | 'bl' | 'br';

const PANEL_W = 480;
const PANEL_H = 520;
const PANEL_VIEWPORT_MARGIN = 16;
const DRAG_CLICK_PX = 8;

export const RESIZE_ZONES: { edge: PanelResizeEdge; cls: string }[] = [
  { edge: 'n', cls: 'ai-rz-n' },
  { edge: 's', cls: 'ai-rz-s' },
  { edge: 'e', cls: 'ai-rz-e' },
  { edge: 'w', cls: 'ai-rz-w' },
  { edge: 'ne', cls: 'ai-rz-ne' },
  { edge: 'nw', cls: 'ai-rz-nw' },
  { edge: 'se', cls: 'ai-rz-se' },
  { edge: 'sw', cls: 'ai-rz-sw' },
];

export interface PanelGeometryDeps {
  fabLeft: Ref<number | null>;
  fabTop: Ref<number | null>;
  fabSize: number;
  isOpen: Ref<boolean>;
  saveFabPos: (overrideEdge?: 'none' | 'left' | 'right') => void;
  defaultPosition: string;
}

function getViewportCssSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: 1024, h: 768 };
  const vv = window.visualViewport;
  if (vv && vv.width >= 16 && vv.height >= 16) {
    return { w: Math.floor(vv.width), h: Math.floor(vv.height) };
  }
  return { w: window.innerWidth, h: window.innerHeight };
}

// eslint-disable-next-line max-lines-per-function
export function usePanelGeometry(deps: PanelGeometryDeps) {
  const { fabLeft, fabTop, fabSize, isOpen, saveFabPos, defaultPosition } = deps;

  const panelExpanded = ref(false);
  const panelUserSize = ref<{ w: number; h: number } | null>(null);
  const openPanelQuadrant = ref<FabScreenQuadrant>('br');
  const panelMountedForLayout = ref(false);
  const panelDragging = ref(false);
  let panelHeaderDraggedWhileOpen = false;

  const panelDrag = ref<{
    pointerId: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  let panelHeaderDragPendingDx = 0;
  let panelHeaderDragPendingDy = 0;
  let panelHeaderDragFlushRaf = 0;
  let panelHeaderTentative: {
    pointerId: number;
    startX: number;
    startY: number;
    headerEl: HTMLElement;
  } | null = null;

  function clampPanelSize(w: number, h: number): { w: number; h: number } {
    const { w: vw, h: vh } = getViewportCssSize();
    const minW = 300,
      minH = 280;
    const maxW = Math.max(minW, vw - 12);
    const maxH = Math.max(minH, vh - 16);
    return {
      w: Math.round(Math.max(minW, Math.min(maxW, w))),
      h: Math.round(Math.max(minH, Math.min(maxH, h))),
    };
  }

  function effectivePanelWidthPx(): number {
    if (panelUserSize.value) return panelUserSize.value.w;
    const { w: vw } = getViewportCssSize();
    return panelExpanded.value ? Math.max(PANEL_W, vw - 2 * PANEL_VIEWPORT_MARGIN) : PANEL_W;
  }

  function effectivePanelHeightPx(): number {
    if (panelUserSize.value) return panelUserSize.value.h;
    const { h: vh } = getViewportCssSize();
    return panelExpanded.value
      ? Math.max(280, vh - 2 * PANEL_VIEWPORT_MARGIN)
      : Math.min(PANEL_H, Math.max(200, vh - 80));
  }

  function togglePanelExpand() {
    panelUserSize.value = null;
    panelExpanded.value = !panelExpanded.value;
  }

  function wrapperOffsetFromFab(quadrant: FabScreenQuadrant): { dx: number; dy: number } {
    const h = effectivePanelHeightPx(),
      w = effectivePanelWidthPx();
    switch (quadrant) {
      case 'tl':
        return { dx: 0, dy: 0 };
      case 'tr':
        return { dx: -(w - fabSize), dy: 0 };
      case 'bl':
        return { dx: 0, dy: -(h - fabSize) };
      case 'br':
      default:
        return { dx: -(w - fabSize), dy: -(h - fabSize) };
    }
  }

  function getPanelScreenRect(): { wl: number; wt: number; w: number; h: number } | null {
    if (fabLeft.value === null || fabTop.value === null) return null;
    const w = effectivePanelWidthPx(),
      h = effectivePanelHeightPx();
    const { dx, dy } = wrapperOffsetFromFab(openPanelQuadrant.value);
    return { wl: fabLeft.value + dx, wt: fabTop.value + dy, w, h };
  }

  function syncFabToPanelRect(wl: number, wt: number, w: number, h: number) {
    const q = openPanelQuadrant.value;
    if (q === 'br') {
      fabLeft.value = wl + w - fabSize;
      fabTop.value = wt + h - fabSize;
    } else if (q === 'tl') {
      fabLeft.value = wl;
      fabTop.value = wt;
    } else if (q === 'tr') {
      fabLeft.value = wl + w - fabSize;
      fabTop.value = wt;
    } else {
      fabLeft.value = wl;
      fabTop.value = wt + h - fabSize;
    }
  }

  function ensurePanelInViewport() {
    if (fabLeft.value === null || fabTop.value === null) return;
    const m = PANEL_VIEWPORT_MARGIN;
    const { w: vw, h: vh } = getViewportCssSize();
    const effW = effectivePanelWidthPx(),
      effH = effectivePanelHeightPx();
    const { dx, dy } = wrapperOffsetFromFab(openPanelQuadrant.value);
    let wl = fabLeft.value + dx,
      wt = fabTop.value + dy;
    if (wl + effW > vw - m) wl = Math.max(m, vw - effW - m);
    if (wl < m) wl = m;
    if (wt + effH > vh - m) wt = Math.max(m, vh - effH - m);
    if (wt < m) wt = m;
    fabLeft.value = wl - dx;
    fabTop.value = wt - dy;
  }

  function resolveFabScreenQuadrant(): FabScreenQuadrant {
    if (fabLeft.value === null || fabTop.value === null) {
      const p = defaultPosition;
      if (p === 'top-left') return 'tl';
      if (p === 'top-right') return 'tr';
      if (p === 'bottom-left') return 'bl';
      return 'br';
    }
    const cx = fabLeft.value + fabSize / 2;
    const cy = fabTop.value + fabSize / 2;
    return (cx < window.innerWidth / 2 ? '' : 'r') === 'r'
      ? cy < window.innerHeight / 2
        ? 'tr'
        : 'br'
      : cy < window.innerHeight / 2
        ? 'tl'
        : 'bl';
  }

  function syncFabPixelFromWrapperDom(wrapperEl: HTMLElement | undefined) {
    if (!wrapperEl) return;
    const r = wrapperEl.getBoundingClientRect();
    const q = openPanelQuadrant.value;
    switch (q) {
      case 'tl':
        fabLeft.value = r.left;
        fabTop.value = r.top;
        break;
      case 'tr':
        fabLeft.value = r.right - fabSize;
        fabTop.value = r.top;
        break;
      case 'bl':
        fabLeft.value = r.left;
        fabTop.value = r.bottom - fabSize;
        break;
      default:
        fabLeft.value = r.right - fabSize;
        fabTop.value = r.bottom - fabSize;
        break;
    }
  }

  const panelResize = usePanelResize(
    panelUserSize,
    getPanelScreenRect,
    syncFabToPanelRect,
    ensurePanelInViewport,
    saveFabPos,
    clampPanelSize,
    isOpen,
  );

  // --- Header drag ---

  function cleanupPanelHeaderTentative() {
    if (!panelHeaderTentative) return;
    window.removeEventListener('pointermove', onPanelHeaderTentativeMove);
    window.removeEventListener('pointerup', onPanelHeaderTentativeUp, true);
    window.removeEventListener('pointercancel', onPanelHeaderTentativeUp, true);
    panelHeaderTentative = null;
  }

  function onPanelHeaderTentativeMove(e: PointerEvent) {
    if (!panelHeaderTentative || e.pointerId !== panelHeaderTentative.pointerId) return;
    const t = panelHeaderTentative;
    if (Math.hypot(e.clientX - t.startX, e.clientY - t.startY) < DRAG_CLICK_PX) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.getRangeAt(0).collapsed) {
      cleanupPanelHeaderTentative();
      return;
    }
    const headerEl = t.headerEl;
    cleanupPanelHeaderTentative();
    startPanelHeaderDragSession(e, headerEl);
  }

  function onPanelHeaderTentativeUp(e: PointerEvent) {
    if (!panelHeaderTentative || e.pointerId !== panelHeaderTentative.pointerId) return;
    cleanupPanelHeaderTentative();
  }

  function startPanelHeaderDragSession(e: PointerEvent, headerEl: HTMLElement) {
    e.preventDefault();
    if (fabLeft.value === null || fabTop.value === null) return;
    panelDrag.value = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    panelDragging.value = true;
    headerEl.setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onPanelHeaderPointerMove);
    window.addEventListener('pointerup', onPanelHeaderPointerUp, true);
    window.addEventListener('pointercancel', onPanelHeaderPointerUp, true);
  }

  function onPanelHeaderPointerDown(e: PointerEvent) {
    if (!isOpen.value || e.button !== 0) return;
    const target = e.target;
    if (target instanceof Element && target.closest('.ai-header-actions')) return;
    const headerEl = e.currentTarget as HTMLElement;
    if (target instanceof Element && target.closest('.ai-title')) {
      panelHeaderTentative = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        headerEl,
      };
      window.addEventListener('pointermove', onPanelHeaderTentativeMove);
      window.addEventListener('pointerup', onPanelHeaderTentativeUp, true);
      window.addEventListener('pointercancel', onPanelHeaderTentativeUp, true);
      return;
    }
    startPanelHeaderDragSession(e, headerEl);
  }

  function flushPanelHeaderDragFrame() {
    panelHeaderDragFlushRaf = 0;
    const dx = panelHeaderDragPendingDx,
      dy = panelHeaderDragPendingDy;
    if (dx === 0 && dy === 0) return;
    panelHeaderDragPendingDx = 0;
    panelHeaderDragPendingDy = 0;
    if (fabLeft.value === null || fabTop.value === null) return;
    fabLeft.value += dx;
    fabTop.value += dy;
    if (isOpen.value) panelHeaderDraggedWhileOpen = true;
    ensurePanelInViewport();
  }

  function onPanelHeaderPointerMove(e: PointerEvent) {
    if (!panelDrag.value || e.pointerId !== panelDrag.value.pointerId) return;
    if (fabLeft.value === null || fabTop.value === null) return;
    const d = panelDrag.value;
    panelHeaderDragPendingDx += e.clientX - d.lastX;
    panelHeaderDragPendingDy += e.clientY - d.lastY;
    d.lastX = e.clientX;
    d.lastY = e.clientY;
    if (!panelHeaderDragFlushRaf)
      panelHeaderDragFlushRaf = requestAnimationFrame(flushPanelHeaderDragFrame);
  }

  function onPanelHeaderPointerUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onPanelHeaderPointerMove);
    window.removeEventListener('pointerup', onPanelHeaderPointerUp, true);
    window.removeEventListener('pointercancel', onPanelHeaderPointerUp, true);
    if (!panelDrag.value || e.pointerId !== panelDrag.value.pointerId) return;
    panelDrag.value = null;
    panelDragging.value = false;
    if (panelHeaderDragFlushRaf) {
      cancelAnimationFrame(panelHeaderDragFlushRaf);
      panelHeaderDragFlushRaf = 0;
    }
    flushPanelHeaderDragFrame();
    saveFabPos();
  }

  // --- Lifecycle helpers ---

  function onPanelOpen(
    wrapperEl: HTMLElement | undefined,
    edgeDock: Ref<'none' | 'left' | 'right'>,
  ) {
    panelResize.panelResizedThisSession.value = false;
    panelHeaderDraggedWhileOpen = false;
    openPanelQuadrant.value = resolveFabScreenQuadrant();
    panelMountedForLayout.value = true;
    edgeDock.value = 'none';
    if (fabLeft.value === null || fabTop.value === null) {
      syncFabPixelFromWrapperDom(wrapperEl);
    }
    ensurePanelInViewport();
  }

  function onPanelClose() {
    panelExpanded.value = false;
    panelUserSize.value = null;
    panelResize.cleanupPanelResize();
    if (panelDrag.value) {
      window.removeEventListener('pointermove', onPanelHeaderPointerMove);
      window.removeEventListener('pointerup', onPanelHeaderPointerUp, true);
      window.removeEventListener('pointercancel', onPanelHeaderPointerUp, true);
      panelDrag.value = null;
      panelDragging.value = false;
    }
    if (panelHeaderDragFlushRaf) {
      cancelAnimationFrame(panelHeaderDragFlushRaf);
      panelHeaderDragFlushRaf = 0;
    }
    panelHeaderDragPendingDx = 0;
    panelHeaderDragPendingDy = 0;
    cleanupPanelHeaderTentative();
  }

  function onWinResizePanel() {
    if (panelUserSize.value) {
      panelUserSize.value = clampPanelSize(panelUserSize.value.w, panelUserSize.value.h);
    }
    ensurePanelInViewport();
  }

  function cleanupGeometry() {
    if (panelHeaderDragFlushRaf) cancelAnimationFrame(panelHeaderDragFlushRaf);
    panelResize.cleanupPanelResize();
    cleanupPanelHeaderTentative();
    window.removeEventListener('pointermove', onPanelHeaderPointerMove);
    window.removeEventListener('pointerup', onPanelHeaderPointerUp, true);
    window.removeEventListener('pointercancel', onPanelHeaderPointerUp, true);
  }

  const panelOpenFabAlignClass = computed(() => {
    if (!panelMountedForLayout.value || fabLeft.value === null) return '';
    return `fab-anchor-${openPanelQuadrant.value}`;
  });

  const FAB_R = fabSize / 2;
  const panelTransformOrigin = computed(() => {
    const origins: Record<FabScreenQuadrant, string> = {
      tl: `${FAB_R}px ${FAB_R}px`,
      tr: `calc(100% - ${FAB_R}px) ${FAB_R}px`,
      bl: `${FAB_R}px calc(100% - ${FAB_R}px)`,
      br: `calc(100% - ${FAB_R}px) calc(100% - ${FAB_R}px)`,
    };
    return origins[openPanelQuadrant.value];
  });

  return {
    panelExpanded,
    panelUserSize,
    openPanelQuadrant,
    panelMountedForLayout,
    panelDragging,
    panelOpenFabAlignClass,
    panelTransformOrigin,
    get panelResizedThisSession() {
      return panelResize.panelResizedThisSession.value;
    },
    get panelHeaderDraggedWhileOpen() {
      return panelHeaderDraggedWhileOpen;
    },
    effectivePanelWidthPx,
    effectivePanelHeightPx,
    togglePanelExpand,
    wrapperOffsetFromFab,
    ensurePanelInViewport,
    resolveFabScreenQuadrant,
    syncFabPixelFromWrapperDom,
    clampPanelSize,
    onPanelResizePointerDown: panelResize.onPanelResizePointerDown,
    onPanelHeaderPointerDown,
    onPanelOpen,
    onPanelClose,
    onWinResizePanel,
    cleanupGeometry,
    resizeZoneDefs: RESIZE_ZONES,
  };
}
