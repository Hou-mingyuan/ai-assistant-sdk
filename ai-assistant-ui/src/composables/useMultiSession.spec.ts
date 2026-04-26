import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useMultiSession } from './useMultiSession'

const STORAGE_KEY = 'ai-test-sessions'

describe('useMultiSession', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.removeItem(STORAGE_KEY)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates initial session on first load', () => {
    const ms = useMultiSession(STORAGE_KEY)
    expect(ms.sessions.value).toHaveLength(1)
    expect(ms.activeSessionId.value).toBe(ms.sessions.value[0].id)
  })

  it('creates new session', () => {
    const ms = useMultiSession(STORAGE_KEY)
    const s = ms.createSession()
    expect(ms.sessions.value).toHaveLength(2)
    expect(ms.activeSessionId.value).toBe(s.id)
  })

  it('switches session', () => {
    const ms = useMultiSession(STORAGE_KEY)
    const s1 = ms.sessions.value[0]
    const s2 = ms.createSession()
    ms.switchSession(s1.id)
    expect(ms.activeSessionId.value).toBe(s1.id)
  })

  it('deletes session and switches to first', () => {
    const ms = useMultiSession(STORAGE_KEY)
    const s1 = ms.sessions.value[0]
    const s2 = ms.createSession()
    ms.deleteSession(s2.id)
    expect(ms.sessions.value).toHaveLength(1)
    expect(ms.activeSessionId.value).toBe(s1.id)
  })

  it('creates new session if last deleted', () => {
    const ms = useMultiSession(STORAGE_KEY)
    const id = ms.sessions.value[0].id
    ms.deleteSession(id)
    expect(ms.sessions.value).toHaveLength(1)
    expect(ms.activeSessionId.value).not.toBe(id)
  })

  it('forkFromMessage creates a copy', () => {
    const ms = useMultiSession(STORAGE_KEY)
    const s = ms.getActiveSession()!
    s.messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'bye' },
    ]
    const forked = ms.forkFromMessage(s.id, 1)
    expect(forked).not.toBeNull()
    expect(forked!.messages).toHaveLength(2)
    expect(forked!.title).toContain('fork')
  })

  it('updateActiveTitle sets title only once', () => {
    const ms = useMultiSession(STORAGE_KEY)
    ms.updateActiveTitle('First')
    expect(ms.getActiveSession()!.title).toBe('First')
    ms.updateActiveTitle('Second')
    expect(ms.getActiveSession()!.title).toBe('First')
  })

  it('persists sessions to localStorage', () => {
    const ms = useMultiSession(STORAGE_KEY)
    ms.updateActiveTitle('Persisted')
    ms.saveSessions()
    vi.advanceTimersByTime(500)
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).toContain('Persisted')
  })
})
