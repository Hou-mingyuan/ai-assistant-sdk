/** 悬浮球拖拽/贴边/点击展开逻辑：pointer 事件驱动，支持左右贴边和位置持久化。 */
import { ref, computed, onUnmounted, type Ref } from 'vue';

const FAB_SIZE = 58;
const DRAG_CLICK_PX = 8;
const DOCK_BREAK_PX = 10;
const EDGE_MARGIN_PX = 8;
const EDGE_SNAP_MARGIN_PX = 12;
const FAB_POS_KEY = 'ai-assistant-fab-pos-v4';

export interface FabDragState {
  fabLeft: Ref<number | null>;
  fabTop: Ref<number | null>;
  edgeDock: Ref<'none' | 'left' | 'right'>;
  dockRevealed: Ref<boolean>;
  fabDragging: Ref<boolean>;
}

function getViewportSize(): { width: number; height: number } {
  const docEl = typeof document !== 'undefined' ? document.documentElement : null;
  const cw = docEl?.clientWidth ?? 0;
  const ch = docEl?.clientHeight ?? 0;
  return {
    width: cw > 0 ? cw : window.innerWidth,
    height: ch > 0 ? ch : window.innerHeight,
  };
}

// eslint-disable-next-line max-lines-per-function
export function useFabDrag(
  isOpen: Ref<boolean>,
  fabHidden: Ref<boolean>,
  persistFab: Ref<boolean>,
  position: string,
) {
  const fabLeft = ref<number | null>(null);
  const fabTop = ref<number | null>(null);
  const edgeDock = ref<'none' | 'left' | 'right'>('none');
  const dockRevealed = ref(false);
  const fabDragging = ref(false);
  const fabPositionCustomized = ref(false);
  const fabDrag = ref<{
    pointerId: number;
    startX: number;
    startY: number;
    originLeft: number;
    originTop: number;
    lastRawLeft: number;
  } | null>(null);

  function clampFabTop(top: number): number {
    const { height } = getViewportSize();
    const maxT = Math.max(EDGE_MARGIN_PX, height - FAB_SIZE - EDGE_MARGIN_PX);
    return Math.max(EDGE_MARGIN_PX, Math.min(top, maxT));
  }

  function clampFabPos(left: number, top: number) {
    const { width } = getViewportSize();
    const maxL = Math.max(EDGE_MARGIN_PX, width - FAB_SIZE - EDGE_MARGIN_PX);
    return {
      left: Math.max(EDGE_MARGIN_PX, Math.min(left, maxL)),
      top: clampFabTop(top),
    };
  }

  function defaultFabCoords(): { left: number; top: number } {
    const m = 24;
    const { width: w, height: h } = getViewportSize();
    switch (position) {
      case 'bottom-left':
        return { left: m, top: h - FAB_SIZE - m };
      case 'top-right':
        return { left: w - FAB_SIZE - m, top: m };
      case 'top-left':
        return { left: m, top: m };
      default:
        return { left: w - FAB_SIZE - m, top: h - FAB_SIZE - m };
    }
  }

  function applyDockedCoords(edge: 'left' | 'right', top: number) {
    const { width } = getViewportSize();
    fabLeft.value = edge === 'left' ? 0 : Math.max(0, width - FAB_SIZE);
    fabTop.value = clampFabTop(top);
  }

  function loadFabPos() {
    if (!persistFab.value) return;
    try {
      const raw = localStorage.getItem(FAB_POS_KEY);
      if (!raw) return;
      const o = JSON.parse(raw);
      if (typeof o.left === 'number' && typeof o.top === 'number') {
        const persistedEdge = o.edgeDock === 'left' || o.edgeDock === 'right' ? o.edgeDock : 'none';
        edgeDock.value = persistedEdge;
        if (persistedEdge === 'left' || persistedEdge === 'right') {
          applyDockedCoords(persistedEdge, o.top);
          fabPositionCustomized.value = typeof o.customized === 'boolean' ? o.customized : true;
          return;
        }
        const c = clampFabPos(o.left, o.top);
        fabLeft.value = c.left;
        fabTop.value = c.top;
        if (typeof o.customized === 'boolean') {
          fabPositionCustomized.value = o.customized;
        } else {
          const d = defaultFabCoords();
          fabPositionCustomized.value = Math.hypot(c.left - d.left, c.top - d.top) > 2;
        }
      }
    } catch {
      /* Ignore malformed persisted positions. */
    }
  }

  function saveFabPos(edgeDockOverride?: 'none' | 'left' | 'right') {
    if (!persistFab.value || fabLeft.value === null || fabTop.value === null) return;
    const dock = edgeDockOverride ?? edgeDock.value;
    const { width, height } = getViewportSize();
    try {
      localStorage.setItem(
        FAB_POS_KEY,
        JSON.stringify({
          left: fabLeft.value,
          top: fabTop.value,
          edgeDock: dock,
          customized: fabPositionCustomized.value,
          viewportWidth: width,
          viewportHeight: height,
        }),
      );
    } catch {
      /* Ignore localStorage write failures. */
    }
  }

  function dockFab(edge: 'none' | 'left' | 'right') {
    fabPositionCustomized.value = true;
    dockRevealed.value = false;
    if (fabLeft.value === null || fabTop.value === null) {
      const d = defaultFabCoords();
      fabLeft.value = d.left;
      fabTop.value = d.top;
    }
    edgeDock.value = edge;
    if (edge === 'left' || edge === 'right') {
      applyDockedCoords(edge, fabTop.value!);
    } else {
      const { width } = getViewportSize();
      if (fabLeft.value! <= EDGE_MARGIN_PX) fabLeft.value = 24;
      else if (fabLeft.value! >= width - FAB_SIZE - EDGE_MARGIN_PX) {
        fabLeft.value = width - FAB_SIZE - 24;
      }
      const c = clampFabPos(fabLeft.value!, fabTop.value!);
      fabLeft.value = c.left;
      fabTop.value = c.top;
    }
    saveFabPos();
  }

  function syncDockedFabToViewport() {
    if (fabLeft.value === null || fabTop.value === null) return;
    if (edgeDock.value === 'left' || edgeDock.value === 'right') {
      applyDockedCoords(edgeDock.value, fabTop.value);
      return;
    }
    const c = clampFabPos(fabLeft.value, fabTop.value);
    fabLeft.value = c.left;
    fabTop.value = c.top;
  }

  function onFabPointerMove(e: PointerEvent) {
    if (!fabDrag.value || e.pointerId !== fabDrag.value.pointerId) return;
    const d = fabDrag.value;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.hypot(dx, dy) > DOCK_BREAK_PX) {
      edgeDock.value = 'none';
      dockRevealed.value = false;
      fabPositionCustomized.value = true;
    }
    if (edgeDock.value !== 'none') return;
    const rawLeft = d.originLeft + dx;
    d.lastRawLeft = rawLeft;
    const c = clampFabPos(rawLeft, d.originTop + dy);
    fabLeft.value = c.left;
    fabTop.value = c.top;
  }

  function onFabPointerUp(e: PointerEvent) {
    window.removeEventListener('pointermove', onFabPointerMove);
    window.removeEventListener('pointerup', onFabPointerUp);
    window.removeEventListener('pointercancel', onFabPointerUp);
    if (!fabDrag.value || e.pointerId !== fabDrag.value.pointerId) return;
    const d = fabDrag.value;
    fabDrag.value = null;
    fabDragging.value = false;
    const moved = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (moved < DRAG_CLICK_PX) {
      if (edgeDock.value !== 'none' && !dockRevealed.value) {
        dockRevealed.value = true;
        return;
      }
      dockRevealed.value = false;
      isOpen.value = true;
    } else if (edgeDock.value === 'none') {
      const { width } = getViewportSize();
      if (d.lastRawLeft <= EDGE_SNAP_MARGIN_PX) {
        dockFab('left');
        return;
      }
      if (d.lastRawLeft >= width - FAB_SIZE - EDGE_SNAP_MARGIN_PX) {
        dockFab('right');
        return;
      }
    }
    saveFabPos();
  }

  function onFabPointerDown(e: PointerEvent) {
    if (isOpen.value || fabHidden.value || e.button !== 0) return;
    e.preventDefault();
    if (fabLeft.value === null || fabTop.value === null) {
      const d = defaultFabCoords();
      fabLeft.value = d.left;
      fabTop.value = d.top;
    }
    let L = fabLeft.value!;
    const T = fabTop.value!;
    if (edgeDock.value === 'left') L = 0;
    else if (edgeDock.value === 'right') L = Math.max(0, getViewportSize().width - FAB_SIZE);
    fabLeft.value = L;
    fabTop.value = T;
    fabDrag.value = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originLeft: L,
      originTop: T,
      lastRawLeft: L,
    };
    fabDragging.value = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    window.addEventListener('pointermove', onFabPointerMove);
    window.addEventListener('pointerup', onFabPointerUp);
    window.addEventListener('pointercancel', onFabPointerUp);
  }

  function cleanupFabDrag() {
    window.removeEventListener('pointermove', onFabPointerMove);
    window.removeEventListener('pointerup', onFabPointerUp);
    window.removeEventListener('pointercancel', onFabPointerUp);
    fabDrag.value = null;
    fabDragging.value = false;
  }

  function markFabPositionCustomized() {
    fabPositionCustomized.value = true;
  }

  onUnmounted(cleanupFabDrag);

  const edgeDockClass = computed(() => {
    if (isOpen.value || fabDragging.value) return '';
    if (edgeDock.value === 'left') return 'edge-dock-left';
    if (edgeDock.value === 'right') return 'edge-dock-right';
    return '';
  });

  return {
    fabLeft,
    fabTop,
    edgeDock,
    dockRevealed,
    fabDragging,
    fabPositionCustomized,
    edgeDockClass,
    clampFabPos,
    defaultFabCoords,
    loadFabPos,
    saveFabPos,
    markFabPositionCustomized,
    dockFab,
    syncDockedFabToViewport,
    onFabPointerDown,
    cleanupFabDrag,
    FAB_SIZE,
  };
}
