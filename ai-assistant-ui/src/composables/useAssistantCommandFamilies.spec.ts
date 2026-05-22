import { describe, expect, it } from 'vitest';
import { computed } from 'vue';

import { useAssistantCommandFamilies } from './useAssistantCommandFamilies';

describe('useAssistantCommandFamilies', () => {
  it('wraps prompt and feature commands into ordered registry families', () => {
    const families = useAssistantCommandFamilies({
      appCommands: {
        slashCommands: [],
        commandPaletteCommands: computed(() => [
          { id: 'ai.toggle-panel', label: 'Toggle panel', action: () => undefined },
        ]),
      },
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
      workflowCommands: {
        slashCommands: [],
        commandPaletteCommands: computed(() => [
          { id: 'ai.open-diagnostics', label: 'Diagnostics', action: () => undefined },
          { id: 'ai.open-sessions', label: 'Sessions', action: () => undefined },
          { id: 'ai.open-export', label: 'Export', action: () => undefined },
        ]),
      },
    });

    expect(families.map((family) => family.name)).toEqual(['app', 'prompt', 'feature', 'workflow']);
    expect(families.map((family) => family.source)).toEqual([
      'app',
      'prompt',
      'feature',
      'workflow',
    ]);
    expect(families.map((family) => family.description)).toEqual([
      'Application commands',
      'Prompt commands',
      'Feature commands',
      'Workflow commands',
    ]);
    expect(families.map((family) => family.slashCommands?.[0]?.name)).toEqual([
      undefined,
      '/template',
      '/memory',
      undefined,
    ]);
    expect(
      families.flatMap(
        (family) => family.commandPaletteCommands?.value.map((command) => command.id) ?? [],
      ),
    ).toEqual([
      'ai.toggle-panel',
      'ai.open-prompt-templates',
      'ai.open-plugins',
      'ai.open-diagnostics',
      'ai.open-sessions',
      'ai.open-export',
    ]);
  });
});
