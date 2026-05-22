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
  const duplicatePaletteCommandIds = computed(() => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const command of commandPaletteExtraCommands.value) {
      if (seen.has(command.id)) {
        duplicates.add(command.id);
      } else {
        seen.add(command.id);
      }
    }
    return [...duplicates];
  });

  return {
    slashCommands,
    commandPaletteExtraCommands,
    duplicatePaletteCommandIds,
  };
}
