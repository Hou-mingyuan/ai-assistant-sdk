import type { ComputedRef } from 'vue';

import type { AssistantCommandFamily } from './useAssistantCommandRegistry';
import type { SlashCommand } from './useSlashCommands';
import type { CommandItem } from '../types/command-palette';

interface AssistantCommandSource {
  slashCommands: SlashCommand[];
  commandPaletteCommands: ComputedRef<CommandItem[]>;
}

export interface UseAssistantCommandFamiliesOptions {
  promptCommands: AssistantCommandSource;
  featureCommands: AssistantCommandSource;
  workflowCommands?: AssistantCommandSource;
}

export function useAssistantCommandFamilies(
  options: UseAssistantCommandFamiliesOptions,
): AssistantCommandFamily[] {
  return [
    {
      slashCommands: options.promptCommands.slashCommands,
      paletteCommands: options.promptCommands.commandPaletteCommands,
    },
    {
      slashCommands: options.featureCommands.slashCommands,
      paletteCommands: options.featureCommands.commandPaletteCommands,
    },
    ...(options.workflowCommands
      ? [
          {
            slashCommands: options.workflowCommands.slashCommands,
            paletteCommands: options.workflowCommands.commandPaletteCommands,
          },
        ]
      : []),
  ];
}
