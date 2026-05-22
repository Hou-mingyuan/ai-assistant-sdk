import { describe, expect, it } from 'vitest';
import { computed } from 'vue';

import { useAssistantCommandRegistry } from './useAssistantCommandRegistry';

describe('useAssistantCommandRegistry', () => {
  it('combines feature and prompt slash commands without rebuilding arrays in the component', () => {
    const registry = useAssistantCommandRegistry({
      featureSlashCommands: [
        { name: '/memory', description: 'Memory', icon: 'M', action: () => true },
      ],
      promptSlashCommands: [
        { name: '/template', description: 'Templates', icon: 'T', action: () => true },
      ],
      featurePaletteCommands: computed(() => [
        { id: 'ai.open-plugins', label: 'Plugins', action: () => undefined },
      ]),
      promptPaletteCommands: computed(() => [
        { id: 'ai.open-prompt-templates', label: 'Templates', action: () => undefined },
      ]),
    });

    expect(registry.slashCommands.map((command) => command.name)).toEqual(['/memory', '/template']);
    expect(registry.commandPaletteExtraCommands.value.map((command) => command.id)).toEqual([
      'ai.open-prompt-templates',
      'ai.open-plugins',
    ]);
  });
});
