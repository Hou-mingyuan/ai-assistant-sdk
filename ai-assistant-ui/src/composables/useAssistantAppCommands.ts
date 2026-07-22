import { computed, type ComputedRef, type Ref } from 'vue';

import type { CommandItem } from '../types/command-palette';
import type { I18nMessages } from '../utils/i18n';
import type { SlashCommand } from './useSlashCommands';

export interface UseAssistantAppCommandsOptions {
  t: ComputedRef<I18nMessages>;
  isOpen: Ref<boolean>;
  isDark: ComputedRef<boolean> | Ref<boolean>;
  startNewSession: () => void;
  clearMessages: () => void;
  toggleManualTheme: () => void;
  openPersonalize: () => void;
  keyboardHelpOpen: Ref<boolean>;
}

export function useAssistantAppCommands(options: UseAssistantAppCommandsOptions) {
  const slashCommands: SlashCommand[] = [];
  const commandPaletteCommands = computed<CommandItem[]>(() => [
    {
      id: 'ai.toggle-panel',
      label: options.isOpen.value
        ? options.t.value.closePanel || '关闭面板'
        : options.t.value.fabOpen || '打开 AI 助手',
      group: '面板',
      icon: options.isOpen.value ? 'panel-right-close' : 'panel-right-open',
      shortcut: 'Esc / Ctrl+/',
      action: () => {
        options.isOpen.value = !options.isOpen.value;
      },
    },
    {
      id: 'ai.new-session',
      label: '新建会话 / New session',
      group: '会话',
      icon: 'plus',
      keywords: ['new', 'session', '新建', '会话', '清空'],
      action: options.startNewSession,
    },
    {
      id: 'ai.clear',
      label: '清空当前会话 / Clear current chat',
      group: '会话',
      icon: 'trash-2',
      keywords: ['clear', '清空', 'reset'],
      action: options.clearMessages,
    },
    {
      id: 'ai.toggle-theme',
      label: options.isDark.value ? '切换到浅色 / Light mode' : '切换到深色 / Dark mode',
      group: '外观',
      icon: options.isDark.value ? 'sun' : 'moon',
      keywords: ['theme', 'dark', 'light', '主题', '暗黑', '浅色'],
      action: options.toggleManualTheme,
    },
    {
      id: 'ai.open-personalize',
      label: '个性化 / Personalize',
      group: '设置',
      icon: 'settings-2',
      keywords: ['personalize', 'settings', '个性化', '系统提示词'],
      action: options.openPersonalize,
    },
    {
      id: 'ai.open-keyboard-help',
      label: '键盘快捷键 / Keyboard shortcuts',
      group: '帮助',
      icon: 'keyboard',
      shortcut: 'Shift+?',
      keywords: ['keyboard', 'shortcut', 'help', '快捷键', '帮助'],
      action: () => {
        options.keyboardHelpOpen.value = true;
      },
    },
  ]);

  return {
    slashCommands,
    commandPaletteCommands,
  };
}
