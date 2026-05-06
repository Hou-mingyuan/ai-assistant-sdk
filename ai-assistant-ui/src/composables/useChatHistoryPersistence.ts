/** 对话历史 localStorage 持久化：消息变更时自动保存，支持清除。 */
import type { Ref } from 'vue';

const DEFAULT_STORAGE_KEY = 'ai-assistant-history';
const MAX_PERSISTED_MESSAGES = 50;

export interface PersistableChatMessage {
  role: 'user' | 'assistant';
  content: string;
  contentArchive?: string;
}

function isValidMsg(o: unknown): o is PersistableChatMessage {
  return (
    typeof o === 'object' &&
    o !== null &&
    typeof (o as PersistableChatMessage).role === 'string' &&
    typeof (o as PersistableChatMessage).content === 'string'
  );
}

export function isAbortCancellationMessage(message: string): boolean {
  const raw = message.trim();
  if (!raw) return false;
  const compact = raw.replace(/\s+/g, ' ').replace(/^[`>\\\s]+/, '');
  return /^(?:(?:error|错误|エラー|오류)\s*[:：]\s*)?(?:aborterror|signal is aborted|the operation was aborted|aborted without reason)\b/i.test(
    compact,
  );
}

export function pruneTransientAssistantMessages<T extends PersistableChatMessage>(messages: T[]): T[] {
  return messages.filter(
    (msg) => !(msg.role === 'assistant' && isAbortCancellationMessage(msg.content)),
  );
}

export function loadPersistedMessages(
  persist: boolean,
  storageKey = DEFAULT_STORAGE_KEY,
): PersistableChatMessage[] {
  if (!persist || typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(storageKey);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return pruneTransientAssistantMessages(parsed.filter(isValidMsg));
  } catch {
    return [];
  }
}

export function useChatHistoryPersistence(
  messages: Ref<PersistableChatMessage[]>,
  persistEnabled: () => boolean,
  storageKey = DEFAULT_STORAGE_KEY,
) {
  let histTimer: ReturnType<typeof setTimeout> | null = null;

  function saveHistory() {
    if (!persistEnabled()) return;
    if (histTimer) return;
    histTimer = setTimeout(() => {
      histTimer = null;
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify(pruneTransientAssistantMessages(messages.value).slice(-MAX_PERSISTED_MESSAGES)),
        );
      } catch {
        /* ignore quota / private mode */
      }
    }, 300);
  }

  function saveHistoryImmediate() {
    if (!persistEnabled()) return;
    if (histTimer) {
      clearTimeout(histTimer);
      histTimer = null;
    }
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(pruneTransientAssistantMessages(messages.value).slice(-MAX_PERSISTED_MESSAGES)),
      );
    } catch {
      /* ignore */
    }
  }

  function clearStoredHistory() {
    if (!persistEnabled()) return;
    if (histTimer) {
      clearTimeout(histTimer);
      histTimer = null;
    }
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
  }

  return { saveHistory, saveHistoryImmediate, clearStoredHistory };
}
