import { computed, type ComputedRef } from 'vue';

import type { SlashCommand } from './useSlashCommands';
import type { CommandItem } from '../types/command-palette';

export interface UseAssistantCommandRegistryOptions {
  featureSlashCommands: SlashCommand[];
  promptSlashCommands: SlashCommand[];
  featurePaletteCommands: ComputedRef<CommandItem[]>;
  promptPaletteCommands: ComputedRef<CommandItem[]>;
}

export function useAssistantCommandRegistry(options: UseAssistantCommandRegistryOptions) {
  const slashCommands = [...options.featureSlashCommands, ...options.promptSlashCommands];
  const commandPaletteExtraCommands = computed(() => [
    ...options.promptPaletteCommands.value,
    ...options.featurePaletteCommands.value,
  ]);

  return {
    slashCommands,
    commandPaletteExtraCommands,
  };
}
