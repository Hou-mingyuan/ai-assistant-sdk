export const ASSISTANT_OUTSIDE_WHITELIST_SELECTOR = [
  '.ai-assistant-wrapper',
  '.ai-fab',
  '.ai-panel',
  '.assistant-loader-fab',
  '.ai-page-sel-bar',
  '.ai-cmd-palette-backdrop',
  '.ai-personalize-overlay',
  '.ai-form-fill-overlay',
  '.ai-sessions-drawer-overlay',
  '.ai-form-fill-toast',
  '.ai-image-lightbox-overlay',
].join(', ');

export interface OutsideCloseContext {
  isOpen: boolean;
  panelEl?: HTMLElement | null;
  wrapperEl?: HTMLElement | null;
  hasOpenModal?: boolean;
  hadTransientPopup?: boolean;
}

/**
 * Checks whether a pointer/mouse event originated inside the assistant wrapper,
 * panel, or any teleported assistant overlay/popover (supports Shadow DOM composedPath).
 */
export function isEventInsideAssistantUi(
  event: MouseEvent,
  panelEl?: HTMLElement | null,
  wrapperEl?: HTMLElement | null,
): boolean {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  for (const node of path) {
    if (node === wrapperEl || node === panelEl) return true;
    if (node instanceof Element && node.closest(ASSISTANT_OUTSIDE_WHITELIST_SELECTOR)) {
      return true;
    }
  }

  const target = event.target;
  if (target instanceof Node) {
    if (wrapperEl?.contains(target) || panelEl?.contains(target)) return true;
    if (target instanceof Element && target.closest(ASSISTANT_OUTSIDE_WHITELIST_SELECTOR)) {
      return true;
    }
  }

  return false;
}

/**
 * Determines whether clicking outside the assistant panel should collapse it back
 * into the floating action button.
 */
export function shouldClosePanelOnOutsideMousedown(
  event: MouseEvent,
  ctx: OutsideCloseContext,
): boolean {
  if (!ctx.isOpen) return false;
  if (event.button !== 0) return false;
  if (ctx.hasOpenModal || ctx.hadTransientPopup) return false;
  if (isEventInsideAssistantUi(event, ctx.panelEl, ctx.wrapperEl)) return false;
  return true;
}
