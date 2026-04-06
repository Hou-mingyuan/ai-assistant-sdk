import type { Ref } from 'vue'

export interface MessageMemoryCapOptions {
  maxMessagesInMemory?: number
  maxTotalCharsInMemory?: number
}

/** 与 AiAssistant Message 兼容的最小形状 */
export interface MemoryCapMessage {
  content?: string
  contentArchive?: string
}

/**
 * 限制内存中消息条数与总字符，避免长会话撑爆单页。
 */
export function useMessageMemoryCap(
  messages: Ref<MemoryCapMessage[]>,
  options: MessageMemoryCapOptions,
  clearRenderCache: () => void,
) {
  function messageCharFootprint(m: MemoryCapMessage): number {
    const c = m.content?.length ?? 0
    const a = m.contentArchive?.length ?? 0
    return Math.max(c, a)
  }

  function countMessagesChars(arr: MemoryCapMessage[]): number {
    let n = 0
    for (const m of arr) {
      n += messageCharFootprint(m)
    }
    return n
  }

  function trimMessagesForMemoryCap() {
    let changed = false
    const msgCap = options.maxMessagesInMemory
    if (msgCap !== undefined && msgCap > 0 && messages.value.length > msgCap) {
      messages.value = messages.value.slice(-msgCap)
      changed = true
    }
    const charCap = options.maxTotalCharsInMemory
    if (charCap !== undefined && charCap > 0 && messages.value.length > 0) {
      while (messages.value.length > 1 && countMessagesChars(messages.value) > charCap) {
        messages.value.shift()
        changed = true
      }
      if (messages.value.length === 1 && countMessagesChars(messages.value) > charCap) {
        const only = messages.value[0]!
        const full = (only.contentArchive ?? only.content) ?? ''
        if (full.length > charCap) {
          only.contentArchive = full
          only.content = full.slice(0, charCap) + '…'
          changed = true
        }
      }
    }
    if (changed) clearRenderCache()
  }

  return { trimMessagesForMemoryCap }
}
