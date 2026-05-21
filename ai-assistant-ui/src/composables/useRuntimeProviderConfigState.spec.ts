import { describe, expect, it } from 'vitest';

import { useRuntimeProviderConfigState } from './useRuntimeProviderConfigState';

describe('useRuntimeProviderConfigState', () => {
  it('hydrates provider fields from sanitized runtime config', () => {
    const state = useRuntimeProviderConfigState();
    state.providerApiKeyInput.value = 'secret';

    state.applyRuntimeModelConfig({
      success: true,
      provider: 'minimax',
      baseUrl: 'https://api.minimaxi.com/v1',
      model: 'MiniMax-M2.7',
      allowedModels: ['MiniMax-M2.7', 'MiniMax-M2.5'],
      apiKeyConfigured: true,
    });

    expect(state.providerInput.value).toBe('minimax');
    expect(state.providerBaseUrlInput.value).toBe('https://api.minimaxi.com/v1');
    expect(state.providerModelInput.value).toBe('MiniMax-M2.7');
    expect(state.providerAllowedModelsInput.value).toBe('MiniMax-M2.7, MiniMax-M2.5');
    expect(state.providerApiKeyInput.value).toBe('');
  });

  it('uses empty strings for missing runtime config fields', () => {
    const state = useRuntimeProviderConfigState();

    state.applyRuntimeModelConfig({ success: true });

    expect(state.providerInput.value).toBe('');
    expect(state.providerBaseUrlInput.value).toBe('');
    expect(state.providerModelInput.value).toBe('');
    expect(state.providerAllowedModelsInput.value).toBe('');
    expect(state.providerApiKeyInput.value).toBe('');
  });

  it('builds the write payload from current inputs', () => {
    const state = useRuntimeProviderConfigState();
    state.providerInput.value = 'openai';
    state.providerBaseUrlInput.value = 'https://gateway.example.com/v1';
    state.providerApiKeyInput.value = 'sk-test';
    state.providerModelInput.value = 'gpt-4o-mini';
    state.providerAllowedModelsInput.value = 'gpt-4o-mini, gpt-4o';

    expect(state.buildRuntimeModelConfigPayload()).toEqual({
      provider: 'openai',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      allowedModelsText: 'gpt-4o-mini, gpt-4o',
    });
  });

  it('applies discovered models and keeps an existing selected model', () => {
    const state = useRuntimeProviderConfigState();
    state.providerModelInput.value = 'custom-model';

    state.applyDiscoveredModels(['model-a', 'model-b']);

    expect(state.providerAllowedModelsInput.value).toBe('model-a, model-b');
    expect(state.providerModelInput.value).toBe('custom-model');
  });

  it('applies the first discovered model when no model is selected', () => {
    const state = useRuntimeProviderConfigState();

    state.applyDiscoveredModels(['model-a', 'model-b']);

    expect(state.providerAllowedModelsInput.value).toBe('model-a, model-b');
    expect(state.providerModelInput.value).toBe('model-a');
  });
});
