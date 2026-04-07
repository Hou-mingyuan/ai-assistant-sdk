import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSessionSearch } from './useSessionSearch'

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

describe('useSessionSearch', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns all messages when no search query', () => {
    const msgs = ref([
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi there' },
    ])
    const { displayedMessages, hiddenOlderCount } = useSessionSearch(msgs, ref(false), ref(true), 60)
    expect(displayedMessages.value).toHaveLength(2)
    expect(hiddenOlderCount.value).toBe(0)
  })

  it('limits rendered messages when renderAll is false', () => {
    const msgs = ref(
      Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, content: `msg ${i}` })),
    )
    const { displayedMessages, hiddenOlderCount } = useSessionSearch(msgs, ref(false), ref(false), 3)
    expect(displayedMessages.value).toHaveLength(3)
    expect(hiddenOlderCount.value).toBe(7)
  })

  it('returns empty when no messages', () => {
    const msgs = ref<{ role: 'user' | 'assistant'; content: string }[]>([])
    const { displayedMessages } = useSessionSearch(msgs, ref(false), ref(true), 60)
    expect(displayedMessages.value).toHaveLength(0)
  })
})
