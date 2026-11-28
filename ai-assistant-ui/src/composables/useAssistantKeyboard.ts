import type { Ref } from 'vue';
import type { AiAssistantOptions } from '../index';

export interface UseAssistantKeyboardOptions {
  options: AiAssistantOptions;
  panelRef: Ref<HTMLElement | undefined>;
  isOpen: Ref<boolean>;
  panelExpanded: Ref<boolean>;
  fabHidden: Ref<boolean>;
  sessionsDrawerOpen: Ref<boolean>;
  edgeDockSettingsOpen?: Ref<boolean>;
  formAutoFillDialogOpen?: Ref<boolean>;
  onCloseFormAutoFillDialog?: () => void;
  clearMessages: () => void;
  startNewSession: () => void;
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
    if (ctrl && e.shiftKey && !e.altKey && opts.isOpen.value) {
      if (e.key.toLowerCase() === 'l') {
        e.preventDefault();
        opts.clearMessages();
        return;
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        opts.startNewSession();
        return;
      }
    }

    if (e.key !== 'Escape') return;
    const activeEl = document.activeElement as HTMLElement | null;
    if (activeEl?.dataset?.recallActive === 'true') return;
    if (opts.edgeDockSettingsOpen?.value) {
      e.preventDefault();
      opts.edgeDockSettingsOpen.value = false;
      return;
    }
    if (opts.formAutoFillDialogOpen?.value) {
      e.preventDefault();
      opts.onCloseFormAutoFillDialog?.();
      return;
    }
    if (opts.sessionsDrawerOpen.value) {
      e.preventDefault();
      opts.sessionsDrawerOpen.value = false;
      return;
    }
    if (opts.isOpen.value && opts.panelExpanded.value) {
      e.preventDefault();
      opts.panelExpanded.value = false;
      return;
    }
    if (opts.isOpen.value) {
      e.preventDefault();
      opts.isOpen.value = false;
    }
  }

  return { trapFocus, matchesToggleShortcut, onEscKeydown };
}
