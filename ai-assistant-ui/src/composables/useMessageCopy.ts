import { ref } from 'vue';

interface UseMessageCopyDeps {
  writeText: (text: string) => Promise<void>;
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

  async function copyMessage(text: string, globalIdx: number) {
    try {
      await deps.writeText(text);
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
