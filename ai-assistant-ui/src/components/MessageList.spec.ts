import { mount } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';

import MessageList from './MessageList.vue';
import { getMessages } from '../utils/i18n';
import type { Message } from '../types/message';

describe('MessageList image thumbnails', () => {
  it('renders an attached user image thumbnail outside the markdown bubble', () => {
    const wrapper = mountList([
      {
        role: 'user',
        content: 'look at this',
        imageThumb: 'data:image/png;base64,thumb',
      },
    ]);

    const image = wrapper.find('img.ai-user-image-thumb');
    expect(image.exists()).toBe(true);
    expect(image.attributes('src')).toBe('data:image/png;base64,thumb');
    expect(wrapper.find('.ai-bubble').text()).toContain('look at this');
  });
});

describe('MessageList error actions', () => {
  it('renders retry with a semantic icon', () => {
    const wrapper = mountList([{ role: 'assistant', content: 'request failed' }], {
      isErrorMessage: () => true,
    });

    expect(wrapper.find('.ai-retry-btn svg').exists()).toBe(true);
    expect(wrapper.find('.ai-retry-btn').text()).toContain('Retry');
  });
});

describe('MessageList assistant metadata', () => {
  it('renders primary latency pill but defers TTFT behind a details toggle', async () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'hello',
        timestamp: Date.now(),
        meta: {
          model: 'qwen-max',
          elapsedMs: 1234,
          ttftMs: 345,
        },
      },
    ]);

    const footer = wrapper.find('.ai-msg-footer');
    expect(footer.exists()).toBe(true);
    expect(Array.from(footer.element.children).map((el) => el.className)).toEqual([
      'ai-msg-actions',
      'ai-msg-time',
      'ai-msg-meta',
    ]);

    const meta = wrapper.find('.ai-msg-meta');
    expect(meta.exists()).toBe(true);
    expect(wrapper.find('.ai-msg-time').text()).toBe('now');
    expect(meta.text()).not.toContain('qwen-max');
    expect(meta.text()).toContain('Elapsed 1.2s');
    expect(meta.text()).not.toContain('TTFT');

    const toggle = wrapper.find('.ai-msg-meta-toggle');
    expect(toggle.exists()).toBe(true);
    expect(toggle.attributes('aria-expanded')).toBe('false');

    await toggle.trigger('click');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    expect(meta.text()).toContain('TTFT 0.3s');
  });

  it('keeps Actual model and Model switched primary while hiding vision details by default', async () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'hello',
        timestamp: Date.now(),
        meta: {
          model: 'MiniMax-M2.7',
          effectiveModel: 'MiniMax-M2.5',
          fallback: true,
          visionInputCount: 1,
          visionRoute: 'minimax-vlm',
        },
      },
    ]);

    const meta = wrapper.find('.ai-msg-meta');
    expect(meta.text()).toContain('Actual model MiniMax-M2.5');
    expect(meta.text()).toContain('Model switched');
    expect(meta.text()).not.toContain('Vision images');
    expect(meta.text()).not.toContain('Vision route');

    await wrapper.find('.ai-msg-meta-toggle').trigger('click');
    expect(meta.text()).toContain('Vision images 1');
    expect(meta.text()).toContain('Vision route minimax-vlm');
  });

  it('renders web search provider and result count in response metadata', () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'fresh answer',
        timestamp: Date.now(),
        meta: {
          webSearchEnabled: true,
          webSearchProvider: 'Tavily',
          webSearchFallback: false,
          webSearchResultCount: 2,
        },
      },
    ]);

    const meta = wrapper.find('.ai-msg-meta');
    expect(meta.text()).toContain('Web Tavily');
    expect(meta.text()).toContain('2 results');
    expect(meta.text()).not.toContain('Search fallback');
  });

  it('renders web search fallback state when provider degraded', () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'fresh answer',
        timestamp: Date.now(),
        meta: {
          webSearchEnabled: true,
          webSearchProvider: 'DuckDuckGo fallback',
          webSearchFallback: true,
          webSearchResultCount: 1,
        },
      },
    ]);

    const meta = wrapper.find('.ai-msg-meta');
    expect(meta.text()).toContain('Web DuckDuckGo fallback');
    expect(meta.text()).toContain('1 result');
    expect(meta.text()).toContain('Search fallback');
  });

  it('renders zero-result web search attempts instead of hiding the search state', () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'answer without search context',
        timestamp: Date.now(),
        meta: {
          webSearchEnabled: true,
          webSearchProvider: 'DuckDuckGo fallback',
          webSearchFallback: true,
          webSearchResultCount: 0,
        },
      },
    ]);

    const meta = wrapper.find('.ai-msg-meta');
    expect(meta.text()).toContain('Web DuckDuckGo fallback');
    expect(meta.text()).toContain('0 results');
    expect(meta.text()).toContain('Search fallback');
  });

  it('keeps web search source URLs behind response metadata details', async () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'fresh answer',
        timestamp: Date.now(),
        meta: {
          webSearchEnabled: true,
          webSearchProvider: 'Tavily',
          webSearchResultCount: 2,
          webSearchSourceUrls: ['https://example.com/a', 'https://example.com/b?x=1&y=2'],
        },
      },
    ]);

    const meta = wrapper.find('.ai-msg-meta');
    expect(meta.text()).not.toContain('Source 1');
    const toggle = wrapper.find('.ai-msg-meta-toggle');
    expect(toggle.exists()).toBe(true);

    await toggle.trigger('click');

    expect(meta.text()).toContain('Source 1');
    expect(meta.text()).toContain('Source 2');
    const links = wrapper.findAll('.ai-msg-meta-source-link');
    expect(links.map((link) => link.attributes('href'))).toEqual([
      'https://example.com/a',
      'https://example.com/b?x=1&y=2',
    ]);
  });

  it('omits the details toggle when no secondary meta is present', () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'hello',
        timestamp: Date.now(),
        meta: {
          model: 'qwen-max',
          elapsedMs: 1234,
        },
      },
    ]);

    expect(wrapper.find('.ai-msg-meta').exists()).toBe(true);
    expect(wrapper.find('.ai-msg-meta-toggle').exists()).toBe(false);
  });
});

describe('MessageList streaming stages', () => {
  it('shows waiting-for-first-token stage before content arrives', () => {
    const wrapper = mountList(
      [
        {
          role: 'assistant',
          content: '',
        },
      ],
      {
        loading: true,
        isActiveStreaming: () => true,
        streamStartedAt: 1000,
        streamingNowMs: 2600,
      },
    );

    expect(wrapper.find('.ai-thinking-text').text()).toContain('Waiting for first token');
    expect(wrapper.findAll('.ai-bubble')).toHaveLength(0);
    expect(wrapper.findAll('.ai-stream-progress')).toHaveLength(0);
  });

  it('shows web-search stage while a web search request is waiting for content', () => {
    const wrapper = mountList(
      [
        {
          role: 'assistant',
          content: '',
          meta: {
            webSearchEnabled: true,
          },
        },
      ],
      {
        loading: true,
        isActiveStreaming: () => true,
        streamStartedAt: 1000,
        streamingNowMs: 1400,
      },
    );

    expect(wrapper.find('.ai-thinking-text').text()).toContain('Searching web');
  });
});

describe('MessageList web search sources', () => {
  it('renders source links directly under completed assistant replies', () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'fresh answer',
        meta: {
          webSearchEnabled: true,
          webSearchSourceUrls: ['https://example.com/a', 'https://example.com/b'],
        },
      },
    ]);

    const sources = wrapper.find('.ai-web-search-sources');
    expect(sources.exists()).toBe(true);
    expect(sources.text()).toContain('References');
    expect(sources.findAll('a').map((link) => link.attributes('href'))).toEqual([
      'https://example.com/a',
      'https://example.com/b',
    ]);
  });

  it('renders web search source preview cards with quality labels', () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'fresh answer [1]',
        meta: {
          webSearchEnabled: true,
          webSearchSourcePreviews: [
            {
              title: 'Official docs',
              url: 'https://example.com/a',
              snippet: 'Preview summary',
              qualityLabel: 'docs',
            },
          ],
        },
      },
    ]);

    const cards = wrapper.find('.ai-web-search-preview-cards');
    expect(cards.exists()).toBe(true);
    expect(cards.text()).toContain('Official docs');
    expect(cards.text()).toContain('docs');
    expect(cards.find('a').attributes('href')).toBe('https://example.com/a');
  });

  it('copies a numbered source citation from preview cards', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'fresh answer [1]',
        meta: {
          webSearchEnabled: true,
          webSearchSourcePreviews: [
            {
              title: 'Official docs',
              url: 'https://example.com/a',
              snippet: 'Preview summary',
              qualityLabel: 'docs',
            },
          ],
        },
      },
    ]);

    await wrapper.find('.ai-web-search-preview-copy').trigger('click');

    expect(writeText).toHaveBeenCalledWith('[1] https://example.com/a');
  });

  it('renders source preview cards before the first streamed token arrives', () => {
    const wrapper = mountList(
      [
        {
          role: 'assistant',
          content: '',
          meta: {
            webSearchEnabled: true,
            webSearchSourcePreviews: [
              {
                title: 'Early source',
                url: 'https://example.com/early',
                snippet: 'Shown before content',
                qualityLabel: 'news',
              },
            ],
          },
        },
      ],
      {
        loading: true,
        isActiveStreaming: () => true,
      },
    );

    expect(wrapper.find('.ai-thinking-bubble').exists()).toBe(true);
    expect(wrapper.find('.ai-web-search-preview-cards').text()).toContain('Early source');
  });

  it('warns when a searched answer does not cite available source numbers', () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'fresh answer without a bracket citation',
        meta: {
          webSearchEnabled: true,
          webSearchResultCount: 2,
          webSearchSourceUrls: ['https://example.com/a', 'https://example.com/b'],
        },
      },
    ]);

    expect(wrapper.find('.ai-web-search-citation-warning').exists()).toBe(true);
  });

  it('offers to regenerate a searched answer when citation check fails', async () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'fresh answer without a bracket citation',
        meta: {
          webSearchEnabled: true,
          webSearchResultCount: 1,
          webSearchSourceUrls: ['https://example.com/a'],
        },
      },
    ]);

    await wrapper.find('.ai-web-search-citation-regenerate').trigger('click');

    expect(wrapper.emitted('regenerate-with-citations')?.[0]).toEqual([0]);
  });

  it('warns when a searched answer cites a source number that is not available', () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'fresh answer with [3]',
        meta: {
          webSearchEnabled: true,
          webSearchResultCount: 2,
          webSearchSourceUrls: ['https://example.com/a', 'https://example.com/b'],
        },
      },
    ]);

    expect(wrapper.find('.ai-web-search-citation-warning').text()).toContain('Citation check');
  });

  it('shows web search timing breakdown in metadata details', async () => {
    const wrapper = mountList([
      {
        role: 'assistant',
        content: 'fresh answer [1]',
        meta: {
          webSearchEnabled: true,
          webSearchProvider: 'DuckDuckGo fallback',
          webSearchResultCount: 1,
          webSearchDurationMs: 321,
          webSearchStableDurationMs: 120,
          webSearchFallbackDurationMs: 201,
        },
      },
    ]);

    await wrapper.find('.ai-msg-meta-toggle').trigger('click');

    expect(wrapper.find('.ai-msg-meta').text()).toContain('Search 0.3s');
    expect(wrapper.find('.ai-msg-meta').text()).toContain('Stable 0.1s');
    expect(wrapper.find('.ai-msg-meta').text()).toContain('Fallback 0.2s');
  });
});

describe('MessageList reading preview', () => {
  it('collapses long assistant replies behind a scan-friendly preview', async () => {
    const longReply = [
      '# Root cause',
      'The assistant response is intentionally long so readers should see a preview first.',
      '- First important point',
      '- Second important point',
      '```ts',
      'const value = 1;',
      '```',
      ...Array.from({ length: 24 }, (_, i) => `Extra detail ${i + 1}`),
    ].join('\n');
    const wrapper = mountList([{ role: 'assistant', content: longReply }]);

    expect(wrapper.find('.ai-reading-preview').exists()).toBe(true);
    expect(wrapper.find('.ai-bubble').exists()).toBe(false);
    expect(wrapper.find('.ai-reading-preview').text()).toContain('Root cause');

    await wrapper.find('.ai-reading-preview-toggle').trigger('click');
    expect(wrapper.find('.ai-bubble').exists()).toBe(true);
  });
});

function mountList(messages: Message[], overrides: Partial<Record<string, unknown>> = {}) {
  return mount(MessageList, {
    props: {
      messages,
      displayOffset: 0,
      hiddenOlderCount: 0,
      renderAllMessages: true,
      selectMode: false,
      selectedIndices: new Set<number>(),
      loading: false,
      editingIdx: null,
      editingText: '',
      copiedIndex: null,
      showEarlierLabel: 'Show earlier',
      t: getMessages('en'),
      isTransientAbort: () => false,
      isActiveStreaming: () => false,
      hasVisibleContent: (content: string) => content.trim().length > 0,
      formatRelativeTime: () => 'now',
      renderBubble: (content: string) => content,
      onBubbleContextMenu: () => undefined,
      isErrorMessage: () => false,
      ...overrides,
    },
  });
}
