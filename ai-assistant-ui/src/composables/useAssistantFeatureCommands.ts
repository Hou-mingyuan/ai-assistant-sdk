import { computed, type ComputedRef, type Ref } from 'vue';

import type { SlashCommand } from './useSlashCommands';
import type { CommandItem } from '../types/command-palette';
import type { I18nMessages } from '../utils/i18n';

export interface UseAssistantFeatureCommandsOptions {
  t: ComputedRef<I18nMessages>;
  input: Ref<string>;
  memoryOpen: Ref<boolean>;
  kbPanelOpen: Ref<boolean>;
  pluginsPanelOpen: Ref<boolean>;
  formAutoFillEnabled: ComputedRef<boolean>;
  openMultiModelCompare: () => void;
  triggerFormAutoFill: (text: string) => void | Promise<void>;
}

export function useAssistantFeatureCommands(options: UseAssistantFeatureCommandsOptions) {
  const actions = {
    openMemory: () => {
      options.memoryOpen.value = true;
    },
    openKnowledgeBase: () => {
      options.kbPanelOpen.value = true;
    },
    togglePlugins: () => {
      options.pluginsPanelOpen.value = !options.pluginsPanelOpen.value;
    },
    openCompare: () => {
      options.openMultiModelCompare();
    },
    runFormFill: () => {
      const buffer = options.input.value.replace(/^\/fill\b\s*/i, '').trim();
      void options.triggerFormAutoFill(buffer);
    },
  };

  const slashCommands: SlashCommand[] = [
    {
      name: '/memory',
      get description() {
        return options.t.value.memoryLabel || '记忆管理';
      },
      icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
      action: () => {
        actions.openMemory();
        return true;
      },
    },
    {
      name: '/kb',
      get description() {
        return options.t.value.kbLabel || '知识库';
      },
      icon: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
      action: () => {
        actions.openKnowledgeBase();
        return true;
      },
    },
    {
      name: '/plugins',
      get description() {
        return options.t.value.pluginsLabel || '插件管理';
      },
      icon: 'M13 13v8h8v-8h-8zM3 21h8v-8H3v8zM3 3v8h8V3H3zm13.66-1.31L11 7.34 16.66 13l5.66-5.66-5.66-5.65z',
      action: () => {
        actions.togglePlugins();
        return true;
      },
    },
    {
      name: '/compare',
      get description() {
        return (
          options.t.value.slashCmdCompareDesc || options.t.value.compareTitle || 'Compare models'
        );
      },
      icon: 'M3 5h7v14H3V5zm11 0h7v6h-7V5zm0 8h7v6h-7v-6z',
      action: () => {
        actions.openCompare();
        return true;
      },
    },
    ...(options.formAutoFillEnabled.value
      ? [
          {
            name: '/fill',
            get description() {
              return (
                options.t.value.slashCmdFillDesc || 'Auto-fill form fields from clipboard pairs'
              );
            },
            icon: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 12h8v2H8zm0 4h5v2H8z',
            action: () => {
              actions.runFormFill();
              return true;
            },
          },
        ]
      : []),
  ];

  const commandPaletteCommands = computed<CommandItem[]>(() => [
    {
      id: 'ai.open-memory',
      label: options.t.value.memoryLabel || '记忆管理 / Memory',
      group: '知识',
      icon: '🧠',
      keywords: ['memory', '记忆', '事实'],
      action: actions.openMemory,
    },
    {
      id: 'ai.open-kb',
      label: options.t.value.kbLabel || '知识库管理 / Knowledge base',
      group: '知识',
      icon: '📖',
      keywords: ['kb', 'knowledge', '知识库', 'rag'],
      action: actions.openKnowledgeBase,
    },
    {
      id: 'ai.open-plugins',
      label: options.t.value.pluginsLabel || '插件管理 / Plugins',
      group: '能力',
      icon: '🧩',
      keywords: ['plugins', 'tools', '插件', '工具'],
      action: actions.togglePlugins,
    },
    {
      id: 'ai.compare-models',
      label:
        options.t.value.slashCmdCompareDesc || options.t.value.compareTitle || 'Compare models',
      group: '能力',
      icon: '▦',
      keywords: ['compare', 'models', '对比', '模型'],
      action: actions.openCompare,
    },
    ...(options.formAutoFillEnabled.value
      ? [
          {
            id: 'ai.form-fill',
            label: options.t.value.slashCmdFillDesc || 'Auto-fill form fields from clipboard pairs',
            group: '能力',
            icon: '⌁',
            keywords: ['fill', 'form', '表单', '填充'],
            action: actions.runFormFill,
          },
        ]
      : []),
  ]);

  return {
    actions,
    slashCommands,
    commandPaletteCommands,
  };
}
