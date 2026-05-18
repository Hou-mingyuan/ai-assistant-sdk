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
  it('renders latency metadata without repeating the selected model below the bubble', () => {
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
    expect(meta.text()).toContain('1.2s');
    expect(meta.text()).toContain('TTFT 0.3s');
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
