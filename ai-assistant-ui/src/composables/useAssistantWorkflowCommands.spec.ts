import { describe, expect, it } from 'vitest';
import { computed, ref } from 'vue';

import { useAssistantWorkflowCommands } from './useAssistantWorkflowCommands';

describe('useAssistantWorkflowCommands', () => {
  it('groups diagnostics, sessions, and export palette commands', () => {
    const diagnosticsOpen = ref(false);
    const sessionsDrawerOpen = ref(false);
    let exportsOpened = 0;

    const workflow = useAssistantWorkflowCommands({
      t: computed(() => ({
        diagnosticsTitle: 'Diagnostics',
        sessionsDrawerTitle: 'Sessions',
        export: 'Export',
      })),
      diagnosticsOpen,
      sessionsDrawerOpen,
      openExportMenu: () => {
        exportsOpened += 1;
      },
    });

    expect(workflow.slashCommands).toEqual([]);
    expect(workflow.commandPaletteCommands.value.map((command) => command.id)).toEqual([
      'ai.open-diagnostics',
      'ai.open-sessions',
      'ai.open-export',
    ]);

    workflow.commandPaletteCommands.value[0]?.action();
    workflow.commandPaletteCommands.value[1]?.action();
    workflow.commandPaletteCommands.value[2]?.action();

    expect(diagnosticsOpen.value).toBe(true);
    expect(sessionsDrawerOpen.value).toBe(true);
    expect(exportsOpened).toBe(1);
  });
});
