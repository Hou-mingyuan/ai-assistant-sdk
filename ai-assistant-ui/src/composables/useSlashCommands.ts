import { ref, computed, type Ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';

export interface SlashCommand {
  name: string;
  description: string;
  icon: string;
  action: () => boolean | void;
}

export interface UseSlashCommandsOptions {
  input: Ref<string>;
  t: Ref<I18nMessages>;
  onClear: () => void;
  onNewSession: () => void;
  onUploadFile?: () => void;
  onFormFill?: () => void;
  formAutoFillEnabled?: Ref<boolean>;
}

export function useSlashCommands(opts: UseSlashCommandsOptions) {
  const selectedIndex = ref(0);
  const forceHide = ref(false);

  function buildCommands(): SlashCommand[] {
    const cmds: SlashCommand[] = [];
    if (opts.formAutoFillEnabled?.value && opts.onFormFill) {
      cmds.push({
        name: '/fill',
        description: opts.t.value.formFillAction || '从剪贴板自动填充当前表单',
        icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11',
        action: () => {
          opts.onFormFill?.();
          return true;
        },
      });
    }
    if (opts.onUploadFile) {
      cmds.push({
        name: '/upload',
        description: opts.t.value.uploadFile || '上传文件提问或摘要',
        icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z',
        action: () => {
          opts.onUploadFile?.();
          return true;
        },
      });
    }
    cmds.push(
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
        name: '/clear',
        description: opts.t.value.clear || '清空对话',
        icon: 'M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z',
        action: () => {
          opts.onClear();
          return true;
        },
      },
    );
    return cmds;
  }

  const query = computed(() => {
    const v = opts.input.value;
    if (!v.startsWith('/')) return null;
    if (v.includes(' ') || v.includes('\n')) return null;
    return v.toLowerCase();
  });

  const visible = computed(() => !forceHide.value && query.value !== null);

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
    if (!visible.value || cmds.length === 0) return false;
    const cmd = cmds[selectedIndex.value] || cmds[0];
    if (!cmd) return false;
    const clear = cmd.action();
    if (clear !== false) opts.input.value = '';
    resetState();
    return true;
  }

  function handleKeydown(e: KeyboardEvent): boolean {
    if (!visible.value) return false;
    const len = filteredCommands.value.length;
    if (len === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        forceHide.value = true;
        return true;
      }
      return false;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      moveSelection(1);
      return true;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      moveSelection(-1);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      return executeSelected();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      forceHide.value = true;
      return true;
    }
    return false;
  }

  function onInputChange() {
    forceHide.value = false;
    selectedIndex.value = 0;
  }

  return {
    visible,
    filteredCommands,
    selectedIndex,
    handleKeydown,
    executeSelected,
    moveSelection,
    onInputChange,
    resetState,
  };
}
