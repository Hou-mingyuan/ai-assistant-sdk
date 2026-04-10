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
    return c + a
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
      let acc = countMessagesChars(messages.value)
      if (acc > charCap) {
        let drop = 0
        while (drop < messages.value.length - 1 && acc > charCap) {
          acc -= messageCharFootprint(messages.value[drop])
          drop++
        }
        if (drop > 0) {
          messages.value = messages.value.slice(drop)
          changed = true
        }
      }
      if (messages.value.length === 1 && countMessagesChars(messages.value) > charCap) {
        const only = messages.value[0]!
        const full = (only.contentArchive ?? only.content) ?? ''
        if (full.length > charCap) {
          only.contentArchive = undefined
          only.content = full.slice(0, charCap) + '…'
          changed = true
        }
      }
    }
    if (changed) clearRenderCache()
  }

  return { trimMessagesForMemoryCap }
}
