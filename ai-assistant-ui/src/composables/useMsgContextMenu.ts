import { ref, nextTick, onUnmounted, type Ref, type ComputedRef } from 'vue';
import { streamChat } from '../utils/api';
import type { I18nMessages } from '../utils/i18n';

interface MsgCtxMenuState {
  show: boolean;
  x: number;
  y: number;
  index: number;
  selectionText: string;
  pointerX: number;
  pointerY: number;
  anchorTop: number;
  selLeft: number;
  selRight: number;
  selTop: number;
  selBottom: number;
}

interface InlineTransPopState {
  show: boolean;
  x: number;
  y: number;
  text: string;
  loading: boolean;
  error: string;
  pointerX: number;
  pointerY: number;
  anchorTop: number;
  selLeft: number;
  selRight: number;
  selTop: number;
  selBottom: number;
}

const MSG_CTX_MENU_W = 228;
const MSG_CTX_MENU_H = 280;

interface MsgCtxDeps {
  messages: Ref<{ role: string; content: string; contentArchive?: string }[]>;
  loading: Ref<boolean>;
  baseUrl?: string;
  accessToken?: string;
  targetLang: Ref<string>;
  t: ComputedRef<I18nMessages>;
  reportError: (source: string, msg: string) => void;
}

export function useMsgContextMenu(deps: MsgCtxDeps) {
  const msgCtxMenu = ref<MsgCtxMenuState>({
    show: false,
    x: 0,
    y: 0,
    index: -1,
    selectionText: '',
    pointerX: 0,
    pointerY: 0,
    anchorTop: 0,
    selLeft: 0,
    selRight: 0,
    selTop: 0,
    selBottom: 0,
  });

  const inlineTranslatePopover = ref<InlineTransPopState>({
    show: false,
    x: 0,
    y: 0,
    text: '',
    loading: false,
    error: '',
    pointerX: 0,
    pointerY: 0,
    anchorTop: 0,
    selLeft: 0,
    selRight: 0,
    selTop: 0,
    selBottom: 0,
  });

  let inlineTranslateAbortCtrl: AbortController | null = null;
  let inlinePopResizeHandler: (() => void) | null = null;
  let positionInlinePopRaf = 0;

  function closeMsgCtxMenu() {
    msgCtxMenu.value = {
      show: false,
      x: 0,
      y: 0,
      index: -1,
      selectionText: '',
      pointerX: 0,
      pointerY: 0,
      anchorTop: 0,
      selLeft: 0,
      selRight: 0,
      selTop: 0,
      selBottom: 0,
    };
  }

  function getSelectionInsideElement(el: HTMLElement): string {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return '';
    const range = sel.getRangeAt(0);
    if (!el.contains(range.commonAncestorContainer)) return '';
    return sel.toString().trim();
  }

  function onBubbleContextMenu(e: MouseEvent, globalIndex: number, role: string) {
    if (role !== 'assistant' || deps.loading.value) return;
    const m = deps.messages.value[globalIndex];
    if (!m || m.role !== 'assistant' || !m.content?.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    const bubble = e.currentTarget as HTMLElement;
    const selectionText = getSelectionInsideElement(bubble);
    const pad = 8,
      selGap = 10;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    let x = e.clientX,
      y = e.clientY;
    if (x + MSG_CTX_MENU_W > vw - pad) x = vw - MSG_CTX_MENU_W - pad;
    if (y + MSG_CTX_MENU_H > vh - pad) y = vh - MSG_CTX_MENU_H - pad;
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    let ptrX = e.clientX,
      ptrY = e.clientY,
      anchorTop = e.clientY;
    let selLeft = 0,
      selRight = 0,
      selTop = 0,
      selBottom = 0;
    if (selectionText) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        if (bubble.contains(range.commonAncestorContainer)) {
          const rr = range.getBoundingClientRect();
          if ((rr.width > 0 || rr.height > 0) && rr.bottom >= rr.top) {
            selLeft = rr.left;
            selRight = rr.right;
            selTop = rr.top;
            selBottom = rr.bottom;
            ptrX = rr.right + selGap;
            ptrY = rr.top;
            anchorTop = rr.top;
          }
        }
      }
    }
    msgCtxMenu.value = {
      show: true,
      x,
      y,
      index: globalIndex,
      selectionText,
      pointerX: ptrX,
      pointerY: ptrY,
      anchorTop,
      selLeft,
      selRight,
      selTop,
      selBottom,
    };
  }

  async function copyAssistantSelection() {
    const text = msgCtxMenu.value.selectionText;
    closeMsgCtxMenu();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      deps.reportError('copy', 'clipboard unavailable');
    }
  }

  function inferInlineTranslateTargetLang(text: string, fallback: string): string {
    const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
    const latin = (text.match(/[a-zA-Z]/g) || []).length;
    if (cjk > 0 && latin === 0) return 'en';
    if (latin > 0 && cjk === 0) return 'zh';
    if (cjk > 0 && latin > 0) return cjk >= latin ? 'en' : 'zh';
    const f = (fallback || 'zh').toLowerCase();
    return f === 'en' || f.startsWith('en') ? 'zh' : 'en';
  }

  function detachInlinePopLayoutListeners() {
    if (inlinePopResizeHandler) {
      window.removeEventListener('resize', inlinePopResizeHandler);
      inlinePopResizeHandler = null;
    }
  }

  function schedulePositionInlineTranslatePopover() {
    if (!inlineTranslatePopover.value.show) return;
    if (positionInlinePopRaf) return;
    positionInlinePopRaf = requestAnimationFrame(() => {
      positionInlinePopRaf = 0;
      positionInlineTranslatePopoverNearPointer();
    });
  }

  function positionInlineTranslatePopoverNearPointer() {
    const pop = inlineTranslatePopover.value;
    if (!pop.show) return;
    const pad = 8,
      gap = 10;
    const vw = window.innerWidth,
      vh = window.innerHeight;
    const pw = Math.min(360, vw - 2 * pad);
    const ph = Math.max(120, 72);
    const sl = pop.selLeft,
      sr = pop.selRight,
      st = pop.selTop,
      sb = pop.selBottom;
    const hasSel = sr > sl + 2 && sb >= st;
    let left: number, top: number;
    if (hasSel) {
      const placeRight = sr + gap,
        placeLeft = sl - pw - gap;
      if (placeRight + pw <= vw - pad) left = placeRight;
      else if (placeLeft >= pad) left = placeLeft;
      else left = Math.max(pad, Math.min(sl, vw - pw - pad));
      top = st + (sb - st) / 2 - ph / 2;
      top = Math.max(pad, Math.min(top, vh - ph - pad));
    } else {
      left = pop.pointerX;
      top = pop.pointerY;
      if (left + pw > vw - pad) left = Math.max(pad, vw - pw - pad);
      if (left < pad) left = pad;
      if (top + ph > vh - pad) top = Math.max(pad, pop.anchorTop - ph - 4);
      if (top < pad) top = pad;
    }
    pop.x = left;
    pop.y = top;
  }

  function attachInlinePopLayoutListeners() {
    detachInlinePopLayoutListeners();
    inlinePopResizeHandler = () => schedulePositionInlineTranslatePopover();
    window.addEventListener('resize', inlinePopResizeHandler, { passive: true });
  }

  function closeInlineTranslatePopover() {
    inlineTranslateAbortCtrl?.abort();
    inlineTranslateAbortCtrl = null;
    detachInlinePopLayoutListeners();
    if (positionInlinePopRaf) {
      cancelAnimationFrame(positionInlinePopRaf);
      positionInlinePopRaf = 0;
    }
    inlineTranslatePopover.value = {
      show: false,
      x: 0,
      y: 0,
      text: '',
      loading: false,
      error: '',
      pointerX: 0,
      pointerY: 0,
      anchorTop: 0,
      selLeft: 0,
      selRight: 0,
      selTop: 0,
      selBottom: 0,
    };
  }

  async function translateAssistantSelection() {
    const text = msgCtxMenu.value.selectionText;
    if (!text || !deps.baseUrl) {
      closeMsgCtxMenu();
      return;
    }
    const { pointerX, pointerY, anchorTop, selLeft, selRight, selTop, selBottom } =
      msgCtxMenu.value;
    closeMsgCtxMenu();
    inlineTranslateAbortCtrl?.abort();
    inlineTranslateAbortCtrl = new AbortController();
    const signal = inlineTranslateAbortCtrl.signal;
    inlineTranslatePopover.value = {
      show: true,
      x: 0,
      y: 0,
      text: '',
      loading: true,
      error: '',
      pointerX,
      pointerY,
      anchorTop,
      selLeft,
      selRight,
      selTop,
      selBottom,
    };
    await nextTick();
    schedulePositionInlineTranslatePopover();
    attachInlinePopLayoutListeners();
    try {
      const payload = {
        action: 'translate' as const,
        text,
        targetLang: inferInlineTranslateTargetLang(text, deps.targetLang.value),
      };
      let acc = '';
      let textFlushRaf = 0;
      const stream = streamChat(deps.baseUrl, payload, deps.accessToken, signal);
      try {
        for await (const chunk of stream) {
          if (signal.aborted) {
            inlineTranslatePopover.value.loading = false;
            return;
          }
          acc += chunk;
          if (!textFlushRaf) {
            textFlushRaf = requestAnimationFrame(() => {
              textFlushRaf = 0;
              if (!signal.aborted) {
                inlineTranslatePopover.value.text = acc;
                schedulePositionInlineTranslatePopover();
              }
            });
          }
        }
      } finally {
        if (textFlushRaf) {
          cancelAnimationFrame(textFlushRaf);
          textFlushRaf = 0;
        }
      }
      if (!signal.aborted) {
        inlineTranslatePopover.value.text = acc;
        schedulePositionInlineTranslatePopover();
      }
    } catch (e: unknown) {
      if (!signal.aborted) {
        inlineTranslatePopover.value.error =
          (e instanceof Error ? e.message : String(e)) || 'Translation failed';
      }
    } finally {
      inlineTranslatePopover.value.loading = false;
    }
  }

  function deleteAssistantAt(globalIndex: number) {
    closeMsgCtxMenu();
    if (globalIndex < 0 || globalIndex >= deps.messages.value.length) return;
    deps.messages.value.splice(globalIndex, 1);
  }

  onUnmounted(() => {
    closeInlineTranslatePopover();
  });

  return {
    msgCtxMenu,
    inlineTranslatePopover,
    MSG_CTX_MENU_W,
    MSG_CTX_MENU_H,
    closeMsgCtxMenu,
    onBubbleContextMenu,
    copyAssistantSelection,
    translateAssistantSelection,
    closeInlineTranslatePopover,
    deleteAssistantAt,
    schedulePositionInlineTranslatePopover,
    detachInlinePopLayoutListeners,
  };
}
