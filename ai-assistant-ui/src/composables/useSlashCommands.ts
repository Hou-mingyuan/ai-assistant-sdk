import { ref, computed, type Ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';

export interface SlashCommand {
  /** e.g. "/clear" */
  name: string;
  /** Short description shown in the popup */
  description: string;
  /** SVG icon path(s) for 24x24 viewBox */
  icon: string;
  /** Callback when the command is selected. Return `true` to clear input. */
  action: () => boolean | void;
}

export interface UseSlashCommandsOptions {
  input: Ref<string>;
  t: Ref<I18nMessages>;
  onClear: () => void;
  onNewSession: () => void;
  onExport: () => void;
  onChangeMode: (mode: 'translate' | 'summarize' | 'chat') => void;
  extraCommands?: SlashCommand[];
}

export function useSlashCommands(opts: UseSlashCommandsOptions) {
  const selectedIndex = ref(0);
  const forceHide = ref(false);

  function buildCommands(): SlashCommand[] {
    return [
      {
        name: '/clear',
        description: opts.t.value.clear || '清除对话',
        icon: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        action: () => {
          opts.onClear();
          return true;
        },
      },
      {
        name: '/new',
        description: opts.t.value.newSession || '新会话',
        icon: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z',
        action: () => {
          opts.onNewSession();
          return true;
        },
      },
      {
        name: '/translate',
        description: opts.t.value.translate || '翻译',
        icon: 'M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z',
        action: () => {
          opts.onChangeMode('translate');
          return true;
        },
      },
      {
        name: '/summarize',
        description: opts.t.value.summarize || '摘要',
        icon: 'M14 17H4v2h10v-2zm6-8H4v2h16V9zM4 15h16v-2H4v2zM4 5v2h16V5H4z',
        action: () => {
          opts.onChangeMode('summarize');
          return true;
        },
      },
      {
        name: '/chat',
        description: opts.t.value.chat || '对话',
        icon: 'M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z',
        action: () => {
          opts.onChangeMode('chat');
          return true;
        },
      },
      {
        name: '/export',
        description: opts.t.value.export || '导出',
        icon: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
        action: () => {
          opts.onExport();
          return true;
        },
      },
      ...(opts.extraCommands ?? []),
    ];
  }

  const query = computed(() => {
    const v = opts.input.value;
    if (!v.startsWith('/')) return null;
    if (v.includes(' ') || v.includes('\n')) return null;
    return v.toLowerCase();
  });

  const visible = computed(() => {
    if (forceHide.value) return false;
    return query.value !== null;
  });

  const filteredCommands = computed(() => {
    const q = query.value;
    if (q === null) return [];
    if (q === '/') return buildCommands();
    return buildCommands().filter((c) => c.name.startsWith(q));
  });

  function resetState() {
    selectedIndex.value = 0;
    forceHide.value = false;
  }

  function moveSelection(delta: number) {
    const len = filteredCommands.value.length;
    if (len === 0) return;
    selectedIndex.value = (selectedIndex.value + delta + len) % len;
  }

  function executeSelected(): boolean {
    const cmds = filteredCommands.value;
    if (cmds.length === 0) return false;
    const idx = Math.min(selectedIndex.value, cmds.length - 1);
    const cmd = cmds[idx];
    const shouldClear = cmd.action();
    if (shouldClear !== false) {
      opts.input.value = '';
    }
    resetState();
    return true;
  }

  function dismiss() {
    forceHide.value = true;
  }

  /** Call on every input change to reset forced-hide when user re-types `/`. */
  function onInputChange() {
    if (opts.input.value.startsWith('/')) {
      forceHide.value = false;
      selectedIndex.value = 0;
    }
  }

  /**
   * Handle keydown in textarea. Returns `true` if the event was consumed
   * (caller should `preventDefault`).
   */
  function handleKeydown(e: KeyboardEvent): boolean {
    if (!visible.value || filteredCommands.value.length === 0) return false;

    switch (e.key) {
      case 'ArrowUp':
        moveSelection(-1);
        return true;
      case 'ArrowDown':
        moveSelection(1);
        return true;
      case 'Enter':
        if (!e.shiftKey && !e.ctrlKey) {
          return executeSelected();
        }
        return false;
      case 'Tab':
        return executeSelected();
      case 'Escape':
        dismiss();
        return true;
      default:
        return false;
    }
  }

  return {
    visible,
    filteredCommands,
    selectedIndex,
    handleKeydown,
    executeSelected,
    dismiss,
    onInputChange,
  };
}
