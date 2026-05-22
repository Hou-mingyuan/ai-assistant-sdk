import { describe, expect, it } from 'vitest';
import { computed } from 'vue';

import { useAssistantCommandFamilies } from './useAssistantCommandFamilies';

describe('useAssistantCommandFamilies', () => {
  it('wraps prompt and feature commands into ordered registry families', () => {
    const families = useAssistantCommandFamilies({
      promptCommands: {
        slashCommands: [
          { name: '/template', description: 'Templates', icon: 'T', action: () => true },
        ],
        commandPaletteCommands: computed(() => [
          { id: 'ai.open-prompt-templates', label: 'Templates', action: () => undefined },
        ]),
      },
      featureCommands: {
        slashCommands: [{ name: '/memory', description: 'Memory', icon: 'M', action: () => true }],
        commandPaletteCommands: computed(() => [
          { id: 'ai.open-plugins', label: 'Plugins', action: () => undefined },
        ]),
      },
    });

    expect(families.map((family) => family.slashCommands?.[0]?.name)).toEqual([
      '/template',
      '/memory',
    ]);
    expect(
      families.flatMap(
        (family) => family.paletteCommands?.value.map((command) => command.id) ?? [],
      ),
    ).toEqual(['ai.open-prompt-templates', 'ai.open-plugins']);
  });
});
