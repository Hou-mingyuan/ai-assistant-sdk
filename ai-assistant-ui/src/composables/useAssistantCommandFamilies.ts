import type { ComputedRef } from 'vue';

import type { AssistantCommandFamily } from './useAssistantCommandRegistry';
import type { SlashCommand } from './useSlashCommands';
import type { CommandItem } from '../types/command-palette';

interface AssistantCommandSource {
  slashCommands: SlashCommand[];
  commandPaletteCommands: ComputedRef<CommandItem[]>;
}

export interface UseAssistantCommandFamiliesOptions {
  appCommands?: AssistantCommandSource;
  promptCommands: AssistantCommandSource;
  featureCommands: AssistantCommandSource;
  workflowCommands?: AssistantCommandSource;
}

export function useAssistantCommandFamilies(
  options: UseAssistantCommandFamiliesOptions,
): AssistantCommandFamily[] {
  return [
    ...(options.appCommands
      ? [
          {
            name: 'app',
            source: 'app',
            description: 'Application commands',
            slashCommands: options.appCommands.slashCommands,
            commandPaletteCommands: options.appCommands.commandPaletteCommands,
          },
        ]
      : []),
    {
      name: 'prompt',
      source: 'prompt',
      description: 'Prompt commands',
      slashCommands: options.promptCommands.slashCommands,
      commandPaletteCommands: options.promptCommands.commandPaletteCommands,
    },
    {
      name: 'feature',
      source: 'feature',
      description: 'Feature commands',
      slashCommands: options.featureCommands.slashCommands,
      commandPaletteCommands: options.featureCommands.commandPaletteCommands,
    },
    ...(options.workflowCommands
      ? [
          {
            name: 'workflow',
            source: 'workflow',
            description: 'Workflow commands',
            slashCommands: options.workflowCommands.slashCommands,
            commandPaletteCommands: options.workflowCommands.commandPaletteCommands,
          },
        ]
      : []),
  ];
}
