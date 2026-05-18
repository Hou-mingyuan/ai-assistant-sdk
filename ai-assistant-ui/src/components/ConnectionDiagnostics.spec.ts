import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ConnectionDiagnostics from './ConnectionDiagnostics.vue';
import type { I18nMessages } from '../utils/i18n';

const t = {
  diagnosticsTitle: 'Diagnostics',
  diagnosticsRefresh: 'Refresh',
  diagnosticsCopy: 'Copy',
  diagnosticsCopied: 'Copied',
  diagnosticsClose: 'Close',
  diagnosticsStatus: 'Status',
  diagnosticsLastError: 'Last error',
  diagnosticsNoError: 'None',
  diagnosticsBaseUrl: 'Base URL',
  diagnosticsModelEndpoint: 'Models endpoint',
  diagnosticsToken: 'Token',
  diagnosticsSelectedModel: 'Selected model',
  diagnosticsNoSelectedModel: 'Not selected',
  diagnosticsModelSource: 'Model source',
  diagnosticsAvailableModels: 'Available models',
  diagnosticsLastChecked: 'Last checked',
  diagnosticsNeverChecked: 'Never',
  modelLabel: 'Model',
  connectionConfigTitle: 'Connection',
  connectionConfigBaseUrlPlaceholder: 'Base URL',
  connectionConfigTokenPlaceholder: 'Token',
  connectionConfigPersist: 'Persist',
  connectionConfigTest: 'Test',
  connectionConfigSave: 'Save',
  diagnosticsRemedyNoBaseUrlTitle: 'No backend configured',
  diagnosticsRemedyNoBaseUrlText: 'Use the default endpoint.',
  diagnosticsRemedyUnauthorizedTitle: 'Token required',
  diagnosticsRemedyUnauthorizedText: 'Check your token.',
  diagnosticsRemedyRateLimitedTitle: 'Rate limited',
  diagnosticsRemedyRateLimitedText: 'Retry later.',
  diagnosticsRemedyServerTitle: 'Server error',
  diagnosticsRemedyServerText: 'Check service logs.',
  diagnosticsRemedyNetworkTitle: 'Network unavailable',
  diagnosticsRemedyNetworkText: 'Check base URL.',
  diagnosticsRemedyGenericTitle: 'Needs attention',
  diagnosticsRemedyGenericText: 'Refresh diagnostics.',
  diagnosticsUseDefaultBaseUrl: 'Use /ai-assistant',
  diagnosticsFocusToken: 'Edit token',
  diagnosticsClearToken: 'Clear token',
} as unknown as I18nMessages;

function mountDialog(overrides: Partial<Record<string, unknown>> = {}) {
  return mount(ConnectionDiagnostics, {
    props: {
      uid: 'test',
      busy: false,
      copied: false,
      copyMessage: '',
      statusMessage: 'No base URL',
      lastError: '',
      baseUrl: undefined,
      modelEndpoint: '—',
      tokenText: 'Missing',
      selectedModel: '',
      modelStatusText: 'Not configured',
      modelStatusKind: 'offline' as const,
      modelSourceText: 'No backend base URL',
      modelHintText: 'Configure backend first.',
      remedyKind: 'noBaseUrl' as const,
      modelCount: 0,
      lastChecked: '',
      baseUrlInput: '',
      tokenInput: '',
      persistEnabled: true,
      configMessage: '',
      isDark: false,
      t,
      ...overrides,
    },
    attachTo: document.body,
  });
}

describe('ConnectionDiagnostics', () => {
  it('offers a default base URL repair action when backend is not configured', async () => {
    const wrapper = mountDialog({ remedyKind: 'noBaseUrl' });

    (document.body.querySelector('.ai-diagnostics-remedy-primary') as HTMLButtonElement).click();
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('useDefaultBaseUrl')).toBeTruthy();
    wrapper.unmount();
  });

  it('focuses the token field for unauthorized model API errors', async () => {
    const wrapper = mountDialog({ remedyKind: 'unauthorized', baseUrl: '/ai-assistant' });

    (document.body.querySelector('.ai-diagnostics-remedy-primary') as HTMLButtonElement).click();
    await wrapper.vm.$nextTick();

    expect(document.activeElement).toBe(document.body.querySelector('.ai-token-input'));
    wrapper.unmount();
  });
});
