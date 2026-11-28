import { ref } from 'vue';

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

interface UseMessageCopyDeps {
  writeText?: (text: string) => Promise<void>;
  reportError: (source: string, message: string) => void;
  pendingTimers?: number[];
  setTimeoutFn?: (cb: () => void, ms: number) => number;
  feedbackDelayMs?: number;
}

function defaultSetTimeout(cb: () => void, ms: number) {
  return window.setTimeout(cb, ms);
}

export function useMessageCopy(deps: UseMessageCopyDeps) {
  const copiedIndex = ref(-1);
  const setTimeoutFn = deps.setTimeoutFn ?? defaultSetTimeout;
  const feedbackDelayMs = deps.feedbackDelayMs ?? 1500;
  const writeText = deps.writeText ?? writeClipboardText;

  async function copyMessage(text: string, globalIdx: number) {
    try {
      await writeText(text);
      copiedIndex.value = globalIdx;
      const timerId = setTimeoutFn(() => {
        copiedIndex.value = -1;
      }, feedbackDelayMs);
      deps.pendingTimers?.push(timerId);
    } catch {
      deps.reportError('clipboard', 'Copy failed');
    }
  }

  return {
    copiedIndex,
    copyMessage,
  };
}
