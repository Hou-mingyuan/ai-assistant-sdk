import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';

import { useAssistantAppCommands } from './useAssistantAppCommands';
import type { I18nMessages } from '../utils/i18n';

describe('useAssistantAppCommands', () => {
  it('exposes panel session appearance settings and help commands as one family source', () => {
    const isOpen = ref(false);
    const isDark = ref(false);
    const personalizeOpen = ref(false);
    const keyboardHelpOpen = ref(false);
    let started = 0;
    let cleared = 0;
    let themeToggled = 0;

    const commands = useAssistantAppCommands({
      t: computed(
        () =>
          ({
            closePanel: 'Close',
            fabOpen: 'Open',
          }) as I18nMessages,
      ),
      isOpen,
      isDark,
      startNewSession: () => {
        started += 1;
      },
      clearMessages: () => {
        cleared += 1;
      },
      toggleManualTheme: () => {
        themeToggled += 1;
      },
      openPersonalize: () => {
        personalizeOpen.value = true;
      },
      keyboardHelpOpen,
    });

    expect(commands.commandPaletteCommands.value.map((command) => command.id)).toEqual([
      'ai.toggle-panel',
      'ai.new-session',
      'ai.clear',
      'ai.toggle-theme',
      'ai.open-personalize',
      'ai.open-keyboard-help',
    ]);

    commands.commandPaletteCommands.value[0]?.action();
    commands.commandPaletteCommands.value[1]?.action();
    commands.commandPaletteCommands.value[2]?.action();
    commands.commandPaletteCommands.value[3]?.action();
    commands.commandPaletteCommands.value[4]?.action();
    commands.commandPaletteCommands.value[5]?.action();

    expect(isOpen.value).toBe(true);
    expect(started).toBe(1);
    expect(cleared).toBe(1);
    expect(themeToggled).toBe(1);
    expect(personalizeOpen.value).toBe(true);
    expect(keyboardHelpOpen.value).toBe(true);
  });
});
