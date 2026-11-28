import { type ComputedRef, type Ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import type { Message } from '../types/message';
import { highlightSearchInHtml } from './useSessionSearch';
import { isAbortCancellationMessage } from './useChatHistoryPersistence';

/** Minimal HTML escaping (ampersand + angle brackets) for the streaming-plain fast path. */
export function escapeHtmlLite(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface UseBubbleRendererOptions {
  t: ComputedRef<I18nMessages>;
  sanitizeAssistantContent: (content: string) => string;
  renderContent: (content: string, copyLabel: string, isStreamingLast: boolean) => string;
  debouncedSearchQuery?: Ref<string>;
  activeMatchGlobalIdx?: Ref<number>;
  searchCaseSensitive?: Ref<boolean>;
  searchWholeWord?: Ref<boolean>;
  searchRegex?: Ref<boolean>;
}

export function useBubbleRenderer(deps: UseBubbleRendererOptions) {
  const {
    t,
    sanitizeAssistantContent,
    renderContent,
    debouncedSearchQuery,
    activeMatchGlobalIdx,
    searchCaseSensitive,
    searchWholeWord,
    searchRegex,
  } = deps;

  function renderBubble(content: string, globalIdx: number, isStreamingLast: boolean): string {
    const sanitized = sanitizeAssistantContent(content);
    let html: string;
    if (isStreamingLast && sanitized.length > 200) {
      html =
        '<pre class="ai-stream-plain" style="white-space:pre-wrap;font-family:inherit;margin:0">' +
        escapeHtmlLite(sanitized) +
        '</pre>';
    } else {
      html = renderContent(sanitized, t.value.copyCode, isStreamingLast);
    }
    const q = debouncedSearchQuery?.value.trim() ?? '';
    if (q) {
      html = highlightSearchInHtml(html, q, globalIdx === (activeMatchGlobalIdx?.value ?? -1), {
        caseSensitive: searchCaseSensitive?.value ?? false,
        wholeWord: searchWholeWord?.value ?? false,
        regex: searchRegex?.value ?? false,
      });
    }
    return html;
  }

  function isTransientAbortAssistantMessage(msg: Message): boolean {
    return msg.role === 'assistant' && isAbortCancellationMessage(msg.content);
  }

  return {
    renderBubble,
    isTransientAbortAssistantMessage,
  };
}
