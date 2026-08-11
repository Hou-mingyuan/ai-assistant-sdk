import { computed, type ComputedRef, type Ref } from 'vue';

export type ModelListStatus =
  '' | 'empty' | 'network' | 'unauthorized' | 'rateLimited' | 'serverError' | 'failed';

export type ModelStatusKind = 'ready' | 'checking' | 'warning' | 'offline';
export type DiagnosticsRemedyKind = 'ready' | 'noBaseUrl' | Exclude<ModelListStatus, ''>;

export interface ConnectionDiagnosticsLabels {
  modelsListEmpty: string;
  modelsNetworkError: string;
  modelsUnauthorized: string;
  modelsRateLimited: string;
  modelsServerError: string;
  modelsLoadFailed: string;
  diagnosticsTokenConfigured: string;
  diagnosticsTokenMissing: string;
  diagnosticsStatusNoBaseUrl: string;
  diagnosticsStatusChecking: string;
  diagnosticsStatusReady: string;
  modelStatusUnconfigured: string;
  modelStatusChecking: string;
  modelStatusUnavailable: string;
  diagnosticsModelSourceUnavailable: string;
  diagnosticsModelSourceSelected: string;
  diagnosticsModelSourceDefault: string;
  diagnosticsModelHintNoBaseUrl: string;
  diagnosticsModelHintReady: string;
  diagnosticsModelHintCheck: string;
}

interface UseConnectionDiagnosticsStateDeps {
  t: ComputedRef<ConnectionDiagnosticsLabels>;
  baseUrl: Ref<string | undefined>;
  accessToken: Ref<string | undefined>;
  diagnosticsBusy: Ref<boolean>;
  modelChoices: Ref<string[]>;
  selectedChatModel: Ref<string>;
  modelListStatus: Ref<ModelListStatus>;
}

export function modelListStatusFromError(error?: string): ModelListStatus {
  if (!error) return 'failed';
  if (/\b(401|403)\b/.test(error)) return 'unauthorized';
  if (/\b429\b/.test(error)) return 'rateLimited';
  if (/\b5\d\d\b/.test(error)) return 'serverError';
  if (/failed to fetch|networkerror|timeout|aborted/i.test(error)) return 'network';
  return 'failed';
}

export function useConnectionDiagnosticsState(deps: UseConnectionDiagnosticsStateDeps) {
  const modelListMessage = computed(() => {
    switch (deps.modelListStatus.value) {
      case 'empty':
        return deps.t.value.modelsListEmpty;
      case 'network':
        return deps.t.value.modelsNetworkError;
      case 'unauthorized':
        return deps.t.value.modelsUnauthorized;
      case 'rateLimited':
        return deps.t.value.modelsRateLimited;
      case 'serverError':
        return deps.t.value.modelsServerError;
      case 'failed':
        return deps.t.value.modelsLoadFailed;
      default:
        return deps.t.value.modelsListEmpty;
    }
  });

  const diagnosticsModelEndpoint = computed(() =>
    deps.baseUrl.value ? `${deps.baseUrl.value.replace(/\/+$/, '')}/models` : '—',
  );
  const diagnosticsTokenText = computed(() =>
    deps.accessToken.value?.trim()
      ? deps.t.value.diagnosticsTokenConfigured
      : deps.t.value.diagnosticsTokenMissing,
  );
  const diagnosticsStatusMessage = computed(() => {
    if (!deps.baseUrl.value) return deps.t.value.diagnosticsStatusNoBaseUrl;
    if (deps.diagnosticsBusy.value) return deps.t.value.diagnosticsStatusChecking;
    if (deps.modelChoices.value.length > 0) return deps.t.value.diagnosticsStatusReady;
    return modelListMessage.value;
  });
  const modelStatusKind = computed<ModelStatusKind>(() => {
    if (!deps.baseUrl.value) return 'offline';
    if (deps.diagnosticsBusy.value) return 'checking';
    if (deps.selectedChatModel.value) return 'ready';
    if (deps.modelListStatus.value) return 'warning';
    return 'offline';
  });
  const modelStatusText = computed(() => {
    if (!deps.baseUrl.value) return deps.t.value.modelStatusUnconfigured;
    if (deps.diagnosticsBusy.value) return deps.t.value.modelStatusChecking;
    if (deps.selectedChatModel.value) return deps.selectedChatModel.value;
    if (deps.modelListStatus.value) return modelListMessage.value;
    return deps.t.value.modelStatusUnavailable;
  });
  const modelSourceText = computed(() => {
    if (!deps.baseUrl.value) return deps.t.value.diagnosticsModelSourceUnavailable;
    if (deps.selectedChatModel.value) return deps.t.value.diagnosticsModelSourceSelected;
    return deps.t.value.diagnosticsModelSourceDefault;
  });
  const modelHintText = computed(() => {
    if (!deps.baseUrl.value) return deps.t.value.diagnosticsModelHintNoBaseUrl;
    if (deps.selectedChatModel.value) {
      return deps.t.value.diagnosticsModelHintReady.replace(
        '{model}',
        deps.selectedChatModel.value,
      );
    }
    return deps.t.value.diagnosticsModelHintCheck;
  });
  const diagnosticsRemedyKind = computed<DiagnosticsRemedyKind>(() => {
    if (deps.selectedChatModel.value && deps.modelChoices.value.length > 0) return 'ready';
    if (!deps.baseUrl.value) return 'noBaseUrl';
    return deps.modelListStatus.value || 'failed';
  });

  return {
    baseUrl: deps.baseUrl,
    accessToken: deps.accessToken,
    diagnosticsBusy: deps.diagnosticsBusy,
    modelChoices: deps.modelChoices,
    selectedChatModel: deps.selectedChatModel,
    modelListStatus: deps.modelListStatus,
    modelListMessage,
    diagnosticsModelEndpoint,
    diagnosticsTokenText,
    diagnosticsStatusMessage,
    modelStatusKind,
    modelStatusText,
    modelSourceText,
    modelHintText,
    diagnosticsRemedyKind,
  };
}
