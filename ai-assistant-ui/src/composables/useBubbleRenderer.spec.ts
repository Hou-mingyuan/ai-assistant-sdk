import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../utils/i18n';
import { escapeHtmlLite, useBubbleRenderer } from './useBubbleRenderer';

const t = computed(() => getMessages('en'));

function makeRenderer(opts: Partial<Parameters<typeof useBubbleRenderer>[0]> = {}) {
  return useBubbleRenderer({
    t,
    sanitizeAssistantContent: (c: string) => c,
    renderContent: (c: string) => `<pre>${c}</pre>`,
    debouncedSearchQuery: ref(''),
    activeMatchGlobalIdx: ref(-1),
    searchCaseSensitive: ref(false),
    searchWholeWord: ref(false),
    searchRegex: ref(false),
    ...opts,
  });
}

describe('escapeHtmlLite', () => {
  it('escapes ampersand and angle brackets only', () => {
    expect(escapeHtmlLite('<a> & </a>')).toBe('&lt;a&gt; &amp; &lt;/a&gt;');
    expect(escapeHtmlLite('no special')).toBe('no special');
  });
});

describe('useBubbleRenderer.injectCodeBlockCompareButton', () => {
  it('injects a compare button into a plain <pre>', () => {
    const { injectCodeBlockCompareButton } = makeRenderer();
    const out = injectCodeBlockCompareButton('<pre>code</pre>', 3);
    expect(out).toContain('data-ai-cmp-msg="3"');
    expect(out).toContain('data-ai-cmp-wrapped="1"');
    expect(out).toContain('ai-code-cmp-btn');
  });

  it('does not double-wrap an already-wrapped <pre>', () => {
    const { injectCodeBlockCompareButton } = makeRenderer();
    const input = '<pre data-ai-cmp-wrapped="1">x</pre>';
    expect(injectCodeBlockCompareButton(input, 0)).toBe(input);
  });

  it('skips the streaming-plain <pre>', () => {
    const { injectCodeBlockCompareButton } = makeRenderer();
    const out = injectCodeBlockCompareButton('<pre data-ai-stream-plain="1">x</pre>', 0);
    expect(out).not.toContain('ai-code-cmp-btn');
  });
});

describe('useBubbleRenderer.renderBubble', () => {
  it('renders the streaming-plain branch for long streaming content', () => {
    const long = 'a'.repeat(201);
    const html = makeRenderer().renderBubble(long, 0, true);
    expect(html).toContain('ai-stream-plain');
    expect(html).toContain(long);
  });

  it('renders markdown and injects the compare button for non-streaming content', () => {
    const html = makeRenderer().renderBubble('code', 0, false);
    expect(html).toContain('ai-code-cmp-btn');
  });

  it('applies search highlight only when a query is present', () => {
    const withQuery = makeRenderer({ debouncedSearchQuery: ref('code') }).renderBubble(
      'code',
      0,
      false,
    );
    const withoutQuery = makeRenderer().renderBubble('code', 0, false);
    expect(withQuery).not.toBe(withoutQuery);
  });
});

describe('useBubbleRenderer.isTransientAbortAssistantMessage', () => {
  it('returns false for non-assistant messages', () => {
    const { isTransientAbortAssistantMessage } = makeRenderer();
    expect(isTransientAbortAssistantMessage({ role: 'user', content: 'anything' })).toBe(false);
  });
});
