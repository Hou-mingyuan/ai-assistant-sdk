import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import MessageList from './MessageList.vue';
import type { Message } from '../types/message';
import { getMessages } from '../utils/i18n';

function mountList(messages: Message[], overrides: Partial<Record<string, unknown>> = {}) {
  return mount(MessageList, {
    props: {
      messages,
      displayOffset: 0,
      hiddenOlderCount: 0,
      renderAllMessages: true,
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
      isErrorMessage: () => false,
      formAutoFillEnabled: false,
      ...overrides,
    },
  });
}

describe('MessageList', () => {
  it('renders user and assistant bubbles with streamlined metadata', () => {
    const wrapper = mountList([
      { role: 'user', content: 'hi', timestamp: Date.now() },
      {
        role: 'assistant',
        content: 'hello',
        timestamp: Date.now(),
        meta: { elapsedMs: 1234 },
      },
    ]);

    expect(wrapper.findAll('.ai-bubble')).toHaveLength(2);
    expect(wrapper.find('.ai-msg-meta-pill').text()).toBe('1.2s');
  });

  it('shows thinking state before first streamed token arrives and stop button during stream', async () => {
    const wrapper = mountList([{ role: 'assistant', content: '' }], {
      loading: true,
      isActiveStreaming: () => true,
      streamStartedAt: 1000,
      streamingNowMs: 1500,
    });

    expect(wrapper.find('.ai-thinking-bubble').exists()).toBe(true);
    expect(wrapper.find('.ai-skeleton').exists()).toBe(true);
    await wrapper.find('.ai-msg-stop').trigger('click');
    expect(wrapper.emitted('stop-generate')).toHaveLength(1);
  });

  it('emits copy-message, form-fill, and regenerate-at actions on assistant messages', async () => {
    const wrapper = mountList([{ role: 'assistant', content: '姓名: 张三\n电话: 13800000000' }], {
      formAutoFillEnabled: true,
    });

    await wrapper.find('.ai-msg-copy').trigger('click');
    await wrapper.find('.ai-msg-form-fill').trigger('click');
    await wrapper.find('.ai-msg-regenerate').trigger('click');

    expect(wrapper.emitted('copy-message')?.[0]).toEqual(['姓名: 张三\n电话: 13800000000', 0]);
    expect(wrapper.emitted('form-fill')?.[0]).toEqual([0]);
    expect(wrapper.emitted('regenerate-at')?.[0]).toEqual([0]);
  });

  it('supports inline user message edit and resend', async () => {
    const wrapper = mountList([{ role: 'user', content: 'old question' }], {
      editingIdx: 0,
      editingText: 'new question',
    });

    await wrapper.find('.ai-edit-confirm').trigger('click');
    expect(wrapper.emitted('confirm-edit')?.[0]).toEqual([0]);

    await wrapper.find('.ai-edit-cancel').trigger('click');
    expect(wrapper.emitted('cancel-edit')).toHaveLength(1);
  });
});
