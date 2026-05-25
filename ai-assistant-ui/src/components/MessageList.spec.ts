import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

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
