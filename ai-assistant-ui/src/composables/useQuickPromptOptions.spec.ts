import { describe, expect, it } from 'vitest';
import { reactive } from 'vue';

import { useQuickPromptOptions } from './useQuickPromptOptions';

describe('useQuickPromptOptions', () => {
  it('keeps only valid quick prompts', () => {
    const options = reactive({
      quickPrompts: [
        { label: 'Explain', text: 'Explain this' },
        { label: '', text: 'Missing label' },
        { label: 'Missing text', text: '' },
      ],
    });

    const { quickPrompts } = useQuickPromptOptions(options);

    expect(quickPrompts.value).toEqual([{ label: 'Explain', text: 'Explain this' }]);
  });
});
