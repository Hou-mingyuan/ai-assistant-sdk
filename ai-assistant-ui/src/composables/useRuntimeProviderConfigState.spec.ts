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
      webSearchProvider: 'tavily',
      webSearchMaxResults: 8,
      webSearchApiKeyConfigured: true,
      webSearchAllowedDomains: 'docs.example.com',
      webSearchBlockedDomains: 'spam.example.com',
      fastRouteMaxChars: 64,
      slowTtftThresholdMs: 2500,
      slowTotalThresholdMs: 7000,
      slowRequestWarningStreak: 3,
    });

    expect(state.providerInput.value).toBe('minimax');
    expect(state.providerBaseUrlInput.value).toBe('https://api.minimaxi.com/v1');
    expect(state.providerModelInput.value).toBe('MiniMax-M2.7');
    expect(state.providerAllowedModelsInput.value).toBe('MiniMax-M2.7, MiniMax-M2.5');
    expect(state.providerApiKeyInput.value).toBe('');
    expect(state.webSearchProviderInput.value).toBe('tavily');
    expect(state.webSearchMaxResultsInput.value).toBe('8');
    expect(state.webSearchApiKeyInput.value).toBe('');
    expect(state.webSearchAllowedDomainsInput.value).toBe('docs.example.com');
    expect(state.webSearchBlockedDomainsInput.value).toBe('spam.example.com');
    expect(state.fastRouteMaxCharsInput.value).toBe('64');
    expect(state.slowTtftThresholdMsInput.value).toBe('2500');
    expect(state.slowTotalThresholdMsInput.value).toBe('7000');
    expect(state.slowRequestWarningStreakInput.value).toBe('3');
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
    state.webSearchProviderInput.value = 'tavily';
    state.webSearchApiKeyInput.value = 'tvly-test';
    state.webSearchMaxResultsInput.value = '6';
    state.webSearchAllowedDomainsInput.value = 'docs.example.com';
    state.webSearchBlockedDomainsInput.value = 'spam.example.com';
    state.fastRouteMaxCharsInput.value = '72';
    state.slowTtftThresholdMsInput.value = '2400';
    state.slowTotalThresholdMsInput.value = '6500';
    state.slowRequestWarningStreakInput.value = '4';

    expect(state.buildRuntimeModelConfigPayload()).toEqual({
      provider: 'openai',
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      allowedModelsText: 'gpt-4o-mini, gpt-4o',
      warmupEnabled: false,
      webSearchProvider: 'tavily',
      webSearchApiKey: 'tvly-test',
      webSearchMaxResults: 6,
      webSearchAllowedDomains: 'docs.example.com',
      webSearchBlockedDomains: 'spam.example.com',
      fastRouteMaxChars: 72,
      slowTtftThresholdMs: 2400,
      slowTotalThresholdMs: 6500,
      slowRequestWarningStreak: 4,
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
