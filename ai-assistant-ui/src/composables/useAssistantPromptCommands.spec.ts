import { describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import { useAssistantPromptCommands } from './useAssistantPromptCommands';

describe('useAssistantPromptCommands', () => {
  it('applies quick prompts through a single action used by buttons and command palette', () => {
    const input = ref('');
    const setMode = vi.fn();
    const commands = useAssistantPromptCommands({
      input,
      setMode,
      quickPrompts: computed(() => [{ label: 'Explain', text: 'Explain this code' }]),
      promptTemplates: computed(() => []),
      openPromptTemplateDialog: vi.fn(),
    });

    commands.applyQuickPrompt({ label: 'Explain', text: 'Explain this code' });

    expect(input.value).toBe('Explain this code');
    expect(setMode).toHaveBeenCalledWith('chat');
  });

  it('renders prompt templates with prompted variables before applying them', () => {
    const input = ref('');
    const promptImpl = vi.fn().mockReturnValue('contract');
    const commands = useAssistantPromptCommands({
      input,
      setMode: vi.fn(),
      quickPrompts: computed(() => []),
      promptTemplates: computed(() => []),
      openPromptTemplateDialog: vi.fn(),
      promptImpl,
    });

    commands.applyPromptTemplate({
      label: 'Review',
      template: 'Review {{topic}}',
      variables: [{ name: 'topic', label: 'Topic' }],
    });

    expect(input.value).toBe('Review contract');
  });

  it('exposes command palette entries for prompt library and quick prompts', () => {
    const openPromptTemplateDialog = vi.fn();
    const input = ref('');
    const commands = useAssistantPromptCommands({
      input,
      setMode: vi.fn(),
      quickPrompts: computed(() => [{ label: 'Explain', text: 'Explain this' }]),
      promptTemplates: computed(() => []),
      openPromptTemplateDialog,
    });

    expect(commands.commandPaletteCommands.value.map((cmd) => cmd.id)).toEqual([
      'ai.open-prompt-templates',
      'ai.quick-prompt.0',
    ]);

    commands.commandPaletteCommands.value[0]?.action();
    commands.commandPaletteCommands.value[1]?.action();

    expect(openPromptTemplateDialog).toHaveBeenCalledTimes(1);
    expect(input.value).toBe('Explain this');
  });
});
