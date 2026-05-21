import { computed, type ComputedRef } from 'vue';

import type { AiAssistantOptions } from '../index';

type QuickPrompt = NonNullable<AiAssistantOptions['quickPrompts']>[number];

export function useQuickPromptOptions(options: Pick<AiAssistantOptions, 'quickPrompts'>): {
  quickPrompts: ComputedRef<QuickPrompt[]>;
} {
  const quickPrompts = computed(() => {
    const prompts = options.quickPrompts;
    if (!Array.isArray(prompts)) return [];
    return prompts.filter(
      (prompt): prompt is QuickPrompt =>
        !!prompt &&
        typeof prompt.label === 'string' &&
        typeof prompt.text === 'string' &&
        !!prompt.label &&
        !!prompt.text,
    );
  });

  return { quickPrompts };
}
