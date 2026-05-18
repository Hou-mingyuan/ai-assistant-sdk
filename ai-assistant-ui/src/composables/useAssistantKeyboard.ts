import type { Ref } from 'vue';
import type { AiAssistantOptions } from '../index';

type ShowStateRef = Ref<{ show: boolean }>;

export interface UseAssistantKeyboardOptions {
  options: AiAssistantOptions;
  panelRef: Ref<HTMLElement | undefined>;
  wrapperRef: Ref<HTMLElement | undefined>;
  isOpen: Ref<boolean>;
  fabHidden: Ref<boolean>;
  mode: Ref<'translate' | 'summarize' | 'chat'>;
  keyboardHelpOpen: Ref<boolean>;
  personalizeOpen: Ref<boolean>;
  diagnosticsOpen: Ref<boolean>;
  sessionsDrawerOpen: Ref<boolean>;
  inlineTranslatePopover: ShowStateRef;
  msgCtxMenu: ShowStateRef;
  fabCtxMenu: ShowStateRef;
  matchesScreenCaptureShortcut: (event: KeyboardEvent) => boolean;
  captureScreenIntoPendingImage: () => void | Promise<void>;
  clearMessages: () => void;
  startNewSession: () => void;
  toggleBatchExportMenu: () => void;
  toggleMemoryPanel: () => void;
  closeInlineTranslatePopover: () => void;
  closeMsgCtxMenu: () => void;
  closeFabCtxMenu: () => void;
}

export function useAssistantKeyboard(opts: UseAssistantKeyboardOptions) {
  function trapFocus(e: KeyboardEvent) {
    if (e.key !== 'Tab' || !opts.panelRef.value) return;
    const focusable = opts.panelRef.value.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  function matchesToggleShortcut(e: KeyboardEvent): boolean {
    const shortcut = opts.options.toggleShortcut;
    if (shortcut === false) return false;
    const raw = shortcut || '/';
    const parts = raw.split('+');
    const mainKey = parts[parts.length - 1];
    if (e.key !== mainKey && e.key.toLowerCase() !== mainKey.toLowerCase()) return false;
    const modifiers = parts.slice(0, -1).map((m) => m.toLowerCase());
    const isMac = navigator.platform?.startsWith('Mac') || navigator.userAgent?.includes('Mac');
    const needCtrl = modifiers.includes('ctrl') || (!modifiers.some((m) => m === 'meta') && !isMac);
    const needMeta = modifiers.includes('meta') || (!modifiers.some((m) => m === 'ctrl') && isMac);
    const needShift = modifiers.includes('shift');
    const needAlt = modifiers.includes('alt');
    return (
      (needCtrl ? e.ctrlKey : !e.ctrlKey || isMac) &&
      (needMeta ? e.metaKey : !e.metaKey || !isMac) &&
      needShift === e.shiftKey &&
      needAlt === e.altKey
    );
  }

  function onEscKeydown(e: KeyboardEvent) {
    if (matchesToggleShortcut(e)) {
      e.preventDefault();
      if (opts.fabHidden.value) return;
      opts.isOpen.value = !opts.isOpen.value;
      return;
    }

    const ctrl = e.ctrlKey || e.metaKey;
    if (opts.matchesScreenCaptureShortcut(e) && opts.isOpen.value && opts.mode.value === 'chat') {
      e.preventDefault();
      void opts.captureScreenIntoPendingImage();
      return;
    }
    if (ctrl && e.shiftKey && !e.altKey && opts.isOpen.value) {
      switch (e.key.toLowerCase()) {
        case 'l':
          e.preventDefault();
          opts.clearMessages();
          return;
        case 'n':
          e.preventDefault();
          opts.startNewSession();
          return;
        case 'f': {
          e.preventDefault();
          const searchEl =
            opts.wrapperRef.value?.querySelector<HTMLInputElement>('.ai-chat-search-input');
          if (searchEl) searchEl.focus();
          return;
        }
        case 's':
          e.preventDefault();
          opts.toggleBatchExportMenu();
          return;
        case 'm':
          e.preventDefault();
          opts.toggleMemoryPanel();
          return;
      }
    }

    if (ctrl && !e.shiftKey && !e.altKey && e.key === '/' && opts.isOpen.value) {
      e.preventDefault();
      opts.keyboardHelpOpen.value = !opts.keyboardHelpOpen.value;
      return;
    }

    if (e.key !== 'Escape') return;
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl?.dataset?.recallActive === 'true') return;
    if (opts.inlineTranslatePopover.value.show) {
      e.preventDefault();
      opts.closeInlineTranslatePopover();
      return;
    }
    if (opts.msgCtxMenu.value.show) {
      e.preventDefault();
      opts.closeMsgCtxMenu();
      return;
    }
    if (opts.fabCtxMenu.value.show) {
      e.preventDefault();
      opts.closeFabCtxMenu();
      return;
    }
    if (opts.personalizeOpen.value) {
      e.preventDefault();
      opts.personalizeOpen.value = false;
      return;
    }
    if (opts.diagnosticsOpen.value) {
      e.preventDefault();
      opts.diagnosticsOpen.value = false;
      return;
    }
    if (opts.keyboardHelpOpen.value) {
      e.preventDefault();
      opts.keyboardHelpOpen.value = false;
      return;
    }
    if (opts.sessionsDrawerOpen.value) {
      e.preventDefault();
      opts.sessionsDrawerOpen.value = false;
      return;
    }
    if (document.querySelector('.ai-header-settings-menu')) {
      e.preventDefault();
      return;
    }
    if (opts.isOpen.value) {
      e.preventDefault();
      opts.isOpen.value = false;
    }
  }

  return { trapFocus, matchesToggleShortcut, onEscKeydown };
}
