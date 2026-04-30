import { computed, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExportActions } from './useExportActions';
import { postServerExport } from '../utils/api';
import type { I18nMessages } from '../utils/i18n';

vi.mock('../utils/api', () => ({
  postServerExport: vi.fn(),
}));

const postServerExportMock = vi.mocked(postServerExport);

function makeMessages(): I18nMessages {
  return {
    title: 'AI Assistant',
    dragHint: 'Drag',
    translate: 'Translate',
    summarize: 'Summarize',
    chat: 'Chat',
    copy: 'Copy',
    copied: 'Copied',
    copyCode: 'Copy code',
    close: 'Close',
    send: 'Send',
    stop: 'Stop',
    clear: 'Clear',
    clearAll: 'Clear all',
    uploadFile: 'Upload file',
    targetLang: 'Target language',
    openInIde: 'IDE',
    exportServerXlsx: 'Server: Excel (.xlsx)',
    exportServerDocx: 'Server: Word (.docx)',
    exportServerPdf: 'Server: PDF (.pdf)',
    exportBatch: 'Export',
    exportAllJson: 'All sessions: JSON',
    exportAllMarkdown: 'All sessions: Markdown',
    exportPreparing: 'Preparing export…',
    exportReceiving: 'Receiving file…',
    exportStartingDownload: 'Starting download…',
    exportDownloadStarted: 'Download started',
    exportUnavailable: 'Server export requires baseUrl',
    mode: 'Mode',
    placeholder: {
      translate: 'Translate text…',
      summarize: 'Summarize text…',
      chat: 'Ask anything…',
    },
    empty: 'Start a conversation',
    errorPrefix: 'Error',
    thinking: 'Thinking…',
    replying: 'Replying…',
    newline: 'Shift+Enter for newline',
    imageAttached: 'Image attached',
    clearImage: 'Clear image',
    pasteImageTooLarge: 'Image exceeds 5MB limit',
    selectTextHint: 'Select text',
    askSelection: 'Ask',
    translateSelection: 'Translate',
    summarizeSelection: 'Summarize',
    hideFab: 'Hide until reload',
    dockLeft: 'Dock left',
    dockRight: 'Dock right',
    undock: 'Undock',
    fabMenuTitle: 'Assistant options',
    newSession: 'New session',
    session: 'Session',
    search: 'Search',
    searchPrev: 'Previous',
    searchNext: 'Next',
    searchClose: 'Close search',
    showEarlierTemplate: 'Show {n} earlier messages',
    forkFromHere: 'Fork from here',
    expandPanel: 'Expand',
    shrinkPanel: 'Shrink',
    resizePanel: 'Resize panel',
    systemPromptTitle: 'Personalize',
    systemPromptLabel: 'System prompt',
    systemPromptEdit: 'Edit',
    systemPromptSave: 'Save',
    systemPromptCancel: 'Cancel',
    systemPromptReset: 'Reset',
    systemPromptTooLong: 'System prompt is too long',
    systemPromptPlaceholder: 'Optional system prompt',
    personalizeTitle: 'Personalize',
    personalizeSubtitle: 'Tune replies',
    personalizeDone: 'Done',
    modelLabel: 'Model',
    modelsListEmpty: 'No models',
    modelsLoadFailed: 'Unable to load models',
    modelsNetworkError: 'Unable to reach model API',
    modelsUnauthorized: 'Model API needs a valid access token',
    modelsRateLimited: 'Model API is rate limited',
    modelsServerError: 'Model API returned a server error',
    diagnosticsTitle: 'Diagnostics',
    diagnosticsRefresh: 'Refresh',
    diagnosticsCopy: 'Copy',
    diagnosticsCopied: 'Copied',
    diagnosticsClose: 'Close diagnostics',
    diagnosticsBaseUrl: 'Base URL',
    diagnosticsModelEndpoint: 'Models endpoint',
    diagnosticsToken: 'Access token',
    diagnosticsTokenConfigured: 'Configured',
    diagnosticsTokenMissing: 'Missing',
    diagnosticsSelectedModel: 'Selected model',
    diagnosticsNoSelectedModel: 'Not selected',
    diagnosticsAvailableModels: 'Available models',
    diagnosticsLastChecked: 'Last checked',
    diagnosticsNeverChecked: 'Never',
    diagnosticsStatus: 'Status',
    diagnosticsStatusReady: 'Model API is ready',
    diagnosticsStatusChecking: 'Checking model API…',
    diagnosticsStatusNoBaseUrl: 'No base URL configured',
    connectionConfigTitle: 'Connection settings',
    connectionConfigBaseUrlPlaceholder: 'API base URL',
    connectionConfigTokenPlaceholder: 'Access token',
    connectionConfigPersist: 'Save in this browser',
    connectionConfigTest: 'Test connection',
    connectionConfigSave: 'Save',
    connectionConfigSaved: 'Connection settings saved',
    connectionConfigTested: 'Connection test finished',
    connectionConfigFailed: 'Connection test failed',
  };
}

describe('useExportActions', () => {
  beforeEach(() => {
    postServerExportMock.mockReset();
  });

  it('uses the latest connection settings when exporting through the server', async () => {
    postServerExportMock.mockResolvedValueOnce({ ok: true });
    let baseUrl = '/old-ai';
    let accessToken = 'old-token';
    const setExportToast = vi.fn();
    const reportError = vi.fn();
    const actions = useExportActions({
      sessions: ref([]),
      messages: ref([{ role: 'assistant', content: 'hello' }]),
      wrapperRef: ref(undefined),
      getBaseUrl: () => baseUrl,
      getAccessToken: () => accessToken,
      t: computed(() => makeMessages()),
      exportServerBusy: ref(false),
      setExportToast,
      reportError,
    });

    baseUrl = '/new-ai';
    accessToken = 'new-token';
    await actions.exportAssistantMessageServer(0, 'docx');

    expect(postServerExportMock).toHaveBeenCalledWith(
      '/new-ai',
      'docx',
      'AI Assistant-1',
      [{ role: 'assistant', content: 'hello' }],
      'new-token',
      expect.any(Function),
      'light',
    );
    expect(reportError).not.toHaveBeenCalled();
  });
});
