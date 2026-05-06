/** 多会话标签页管理：创建/切换/删除/分叉会话，localStorage 持久化。 */
import { ref, onUnmounted, getCurrentInstance } from 'vue';
import {
  isAbortCancellationMessage,
  type PersistableChatMessage,
} from './useChatHistoryPersistence';

export interface SessionEntry {
  id: string;
  title: string;
  messages: SessionMessage[];
  createdAt: number;
}

type SessionMessage = PersistableChatMessage & {
  feedback?: 'up' | 'down';
};

const STORAGE_KEY = 'ai-assistant-sessions';
const MAX_SESSIONS = 20;

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function useMultiSession(storageKey = STORAGE_KEY) {
  const sessions = ref<SessionEntry[]>([]);
  const activeSessionId = ref('');

  function isValidSession(o: unknown): o is SessionEntry {
    return (
      typeof o === 'object' &&
      o !== null &&
      typeof (o as SessionEntry).id === 'string' &&
      Array.isArray((o as SessionEntry).messages)
    );
  }

  function isValidSessionMessage(o: unknown): o is SessionMessage {
    return (
      typeof o === 'object' &&
      o !== null &&
      ((o as SessionMessage).role === 'user' || (o as SessionMessage).role === 'assistant') &&
      typeof (o as SessionMessage).content === 'string'
    );
  }

  function cleanMessages(messages: unknown[]): SessionMessage[] {
    return messages
      .filter(isValidSessionMessage)
      .filter((msg) => !(msg.role === 'assistant' && isAbortCancellationMessage(msg.content)));
  }

  function cleanSessions(input: SessionEntry[]): SessionEntry[] {
    return input
      .map((session) => ({
        ...session,
        messages: cleanMessages(session.messages),
      }))
      .slice(0, MAX_SESSIONS);
  }

  function loadSessions() {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          sessions.value = cleanSessions(parsed.filter(isValidSession));
        }
      }
    } catch {
      /* ignore */
    }
    if (sessions.value.length === 0) {
      createSession();
    } else {
      activeSessionId.value = sessions.value[0].id;
    }
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  function saveSessions() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try {
        localStorage.setItem(storageKey, JSON.stringify(cleanSessions(sessions.value)));
      } catch {
        /* ignore */
      }
    }, 300);
  }
  function saveSessionsImmediate() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(cleanSessions(sessions.value)));
    } catch {
      /* ignore */
    }
  }

  function createSession(): SessionEntry {
    const entry: SessionEntry = {
      id: genId(),
      title: '',
      messages: [],
      createdAt: Date.now(),
    };
    sessions.value.unshift(entry);
    if (sessions.value.length > MAX_SESSIONS) {
      sessions.value = sessions.value.slice(0, MAX_SESSIONS);
    }
    activeSessionId.value = entry.id;
    saveSessionsImmediate();
    return entry;
  }

  function switchSession(id: string) {
    const found = sessions.value.find((s) => s.id === id);
    if (found) activeSessionId.value = id;
  }

  function deleteSession(id: string) {
    sessions.value = sessions.value.filter((s) => s.id !== id);
    if (sessions.value.length === 0) {
      createSession();
    } else if (activeSessionId.value === id) {
      activeSessionId.value = sessions.value[0].id;
    }
    saveSessionsImmediate();
  }

  function getActiveSession(): SessionEntry | undefined {
    return sessions.value.find((s) => s.id === activeSessionId.value);
  }

  function updateActiveMessages(msgs: SessionEntry['messages']) {
    const s = getActiveSession();
    if (s) {
      s.messages = cleanMessages(msgs);
      saveSessions();
    }
  }

  function updateActiveTitle(title: string) {
    const s = getActiveSession();
    if (s && !s.title) {
      s.title = title;
      saveSessions();
    }
  }

  function forkFromMessage(sessionId: string, messageIndex: number): SessionEntry | null {
    const src = sessions.value.find((s) => s.id === sessionId);
    if (!src || messageIndex < 0 || messageIndex >= src.messages.length) return null;
    const forked = createSession();
    forked.messages = cleanMessages(JSON.parse(JSON.stringify(src.messages.slice(0, messageIndex + 1))));
    forked.title = (src.title || 'Untitled') + ' (fork)';
    saveSessionsImmediate();
    return forked;
  }

  const cleanup = () => {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveSessionsImmediate();
  };
  if (getCurrentInstance()) {
    onUnmounted(cleanup);
  }

  loadSessions();

  return {
    sessions,
    activeSessionId,
    createSession,
    switchSession,
    deleteSession,
    getActiveSession,
    updateActiveMessages,
    updateActiveTitle,
    forkFromMessage,
    saveSessions,
    cleanup,
  };
}
