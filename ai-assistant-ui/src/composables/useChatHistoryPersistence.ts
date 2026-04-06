import type { Ref } from 'vue'

const STORAGE_KEY = 'ai-assistant-history'
const MAX_PERSISTED_MESSAGES = 50

export interface PersistableChatMessage {
  role: 'user' | 'assistant'
  content: string
  contentArchive?: string
}

export function loadPersistedMessages(persist: boolean): PersistableChatMessage[] {
  if (!persist) return []
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

export function useChatHistoryPersistence(
  messages: Ref<PersistableChatMessage[]>,
  persistEnabled: () => boolean,
) {
  function saveHistory() {
    if (!persistEnabled()) return
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(messages.value.slice(-MAX_PERSISTED_MESSAGES)),
      )
    } catch {
      /* ignore quota / private mode */
    }
  }

  function clearStoredHistory() {
    if (!persistEnabled()) return
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
  }

  return { saveHistory, clearStoredHistory }
}
