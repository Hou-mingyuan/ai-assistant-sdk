import { computed, type ComputedRef, type Ref } from 'vue';

import type { AiAssistantOptions } from '../index';
import type { CommandItem } from '../types/command-palette';
import type { SlashCommand } from './useSlashCommands';

type AssistantMode = 'translate' | 'summarize' | 'chat';
type PromptTemplate = NonNullable<AiAssistantOptions['promptTemplates']>[number];
type QuickPrompt = NonNullable<AiAssistantOptions['quickPrompts']>[number];

export interface UseAssistantPromptCommandsOptions {
  input: Ref<string>;
  setMode: (mode: AssistantMode) => void;
  quickPrompts: ComputedRef<QuickPrompt[]>;
  promptTemplates: ComputedRef<PromptTemplate[]>;
  openPromptTemplateDialog: () => void;
  templateDescription?: ComputedRef<string>;
  promptImpl?: (message?: string, defaultValue?: string) => string | null;
}

export function useAssistantPromptCommands(options: UseAssistantPromptCommandsOptions) {
  const promptImpl =
    options.promptImpl ??
    ((message?: string, defaultValue?: string) =>
      typeof window !== 'undefined' && typeof window.prompt === 'function'
        ? window.prompt(message, defaultValue)
        : null);

  function applyQuickPrompt(prompt: QuickPrompt) {
    options.input.value = prompt.text;
    options.setMode('chat');
  }

  function applyPromptTemplate(template: PromptTemplate) {
    const vars = template.variables;
    if (!vars || vars.length === 0) {
      options.input.value = template.template;
      options.setMode('chat');
      return;
    }

    const values: Record<string, string> = {};
    for (const variable of vars) {
      const answer = promptImpl(variable.label, variable.default ?? '');
      if (answer === null) return;
      values[variable.name] = answer;
    }

    let text = template.template;
    for (const [key, value] of Object.entries(values)) {
      text = text.split(`{{${key}}}`).join(value);
    }
    options.input.value = text;
    options.setMode('chat');
  }

  const commandPaletteCommands = computed<CommandItem[]>(() => [
    {
      id: 'ai.open-prompt-templates',
      label: 'Prompt templates / 模板库',
      group: 'Prompt',
      icon: 'layout-template',
      keywords: ['prompt', 'template', '模板', '提示词'],
      action: () => {
        options.openPromptTemplateDialog();
      },
    },
    ...options.quickPrompts.value.map<CommandItem>((prompt, index) => ({
      id: `ai.quick-prompt.${index}`,
      label: prompt.label,
      group: 'Prompt',
      icon: 'zap',
      keywords: ['quick', 'prompt', '快捷', '提示词', prompt.text],
      action: () => {
        applyQuickPrompt(prompt);
      },
    })),
  ]);

  const slashCommands: SlashCommand[] = [
    {
      name: '/template',
      get description() {
        return options.templateDescription?.value ?? 'Templates';
      },
      icon: 'M14 3v4a1 1 0 0 0 1 1h4l-5-5zM5 3h7v5a2 2 0 0 0 2 2h5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 9h10v2H7v-2zm0 4h7v2H7v-2z',
      action: () => {
        options.openPromptTemplateDialog();
        return true;
      },
    },
  ];

  return {
    applyQuickPrompt,
    applyPromptTemplate,
    commandPaletteCommands,
    slashCommands,
    openPromptTemplateDialog: options.openPromptTemplateDialog,
  };
}
