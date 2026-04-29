import { describe, it, expect, vi, afterEach } from 'vitest';
import { ref } from 'vue';
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
  afterEach(() => vi.restoreAllMocks());

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
