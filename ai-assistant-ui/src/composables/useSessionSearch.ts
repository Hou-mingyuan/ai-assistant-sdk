import { computed, onUnmounted, ref, watch, type Ref } from 'vue'

interface Message {
  role: 'user' | 'assistant'
  content: string
  contentArchive?: string
}

const SEARCH_DEBOUNCE_MS = 200

/**
 * 会话内搜索 + 长会话仅挂载最近 N 条（与「显示更早消息」配合）。
 */
export function useSessionSearch(
  messages: Ref<Message[]>,
  _loading: Ref<boolean>,
  renderAllMessages: Ref<boolean>,
  maxRendered: number,
) {
  const chatSearchInput = ref('')
  const debouncedSearchQuery = ref('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(
    chatSearchInput,
    (v) => {
      if (debounceTimer !== null) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debouncedSearchQuery.value = v
        debounceTimer = null
      }, SEARCH_DEBOUNCE_MS)
    },
    { immediate: true },
  )

  onUnmounted(() => {
    if (debounceTimer !== null) clearTimeout(debounceTimer)
  })

  const plan = computed(() => {
    const all = messages.value
    const q = debouncedSearchQuery.value.trim().toLowerCase()

    if (all.length === 0) {
      return { offset: 0, list: [] as Message[], hiddenBefore: 0 }
    }

    if (q) {
      const matchIdx: number[] = []
      for (let i = 0; i < all.length; i++) {
        const c = all[i]?.content ?? ''
        if (c.toLowerCase().includes(q)) {
          matchIdx.push(i)
        }
      }
      if (matchIdx.length === 0) {
        return { offset: 0, list: [] as Message[], hiddenBefore: 0 }
      }
      const from = Math.min(...matchIdx)
      const to = Math.max(...matchIdx) + 1
      return {
        offset: from,
        list: all.slice(from, to),
        hiddenBefore: from,
      }
    }

    const cap = Math.max(1, maxRendered)
    const showAll = renderAllMessages.value || all.length <= cap
    if (showAll) {
      return { offset: 0, list: all.slice(), hiddenBefore: 0 }
    }
    const from = all.length - cap
    return {
      offset: from,
      list: all.slice(from),
      hiddenBefore: from,
    }
  })

  const displayOffset = computed(() => plan.value.offset)
  const displayedMessages = computed(() => plan.value.list)
  const hiddenOlderCount = computed(() => {
    if (debouncedSearchQuery.value.trim()) {
      return plan.value.hiddenBefore
    }
    if (renderAllMessages.value) {
      return 0
    }
    const cap = Math.max(1, maxRendered)
    return Math.max(0, messages.value.length - cap)
  })

  function resetSearch() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    chatSearchInput.value = ''
    debouncedSearchQuery.value = ''
  }

  function disposeSearch() {
    resetSearch()
  }

  return {
    chatSearchInput,
    displayOffset,
    displayedMessages,
    hiddenOlderCount,
    resetSearch,
    disposeSearch,
  }
}
