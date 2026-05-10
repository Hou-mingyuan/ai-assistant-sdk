import { nextTick, type Ref } from 'vue';
import type { Message } from '../types/message';

/**
 * Per-message chat orchestration extracted from the main AiAssistant SFC.
 *
 * The hook owns the small "what happens when the user clicks a per-message
 * button" surface: stop the in-flight stream, retry / regenerate, edit-and-
 * resend, feedback. The hot path of building the request body and consuming
 * the streamed response is intentionally NOT inside the hook — that lives in
 * the parent component's {@link UseChatOrchestratorDeps.send} callback so the
 * hook stays mockable in tests and free of heavy dependencies.
 *
 * The {@code streamAbortController} is exposed via getter / setter so the
 * parent can keep it as a plain {@code let} variable (it gets reassigned on
 * every send) without forcing a full ref refactor.
 */
export interface UseChatOrchestratorDeps {
  messages: Ref<Message[]>;
  loading: Ref<boolean>;
  input: Ref<string>;
  editingMsgIdx: Ref<number | null>;
  editingText: Ref<string>;
  clearRenderCache: () => void;
  send: () => Promise<void> | void;
  getStreamAbortController: () => AbortController | null;
  setStreamAbortController: (controller: AbortController | null) => void;
  setStreamStoppedByUser: (stopped: boolean) => void;
  emitFeedback: (payload: { index: number; value: 'up' | 'down' | null }) => void;
  /** Optional override for assistant error-message prefixes; defaults cover en/zh/ja/ko. */
  errorPrefixes?: readonly string[];
}

const DEFAULT_ERROR_PREFIXES: readonly string[] = ['Error:', '错误:', 'エラー:', '오류:'];

export function useChatOrchestrator(deps: UseChatOrchestratorDeps) {
  function stopGenerate() {
    const controller = deps.getStreamAbortController();
    if (!controller) return;
    deps.setStreamStoppedByUser(true);
    controller.abort('user-stop');
    deps.setStreamAbortController(null);
  }

  function isErrorMessage(msg: Message): boolean {
    if (msg.role !== 'assistant') return false;
    const prefixes = deps.errorPrefixes ?? DEFAULT_ERROR_PREFIXES;
    return prefixes.some((p) => msg.content.startsWith(p));
  }

  function regenerateAt(globalIdx: number) {
    if (deps.loading.value) return;
    const assistantMsg = deps.messages.value[globalIdx];
    if (!assistantMsg || assistantMsg.role !== 'assistant') return;

    let userIdx = globalIdx - 1;
    while (userIdx >= 0 && deps.messages.value[userIdx].role !== 'user') {
      userIdx--;
    }
    if (userIdx < 0) return;

    const userMsg = deps.messages.value[userIdx];
    const userText = userMsg.contentArchive ?? userMsg.content;
    const cleanText = userText.replace(/^🖼️\s*/, '');

    deps.messages.value.splice(globalIdx, 1);
    deps.clearRenderCache();
    deps.input.value = cleanText;
    nextTick(() => {
      void deps.send();
    });
  }

  function retryLastError(globalIdx: number) {
    if (deps.loading.value) return;
    const msg = deps.messages.value[globalIdx];
    if (!msg || !isErrorMessage(msg)) return;
    regenerateAt(globalIdx);
  }

  function startEdit(globalIdx: number) {
    if (deps.loading.value) return;
    const msg = deps.messages.value[globalIdx];
    if (!msg || msg.role !== 'user') return;
    const raw = (msg.contentArchive ?? msg.content).replace(/^🖼️\s*/, '');
    deps.editingMsgIdx.value = globalIdx;
    deps.editingText.value = raw;
  }

  function cancelEdit() {
    deps.editingMsgIdx.value = null;
    deps.editingText.value = '';
  }

  function confirmEditAndResend(globalIdx: number) {
    const newText = deps.editingText.value.trim();
    if (!newText || deps.loading.value) return;
    deps.messages.value.splice(globalIdx);
    deps.clearRenderCache();
    deps.editingMsgIdx.value = null;
    deps.editingText.value = '';
    deps.input.value = newText;
    nextTick(() => {
      void deps.send();
    });
  }

  function setFeedback(globalIdx: number, value: 'up' | 'down') {
    const msg = deps.messages.value[globalIdx];
    if (!msg || msg.role !== 'assistant') return;
    msg.feedback = msg.feedback === value ? undefined : value;
    deps.emitFeedback({ index: globalIdx, value: msg.feedback ?? null });
  }

  return {
    stopGenerate,
    isErrorMessage,
    regenerateAt,
    retryLastError,
    startEdit,
    cancelEdit,
    confirmEditAndResend,
    setFeedback,
  };
}
