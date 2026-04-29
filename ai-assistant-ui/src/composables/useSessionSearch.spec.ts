import { describe, it, expect, vi, afterEach } from 'vitest';
import { nextTick, ref } from 'vue';
import { useSessionSearch, highlightSearchInHtml } from './useSessionSearch';

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    onUnmounted: vi.fn(),
    nextTick: vi.fn(),
  };
});

describe('useSessionSearch', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns all messages when no search query', () => {
    const msgs = ref([
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'hi there' },
    ]);
    const { displayedMessages, hiddenOlderCount } = useSessionSearch(
      msgs,
      ref(false),
      ref(true),
      60,
    );
    expect(displayedMessages.value).toHaveLength(2);
    expect(hiddenOlderCount.value).toBe(0);
  });

  it('limits rendered messages when renderAll is false', () => {
    const msgs = ref(
      Array.from({ length: 10 }, (_, i) => ({ role: 'user' as const, content: `msg ${i}` })),
    );
    const { displayedMessages, hiddenOlderCount } = useSessionSearch(
      msgs,
      ref(false),
      ref(false),
      3,
    );
    expect(displayedMessages.value).toHaveLength(3);
    expect(hiddenOlderCount.value).toBe(7);
  });

  it('returns empty when no messages', () => {
    const msgs = ref<{ role: 'user' | 'assistant'; content: string }[]>([]);
    const { displayedMessages } = useSessionSearch(msgs, ref(false), ref(true), 60);
    expect(displayedMessages.value).toHaveLength(0);
  });

  it('tracks match count and indices', () => {
    const msgs = ref([
      { role: 'user' as const, content: 'hello world' },
      { role: 'assistant' as const, content: 'hi there' },
      { role: 'user' as const, content: 'hello again' },
    ]);
    const s = useSessionSearch(msgs, ref(false), ref(true), 60);
    s.chatSearchInput.value = 'hello';
    s.debouncedSearchQuery.value = 'hello';
    expect(s.totalMatches.value).toBe(2);
    expect(s.currentMatchIdx.value).toBe(0);
    expect(s.activeMatchGlobalIdx.value).toBe(0);
  });

  it('renders only the range between first and last match when searching', () => {
    const msgs = ref([
      { role: 'user' as const, content: 'first match' },
      { role: 'assistant' as const, content: 'middle message' },
      { role: 'user' as const, content: 'second match' },
      { role: 'assistant' as const, content: 'after range' },
    ]);
    const s = useSessionSearch(msgs, ref(false), ref(false), 1);

    s.debouncedSearchQuery.value = 'match';

    expect(s.displayOffset.value).toBe(0);
    expect(s.displayedMessages.value.map((msg) => msg.content)).toEqual([
      'first match',
      'middle message',
      'second match',
    ]);
    expect(s.hiddenOlderCount.value).toBe(0);
  });

  it('returns empty display state when search has no matches', () => {
    const msgs = ref([
      { role: 'user' as const, content: 'hello' },
      { role: 'assistant' as const, content: 'world' },
    ]);
    const s = useSessionSearch(msgs, ref(false), ref(false), 1);

    s.debouncedSearchQuery.value = 'missing';

    expect(s.totalMatches.value).toBe(0);
    expect(s.activeMatchGlobalIdx.value).toBe(-1);
    expect(s.displayedMessages.value).toEqual([]);
    expect(s.hiddenOlderCount.value).toBe(0);
  });

  it('uses at least one rendered message even when maxRendered is zero', () => {
    const msgs = ref([
      { role: 'user' as const, content: 'one' },
      { role: 'assistant' as const, content: 'two' },
    ]);
    const s = useSessionSearch(msgs, ref(false), ref(false), 0);

    expect(s.displayOffset.value).toBe(1);
    expect(s.displayedMessages.value.map((msg) => msg.content)).toEqual(['two']);
    expect(s.hiddenOlderCount.value).toBe(1);
  });

  it('debounces input before updating search query', async () => {
    vi.useFakeTimers();
    const msgs = ref([{ role: 'user' as const, content: 'foo' }]);
    const s = useSessionSearch(msgs, ref(false), ref(true), 60);

    s.currentMatchIdx.value = 3;
    s.chatSearchInput.value = 'foo';
    await Promise.resolve();

    vi.advanceTimersByTime(199);
    expect(s.debouncedSearchQuery.value).toBe('');

    vi.advanceTimersByTime(1);
    expect(s.debouncedSearchQuery.value).toBe('foo');
    expect(s.currentMatchIdx.value).toBe(0);
  });

  it('goNextMatch cycles through matches', () => {
    const msgs = ref([
      { role: 'user' as const, content: 'apple' },
      { role: 'assistant' as const, content: 'banana' },
      { role: 'user' as const, content: 'apple pie' },
    ]);
    const s = useSessionSearch(msgs, ref(false), ref(true), 60);
    s.debouncedSearchQuery.value = 'apple';
    expect(s.totalMatches.value).toBe(2);
    s.goNextMatch();
    expect(s.currentMatchIdx.value).toBe(1);
    expect(s.activeMatchGlobalIdx.value).toBe(2);
    s.goNextMatch();
    expect(s.currentMatchIdx.value).toBe(0);
  });

  it('does not change match index when navigating without matches', () => {
    const msgs = ref([{ role: 'user' as const, content: 'only message' }]);
    const s = useSessionSearch(msgs, ref(false), ref(true), 60);

    s.goNextMatch();
    s.goPrevMatch();

    expect(s.currentMatchIdx.value).toBe(0);
    expect(s.activeMatchGlobalIdx.value).toBe(-1);
  });

  it('goPrevMatch wraps around', () => {
    const msgs = ref([
      { role: 'user' as const, content: 'test A' },
      { role: 'user' as const, content: 'test B' },
    ]);
    const s = useSessionSearch(msgs, ref(false), ref(true), 60);
    s.debouncedSearchQuery.value = 'test';
    s.goPrevMatch();
    expect(s.currentMatchIdx.value).toBe(1);
  });

  it('resetSearch clears match state', () => {
    const msgs = ref([{ role: 'user' as const, content: 'foo bar' }]);
    const s = useSessionSearch(msgs, ref(false), ref(true), 60);
    s.debouncedSearchQuery.value = 'foo';
    expect(s.totalMatches.value).toBe(1);
    s.resetSearch();
    expect(s.totalMatches.value).toBe(0);
    expect(s.currentMatchIdx.value).toBe(0);
  });

  it('disposeSearch delegates to resetSearch', () => {
    const msgs = ref([{ role: 'user' as const, content: 'foo bar' }]);
    const s = useSessionSearch(msgs, ref(false), ref(true), 60);
    s.chatSearchInput.value = 'foo';
    s.debouncedSearchQuery.value = 'foo';

    s.disposeSearch();

    expect(s.chatSearchInput.value).toBe('');
    expect(s.debouncedSearchQuery.value).toBe('');
  });

  it('requests scrolling when active match changes', () => {
    const msgs = ref([{ role: 'user' as const, content: 'foo' }]);
    const s = useSessionSearch(msgs, ref(false), ref(true), 60);
    s.debouncedSearchQuery.value = 'foo';

    s.goNextMatch();

    expect(nextTick).toHaveBeenCalledOnce();
  });
});

describe('highlightSearchInHtml', () => {
  it('wraps matching text in <mark> tags', () => {
    const html = '<p>Hello world</p>';
    const result = highlightSearchInHtml(html, 'world', false);
    expect(result).toContain('<mark class="ai-search-hl">world</mark>');
    expect(result).toContain('<p>Hello ');
  });

  it('adds active class when isActive is true', () => {
    const html = '<p>test</p>';
    const result = highlightSearchInHtml(html, 'test', true);
    expect(result).toContain('ai-search-hl-active');
  });

  it('does not modify HTML tags', () => {
    const html = '<a href="https://test.com">click</a>';
    const result = highlightSearchInHtml(html, 'test', false);
    expect(result).toContain('href="https://test.com"');
    expect(result).not.toContain('<mark');
  });

  it('returns original html when query is empty', () => {
    const html = '<p>hello</p>';
    expect(highlightSearchInHtml(html, '', false)).toBe(html);
  });

  it('handles case-insensitive matching', () => {
    const html = '<p>Hello HELLO hello</p>';
    const result = highlightSearchInHtml(html, 'hello', false);
    expect(result.match(/<mark/g)?.length).toBe(3);
  });

  it('escapes regex special characters in query', () => {
    const html = '<p>price is $10.00</p>';
    const result = highlightSearchInHtml(html, '$10.00', false);
    expect(result).toContain('<mark class="ai-search-hl">$10.00</mark>');
  });
});
