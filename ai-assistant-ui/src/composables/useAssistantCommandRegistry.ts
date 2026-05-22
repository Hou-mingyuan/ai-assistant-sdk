import { computed, type ComputedRef } from 'vue';

import type { SlashCommand } from './useSlashCommands';
import type { CommandItem } from '../types/command-palette';

export interface AssistantCommandFamily {
  name: string;
  slashCommands?: SlashCommand[];
  commandPaletteCommands?: ComputedRef<CommandItem[]>;
}

export interface UseAssistantCommandRegistryOptions {
  families: AssistantCommandFamily[];
}

export function useAssistantCommandRegistry(options: UseAssistantCommandRegistryOptions) {
  const slashCommands = options.families.flatMap((family) => family.slashCommands ?? []);
  const commandPaletteExtraCommands = computed(() =>
    options.families.flatMap((family) => family.commandPaletteCommands?.value ?? []),
  );

  return {
    slashCommands,
    commandPaletteExtraCommands,
  };
}
