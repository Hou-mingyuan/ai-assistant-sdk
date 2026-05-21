import { describe, expect, it, vi } from 'vitest';
import { computed } from 'vue';

import {
  buildDiagnosticsText,
  useDiagnosticsClipboard,
  writeClipboardText,
} from './useDiagnosticsClipboard';

describe('useDiagnosticsClipboard', () => {
  it('builds diagnostics text from the current snapshot', () => {
    const text = buildDiagnosticsText({
      baseUrl: '/ai-assistant',
      modelEndpoint: '/ai-assistant/models',
      accessToken: 'token',
      statusMessage: 'Connected',
      lastError: '',
      selectedModel: 'deepseek-chat',
      modelSourceText: 'server',
      modelStatusText: 'ready',
      modelCount: 2,
      lastChecked: '2026-05-21 17:00',
    });

    expect(text).toContain('AI Assistant Diagnostics');
    expect(text).toContain('Base URL: /ai-assistant');
    expect(text).toContain('Access token: configured');
    expect(text).toContain('Available models: 2');
  });

  it('copies diagnostics text and clears the copied state after the timer', async () => {
    vi.useFakeTimers();
    const pendingTimers: number[] = [];
    const writeText = vi.fn<
      Parameters<typeof writeClipboardText>,
      ReturnType<typeof writeClipboardText>
    >(async () => undefined);
    const clipboard = useDiagnosticsClipboard({
      t: computed(() => ({
        diagnosticsCopied: 'copied',
        diagnosticsCopyFailed: 'failed',
      })),
      pendingTimers,
      writeText,
      getSnapshot: () => ({
        baseUrl: '/ai-assistant',
        modelEndpoint: '/ai-assistant/models',
        accessToken: '',
        statusMessage: 'Missing token',
        lastError: '401',
        selectedModel: '',
        modelSourceText: 'none',
        modelStatusText: 'error',
        modelCount: 0,
        lastChecked: '',
      }),
    });

    await clipboard.copyDiagnostics();

    expect(writeText).toHaveBeenCalledOnce();
    expect(clipboard.diagnosticsCopied.value).toBe(true);
    expect(clipboard.diagnosticsCopyMessage.value).toBe('copied');
    expect(pendingTimers).toHaveLength(1);

    vi.runOnlyPendingTimers();

    expect(clipboard.diagnosticsCopied.value).toBe(false);
    expect(clipboard.diagnosticsCopyMessage.value).toBe('');
    vi.useRealTimers();
  });

  it('shows a failure message when clipboard writing fails', async () => {
    const clipboard = useDiagnosticsClipboard({
      t: computed(() => ({
        diagnosticsCopied: 'copied',
        diagnosticsCopyFailed: 'failed',
      })),
      pendingTimers: [],
      writeText: async () => {
        throw new Error('denied');
      },
      getSnapshot: () => ({
        baseUrl: '',
        modelEndpoint: '',
        accessToken: '',
        statusMessage: '',
        lastError: '',
        selectedModel: '',
        modelSourceText: '',
        modelStatusText: '',
        modelCount: 0,
        lastChecked: '',
      }),
    });

    await clipboard.copyDiagnostics();

    expect(clipboard.diagnosticsCopied.value).toBe(false);
    expect(clipboard.diagnosticsCopyMessage.value).toBe('failed');
  });
});
