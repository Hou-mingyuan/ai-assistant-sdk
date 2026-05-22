import { computed, type ComputedRef } from 'vue';

import type { SlashCommand } from './useSlashCommands';
import type { CommandItem } from '../types/command-palette';

export interface AssistantCommandFamily {
  name: string;
  source?: string;
  description?: string;
  slashCommands?: SlashCommand[];
  commandPaletteCommands?: ComputedRef<CommandItem[]>;
}

export interface UseAssistantCommandRegistryOptions {
  families: AssistantCommandFamily[];
  throwOnDuplicatePaletteCommandIds?: boolean;
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
  const commandPaletteDebugRows = computed(() =>
    options.families.flatMap((family) =>
      (family.commandPaletteCommands?.value ?? []).map((command) => ({
        family: family.name,
        source: family.source ?? family.name,
        commandId: command.id,
        label: command.label,
      })),
    ),
  );
  const commandPaletteDebugMarkdown = computed(() =>
    [
      '| Family | Source | Command ID | Label |',
      '| --- | --- | --- | --- |',
      ...commandPaletteDebugRows.value.map(
        (row) => `| ${row.family} | ${row.source} | \`${row.commandId}\` | ${row.label} |`,
      ),
      '',
    ].join('\n'),
  );

  if (options.throwOnDuplicatePaletteCommandIds && duplicatePaletteCommandIds.value.length > 0) {
    throw new Error(
      `Duplicate command palette ids: ${duplicatePaletteCommandIds.value.join(', ')}`,
    );
  }

  return {
    slashCommands,
    commandPaletteExtraCommands,
    duplicatePaletteCommandIds,
    commandPaletteDebugRows,
    commandPaletteDebugMarkdown,
  };
}
