import { type ComputedRef, type Ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import type { Message } from '../types/message';
import { highlightSearchInHtml } from './useSessionSearch';
import { isAbortCancellationMessage } from './useChatHistoryPersistence';

/**
 * Assistant message bubble rendering extracted from AiAssistant.vue (refactor batch 3).
 *
 * Turns raw assistant content into the sanitized + highlighted HTML the message
 * list renders: streaming-plain fast path for long in-flight content, markdown
 * rendering + per-code-block "Add to Compare" button injection otherwise, then
 * optional search-term highlighting. Behaviour is identical to the previous
 * inline implementation; the markdown renderer and search state are injected so
 * the logic stays unit-testable.
 */

const CODE_COMPARE_BTN_LABEL_KEY = 'msgCtxCompareMarkSelection';

/** Minimal HTML escaping (ampersand + angle brackets) for the streaming-plain fast path. */
export function escapeHtmlLite(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface UseBubbleRendererOptions {
  t: ComputedRef<I18nMessages>;
  sanitizeAssistantContent: (content: string) => string;
  renderContent: (content: string, copyLabel: string, isStreamingLast: boolean) => string;
  debouncedSearchQuery: Ref<string>;
  activeMatchGlobalIdx: Ref<number>;
  searchCaseSensitive: Ref<boolean>;
  searchWholeWord: Ref<boolean>;
  searchRegex: Ref<boolean>;
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

  /**
   * Inject a hover-only "Add to Compare" button into every <pre> that is not the
   * streaming-plain wrapper. Single regex pass; the markdown renderer output is
   * already trusted (sanitized inside renderContent), so splicing is safe. The
   * `data-ai-cmp-msg` marker lets the global click delegator find the source
   * message index.
   */
  function injectCodeBlockCompareButton(html: string, globalIdx: number): string {
    const btnLabel = t.value[CODE_COMPARE_BTN_LABEL_KEY] || 'Add to Compare';
    return html.replace(/<pre(?![^>]*data-ai-stream-plain)([^>]*)>/g, (full, attrs: string) => {
      if (/data-ai-cmp-wrapped="1"/.test(attrs)) return full;
      const newAttrs = `${attrs} data-ai-cmp-wrapped="1" style="position:relative"`;
      const btn =
        `<button type="button" class="ai-code-cmp-btn" data-ai-cmp-msg="${globalIdx}"` +
        ` title="${escapeHtmlLite(btnLabel)}" aria-label="${escapeHtmlLite(btnLabel)}">` +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
        ' stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
        '<path d="M5 12h14M12 5v14"/></svg></button>';
      return `<pre${newAttrs}>${btn}`;
    });
  }

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
      html = injectCodeBlockCompareButton(html, globalIdx);
    }
    const q = debouncedSearchQuery.value.trim();
    if (q) {
      html = highlightSearchInHtml(html, q, globalIdx === activeMatchGlobalIdx.value, {
        caseSensitive: searchCaseSensitive.value,
        wholeWord: searchWholeWord.value,
        regex: searchRegex.value,
      });
    }
    return html;
  }

  function isTransientAbortAssistantMessage(msg: Message): boolean {
    return msg.role === 'assistant' && isAbortCancellationMessage(msg.content);
  }

  return { renderBubble, injectCodeBlockCompareButton, isTransientAbortAssistantMessage };
}
