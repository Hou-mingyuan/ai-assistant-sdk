import { computed, type ComputedRef } from 'vue';

import type { SlashCommand } from './useSlashCommands';
import type { CommandItem } from '../types/command-palette';

export interface AssistantCommandFamily {
  slashCommands?: SlashCommand[];
  paletteCommands?: ComputedRef<CommandItem[]>;
}

export interface UseAssistantCommandRegistryOptions {
  families: AssistantCommandFamily[];
}

export function useAssistantCommandRegistry(options: UseAssistantCommandRegistryOptions) {
  const slashCommands = options.families.flatMap((family) => family.slashCommands ?? []);
  const commandPaletteExtraCommands = computed(() =>
    options.families.flatMap((family) => family.paletteCommands?.value ?? []),
  );

  return {
    slashCommands,
    commandPaletteExtraCommands,
  };
}
