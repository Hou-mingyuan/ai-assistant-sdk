import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';

import { useDiagnosticsModelRequests } from './useDiagnosticsModelRequests';

function makeHarness(optionsOverride: { accessToken?: string; adminToken?: string } = {}) {
  const options = {
    baseUrl: '/ai-assistant',
    accessToken: 'token',
    adminToken: 'admin',
    ...optionsOverride,
  };
  const modelChoices = ref<string[]>(['stale']);
  const modelCapabilities = ref<Record<string, string[]>>({ stale: ['chat'] });
  const selectedChatModel = ref('stale');
  const defaultChatModel = ref('stale');
  const modelListStatus = ref('');
  const modelListError = ref('');
  const diagnosticsBusy = ref(false);
  const diagnosticsLastChecked = ref('');
  const connectionConfigMessage = ref('');
  const providerApiKeyInput = ref('secret');
  const webSearchDiagnosticsText = ref('—');
  const fetchModels = vi.fn(async () => ({
    success: true,
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    modelDetails: [{ id: 'deepseek-chat', capabilities: ['chat'] }],
  }));
  const fetchRuntimeModelConfig = vi.fn(async () => ({
    success: true,
    provider: 'deepseek',
  }));
  const saveRuntimeModelConfig = vi.fn(async () => ({ success: true }));
  const discoverRuntimeProviderModels = vi.fn(async () => ({
    success: true,
    models: ['discovered-a', 'discovered-b'],
  }));
  const fetchHealth = vi.fn(async () => ({
    success: true,
    webSearchProvider: 'tavily',
    webSearchStableProviderConfigured: true,
    webSearchMaxResults: 7,
    webSearchProbe: { status: 'ok', provider: 'tavily', resultCount: 1, durationMs: 42 },
  }));

  const requests = useDiagnosticsModelRequests({
    options,
    t: computed(() => ({
      modelsLoadFailed: 'models failed',
      modelsNetworkError: 'network failed',
      modelsListEmpty: 'empty',
      connectionConfigSaved: 'saved',
      connectionConfigFailed: 'failed',
      connectionConfigTested: 'tested',
    })),
    showModelPicker: computed(() => true),
    selectedModelStorageKey: computed(() => 'selected-model'),
    modelChoices,
    modelCapabilities,
    selectedChatModel,
    defaultChatModel,
    modelListStatus,
    modelListError,
    diagnosticsBusy,
    diagnosticsLastChecked,
    connectionConfigMessage,
    providerApiKeyInput,
    webSearchDiagnosticsText,
    applyRuntimeModelConfig: vi.fn(),
    buildRuntimeModelConfigPayload: () => ({ provider: 'deepseek' }),
    applyDiscoveredModels: vi.fn(),
    api: {
      fetchModels,
      fetchRuntimeModelConfig,
      saveRuntimeModelConfig,
      discoverRuntimeProviderModels,
      fetchHealth,
    },
  });

  return {
    requests,
    state: {
      modelChoices,
      modelCapabilities,
      selectedChatModel,
      defaultChatModel,
      modelListStatus,
      modelListError,
      diagnosticsBusy,
      diagnosticsLastChecked,
      connectionConfigMessage,
      providerApiKeyInput,
      webSearchDiagnosticsText,
    },
    api: {
      fetchModels,
      fetchRuntimeModelConfig,
      saveRuntimeModelConfig,
      discoverRuntimeProviderModels,
      fetchHealth,
    },
  };
}

describe('useDiagnosticsModelRequests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('refreshChatModels loads models, capabilities, default, and saved selection', async () => {
    localStorage.setItem('selected-model', 'deepseek-reasoner');
    const { requests, state, api } = makeHarness();

    await requests.refreshChatModels();

    expect(api.fetchModels).toHaveBeenCalledWith('/ai-assistant', 'token', { probe: true });
    expect(state.modelChoices.value).toEqual(['deepseek-chat', 'deepseek-reasoner']);
    expect(state.modelCapabilities.value).toEqual({ 'deepseek-chat': ['chat'] });
    expect(state.defaultChatModel.value).toBe('deepseek-chat');
    expect(state.selectedChatModel.value).toBe('deepseek-reasoner');
  });

  it('saveProviderConfig saves runtime config, clears api key, refreshes models, and reports success', async () => {
    const { requests, state, api } = makeHarness();

    await requests.saveProviderConfig();

    expect(api.saveRuntimeModelConfig).toHaveBeenCalledWith(
      '/ai-assistant',
      { provider: 'deepseek' },
      'token',
      'admin',
    );
    expect(state.providerApiKeyInput.value).toBe('');
    expect(api.fetchModels).toHaveBeenCalledOnce();
    expect(state.connectionConfigMessage.value).toBe('saved');
    expect(state.diagnosticsBusy.value).toBe(false);
    expect(state.diagnosticsLastChecked.value).not.toBe('');
  });

  it('runModelDiagnostics refreshes web search diagnostics from health', async () => {
    const { requests, state, api } = makeHarness();

    await requests.runModelDiagnostics();

    expect(api.fetchHealth).toHaveBeenCalledWith('/ai-assistant', 'token', true);
    expect(state.webSearchDiagnosticsText.value).toBe('tavily · configured · 7 · probe ok');
  });

  it('keeps the previous model picker state when model refresh fails', async () => {
    const { requests, state, api } = makeHarness();
    api.fetchModels.mockResolvedValueOnce({ success: false, error: 'network down' });

    await requests.refreshChatModels();

    expect(state.modelChoices.value).toEqual(['stale']);
    expect(state.selectedChatModel.value).toBe('stale');
    expect(state.modelListError.value).toBe('network down');
  });

  it('does not call admin runtime-config endpoints without host credentials', async () => {
    const { requests, api } = makeHarness({ accessToken: undefined, adminToken: undefined });

    await requests.refreshRuntimeModelConfig();
    await requests.saveProviderConfig();
    await requests.discoverProviderModels();

    expect(api.fetchRuntimeModelConfig).not.toHaveBeenCalled();
    expect(api.saveRuntimeModelConfig).not.toHaveBeenCalled();
    expect(api.discoverRuntimeProviderModels).not.toHaveBeenCalled();
  });
});
