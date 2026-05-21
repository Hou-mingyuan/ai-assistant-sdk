import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { usePromptTemplateInteraction } from './usePromptTemplateInteraction';

describe('usePromptTemplateInteraction', () => {
  it('applies rendered template text and closes the dialog', () => {
    const input = ref('');
    const interaction = usePromptTemplateInteraction({ input });
    interaction.promptTemplateOpen.value = true;

    interaction.onPromptTemplateUse('Rendered prompt');

    expect(input.value).toBe('Rendered prompt');
    expect(interaction.promptTemplateOpen.value).toBe(false);
  });
});
