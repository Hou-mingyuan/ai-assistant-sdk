import { computed, watch, type ComputedRef, type Ref } from 'vue';
import type { CommandItem } from '../types/command-palette';
import type { I18nMessages } from '../utils/i18n';

/**
 * Refactor (T1-Wave2)：原本在 AiAssistant.vue 里以一个 ~110 行的大 computed 形式存在的
 * VSCode 风 Ctrl+K Command Palette 内置命令清单，整合到独立 composable。
 *
 * - 8 个内置命令：toggle-panel / new-session / clear / toggle-theme /
 *   open-personalize / open-memory / open-kb / open-keyboard-help
 * - 内置命令变化时自动 cmdPalette.clear() + register()
 * - 标签随 isOpen / isDark 实时切换（toggle-panel 显示「打开/关闭」、toggle-theme
 *   显示「浅色/深色」）
 *
 * 调用方还可以追加自定义命令：
 *   const { cmdPalette } = useBuiltInCommands({ ... });
 *   cmdPalette.register(myAdditionalCommands);
 */

export interface BuiltInCommandsDeps {
  t: ComputedRef<I18nMessages>;
  isOpen: Ref<boolean>;
  isDark: ComputedRef<boolean> | Ref<boolean>;
  startNewSession: () => void;
  clearMessages: () => void;
  toggleManualTheme: () => void;
  openPersonalize: () => void;
  memoryOpen: Ref<boolean>;
  kbPanelOpen: Ref<boolean>;
  keyboardHelpOpen: Ref<boolean>;
  /**
   * 来自外层 useCommandPalette() 的实例。本 composable 不持有 palette 状态，
   * 仅注册命令；这样调用方可以把 palette 暴露给宿主用 defineExpose。
   */
  cmdPalette: {
    register: (cmds: CommandItem[]) => void;
    clear: () => void;
    open: Ref<boolean>;
    commands: Ref<CommandItem[]>;
  };
  extraCommands?: ComputedRef<CommandItem[]> | Ref<CommandItem[]>;
}

export function useBuiltInCommands(deps: BuiltInCommandsDeps) {
  const {
    t,
    isOpen,
    isDark,
    startNewSession,
    clearMessages,
    toggleManualTheme,
    openPersonalize,
    memoryOpen,
    kbPanelOpen,
    keyboardHelpOpen,
    cmdPalette,
    extraCommands,
  } = deps;

  const builtInCommands = computed<CommandItem[]>(() => [
    {
      id: 'ai.toggle-panel',
      label: isOpen.value ? t.value.closePanel || '关闭面板' : t.value.fabOpen || '打开 AI 助手',
      group: '面板',
      icon: isOpen.value ? '✕' : '✨',
      shortcut: 'Esc / Ctrl+/',
      action: () => {
        isOpen.value = !isOpen.value;
      },
    },
    {
      id: 'ai.new-session',
      label: '新建会话 / New session',
      group: '会话',
      icon: '➕',
      keywords: ['new', 'session', '新建', '会话', '清空'],
      action: () => {
        startNewSession();
      },
    },
    {
      id: 'ai.clear',
      label: '清空当前会话 / Clear current chat',
      group: '会话',
      icon: '🗑',
      keywords: ['clear', '清空', 'reset'],
      action: () => {
        clearMessages();
      },
    },
    {
      id: 'ai.toggle-theme',
      label: isDark.value ? '切换到浅色 / Light mode' : '切换到深色 / Dark mode',
      group: '外观',
      icon: isDark.value ? '☀️' : '🌙',
      keywords: ['theme', 'dark', 'light', '主题', '暗黑', '浅色'],
      action: () => {
        toggleManualTheme();
      },
    },
    {
      id: 'ai.open-personalize',
      label: '个性化 / Personalize',
      group: '设置',
      icon: '⚙️',
      keywords: ['personalize', 'settings', '个性化', '系统提示词'],
      action: () => {
        openPersonalize();
      },
    },
    {
      id: 'ai.open-memory',
      label: t.value.memoryLabel || '记忆管理 / Memory',
      group: '知识',
      icon: '🧠',
      keywords: ['memory', '记忆', '事实'],
      action: () => {
        memoryOpen.value = true;
      },
    },
    {
      id: 'ai.open-kb',
      label: t.value.kbLabel || '知识库管理 / Knowledge base',
      group: '知识',
      icon: '📖',
      keywords: ['kb', 'knowledge', '知识库', 'rag'],
      action: () => {
        kbPanelOpen.value = true;
      },
    },
    {
      id: 'ai.open-keyboard-help',
      label: '键盘快捷键 / Keyboard shortcuts',
      group: '帮助',
      icon: '⌨️',
      shortcut: 'Shift+?',
      keywords: ['keyboard', 'shortcut', 'help', '快捷键', '帮助'],
      action: () => {
        keyboardHelpOpen.value = true;
      },
    },
    ...(extraCommands?.value ?? []),
  ]);

  watch(
    builtInCommands,
    (cmds) => {
      cmdPalette.clear();
      cmdPalette.register(cmds);
    },
    { immediate: true },
  );

  return { builtInCommands };
}
