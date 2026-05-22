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
    expect(registry.duplicatePaletteCommandIds.value).toEqual([]);
  });

  it('reports duplicate palette command ids across families', () => {
    const registry = useAssistantCommandRegistry({
      families: [
        {
          name: 'app',
          commandPaletteCommands: computed(() => [
            { id: 'ai.open-memory', label: 'Memory', action: () => undefined },
          ]),
        },
        {
          name: 'feature',
          commandPaletteCommands: computed(() => [
            { id: 'ai.open-memory', label: 'Memory again', action: () => undefined },
          ]),
        },
      ],
    });

    expect(registry.duplicatePaletteCommandIds.value).toEqual(['ai.open-memory']);
  });

  it('can fail fast when duplicate palette command ids are present', () => {
    expect(() =>
      useAssistantCommandRegistry({
        throwOnDuplicatePaletteCommandIds: true,
        families: [
          {
            name: 'app',
            source: 'app',
            commandPaletteCommands: computed(() => [
              { id: 'ai.toggle-panel', label: 'Toggle', action: () => undefined },
            ]),
          },
          {
            name: 'workflow',
            source: 'workflow',
            commandPaletteCommands: computed(() => [
              { id: 'ai.toggle-panel', label: 'Duplicate', action: () => undefined },
            ]),
          },
        ],
      }),
    ).toThrow(/Duplicate command palette ids: ai\.toggle-panel/);
  });

  it('renders a debug markdown report for command families', () => {
    const registry = useAssistantCommandRegistry({
      families: [
        {
          name: 'prompt',
          source: 'prompt',
          description: 'Prompt commands',
          commandPaletteCommands: computed(() => [
            { id: 'ai.open-prompt-templates', label: 'Templates', action: () => undefined },
          ]),
        },
      ],
    });

    expect(registry.commandPaletteDebugRows.value).toEqual([
      {
        family: 'prompt',
        source: 'prompt',
        commandId: 'ai.open-prompt-templates',
        label: 'Templates',
      },
    ]);
    expect(registry.commandPaletteDebugMarkdown.value).toContain(
      '| prompt | prompt | `ai.open-prompt-templates` | Templates |',
    );
  });
});
