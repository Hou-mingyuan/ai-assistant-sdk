import { ref, type ComputedRef } from 'vue';

interface DiagnosticsClipboardLabels {
  diagnosticsCopied: string;
  diagnosticsCopyFailed: string;
}

export interface DiagnosticsSnapshot {
  baseUrl?: string;
  modelEndpoint: string;
  accessToken?: string;
  statusMessage: string;
  lastError: string;
  selectedModel: string;
  modelSourceText: string;
  modelStatusText: string;
  modelCount: number;
  lastChecked: string;
}

interface UseDiagnosticsClipboardOptions {
  t: ComputedRef<DiagnosticsClipboardLabels>;
  pendingTimers: number[];
  getSnapshot: () => DiagnosticsSnapshot;
  writeText?: (text: string) => Promise<void>;
}

export function buildDiagnosticsText(snapshot: DiagnosticsSnapshot) {
  return [
    'AI Assistant Diagnostics',
    `Base URL: ${snapshot.baseUrl || '(not configured)'}`,
    `Models endpoint: ${snapshot.modelEndpoint}`,
    `Access token: ${snapshot.accessToken?.trim() ? 'configured' : 'missing'}`,
    `Status: ${snapshot.statusMessage}`,
    `Last error: ${snapshot.lastError || '(none)'}`,
    `Selected model: ${snapshot.selectedModel || '(not selected)'}`,
    `Model source: ${snapshot.modelSourceText}`,
    `Model status: ${snapshot.modelStatusText}`,
    `Available models: ${snapshot.modelCount}`,
    `Last checked: ${snapshot.lastChecked || '(never)'}`,
  ].join('\n');
}

export function useDiagnosticsClipboard(opts: UseDiagnosticsClipboardOptions) {
  const diagnosticsCopied = ref(false);
  const diagnosticsCopyMessage = ref('');
  const writeText = opts.writeText ?? writeClipboardText;

  async function copyDiagnostics() {
    const text = buildDiagnosticsText(opts.getSnapshot());
    try {
      await writeText(text);
      diagnosticsCopied.value = true;
      diagnosticsCopyMessage.value = opts.t.value.diagnosticsCopied;
      opts.pendingTimers.push(
        window.setTimeout(() => {
          diagnosticsCopied.value = false;
          diagnosticsCopyMessage.value = '';
        }, 1500),
      );
    } catch {
      diagnosticsCopied.value = false;
      diagnosticsCopyMessage.value = opts.t.value.diagnosticsCopyFailed;
    }
  }

  return {
    diagnosticsCopied,
    diagnosticsCopyMessage,
    copyDiagnostics,
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
