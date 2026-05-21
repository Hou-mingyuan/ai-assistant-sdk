import { computed, ref, type ComputedRef } from 'vue';

import type { AiAssistantOptions } from '../index';
import type { PromptTemplate } from './usePromptTemplateLibrary';
import { fetchPromptTemplates, type PromptTemplatesListResult } from '../utils/api';

export type PromptTemplatePreset = PromptTemplate;

export interface UseServerPromptTemplatesDeps {
  fetchTemplates?: (baseUrl: string, token?: string) => Promise<PromptTemplatesListResult>;
}

export function useServerPromptTemplates(
  options: Pick<AiAssistantOptions, 'baseUrl' | 'accessToken' | 'promptTemplates'>,
  deps: UseServerPromptTemplatesDeps = {},
): {
  presetPromptTemplates: ComputedRef<PromptTemplatePreset[]>;
  refreshServerPromptTemplates: () => Promise<void>;
} {
  const fetchTemplates = deps.fetchTemplates ?? fetchPromptTemplates;
  const serverPromptTemplates = ref<PromptTemplatePreset[]>([]);

  const presetPromptTemplates = computed(() => {
    const hostPresets = (options.promptTemplates ?? []).map((preset, index) => ({
      id: `preset_${index}`,
      label: preset.label,
      template: preset.template,
      variables: preset.variables,
    }));
    return [...serverPromptTemplates.value, ...hostPresets];
  });

  async function refreshServerPromptTemplates(): Promise<void> {
    if (!options.baseUrl) return;
    try {
      const result = await fetchTemplates(options.baseUrl, options.accessToken);
      if (result.success && result.templates) {
        serverPromptTemplates.value = result.templates.map((template) => ({
          id: `server:${template.name}`,
          label: template.name,
          template: template.template,
        }));
      }
    } catch {
      /* Server templates are optional; local presets remain available. */
    }
  }

  return {
    presetPromptTemplates,
    refreshServerPromptTemplates,
  };
}
