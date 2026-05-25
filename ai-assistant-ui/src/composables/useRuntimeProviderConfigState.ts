import { ref } from 'vue';
import type { RuntimeModelConfigResult } from '../utils/api';

export function useRuntimeProviderConfigState() {
  const providerInput = ref('');
  const providerBaseUrlInput = ref('');
  const providerApiKeyInput = ref('');
  const providerModelInput = ref('');
  const providerAllowedModelsInput = ref('');
  const warmupEnabledInput = ref(false);
  const webSearchProviderInput = ref('');
  const webSearchApiKeyInput = ref('');
  const webSearchMaxResultsInput = ref('');
  const webSearchAllowedDomainsInput = ref('');
  const webSearchBlockedDomainsInput = ref('');

  function applyRuntimeModelConfig(config: RuntimeModelConfigResult) {
    providerInput.value = config.provider || '';
    providerBaseUrlInput.value = config.baseUrl || '';
    providerModelInput.value = config.model || '';
    providerAllowedModelsInput.value = (config.allowedModels ?? []).join(', ');
    warmupEnabledInput.value = config.warmupEnabled === true;
    providerApiKeyInput.value = '';
    webSearchProviderInput.value = config.webSearchProvider || '';
    webSearchMaxResultsInput.value =
      config.webSearchMaxResults != null ? String(config.webSearchMaxResults) : '';
    webSearchApiKeyInput.value = '';
    webSearchAllowedDomainsInput.value = config.webSearchAllowedDomains || '';
    webSearchBlockedDomainsInput.value = config.webSearchBlockedDomains || '';
  }

  function buildRuntimeModelConfigPayload() {
    const webSearchMaxResults = Number(webSearchMaxResultsInput.value);
    return {
      provider: providerInput.value,
      baseUrl: providerBaseUrlInput.value,
      apiKey: providerApiKeyInput.value,
      model: providerModelInput.value,
      allowedModelsText: providerAllowedModelsInput.value,
      warmupEnabled: warmupEnabledInput.value,
      webSearchProvider: webSearchProviderInput.value,
      webSearchApiKey: webSearchApiKeyInput.value,
      webSearchMaxResults: Number.isFinite(webSearchMaxResults) ? webSearchMaxResults : undefined,
      webSearchAllowedDomains: webSearchAllowedDomainsInput.value,
      webSearchBlockedDomains: webSearchBlockedDomainsInput.value,
    };
  }

  function applyDiscoveredModels(models: string[]) {
    providerAllowedModelsInput.value = models.join(', ');
    if (!providerModelInput.value && models[0]) {
      providerModelInput.value = models[0];
    }
  }

  return {
    providerInput,
    providerBaseUrlInput,
    providerApiKeyInput,
    providerModelInput,
    providerAllowedModelsInput,
    warmupEnabledInput,
    webSearchProviderInput,
    webSearchApiKeyInput,
    webSearchMaxResultsInput,
    webSearchAllowedDomainsInput,
    webSearchBlockedDomainsInput,
    applyRuntimeModelConfig,
    buildRuntimeModelConfigPayload,
    applyDiscoveredModels,
  };
}
