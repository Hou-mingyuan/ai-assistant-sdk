import { ref, type Ref } from 'vue';

/**
 * Floating-action-button right-click context menu extracted from AiAssistant.vue
 * (refactor batch 4).
 *
 * Owns the menu open/position state and the dock/hide/close commands. Geometry
 * (viewport clamping) and the dock delegate are injected so the imperative DOM
 * logic stays out of the host component and is unit-testable. Behaviour is
 * identical to the previous inline implementation.
 */
export type FabDockEdge = 'none' | 'left' | 'right';

/** Menu width estimate (kept in sync with the styles) used for viewport clamping. */
const FAB_CTX_MENU_W = 236;

export interface UseFabContextMenuOptions {
  isOpen: Ref<boolean>;
  fabHidden: Ref<boolean>;
  edgeDock: Ref<FabDockEdge>;
  /** Returns the FAB element so position can be measured at click time. */
  getFab: () => HTMLElement | undefined;
  /** Delegates the actual edge docking to the host's fab drag controller. */
  dock: (edge: FabDockEdge) => void;
}

export function useFabContextMenu(deps: UseFabContextMenuOptions) {
  const { isOpen, fabHidden, edgeDock, getFab, dock } = deps;

  const fabCtxMenu = ref({ show: false, x: 0, y: 0 });

  function estimateFabCtxMenuHeight(): number {
    let n = 0;
    if (edgeDock.value !== 'left') n++;
    if (edgeDock.value !== 'right') n++;
    if (edgeDock.value !== 'none') n++;
    n++; // 隐藏至刷新
    const header = 48;
    const row = 52;
    const listPad = 14;
    return header + n * row + listPad;
  }

  function onFabContextMenu(e: MouseEvent) {
    e.preventDefault();
    if (isOpen.value || fabHidden.value) return;
    const fab = getFab();
    if (!fab) return;
    const fr = fab.getBoundingClientRect();
    const pad = 10;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const menuH = estimateFabCtxMenuHeight();
    let x = fr.left;
    let y = fr.bottom + 6;
    if (x + FAB_CTX_MENU_W > vw - pad) x = vw - FAB_CTX_MENU_W - pad;
    if (x < pad) x = pad;
    if (y + menuH > vh - pad) y = fr.top - menuH - 6;
    if (y < pad) y = pad;
    fabCtxMenu.value = { show: true, x, y };
  }

  function closeFabCtxMenu() {
    fabCtxMenu.value.show = false;
  }

  function hideFabUntilPageReload() {
    closeFabCtxMenu();
    fabHidden.value = true;
    isOpen.value = false;
  }

  function dockFab(edge: FabDockEdge) {
    dock(edge);
    closeFabCtxMenu();
  }

  return { fabCtxMenu, onFabContextMenu, closeFabCtxMenu, hideFabUntilPageReload, dockFab };
}
