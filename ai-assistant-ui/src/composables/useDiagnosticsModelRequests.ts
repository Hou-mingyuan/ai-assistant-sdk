import type { ComputedRef, Ref } from 'vue';
import type { AiAssistantOptions } from '../index';
import type { I18nMessages } from '../utils/i18n';
import {
  discoverRuntimeProviderModels,
  fetchHealth,
  fetchModels,
  fetchRuntimeModelConfig,
  saveRuntimeModelConfig,
  type RuntimeModelConfigPayload,
  type RuntimeModelConfigResult,
} from '../utils/api';
import { modelListStatusFromError, type ModelListStatus } from './useConnectionDiagnosticsState';

interface DiagnosticsRequestApi {
  fetchModels: typeof fetchModels;
  fetchRuntimeModelConfig: typeof fetchRuntimeModelConfig;
  saveRuntimeModelConfig: typeof saveRuntimeModelConfig;
  discoverRuntimeProviderModels: typeof discoverRuntimeProviderModels;
  fetchHealth: typeof fetchHealth;
}

export interface UseDiagnosticsModelRequestsOptions {
  options: AiAssistantOptions;
  t: ComputedRef<
    Pick<
      I18nMessages,
      | 'modelsLoadFailed'
      | 'modelsNetworkError'
      | 'modelsListEmpty'
      | 'connectionConfigSaved'
      | 'connectionConfigFailed'
      | 'connectionConfigTested'
    >
  >;
  showModelPicker: ComputedRef<boolean>;
  selectedModelStorageKey: ComputedRef<string>;
  modelChoices: Ref<string[]>;
  modelCapabilities: Ref<Record<string, string[]>>;
  selectedChatModel: Ref<string>;
  defaultChatModel: Ref<string>;
  modelListStatus: Ref<ModelListStatus>;
  modelListError: Ref<string>;
  diagnosticsBusy: Ref<boolean>;
  diagnosticsLastChecked: Ref<string>;
  connectionConfigMessage: Ref<string>;
  providerApiKeyInput: Ref<string>;
  webSearchApiKeyInput?: Ref<string>;
  webSearchDiagnosticsText: Ref<string>;
  applyRuntimeModelConfig: (config: RuntimeModelConfigResult) => void;
  buildRuntimeModelConfigPayload: () => RuntimeModelConfigPayload;
  applyDiscoveredModels: (models: string[]) => void;
  api?: DiagnosticsRequestApi;
}

export function useDiagnosticsModelRequests(opts: UseDiagnosticsModelRequestsOptions) {
  const api = opts.api ?? {
    fetchModels,
    fetchRuntimeModelConfig,
    saveRuntimeModelConfig,
    discoverRuntimeProviderModels,
    fetchHealth,
  };

  async function refreshChatModels() {
    opts.modelChoices.value = [];
    opts.modelCapabilities.value = {};
    opts.selectedChatModel.value = '';
    opts.defaultChatModel.value = '';
    opts.modelListStatus.value = '';
    opts.modelListError.value = '';
    if (!opts.options.baseUrl || !opts.showModelPicker.value) return;
    try {
      const r = await api.fetchModels(opts.options.baseUrl, opts.options.accessToken, {
        probe: true,
      });
      if (!r.success) {
        opts.modelListStatus.value = modelListStatusFromError(r.error);
        opts.modelListError.value = r.error || opts.t.value.modelsLoadFailed;
        return;
      }
      if (!r.models?.length) {
        opts.modelListStatus.value = 'empty';
        return;
      }
      opts.modelChoices.value = r.models;
      opts.modelCapabilities.value = Object.fromEntries(
        (r.modelDetails ?? [])
          .filter((detail) => detail.id && Array.isArray(detail.capabilities))
          .map((detail) => [detail.id, detail.capabilities ?? []]),
      );
      const def =
        r.defaultModel && r.models.includes(r.defaultModel) ? r.defaultModel : r.models[0];
      opts.defaultChatModel.value = def;
      let pick = def;
      try {
        const saved = localStorage.getItem(opts.selectedModelStorageKey.value);
        if (saved && r.models.includes(saved)) pick = saved;
      } catch {
        /* ignore */
      }
      opts.selectedChatModel.value = pick;
    } catch (e: unknown) {
      opts.modelListStatus.value = 'network';
      opts.modelListError.value =
        e instanceof Error ? e.message : String(e || opts.t.value.modelsNetworkError);
    }
  }

  async function refreshRuntimeModelConfig() {
    if (!opts.options.baseUrl) return;
    const cfg = await api.fetchRuntimeModelConfig(
      opts.options.baseUrl,
      opts.options.accessToken,
      opts.options.adminToken,
    );
    if (!cfg.success) {
      opts.modelListStatus.value = modelListStatusFromError(cfg.error);
      opts.modelListError.value = cfg.error || opts.t.value.modelsLoadFailed;
      return;
    }
    opts.applyRuntimeModelConfig(cfg);
  }

  async function refreshWebSearchDiagnostics() {
    opts.webSearchDiagnosticsText.value = '—';
    if (!opts.options.baseUrl) return;
    try {
      const health = await api.fetchHealth(opts.options.baseUrl, opts.options.accessToken);
      if (!health.success) return;
      const provider = health.webSearchProvider || 'duckduckgo';
      const configured = health.webSearchStableProviderConfigured ? 'configured' : 'fallback';
      const max = health.webSearchMaxResults ?? 5;
      const stats = health.webSearchStats;
      const statText = stats?.attempts
        ? ` · ${stats.successes ?? 0}/${stats.attempts} ok · ${stats.averageDurationMs ?? 0}ms avg`
        : '';
      opts.webSearchDiagnosticsText.value = `${provider} · ${configured} · ${max}${statText}`;
    } catch {
      opts.webSearchDiagnosticsText.value = 'unavailable';
    }
  }

  async function runModelDiagnostics() {
    opts.diagnosticsBusy.value = true;
    try {
      await refreshRuntimeModelConfig();
      await refreshChatModels();
      await refreshWebSearchDiagnostics();
    } finally {
      opts.diagnosticsLastChecked.value = new Date().toLocaleString();
      opts.diagnosticsBusy.value = false;
    }
  }

  async function saveProviderConfig() {
    if (!opts.options.baseUrl) return;
    opts.diagnosticsBusy.value = true;
    try {
      const result = await api.saveRuntimeModelConfig(
        opts.options.baseUrl,
        opts.buildRuntimeModelConfigPayload(),
        opts.options.accessToken,
        opts.options.adminToken,
      );
      if (!result.success) {
        opts.modelListStatus.value = modelListStatusFromError(result.error);
        opts.modelListError.value = result.error || opts.t.value.modelsLoadFailed;
        opts.connectionConfigMessage.value = opts.t.value.connectionConfigFailed;
        return;
      }
      opts.providerApiKeyInput.value = '';
      if (opts.webSearchApiKeyInput) opts.webSearchApiKeyInput.value = '';
      await refreshChatModels();
      await refreshWebSearchDiagnostics();
      opts.connectionConfigMessage.value = opts.t.value.connectionConfigSaved;
    } finally {
      opts.diagnosticsBusy.value = false;
      opts.diagnosticsLastChecked.value = new Date().toLocaleString();
    }
  }

  async function discoverProviderModels() {
    if (!opts.options.baseUrl) return;
    opts.diagnosticsBusy.value = true;
    try {
      const result = await api.discoverRuntimeProviderModels(
        opts.options.baseUrl,
        opts.options.accessToken,
        opts.options.adminToken,
      );
      if (!result.success || !result.models?.length) {
        opts.modelListStatus.value = modelListStatusFromError(result.error);
        opts.modelListError.value = result.error || opts.t.value.modelsListEmpty;
        opts.connectionConfigMessage.value = opts.t.value.connectionConfigFailed;
        return;
      }
      opts.applyDiscoveredModels(result.models);
      opts.connectionConfigMessage.value = opts.t.value.connectionConfigTested;
    } finally {
      opts.diagnosticsBusy.value = false;
      opts.diagnosticsLastChecked.value = new Date().toLocaleString();
    }
  }

  return {
    refreshRuntimeModelConfig,
    refreshChatModels,
    runModelDiagnostics,
    refreshWebSearchDiagnostics,
    saveProviderConfig,
    discoverProviderModels,
  };
}
