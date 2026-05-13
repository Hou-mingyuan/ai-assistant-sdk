import { computed, nextTick, onUnmounted, ref, watch, type Ref } from 'vue';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  contentArchive?: string;
  feedback?: 'up' | 'down';
  timestamp?: number;
}

const SEARCH_DEBOUNCE_MS = 200;

/**
 * H6: 构建搜索 RegExp。
 * - regex=true 时把 query 当成 raw 正则；invalid → 返回 null（视为零匹配）
 * - wholeWord=true 时在两端加 \b 单词边界
 * - caseSensitive=false 时加 i flag
 * - global flag 始终启用（匹配全部）
 */
export function buildSearchRegex(
  query: string,
  options: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean } = {},
): RegExp | null {
  if (!query) return null;
  const flags = (options.caseSensitive ? '' : 'i') + 'g';
  try {
    let pattern: string;
    if (options.regex) {
      pattern = query;
    } else {
      pattern = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    if (options.wholeWord) {
      pattern = `\\b(?:${pattern})\\b`;
    } else {
      pattern = `(${pattern})`;
    }
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

/**
 * 会话内搜索 + 长会话仅挂载最近 N 条（与「显示更早消息」配合）。
 * 支持匹配计数、prev/next 跳转、高亮渲染。
 */
export function useSessionSearch(
  messages: Ref<Message[]>,
  _loading: Ref<boolean>,
  renderAllMessages: Ref<boolean>,
  maxRendered: number,
  panelRoot?: Ref<HTMLElement | undefined>,
) {
  const chatSearchInput = ref('');
  const debouncedSearchQuery = ref('');
  const currentMatchIdx = ref(0);
  /* H6: 三模式 toggle - 重置 chatSearchInput 时不重置，让用户偏好持久 */
  const searchCaseSensitive = ref(false);
  const searchWholeWord = ref(false);
  const searchRegex = ref(false);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  watch(
    chatSearchInput,
    (v) => {
      if (debounceTimer !== null) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debouncedSearchQuery.value = v;
        currentMatchIdx.value = 0;
        debounceTimer = null;
      }, SEARCH_DEBOUNCE_MS);
    },
    { immediate: true },
  );

  onUnmounted(() => {
    if (debounceTimer !== null) clearTimeout(debounceTimer);
  });

  const searchMatchedIndices = computed(() => {
    const q = debouncedSearchQuery.value.trim();
    if (!q) return [] as number[];
    const re = buildSearchRegex(q, {
      caseSensitive: searchCaseSensitive.value,
      wholeWord: searchWholeWord.value,
      regex: searchRegex.value,
    });
    if (!re) return [] as number[];
    const result: number[] = [];
    const all = messages.value;
    for (let i = 0; i < all.length; i++) {
      /* reset lastIndex 因为 RegExp 是 g flag 复用同一对象 */
      re.lastIndex = 0;
      if (re.test(all[i]?.content ?? '')) {
        result.push(i);
      }
    }
    return result;
  });

  const totalMatches = computed(() => searchMatchedIndices.value.length);

  const activeMatchGlobalIdx = computed(() => {
    if (totalMatches.value === 0) return -1;
    return searchMatchedIndices.value[currentMatchIdx.value] ?? -1;
  });

  const plan = computed(() => {
    const all = messages.value;
    const q = debouncedSearchQuery.value.trim();

    if (all.length === 0) {
      return { offset: 0, list: [] as Message[], hiddenBefore: 0 };
    }

    if (q) {
      const matchIdx = searchMatchedIndices.value;
      if (matchIdx.length === 0) {
        return { offset: 0, list: [] as Message[], hiddenBefore: 0 };
      }
      const from = Math.min(...matchIdx);
      const to = Math.max(...matchIdx) + 1;
      return {
        offset: from,
        list: all.slice(from, to),
        hiddenBefore: from,
      };
    }

    const cap = Math.max(1, maxRendered);
    const showAll = renderAllMessages.value || all.length <= cap;
    if (showAll) {
      return { offset: 0, list: all.slice(), hiddenBefore: 0 };
    }
    const from = all.length - cap;
    return {
      offset: from,
      list: all.slice(from),
      hiddenBefore: from,
    };
  });

  const displayOffset = computed(() => plan.value.offset);
  const displayedMessages = computed(() => plan.value.list);
  const hiddenOlderCount = computed(() => {
    if (debouncedSearchQuery.value.trim()) {
      return plan.value.hiddenBefore;
    }
    if (renderAllMessages.value) {
      return 0;
    }
    const cap = Math.max(1, maxRendered);
    return Math.max(0, messages.value.length - cap);
  });

  function goNextMatch() {
    if (totalMatches.value === 0) return;
    currentMatchIdx.value = (currentMatchIdx.value + 1) % totalMatches.value;
    scrollToActiveMatch();
  }

  function goPrevMatch() {
    if (totalMatches.value === 0) return;
    currentMatchIdx.value = (currentMatchIdx.value - 1 + totalMatches.value) % totalMatches.value;
    scrollToActiveMatch();
  }

  function scrollToActiveMatch() {
    const gIdx = activeMatchGlobalIdx.value;
    if (gIdx < 0) return;
    nextTick(() => {
      const root = panelRoot?.value ?? document;
      const el = root.querySelector(`[data-ai-msg-global-idx="${gIdx}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function resetSearch() {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    chatSearchInput.value = '';
    debouncedSearchQuery.value = '';
    currentMatchIdx.value = 0;
  }

  function disposeSearch() {
    resetSearch();
  }

  return {
    chatSearchInput,
    debouncedSearchQuery,
    displayOffset,
    displayedMessages,
    hiddenOlderCount,
    totalMatches,
    currentMatchIdx,
    activeMatchGlobalIdx,
    searchCaseSensitive,
    searchWholeWord,
    searchRegex,
    goNextMatch,
    goPrevMatch,
    resetSearch,
    disposeSearch,
  };
}

/**
 * 在已渲染的 HTML 文本节点中标记搜索匹配词。
 * 跳过 HTML 标签内部，仅处理可见文本。
 *
 * @param options H6 三模式（caseSensitive/wholeWord/regex），未传时
 *                走老语义（case-insensitive substring）以保持兼容
 */
export function highlightSearchInHtml(
  html: string,
  query: string,
  isActive: boolean,
  options?: { caseSensitive?: boolean; wholeWord?: boolean; regex?: boolean },
): string {
  if (!query) return html;
  const re = buildSearchRegex(query, options ?? {});
  if (!re) return html;
  const cls = isActive ? 'ai-search-hl ai-search-hl-active' : 'ai-search-hl';
  const parts = html.split(/(<[^>]+>)/);
  return parts
    .map((part) => {
      if (part.startsWith('<')) return part;
      /* g flag 共享 lastIndex；用 String.replace 自动重置 */
      return part.replace(re, (m) => `<mark class="${cls}">${m}</mark>`);
    })
    .join('');
}
