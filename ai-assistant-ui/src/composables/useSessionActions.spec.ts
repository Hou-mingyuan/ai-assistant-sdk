import { nextTick, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { Message } from '../types/message';
import { useSessionActions } from './useSessionActions';
import type { useMultiSession } from './useMultiSession';

function makeStore(over: Record<string, unknown> = {}) {
  return {
    activeSessionId: ref('s1'),
    createSession: vi.fn(),
    switchSession: vi.fn(),
    getActiveSession: vi.fn(() => ({ messages: [] as Message[], title: '' })),
    deleteSession: vi.fn(),
    forkFromMessage: vi.fn(() => ({
      messages: [{ role: 'user', content: 'f' }] as Message[],
      title: 'forked',
    })),
    updateActiveMessages: vi.fn(),
    updateActiveTitle: vi.fn(),
    ...over,
  } as unknown as ReturnType<typeof useMultiSession>;
}

function setup(store = makeStore()) {
  const messages = ref<Message[]>([{ role: 'user', content: 'a' }]);
  const renderAllMessages = ref(true);
  const sessionTitle = ref('title');
  const isOpen = ref(false);
  const panelRef = ref<HTMLElement | undefined>(undefined);
  const resetSearch = vi.fn();
  const clearRenderCache = vi.fn();
  const clearStoredHistory = vi.fn();
  const scrollToBottom = vi.fn();
  const actions = useSessionActions({
    multiSessions: store,
    messages,
    renderAllMessages,
    sessionTitle,
    isOpen,
    panelRef,
    maxRenderedMessages: 60,
    resetSearch,
    clearRenderCache,
    clearStoredHistory,
    scrollToBottom,
  });
  return {
    store,
    messages,
    renderAllMessages,
    sessionTitle,
    isOpen,
    resetSearch,
    clearRenderCache,
    clearStoredHistory,
    scrollToBottom,
    actions,
  };
}

describe('useSessionActions', () => {
  it('saveCurrentSessionToMulti persists a deep clone and the title', () => {
    const { actions, store } = setup();
    actions.saveCurrentSessionToMulti();
    expect(store.updateActiveMessages).toHaveBeenCalledWith([{ role: 'user', content: 'a' }]);
    expect(store.updateActiveTitle).toHaveBeenCalledWith('title');
  });

  it('startNewSession saves, creates and resets to an empty session', () => {
    const { actions, store, messages, sessionTitle, renderAllMessages, resetSearch } = setup();
    actions.startNewSession();
    expect(store.updateActiveMessages).toHaveBeenCalled();
    expect(store.createSession).toHaveBeenCalled();
    expect(messages.value).toEqual([]);
    expect(sessionTitle.value).toBe('');
    expect(renderAllMessages.value).toBe(false);
    expect(resetSearch).toHaveBeenCalled();
  });

  it('switchToSession is a no-op for the active id', () => {
    const { actions, store } = setup();
    actions.switchToSession('s1');
    expect(store.switchSession).not.toHaveBeenCalled();
  });

  it('switchToSession saves the current and loads the target', () => {
    const store = makeStore({
      getActiveSession: vi.fn(() => ({
        messages: [{ role: 'assistant', content: 'b' }],
        title: 'T2',
      })),
    });
    const { actions, messages, sessionTitle } = setup(store);
    actions.switchToSession('s2');
    expect(store.updateActiveMessages).toHaveBeenCalled();
    expect(store.switchSession).toHaveBeenCalledWith('s2');
    expect(messages.value).toEqual([{ role: 'assistant', content: 'b' }]);
    expect(sessionTitle.value).toBe('T2');
  });

  it('deleteSessionTab deletes and reloads the active session', () => {
    const { actions, store, messages } = setup();
    actions.deleteSessionTab('sX');
    expect(store.deleteSession).toHaveBeenCalledWith('sX');
    expect(messages.value).toEqual([]);
  });

  it('forkFromHere loads the forked session messages and title', () => {
    const { actions, store, messages, sessionTitle } = setup();
    actions.forkFromHere(2);
    expect(store.forkFromMessage).toHaveBeenCalledWith('s1', 2);
    expect(messages.value).toEqual([{ role: 'user', content: 'f' }]);
    expect(sessionTitle.value).toBe('forked');
  });

  it('clearMessages empties the log, clears stored history and active messages', () => {
    const { actions, store, messages, clearStoredHistory } = setup();
    actions.clearMessages();
    expect(messages.value).toEqual([]);
    expect(clearStoredHistory).toHaveBeenCalled();
    expect(store.updateActiveMessages).toHaveBeenCalledWith([]);
  });

  it('showAllOlderMessages forces full render and scrolls to bottom on next tick', async () => {
    const { actions, renderAllMessages, scrollToBottom } = setup();
    actions.showAllOlderMessages();
    expect(renderAllMessages.value).toBe(true);
    await nextTick();
    expect(scrollToBottom).toHaveBeenCalledWith(true);
  });

  it('onPickCrossSessionMessage switches session and opens the panel', async () => {
    const { actions, store, isOpen } = setup();
    actions.onPickCrossSessionMessage('s2', 0);
    expect(store.switchSession).toHaveBeenCalledWith('s2');
    await nextTick();
    expect(isOpen.value).toBe(true);
  });
});
