/** 多会话标签页管理：创建/切换/删除/分叉会话，localStorage 持久化。 */
import { ref, onUnmounted } from 'vue'

export interface SessionEntry {
  id: string
  title: string
  messages: { role: 'user' | 'assistant'; content: string; contentArchive?: string; feedback?: 'up' | 'down' }[]
  createdAt: number
}

const STORAGE_KEY = 'ai-assistant-sessions'
const MAX_SESSIONS = 20

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}

export function useMultiSession(storageKey = STORAGE_KEY) {
  const sessions = ref<SessionEntry[]>([])
  const activeSessionId = ref('')

  function isValidSession(o: unknown): o is SessionEntry {
    return typeof o === 'object' && o !== null
      && typeof (o as SessionEntry).id === 'string'
      && Array.isArray((o as SessionEntry).messages)
  }

  function loadSessions() {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          sessions.value = parsed.filter(isValidSession).slice(0, MAX_SESSIONS)
        }
      }
    } catch { /* ignore */ }
    if (sessions.value.length === 0) {
      createSession()
    } else {
      activeSessionId.value = sessions.value[0].id
    }
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  function saveSessions() {
    if (saveTimer) return
    saveTimer = setTimeout(() => {
      saveTimer = null
      try {
        localStorage.setItem(storageKey, JSON.stringify(sessions.value))
      } catch { /* ignore */ }
    }, 300)
  }
  function saveSessionsImmediate() {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    try {
      localStorage.setItem(storageKey, JSON.stringify(sessions.value))
    } catch { /* ignore */ }
  }

  function createSession(): SessionEntry {
    const entry: SessionEntry = {
      id: genId(),
      title: '',
      messages: [],
      createdAt: Date.now(),
    }
    sessions.value.unshift(entry)
    if (sessions.value.length > MAX_SESSIONS) {
      sessions.value = sessions.value.slice(0, MAX_SESSIONS)
    }
    activeSessionId.value = entry.id
    saveSessionsImmediate()
    return entry
  }

  function switchSession(id: string) {
    const found = sessions.value.find(s => s.id === id)
    if (found) activeSessionId.value = id
  }

  function deleteSession(id: string) {
    sessions.value = sessions.value.filter(s => s.id !== id)
    if (sessions.value.length === 0) {
      createSession()
    } else if (activeSessionId.value === id) {
      activeSessionId.value = sessions.value[0].id
    }
    saveSessionsImmediate()
  }

  function getActiveSession(): SessionEntry | undefined {
    return sessions.value.find(s => s.id === activeSessionId.value)
  }

  function updateActiveMessages(msgs: SessionEntry['messages']) {
    const s = getActiveSession()
    if (s) {
      s.messages = msgs
      saveSessions()
    }
  }

  function updateActiveTitle(title: string) {
    const s = getActiveSession()
    if (s && !s.title) {
      s.title = title
      saveSessions()
    }
  }

  function forkFromMessage(sessionId: string, messageIndex: number): SessionEntry | null {
    const src = sessions.value.find(s => s.id === sessionId)
    if (!src || messageIndex < 0 || messageIndex >= src.messages.length) return null
    const forked = createSession()
    forked.messages = JSON.parse(JSON.stringify(src.messages.slice(0, messageIndex + 1)))
    forked.title = (src.title || 'Untitled') + ' (fork)'
    saveSessionsImmediate()
    return forked
  }

  onUnmounted(() => {
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
    saveSessionsImmediate()
  })

  loadSessions()

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
  }
}
