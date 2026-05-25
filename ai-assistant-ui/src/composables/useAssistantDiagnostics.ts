import { computed, ref, type ComputedRef } from 'vue';
import type { AiAssistantOptions } from '../index';
import type { I18nMessages } from '../utils/i18n';
import {
  useConnectionDiagnosticsState,
  type ModelListStatus,
} from './useConnectionDiagnosticsState';
import { useConnectionConfigState } from './useConnectionConfigState';
import { useRuntimeProviderConfigState } from './useRuntimeProviderConfigState';
import { useDiagnosticsClipboard } from './useDiagnosticsClipboard';
import { useDiagnosticsModelRequests } from './useDiagnosticsModelRequests';

export interface UseAssistantDiagnosticsOptions {
  options: AiAssistantOptions;
  t: ComputedRef<I18nMessages>;
  showModelPicker: ComputedRef<boolean>;
  selectedModelStorageKey: ComputedRef<string>;
  pendingTimers: number[];
}

// eslint-disable-next-line max-lines-per-function
export function useAssistantDiagnostics(opts: UseAssistantDiagnosticsOptions) {
  const { options, t, showModelPicker, selectedModelStorageKey, pendingTimers } = opts;

  const modelChoices = ref<string[]>([]);
  const modelCapabilities = ref<Record<string, string[]>>({});
  const selectedChatModel = ref('');
  const defaultChatModel = ref('');
  const diagnosticsOpen = ref(false);
  const diagnosticsBusy = ref(false);
  const diagnosticsLastChecked = ref('');
  const modelListError = ref('');
  const modelListStatus = ref<ModelListStatus>('');
  const webSearchDiagnosticsText = ref('—');
  const webSearchStats = ref<Record<string, number> | null>(null);
  const providerConfig = useRuntimeProviderConfigState();
  const {
    providerInput,
    providerBaseUrlInput,
    providerApiKeyInput,
    providerModelInput,
    providerAllowedModelsInput,
    webSearchProviderInput,
    webSearchApiKeyInput,
    webSearchMaxResultsInput,
    webSearchAllowedDomainsInput,
    webSearchBlockedDomainsInput,
    applyRuntimeModelConfig,
    buildRuntimeModelConfigPayload,
    applyDiscoveredModels,
  } = providerConfig;
  const diagnosticsBaseUrl = computed({
    get: () => options.baseUrl,
    set: (value: string | undefined) => {
      options.baseUrl = value;
    },
  });
  const diagnosticsAccessToken = computed({
    get: () => options.accessToken,
    set: (value: string | undefined) => {
      options.accessToken = value;
    },
  });

  const connectionConfig = useConnectionConfigState({ options, t });
  const {
    connectionBaseUrlInput,
    connectionTokenInput,
    connectionPersistEnabled,
    connectionConfigMessage,
    connectionBaseUrlStorageKey,
    connectionTokenStorageKey,
    syncConnectionInputsFromOptions,
    applyConnectionConfigInputs,
    persistConnectionConfigIfEnabled,
    useDefaultBaseUrlForDiagnostics,
  } = connectionConfig;
  const diagnosticsState = useConnectionDiagnosticsState({
    t,
    baseUrl: diagnosticsBaseUrl,
    accessToken: diagnosticsAccessToken,
    diagnosticsBusy,
    modelChoices,
    selectedChatModel,
    modelListStatus,
  });
  const {
    modelListMessage,
    diagnosticsModelEndpoint,
    diagnosticsTokenText,
    diagnosticsStatusMessage,
    modelStatusKind,
    modelStatusText,
    modelSourceText,
    modelHintText,
    diagnosticsRemedyKind,
  } = diagnosticsState;
  const { diagnosticsCopied, diagnosticsCopyMessage, copyDiagnostics } = useDiagnosticsClipboard({
    t,
    pendingTimers,
    getSnapshot: () => ({
      baseUrl: options.baseUrl,
      modelEndpoint: diagnosticsModelEndpoint.value,
      accessToken: options.accessToken,
      statusMessage: diagnosticsStatusMessage.value,
      lastError: modelListError.value,
      selectedModel: selectedChatModel.value,
      modelSourceText: modelSourceText.value,
      modelStatusText: modelStatusText.value,
      webSearchDiagnosticsText: webSearchDiagnosticsText.value,
      webSearchStats: webSearchStats.value,
      modelCount: modelChoices.value.length,
      lastChecked: diagnosticsLastChecked.value,
    }),
  });

  const {
    refreshRuntimeModelConfig,
    refreshChatModels,
    runModelDiagnostics,
    saveProviderConfig,
    discoverProviderModels,
  } = useDiagnosticsModelRequests({
    options,
    t,
    showModelPicker,
    selectedModelStorageKey,
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
    webSearchApiKeyInput,
    webSearchDiagnosticsText,
    webSearchStats,
    applyRuntimeModelConfig,
    buildRuntimeModelConfigPayload,
    applyDiscoveredModels,
  });

  function toggleDiagnostics() {
    diagnosticsOpen.value = !diagnosticsOpen.value;
    if (diagnosticsOpen.value) {
      syncConnectionInputsFromOptions();
      void runModelDiagnostics();
    }
  }

  function handleSendBlockedAction() {
    if (options.baseUrl) return;
    diagnosticsOpen.value = true;
    syncConnectionInputsFromOptions();
    useDefaultBaseUrlForDiagnostics();
  }

  async function testConnectionConfig() {
    applyConnectionConfigInputs();
    await runModelDiagnostics();
    connectionConfigMessage.value =
      modelChoices.value.length > 0
        ? t.value.connectionConfigTested
        : t.value.connectionConfigFailed;
  }

  async function saveConnectionConfig() {
    applyConnectionConfigInputs();
    persistConnectionConfigIfEnabled();
    await runModelDiagnostics();
    connectionConfigMessage.value = t.value.connectionConfigSaved;
  }

  return {
    modelChoices,
    modelCapabilities,
    selectedChatModel,
    defaultChatModel,
    diagnosticsOpen,
    diagnosticsBusy,
    diagnosticsCopied,
    diagnosticsCopyMessage,
    diagnosticsLastChecked,
    modelListError,
    connectionBaseUrlInput,
    connectionTokenInput,
    connectionPersistEnabled,
    connectionConfigMessage,
    providerInput,
    providerBaseUrlInput,
    providerApiKeyInput,
    providerModelInput,
    providerAllowedModelsInput,
    webSearchProviderInput,
    webSearchApiKeyInput,
    webSearchMaxResultsInput,
    webSearchAllowedDomainsInput,
    webSearchBlockedDomainsInput,
    modelListStatus,
    webSearchDiagnosticsText,
    webSearchStats,
    modelListMessage,
    diagnosticsModelEndpoint,
    diagnosticsTokenText,
    diagnosticsStatusMessage,
    modelStatusKind,
    modelStatusText,
    modelSourceText,
    modelHintText,
    diagnosticsRemedyKind,
    refreshRuntimeModelConfig,
    refreshChatModels,
    runModelDiagnostics,
    toggleDiagnostics,
    syncConnectionInputsFromOptions,
    useDefaultBaseUrlForDiagnostics,
    handleSendBlockedAction,
    testConnectionConfig,
    saveConnectionConfig,
    saveProviderConfig,
    discoverProviderModels,
    copyDiagnostics,
    connectionBaseUrlStorageKey,
    connectionTokenStorageKey,
  };
}
