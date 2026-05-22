import { describe, expect, it } from 'vitest';
import { computed } from 'vue';

import { useAssistantCommandRegistry } from './useAssistantCommandRegistry';

describe('useAssistantCommandRegistry', () => {
  it('combines command families without naming each family in the component', () => {
    const registry = useAssistantCommandRegistry({
      families: [
        {
          name: 'prompt',
          slashCommands: [
            { name: '/template', description: 'Templates', icon: 'T', action: () => true },
          ],
          commandPaletteCommands: computed(() => [
            { id: 'ai.open-prompt-templates', label: 'Templates', action: () => undefined },
          ]),
        },
        {
          name: 'feature',
          slashCommands: [
            { name: '/memory', description: 'Memory', icon: 'M', action: () => true },
          ],
          commandPaletteCommands: computed(() => [
            { id: 'ai.open-plugins', label: 'Plugins', action: () => undefined },
          ]),
        },
      ],
    });

    expect(registry.slashCommands.map((command) => command.name)).toEqual(['/template', '/memory']);
    expect(registry.commandPaletteExtraCommands.value.map((command) => command.id)).toEqual([
      'ai.open-prompt-templates',
      'ai.open-plugins',
    ]);
  });
});
