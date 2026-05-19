import { computed, ref, type ComputedRef } from 'vue';
import type { AiAssistantOptions } from '../index';
import type { I18nMessages } from '../utils/i18n';
import {
  discoverRuntimeProviderModels,
  fetchModels,
  fetchRuntimeModelConfig,
  saveRuntimeModelConfig,
} from '../utils/api';

type ModelListStatus =
  | ''
  | 'empty'
  | 'network'
  | 'unauthorized'
  | 'rateLimited'
  | 'serverError'
  | 'failed';

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
  const diagnosticsCopied = ref(false);
  const diagnosticsCopyMessage = ref('');
  const diagnosticsLastChecked = ref('');
  const modelListError = ref('');
  const connectionBaseUrlInput = ref(options.baseUrl || '');
  const connectionTokenInput = ref(options.accessToken || '');
  const connectionPersistEnabled = ref(true);
  const connectionConfigMessage = ref('');
  const modelListStatus = ref<ModelListStatus>('');
  const providerInput = ref('');
  const providerBaseUrlInput = ref('');
  const providerApiKeyInput = ref('');
  const providerModelInput = ref('');
  const providerAllowedModelsInput = ref('');

  const connectionBaseUrlStorageKey = 'ai-assistant-connection-base-url';
  const connectionTokenStorageKey = 'ai-assistant-connection-token';

  const modelListMessage = computed(() => {
    switch (modelListStatus.value) {
      case 'empty':
        return t.value.modelsListEmpty;
      case 'network':
        return t.value.modelsNetworkError;
      case 'unauthorized':
        return t.value.modelsUnauthorized;
      case 'rateLimited':
        return t.value.modelsRateLimited;
      case 'serverError':
        return t.value.modelsServerError;
      case 'failed':
        return t.value.modelsLoadFailed;
      default:
        return t.value.modelsListEmpty;
    }
  });
  const diagnosticsModelEndpoint = computed(() =>
    options.baseUrl ? `${options.baseUrl.replace(/\/+$/, '')}/models` : '—',
  );
  const diagnosticsTokenText = computed(() =>
    options.accessToken?.trim()
      ? t.value.diagnosticsTokenConfigured
      : t.value.diagnosticsTokenMissing,
  );
  const diagnosticsStatusMessage = computed(() => {
    if (!options.baseUrl) return t.value.diagnosticsStatusNoBaseUrl;
    if (diagnosticsBusy.value) return t.value.diagnosticsStatusChecking;
    if (modelChoices.value.length > 0) return t.value.diagnosticsStatusReady;
    return modelListMessage.value;
  });
  const modelStatusKind = computed<'ready' | 'checking' | 'warning' | 'offline'>(() => {
    if (!options.baseUrl) return 'offline';
    if (diagnosticsBusy.value) return 'checking';
    if (selectedChatModel.value) return 'ready';
    if (modelListStatus.value) return 'warning';
    return 'offline';
  });
  const modelStatusText = computed(() => {
    if (!options.baseUrl) return t.value.modelStatusUnconfigured;
    if (diagnosticsBusy.value) return t.value.modelStatusChecking;
    if (selectedChatModel.value) return selectedChatModel.value;
    if (modelListStatus.value) return modelListMessage.value;
    return t.value.modelStatusUnavailable;
  });
  const modelSourceText = computed(() => {
    if (!options.baseUrl) return t.value.diagnosticsModelSourceUnavailable;
    if (selectedChatModel.value) return t.value.diagnosticsModelSourceSelected;
    return t.value.diagnosticsModelSourceDefault;
  });
  const modelHintText = computed(() => {
    if (!options.baseUrl) return t.value.diagnosticsModelHintNoBaseUrl;
    if (selectedChatModel.value) {
      return t.value.diagnosticsModelHintReady.replace('{model}', selectedChatModel.value);
    }
    return t.value.diagnosticsModelHintCheck;
  });
  const diagnosticsRemedyKind = computed(() => {
    if (selectedChatModel.value && modelChoices.value.length > 0) return 'ready';
    if (!options.baseUrl) return 'noBaseUrl';
    return modelListStatus.value || 'failed';
  });

  function modelListStatusFromError(error?: string): ModelListStatus {
    if (!error) return 'failed';
    if (/\b(401|403)\b/.test(error)) return 'unauthorized';
    if (/\b429\b/.test(error)) return 'rateLimited';
    if (/\b5\d\d\b/.test(error)) return 'serverError';
    if (/failed to fetch|networkerror|timeout|aborted/i.test(error)) return 'network';
    return 'failed';
  }

  async function refreshChatModels() {
    modelChoices.value = [];
    modelCapabilities.value = {};
    selectedChatModel.value = '';
    defaultChatModel.value = '';
    modelListStatus.value = '';
    modelListError.value = '';
    if (!options.baseUrl || !showModelPicker.value) return;
    try {
      const r = await fetchModels(options.baseUrl, options.accessToken, { probe: true });
      if (!r.success) {
        modelListStatus.value = modelListStatusFromError(r.error);
        modelListError.value = r.error || t.value.modelsLoadFailed;
        return;
      }
      if (!r.models?.length) {
        modelListStatus.value = 'empty';
        return;
      }
      modelChoices.value = r.models;
      modelCapabilities.value = Object.fromEntries(
        (r.modelDetails ?? [])
          .filter((detail) => detail.id && Array.isArray(detail.capabilities))
          .map((detail) => [detail.id, detail.capabilities ?? []]),
      );
      const def =
        r.defaultModel && r.models.includes(r.defaultModel) ? r.defaultModel : r.models[0];
      defaultChatModel.value = def;
      let pick = def;
      try {
        const saved = localStorage.getItem(selectedModelStorageKey.value);
        if (saved && r.models.includes(saved)) pick = saved;
      } catch {
        /* ignore */
      }
      selectedChatModel.value = pick;
    } catch (e: unknown) {
      modelListStatus.value = 'network';
      modelListError.value =
        e instanceof Error ? e.message : String(e || t.value.modelsNetworkError);
    }
  }

  async function refreshRuntimeModelConfig() {
    if (!options.baseUrl) return;
    const cfg = await fetchRuntimeModelConfig(
      options.baseUrl,
      options.accessToken,
      options.adminToken,
    );
    if (!cfg.success) {
      modelListStatus.value = modelListStatusFromError(cfg.error);
      modelListError.value = cfg.error || t.value.modelsLoadFailed;
      return;
    }
    providerInput.value = cfg.provider || '';
    providerBaseUrlInput.value = cfg.baseUrl || '';
    providerModelInput.value = cfg.model || '';
    providerAllowedModelsInput.value = (cfg.allowedModels ?? []).join(', ');
    providerApiKeyInput.value = '';
  }

  async function runModelDiagnostics() {
    diagnosticsBusy.value = true;
    try {
      await refreshRuntimeModelConfig();
      await refreshChatModels();
    } finally {
      diagnosticsLastChecked.value = new Date().toLocaleString();
      diagnosticsBusy.value = false;
    }
  }

  function syncConnectionInputsFromOptions() {
    connectionBaseUrlInput.value = options.baseUrl || '';
    connectionTokenInput.value = options.accessToken || '';
  }

  function toggleDiagnostics() {
    diagnosticsOpen.value = !diagnosticsOpen.value;
    if (diagnosticsOpen.value) {
      syncConnectionInputsFromOptions();
      void runModelDiagnostics();
    }
  }

  function applyConnectionConfigInputs() {
    const baseUrl = connectionBaseUrlInput.value.trim();
    const token = connectionTokenInput.value.trim();
    options.baseUrl = baseUrl || undefined;
    options.accessToken = token || undefined;
  }

  function persistConnectionConfigIfEnabled() {
    const baseUrl = connectionBaseUrlInput.value.trim();
    const token = connectionTokenInput.value.trim();
    try {
      if (!connectionPersistEnabled.value) {
        localStorage.removeItem(connectionBaseUrlStorageKey);
        localStorage.removeItem(connectionTokenStorageKey);
        return;
      }
      if (baseUrl) localStorage.setItem(connectionBaseUrlStorageKey, baseUrl);
      else localStorage.removeItem(connectionBaseUrlStorageKey);
      if (token) localStorage.setItem(connectionTokenStorageKey, token);
      else localStorage.removeItem(connectionTokenStorageKey);
    } catch {
      /* localStorage may be unavailable or full. */
    }
  }

  function useDefaultBaseUrlForDiagnostics() {
    connectionBaseUrlInput.value = '/ai-assistant';
    connectionConfigMessage.value = t.value.connectionConfigDefaultApplied;
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

  async function saveProviderConfig() {
    if (!options.baseUrl) return;
    diagnosticsBusy.value = true;
    try {
      const result = await saveRuntimeModelConfig(
        options.baseUrl,
        {
          provider: providerInput.value,
          baseUrl: providerBaseUrlInput.value,
          apiKey: providerApiKeyInput.value,
          model: providerModelInput.value,
          allowedModelsText: providerAllowedModelsInput.value,
        },
        options.accessToken,
        options.adminToken,
      );
      if (!result.success) {
        modelListStatus.value = modelListStatusFromError(result.error);
        modelListError.value = result.error || t.value.modelsLoadFailed;
        connectionConfigMessage.value = t.value.connectionConfigFailed;
        return;
      }
      providerApiKeyInput.value = '';
      await refreshChatModels();
      connectionConfigMessage.value = t.value.connectionConfigSaved;
    } finally {
      diagnosticsBusy.value = false;
      diagnosticsLastChecked.value = new Date().toLocaleString();
    }
  }

  async function discoverProviderModels() {
    if (!options.baseUrl) return;
    diagnosticsBusy.value = true;
    try {
      const result = await discoverRuntimeProviderModels(
        options.baseUrl,
        options.accessToken,
        options.adminToken,
      );
      if (!result.success || !result.models?.length) {
        modelListStatus.value = modelListStatusFromError(result.error);
        modelListError.value = result.error || t.value.modelsListEmpty;
        connectionConfigMessage.value = t.value.connectionConfigFailed;
        return;
      }
      providerAllowedModelsInput.value = result.models.join(', ');
      if (!providerModelInput.value && result.models[0]) {
        providerModelInput.value = result.models[0];
      }
      connectionConfigMessage.value = t.value.connectionConfigTested;
    } finally {
      diagnosticsBusy.value = false;
      diagnosticsLastChecked.value = new Date().toLocaleString();
    }
  }

  async function copyDiagnostics() {
    const lines = [
      'AI Assistant Diagnostics',
      `Base URL: ${options.baseUrl || '(not configured)'}`,
      `Models endpoint: ${diagnosticsModelEndpoint.value}`,
      `Access token: ${options.accessToken?.trim() ? 'configured' : 'missing'}`,
      `Status: ${diagnosticsStatusMessage.value}`,
      `Last error: ${modelListError.value || '(none)'}`,
      `Selected model: ${selectedChatModel.value || '(not selected)'}`,
      `Model source: ${modelSourceText.value}`,
      `Model status: ${modelStatusText.value}`,
      `Available models: ${modelChoices.value.length}`,
      `Last checked: ${diagnosticsLastChecked.value || '(never)'}`,
    ];
    const text = lines.join('\n');
    try {
      await writeClipboardText(text);
      diagnosticsCopied.value = true;
      diagnosticsCopyMessage.value = t.value.diagnosticsCopied;
      pendingTimers.push(
        window.setTimeout(() => {
          diagnosticsCopied.value = false;
          diagnosticsCopyMessage.value = '';
        }, 1500),
      );
    } catch {
      diagnosticsCopied.value = false;
      diagnosticsCopyMessage.value = t.value.diagnosticsCopyFailed;
    }
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
    modelListStatus,
    modelListMessage,
    diagnosticsModelEndpoint,
    diagnosticsTokenText,
    diagnosticsStatusMessage,
    modelStatusKind,
    modelStatusText,
    modelSourceText,
    modelHintText,
    diagnosticsRemedyKind,
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

export async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('copy command failed');
  } finally {
    document.body.removeChild(textarea);
  }
}
