import { nextTick, type Ref } from 'vue';
import type { Message } from '../types/message';
import type { useMultiSession } from './useMultiSession';

/**
 * Multi-session lifecycle actions extracted from AiAssistant.vue (refactor batch 5).
 *
 * New / switch / delete / fork / clear session plus the cross-session "jump to
 * message" entry. All shared state (message log, title, render window, search,
 * render cache) is injected so the orchestration stays identical to the previous
 * inline implementation while moving out of the host component.
 */
type MultiSession = ReturnType<typeof useMultiSession>;

export interface UseSessionActionsOptions {
  multiSessions: MultiSession;
  messages: Ref<Message[]>;
  renderAllMessages: Ref<boolean>;
  sessionTitle: Ref<string>;
  isOpen: Ref<boolean>;
  panelRef: Ref<HTMLElement | undefined>;
  maxRenderedMessages: number;
  resetSearch: () => void;
  clearRenderCache: () => void;
  clearStoredHistory: () => void;
  scrollToBottom: (force: boolean) => void;
}

export function useSessionActions(deps: UseSessionActionsOptions) {
  const {
    multiSessions,
    messages,
    renderAllMessages,
    sessionTitle,
    isOpen,
    panelRef,
    maxRenderedMessages,
    resetSearch,
    clearRenderCache,
    clearStoredHistory,
    scrollToBottom,
  } = deps;

  function saveCurrentSessionToMulti() {
    multiSessions.updateActiveMessages(JSON.parse(JSON.stringify(messages.value)));
    if (sessionTitle.value) multiSessions.updateActiveTitle(sessionTitle.value);
  }

  function startNewSession() {
    saveCurrentSessionToMulti();
    multiSessions.createSession();
    messages.value = [];
    renderAllMessages.value = false;
    resetSearch();
    clearRenderCache();
    sessionTitle.value = '';
  }

  function switchToSession(id: string) {
    if (id === multiSessions.activeSessionId.value) return;
    saveCurrentSessionToMulti();
    multiSessions.switchSession(id);
    const s = multiSessions.getActiveSession();
    messages.value = s?.messages ?? [];
    sessionTitle.value = s?.title ?? '';
    renderAllMessages.value = false;
    resetSearch();
    clearRenderCache();
  }

  /**
   * K39: cross-session "jump to message" entry. Switches session, forces full
   * render when the target sits outside the recent window, then scrolls the
   * element into view with a brief flash highlight.
   */
  function onPickCrossSessionMessage(sessionId: string, msgIndex: number) {
    switchToSession(sessionId);
    if (msgIndex < messages.value.length - maxRenderedMessages) {
      renderAllMessages.value = true;
    }
    void nextTick(() => {
      const root = panelRef.value ?? document;
      const el = root.querySelector(`[data-ai-msg-global-idx="${msgIndex}"]`);
      if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
        (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
        (el as HTMLElement).classList.add('ai-cross-search-flash');
        setTimeout(() => (el as HTMLElement).classList.remove('ai-cross-search-flash'), 1600);
      }
      if (!isOpen.value) {
        isOpen.value = true;
      }
    });
  }

  function deleteSessionTab(id: string) {
    multiSessions.deleteSession(id);
    const s = multiSessions.getActiveSession();
    messages.value = s?.messages ?? [];
    sessionTitle.value = s?.title ?? '';
    clearRenderCache();
  }

  function forkFromHere(index: number) {
    saveCurrentSessionToMulti();
    const forked = multiSessions.forkFromMessage(multiSessions.activeSessionId.value, index);
    if (forked) {
      messages.value = forked.messages as Message[];
      sessionTitle.value = forked.title;
      clearRenderCache();
    }
  }

  function clearMessages() {
    messages.value = [];
    renderAllMessages.value = false;
    resetSearch();
    clearRenderCache();
    clearStoredHistory();
    sessionTitle.value = '';
    multiSessions.updateActiveMessages([]);
  }

  function showAllOlderMessages() {
    renderAllMessages.value = true;
    nextTick(() => scrollToBottom(true));
  }

  return {
    startNewSession,
    switchToSession,
    onPickCrossSessionMessage,
    deleteSessionTab,
    forkFromHere,
    saveCurrentSessionToMulti,
    clearMessages,
    showAllOlderMessages,
  };
}
