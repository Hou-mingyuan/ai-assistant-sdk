import { computed, type ComputedRef, type Ref } from 'vue';

import type { CommandItem } from '../types/command-palette';
import type { I18nMessages } from '../utils/i18n';
import type { SlashCommand } from './useSlashCommands';

export interface UseAssistantWorkflowCommandsOptions {
  t: ComputedRef<Partial<I18nMessages>>;
  diagnosticsOpen: Ref<boolean>;
  sessionsDrawerOpen: Ref<boolean>;
  openExportMenu: () => void;
}

export function useAssistantWorkflowCommands(options: UseAssistantWorkflowCommandsOptions) {
  const slashCommands: SlashCommand[] = [];
  const commandPaletteCommands = computed<CommandItem[]>(() => [
    {
      id: 'ai.open-diagnostics',
      label: options.t.value.diagnosticsTitle || '连接诊断 / Connection diagnostics',
      group: '工作流',
      icon: '🔍',
      keywords: ['diagnostics', 'health', '连接', '诊断'],
      action: () => {
        options.diagnosticsOpen.value = true;
      },
    },
    {
      id: 'ai.open-sessions',
      label: options.t.value.sessionsDrawerTitle || '所有会话 / All sessions',
      group: '工作流',
      icon: '📚',
      keywords: ['sessions', 'history', '会话', '抽屉'],
      action: () => {
        options.sessionsDrawerOpen.value = true;
      },
    },
    {
      id: 'ai.open-export',
      label: options.t.value.export || '导出 / Export',
      group: '工作流',
      icon: '⤓',
      keywords: ['export', 'download', '导出', '下载'],
      action: options.openExportMenu,
    },
  ]);

  return {
    slashCommands,
    commandPaletteCommands,
  };
}
