import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import { useAssistantFeatureCommands } from './useAssistantFeatureCommands';
import type { I18nMessages } from '../utils/i18n';

const t = computed(
  () =>
    ({
      memoryLabel: 'Memory',
      kbLabel: 'Knowledge base',
      pluginsLabel: 'Plugins',
      slashCmdCompareDesc: 'Compare models',
      slashCmdFillDesc: 'Fill form',
    }) as unknown as I18nMessages,
);

describe('useAssistantFeatureCommands', () => {
  it('builds slash commands for feature panels from shared actions', () => {
    const memoryOpen = ref(false);
    const kbPanelOpen = ref(false);
    const pluginsPanelOpen = ref(false);
    const openMultiModelCompare = vi.fn();

    const commands = useAssistantFeatureCommands({
      t,
      input: ref(''),
      memoryOpen,
      kbPanelOpen,
      pluginsPanelOpen,
      formAutoFillEnabled: computed(() => false),
      openMultiModelCompare,
      triggerFormAutoFill: vi.fn(),
    });

    expect(commands.slashCommands.map((cmd) => cmd.name)).toEqual([
      '/memory',
      '/kb',
      '/plugins',
      '/compare',
    ]);

    commands.slashCommands[0]?.action();
    commands.slashCommands[1]?.action();
    commands.slashCommands[2]?.action();
    commands.slashCommands[3]?.action();

    expect(memoryOpen.value).toBe(true);
    expect(kbPanelOpen.value).toBe(true);
    expect(pluginsPanelOpen.value).toBe(true);
    expect(openMultiModelCompare).toHaveBeenCalledTimes(1);
  });

  it('adds form-fill slash and palette commands only when enabled', () => {
    const triggerFormAutoFill = vi.fn();
    const input = ref('/fill name: Ada');
    const commands = useAssistantFeatureCommands({
      t,
      input,
      memoryOpen: ref(false),
      kbPanelOpen: ref(false),
      pluginsPanelOpen: ref(false),
      formAutoFillEnabled: computed(() => true),
      openMultiModelCompare: vi.fn(),
      triggerFormAutoFill,
    });

    expect(commands.slashCommands.map((cmd) => cmd.name)).toContain('/fill');
    expect(commands.commandPaletteCommands.value.map((cmd) => cmd.id)).toContain('ai.form-fill');

    commands.slashCommands.find((cmd) => cmd.name === '/fill')?.action();

    expect(triggerFormAutoFill).toHaveBeenCalledWith('name: Ada');
  });
});
