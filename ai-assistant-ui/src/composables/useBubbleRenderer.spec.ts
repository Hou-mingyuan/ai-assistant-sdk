import { computed, ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { escapeHtmlLite, useBubbleRenderer } from './useBubbleRenderer';
import type { I18nMessages } from '../utils/i18n';

function makeRenderer(overrides: Partial<Parameters<typeof useBubbleRenderer>[0]> = {}) {
  return useBubbleRenderer({
    t: computed(() => ({ copyCode: 'Copy' }) as I18nMessages),
    sanitizeAssistantContent: (s) => s.trim(),
    renderContent: vi.fn((content, _copy, streaming) =>
      streaming ? `<p>${content}</p>` : `<div><pre><code>${content}</code></pre></div>`,
    ),
    ...overrides,
  });
}

describe('escapeHtmlLite', () => {
  it('escapes ampersands and angle brackets', () => {
    expect(escapeHtmlLite('a & <b>c</b>')).toBe('a &amp; &lt;b&gt;c&lt;/b&gt;');
  });
});

describe('useBubbleRenderer.renderBubble', () => {
  it('uses escaped <pre class="ai-stream-plain"> fast path for long active streams', () => {
    const renderContent = vi.fn();
    const { renderBubble } = makeRenderer({ renderContent });
    const long = '<x>' + 'a'.repeat(210);
    const out = renderBubble(long, 0, true);
    expect(out).toContain('class="ai-stream-plain"');
    expect(out).toContain('&lt;x&gt;');
    expect(renderContent).not.toHaveBeenCalled();
  });

  it('renders sanitized markdown via renderContent when not on long-stream fast path', () => {
    const { renderBubble } = makeRenderer();
    const out = renderBubble('  code  ', 0, false);
    expect(out).toContain('<pre><code>code</code></pre>');
  });

  it('applies search highlight when optional search refs are supplied', () => {
    const withQuery = makeRenderer({ debouncedSearchQuery: ref('code') }).renderBubble(
      'code',
      0,
      false,
    );
    expect(withQuery).toContain('<mark');
  });

  it('detects transient abort cancellation messages', () => {
    const { isTransientAbortAssistantMessage } = makeRenderer();
    expect(isTransientAbortAssistantMessage({ role: 'user', content: 'Cancelled' })).toBe(false);
    expect(
      isTransientAbortAssistantMessage({ role: 'assistant', content: 'Error: AbortError' }),
    ).toBe(true);
  });
});
