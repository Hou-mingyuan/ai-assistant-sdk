import { computed, watch, type ComputedRef, type Ref } from 'vue';

import type { CommandItem } from '../types/command-palette';

export interface CommandPaletteRegistrationDeps {
  cmdPalette: {
    register: (cmds: CommandItem[]) => void;
    clear: () => void;
    open: Ref<boolean>;
    commands: Ref<CommandItem[]>;
  };
  commands?: ComputedRef<CommandItem[]> | Ref<CommandItem[]>;
}

export function useCommandPaletteRegistration(deps: CommandPaletteRegistrationDeps) {
  const registeredCommands = computed<CommandItem[]>(() => deps.commands?.value ?? []);

  watch(
    registeredCommands,
    (cmds) => {
      deps.cmdPalette.clear();
      deps.cmdPalette.register(cmds);
    },
    { immediate: true },
  );

  return { registeredCommands };
}
