import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';

import { useCommandPaletteRegistration } from './useCommandPaletteRegistration';
import type { CommandItem } from '../types/command-palette';

describe('useCommandPaletteRegistration', () => {
  it('clears and registers the computed command list immediately', () => {
    const registered = ref<CommandItem[]>([
      { id: 'stale', label: 'Stale', action: () => undefined },
    ]);
    const clearCount = ref(0);

    useCommandPaletteRegistration({
      cmdPalette: {
        register: (cmds) => {
          registered.value = cmds;
        },
        clear: () => {
          clearCount.value += 1;
          registered.value = [];
        },
        open: ref(false),
        commands: registered,
      },
      commands: computed(() => [{ id: 'fresh', label: 'Fresh', action: () => undefined }]),
    });

    expect(clearCount.value).toBe(1);
    expect(registered.value.map((command) => command.id)).toEqual(['fresh']);
  });
});
