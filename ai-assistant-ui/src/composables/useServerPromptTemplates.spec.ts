import { describe, expect, it } from 'vitest';
import { nextTick, reactive } from 'vue';

import { useServerPromptTemplates } from './useServerPromptTemplates';

describe('useServerPromptTemplates', () => {
  it('merges server templates before host presets', async () => {
    const options = reactive({
      baseUrl: '/ai',
      accessToken: 'token',
      promptTemplates: [
        { label: 'Host', template: 'Host {{value}}', variables: [{ name: 'value' }] },
      ],
    });
    const fetchTemplates = async () => ({
      success: true as const,
      templates: [{ name: 'Server', template: 'Server prompt' }],
    });

    const templates = useServerPromptTemplates(options, { fetchTemplates });
    await templates.refreshServerPromptTemplates();
    await nextTick();

    expect(templates.presetPromptTemplates.value).toEqual([
      { id: 'server:Server', label: 'Server', template: 'Server prompt' },
      { id: 'preset_0', label: 'Host', template: 'Host {{value}}', variables: [{ name: 'value' }] },
    ]);
  });

  it('keeps host presets when server templates are unavailable', async () => {
    const options = reactive({
      baseUrl: '/ai',
      promptTemplates: [{ label: 'Host', template: 'Host prompt' }],
    });
    const fetchTemplates = async () => ({
      success: false as const,
      error: 'offline',
    });

    const templates = useServerPromptTemplates(options, { fetchTemplates });
    await templates.refreshServerPromptTemplates();

    expect(templates.presetPromptTemplates.value).toEqual([
      { id: 'preset_0', label: 'Host', template: 'Host prompt', variables: undefined },
    ]);
  });
});
