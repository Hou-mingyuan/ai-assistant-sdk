import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import PersonalizeDialog from './PersonalizeDialog.vue';
import type { I18nMessages } from '../utils/i18n';

const t = {
  personalizeTitle: 'Personalize',
  closePanel: 'Close',
  systemPromptPlaceholder: 'System prompt',
  personalizePlaceholder: 'Write a role prompt',
  personalizeCharCount: '{cur}/{max}',
  personalizeDone: 'Done',
  providerConfigTitle: 'Model provider connection',
  providerConfigPresetMinimax: 'MiniMax',
  providerConfigPresetOpenai: 'OpenAI',
  providerConfigPresetDeepseek: 'DeepSeek',
  providerConfigDetectModels: 'Detect models',
  providerConfigProvider: 'Provider',
  providerConfigProviderPlaceholder: 'provider id',
  providerConfigBaseUrl: 'Model API Base URL',
  providerConfigBaseUrlPlaceholder: 'provider base URL',
  providerConfigApiKey: 'Model API key',
  providerConfigApiKeyPlaceholder: 'Leave blank to keep the current key',
  providerConfigDefaultModel: 'Default model',
  providerConfigDefaultModelPlaceholder: 'default model id',
  providerConfigAllowedModels: 'Allowed models',
  providerConfigAllowedModelsPlaceholder: 'model-a, model-b',
  providerConfigSaveAndRefresh: 'Save model config and refresh list',
} as unknown as I18nMessages;

function mountDialog() {
  return mount(PersonalizeDialog, {
    props: {
      open: true,
      modelValue: '',
      isDark: false,
      disabled: false,
      maxChars: 4000,
      t,
    },
    attachTo: document.body,
  });
}

describe('PersonalizeDialog provider configuration', () => {
  it('renders provider configuration labels and placeholders from i18n', () => {
    const wrapper = mountDialog();

    const inputs = document.body.querySelectorAll<HTMLInputElement>(
      '.ai-personalize-model-field input',
    );
    expect(document.body.textContent).toContain('Model provider connection');
    expect(inputs[0].placeholder).toBe('provider id');
    expect(inputs[1].placeholder).toBe('provider base URL');
    expect(inputs[3].placeholder).toBe('default model id');
    expect(inputs[4].placeholder).toBe('model-a, model-b');

    wrapper.unmount();
  });

  it('emits preset values, model discovery and save actions', async () => {
    const wrapper = mountDialog();
    const buttons = document.body.querySelectorAll<HTMLButtonElement>(
      '.ai-personalize-model-presets button',
    );

    buttons[0].click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:providerInput')?.[0]).toEqual(['minimax']);
    expect(wrapper.emitted('update:providerBaseUrlInput')?.[0]).toEqual([
      'https://api.minimaxi.com/v1',
    ]);

    buttons[3].click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('discoverProviderModels')).toBeTruthy();

    document.body
      .querySelector<HTMLButtonElement>('.ai-personalize-model-section .ai-personalize-done')
      ?.click();
    await wrapper.vm.$nextTick();
    expect(wrapper.emitted('saveProviderConfig')).toBeTruthy();

    wrapper.unmount();
  });
});
