import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useMultiSession } from './useMultiSession';

const STORAGE_KEY = 'ai-test-sessions';

describe('useMultiSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.removeItem(STORAGE_KEY);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('creates initial session on first load', () => {
    const ms = useMultiSession(STORAGE_KEY);
    expect(ms.sessions.value).toHaveLength(1);
    expect(ms.activeSessionId.value).toBe(ms.sessions.value[0].id);
  });

  it('creates new session', () => {
    const ms = useMultiSession(STORAGE_KEY);
    const s = ms.createSession();
    expect(ms.sessions.value).toHaveLength(2);
    expect(ms.activeSessionId.value).toBe(s.id);
  });

  it('switches session', () => {
    const ms = useMultiSession(STORAGE_KEY);
    const s1 = ms.sessions.value[0];
    ms.createSession();
    ms.switchSession(s1.id);
    expect(ms.activeSessionId.value).toBe(s1.id);
  });

  it('deletes session and switches to first', () => {
    const ms = useMultiSession(STORAGE_KEY);
    const s1 = ms.sessions.value[0];
    const s2 = ms.createSession();
    ms.deleteSession(s2.id);
    expect(ms.sessions.value).toHaveLength(1);
    expect(ms.activeSessionId.value).toBe(s1.id);
  });

  it('creates new session if last deleted', () => {
    const ms = useMultiSession(STORAGE_KEY);
    const id = ms.sessions.value[0].id;
    ms.deleteSession(id);
    expect(ms.sessions.value).toHaveLength(1);
    expect(ms.activeSessionId.value).not.toBe(id);
  });

  it('forkFromMessage creates a copy', () => {
    const ms = useMultiSession(STORAGE_KEY);
    const s = ms.getActiveSession()!;
    s.messages = [
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi' },
      { role: 'user', content: 'bye' },
    ];
    const forked = ms.forkFromMessage(s.id, 1);
    expect(forked).not.toBeNull();
    expect(forked!.messages).toHaveLength(2);
    expect(forked!.title).toContain('fork');
  });

  it('updateActiveTitle sets title only once', () => {
    const ms = useMultiSession(STORAGE_KEY);
    ms.updateActiveTitle('First');
    expect(ms.getActiveSession()!.title).toBe('First');
    ms.updateActiveTitle('Second');
    expect(ms.getActiveSession()!.title).toBe('First');
  });

  it('persists sessions to localStorage', () => {
    const ms = useMultiSession(STORAGE_KEY);
    ms.updateActiveTitle('Persisted');
    ms.saveSessions();
    vi.advanceTimersByTime(500);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).toContain('Persisted');
  });

  it('loads valid persisted sessions and ignores invalid entries', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { id: 'persisted-1', title: 'One', messages: [], createdAt: 1 },
        { id: 123, title: 'Broken', messages: [], createdAt: 2 },
        {
          id: 'persisted-2',
          title: 'Two',
          messages: [{ role: 'user', content: 'hi' }],
          createdAt: 3,
        },
      ]),
    );

    const ms = useMultiSession(STORAGE_KEY);

    expect(ms.sessions.value.map((session) => session.id)).toEqual(['persisted-1', 'persisted-2']);
    expect(ms.activeSessionId.value).toBe('persisted-1');
  });

  it('creates a fresh session when persisted JSON is malformed', () => {
    localStorage.setItem(STORAGE_KEY, '{not valid json');

    const ms = useMultiSession(STORAGE_KEY);

    expect(ms.sessions.value).toHaveLength(1);
    expect(ms.activeSessionId.value).toBe(ms.sessions.value[0].id);
  });

  it('caps sessions at the maximum allowed count', () => {
    const ms = useMultiSession(STORAGE_KEY);

    for (let i = 0; i < 25; i += 1) {
      ms.createSession();
    }

    expect(ms.sessions.value).toHaveLength(20);
  });

  it('ignores switch requests for unknown sessions', () => {
    const ms = useMultiSession(STORAGE_KEY);
    const activeId = ms.activeSessionId.value;

    ms.switchSession('missing-session');

    expect(ms.activeSessionId.value).toBe(activeId);
  });

  it('updates active messages and flushes them during cleanup', () => {
    const ms = useMultiSession(STORAGE_KEY);

    ms.updateActiveMessages([{ role: 'assistant', content: 'saved by cleanup' }]);
    ms.cleanup();

    expect(localStorage.getItem(STORAGE_KEY)).toContain('saved by cleanup');
  });

  it('does nothing when updating without an active session', () => {
    const ms = useMultiSession(STORAGE_KEY);
    ms.activeSessionId.value = 'missing-session';

    expect(() => ms.updateActiveMessages([{ role: 'user', content: 'ignored' }])).not.toThrow();
    expect(() => ms.updateActiveTitle('ignored')).not.toThrow();
  });

  it('returns null when forking from an invalid message reference', () => {
    const ms = useMultiSession(STORAGE_KEY);
    const active = ms.getActiveSession()!;
    active.messages = [{ role: 'user', content: 'hello' }];

    expect(ms.forkFromMessage('missing-session', 0)).toBeNull();
    expect(ms.forkFromMessage(active.id, -1)).toBeNull();
    expect(ms.forkFromMessage(active.id, 1)).toBeNull();
  });

  it('ignores localStorage write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => useMultiSession(STORAGE_KEY)).not.toThrow();
  });
});
