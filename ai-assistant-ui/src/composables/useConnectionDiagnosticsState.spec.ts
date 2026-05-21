import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';

import {
  modelListStatusFromError,
  useConnectionDiagnosticsState,
} from './useConnectionDiagnosticsState';

const t = computed(() => ({
  modelsListEmpty: 'No models',
  modelsNetworkError: 'Network error',
  modelsUnauthorized: 'Unauthorized',
  modelsRateLimited: 'Rate limited',
  modelsServerError: 'Server error',
  modelsLoadFailed: 'Load failed',
  diagnosticsTokenConfigured: 'Configured',
  diagnosticsTokenMissing: 'Missing',
  diagnosticsStatusNoBaseUrl: 'No base URL',
  diagnosticsStatusChecking: 'Checking',
  diagnosticsStatusReady: 'Ready',
  modelStatusUnconfigured: 'Unconfigured',
  modelStatusChecking: 'Checking model',
  modelStatusUnavailable: 'Unavailable',
  diagnosticsModelSourceUnavailable: 'No endpoint',
  diagnosticsModelSourceSelected: 'Selected',
  diagnosticsModelSourceDefault: 'Default',
  diagnosticsModelHintNoBaseUrl: 'Configure backend first',
  diagnosticsModelHintReady: 'Using {model}',
  diagnosticsModelHintCheck: 'Refresh diagnostics',
}));

function createState() {
  return useConnectionDiagnosticsState({
    t,
    baseUrl: ref<string | undefined>(),
    accessToken: ref<string | undefined>(),
    diagnosticsBusy: ref(false),
    modelChoices: ref<string[]>([]),
    selectedChatModel: ref(''),
    modelListStatus: ref(''),
  });
}

describe('useConnectionDiagnosticsState', () => {
  it('classifies model list errors', () => {
    expect(modelListStatusFromError('HTTP 401')).toBe('unauthorized');
    expect(modelListStatusFromError('403 Forbidden')).toBe('unauthorized');
    expect(modelListStatusFromError('429')).toBe('rateLimited');
    expect(modelListStatusFromError('502 Bad Gateway')).toBe('serverError');
    expect(modelListStatusFromError('Failed to fetch')).toBe('network');
    expect(modelListStatusFromError('unexpected')).toBe('failed');
    expect(modelListStatusFromError()).toBe('failed');
  });

  it('returns offline diagnostics when baseUrl is missing', () => {
    const state = createState();

    expect(state.diagnosticsModelEndpoint.value).toBe('—');
    expect(state.diagnosticsTokenText.value).toBe('Missing');
    expect(state.diagnosticsStatusMessage.value).toBe('No base URL');
    expect(state.modelStatusKind.value).toBe('offline');
    expect(state.modelStatusText.value).toBe('Unconfigured');
    expect(state.modelSourceText.value).toBe('No endpoint');
    expect(state.modelHintText.value).toBe('Configure backend first');
    expect(state.diagnosticsRemedyKind.value).toBe('noBaseUrl');
  });

  it('shows checking state while diagnostics are busy', () => {
    const state = createState();
    state.baseUrl.value = 'https://api.example.com/ai-assistant/';
    state.accessToken.value = 'token';
    state.diagnosticsBusy.value = true;

    expect(state.diagnosticsModelEndpoint.value).toBe(
      'https://api.example.com/ai-assistant/models',
    );
    expect(state.diagnosticsTokenText.value).toBe('Configured');
    expect(state.diagnosticsStatusMessage.value).toBe('Checking');
    expect(state.modelStatusKind.value).toBe('checking');
    expect(state.modelStatusText.value).toBe('Checking model');
  });

  it('shows ready state when a selected model is available', () => {
    const state = createState();
    state.baseUrl.value = '/ai-assistant';
    state.modelChoices.value = ['gpt-4o-mini'];
    state.selectedChatModel.value = 'gpt-4o-mini';

    expect(state.diagnosticsStatusMessage.value).toBe('Ready');
    expect(state.modelStatusKind.value).toBe('ready');
    expect(state.modelStatusText.value).toBe('gpt-4o-mini');
    expect(state.modelSourceText.value).toBe('Selected');
    expect(state.modelHintText.value).toBe('Using gpt-4o-mini');
    expect(state.diagnosticsRemedyKind.value).toBe('ready');
  });

  it('surfaces warning and remedy from modelListStatus', () => {
    const state = createState();
    state.baseUrl.value = '/ai-assistant';
    state.modelListStatus.value = 'unauthorized';

    expect(state.modelListMessage.value).toBe('Unauthorized');
    expect(state.diagnosticsStatusMessage.value).toBe('Unauthorized');
    expect(state.modelStatusKind.value).toBe('warning');
    expect(state.modelStatusText.value).toBe('Unauthorized');
    expect(state.diagnosticsRemedyKind.value).toBe('unauthorized');
  });
});
