import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import {
  useCrossSessionSearch,
  buildSnippet,
  escapeHtml,
  type CrossSessionSearchSessionView,
} from './useCrossSessionSearch';

function S(
  id: string,
  title: string,
  msgs: { role?: 'user' | 'assistant'; content: string; timestamp?: number }[],
  createdAt = Date.now(),
): CrossSessionSearchSessionView {
  return {
    id,
    title,
    createdAt,
    messages: msgs.map((m) => ({
      role: m.role ?? 'user',
      content: m.content,
      timestamp: m.timestamp,
    })),
  };
}

describe('escapeHtml', () => {
  it('escapes the 5 standard HTML chars', () => {
    expect(escapeHtml('<a href="x">b&c</a>\'')).toBe(
      '&lt;a href=&quot;x&quot;&gt;b&amp;c&lt;/a&gt;&#39;',
    );
  });
  it('returns identity for safe strings', () => {
    expect(escapeHtml('Hello world 123')).toBe('Hello world 123');
  });
});

describe('buildSnippet', () => {
  it('wraps the match in <mark> tags', () => {
    const out = buildSnippet('hello world', 6, 5, 30);
    expect(out).toContain('<mark class="ai-cross-search-hl">world</mark>');
    expect(out).toContain('hello ');
  });
  it('adds ellipsis when truncated on either side', () => {
    const long = 'a'.repeat(100) + 'NEEDLE' + 'b'.repeat(100);
    const out = buildSnippet(long, 100, 6, 10);
    expect(out.startsWith('…')).toBe(true);
    expect(out.endsWith('…')).toBe(true);
    expect(out).toContain('<mark class="ai-cross-search-hl">NEEDLE</mark>');
  });
  it('escapes HTML inside the snippet', () => {
    const out = buildSnippet('go to <foo> tag', 6, 5, 20);
    expect(out).toContain('&lt;foo&gt;');
    expect(out).not.toContain('<foo>');
  });
});

describe('useCrossSessionSearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(query = '', debounceMs = 0) {
    const q = ref(query);
    const sessions = ref<CrossSessionSearchSessionView[]>([
      S('s1', 'Vue migration', [
        { role: 'user', content: 'How do I migrate from Vue 2 to Vue 3?' },
        { role: 'assistant', content: 'Use the migration build, then enable composition API.' },
      ]),
      S('s2', 'Bash tips', [
        { role: 'user', content: 'Tell me about bash arrays' },
        { role: 'assistant', content: 'Bash 4+ supports associative arrays via declare -A.' },
      ]),
      S('s3', 'Database', [{ role: 'user', content: 'How to index a JSON column in PostgreSQL?' }]),
    ]);
    return { q, sessions, api: useCrossSessionSearch({ sessions, query: q, debounceMs }) };
  }

  it('returns empty matches for empty query', () => {
    const { api } = setup('');
    expect(api.matches.value).toEqual([]);
    expect(api.totalMatches.value).toBe(0);
  });

  it('finds case-insensitive substring across all sessions', () => {
    const { api } = setup('VUE');
    /* s1 user msg has "Vue 2" + "Vue 3" but only the first occurrence per
     * message is surfaced (one snippet per message). s1 assistant msg has
     * no "vue" substring. So total = 1. */
    expect(api.totalMatches.value).toBe(1);
    expect(api.matches.value[0]?.sessionId).toBe('s1');
    expect(api.matches.value[0]?.role).toBe('user');
  });

  it('builds match metadata: offset / role / sessionTitle / snippet', () => {
    const { api } = setup('bash');
    const m = api.matches.value[0];
    expect(m).toBeTruthy();
    expect(m!.sessionId).toBe('s2');
    expect(m!.role).toBe('user');
    expect(m!.sessionTitle).toBe('Bash tips');
    expect(m!.snippet).toContain('<mark class="ai-cross-search-hl">bash</mark>');
    expect(m!.matchOffset).toBeGreaterThanOrEqual(0);
  });

  it('caps matches per session via maxPerSession', () => {
    const sessions = ref<CrossSessionSearchSessionView[]>([
      S(
        'z',
        'Z',
        Array.from({ length: 10 }, () => ({ content: 'apple' })),
      ),
    ]);
    const q = ref('apple');
    const api = useCrossSessionSearch({ sessions, query: q, debounceMs: 0, maxPerSession: 4 });
    expect(api.matches.value.length).toBe(4);
  });

  it('groups results by sessionId in matchesBySession', () => {
    const { api } = setup('arrays');
    expect(api.matchesBySession.value.size).toBe(1);
    expect(api.matchesBySession.value.get('s2')?.length).toBe(2);
  });

  it('sorts results by timestamp descending when present', () => {
    const sessions = ref<CrossSessionSearchSessionView[]>([
      S('a', 'A', [{ content: 'foo', timestamp: 1000 }]),
      S('b', 'B', [{ content: 'foo', timestamp: 3000 }]),
      S('c', 'C', [{ content: 'foo', timestamp: 2000 }]),
    ]);
    const q = ref('foo');
    const api = useCrossSessionSearch({ sessions, query: q, debounceMs: 0 });
    expect(api.matches.value.map((m) => m.sessionId)).toEqual(['b', 'c', 'a']);
  });

  it('debounces query updates by the configured delay', async () => {
    const { api, q } = setup('', 200);
    expect(api.totalMatches.value).toBe(0);
    q.value = 'Vue';
    await nextTick();
    expect(api.effectiveQuery.value).toBe('');
    vi.advanceTimersByTime(199);
    expect(api.effectiveQuery.value).toBe('');
    vi.advanceTimersByTime(2);
    expect(api.effectiveQuery.value).toBe('Vue');
    expect(api.totalMatches.value).toBeGreaterThan(0);
  });

  it('does not include matches whose msgIndex would point at empty content', () => {
    const sessions = ref<CrossSessionSearchSessionView[]>([
      S('x', 'X', [{ content: '' }, { content: 'hit' }]),
    ]);
    const q = ref('hit');
    const api = useCrossSessionSearch({ sessions, query: q, debounceMs: 0 });
    expect(api.matches.value.length).toBe(1);
    expect(api.matches.value[0]!.msgIndex).toBe(1);
  });
});
