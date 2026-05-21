import { ref } from 'vue';
import type { RuntimeModelConfigResult } from '../utils/api';

export function useRuntimeProviderConfigState() {
  const providerInput = ref('');
  const providerBaseUrlInput = ref('');
  const providerApiKeyInput = ref('');
  const providerModelInput = ref('');
  const providerAllowedModelsInput = ref('');

  function applyRuntimeModelConfig(config: RuntimeModelConfigResult) {
    providerInput.value = config.provider || '';
    providerBaseUrlInput.value = config.baseUrl || '';
    providerModelInput.value = config.model || '';
    providerAllowedModelsInput.value = (config.allowedModels ?? []).join(', ');
    providerApiKeyInput.value = '';
  }

  function buildRuntimeModelConfigPayload() {
    return {
      provider: providerInput.value,
      baseUrl: providerBaseUrlInput.value,
      apiKey: providerApiKeyInput.value,
      model: providerModelInput.value,
      allowedModelsText: providerAllowedModelsInput.value,
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
    applyRuntimeModelConfig,
    buildRuntimeModelConfigPayload,
    applyDiscoveredModels,
  };
}
