import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import ChatEmptyState from './ChatEmptyState.vue';

describe('ChatEmptyState', () => {
  it('renders greeting, subtitle, and direct starter cards without nested drawers', () => {
    const wrapper = mount(ChatEmptyState, {
      props: {
        greeting: '您好，有什么可以帮您？',
        subtitle: '纯悬浮球对话、文件问答与表单自动填充',
        formAutoFillEnabled: true,
        isZh: true,
      },
    });

    expect(wrapper.find('.ai-empty-greeting').text()).toBe('您好，有什么可以帮您？');
    expect(wrapper.find('.ai-empty-subtitle').text()).toBe('纯悬浮球对话、文件问答与表单自动填充');
    expect(wrapper.find('.ai-empty-launcher-popover').exists()).toBe(false);
    expect(wrapper.findAll('.ai-empty-starter')).toHaveLength(3);
  });

  it('emits apply-prompt, trigger-upload, and trigger-form-fill from the cards', async () => {
    const wrapper = mount(ChatEmptyState, {
      props: {
        greeting: 'Hello',
        formAutoFillEnabled: true,
        isZh: false,
      },
    });

    const cards = wrapper.findAll('.ai-empty-starter');
    await cards[0]!.trigger('click');
    await cards[1]!.trigger('click');
    await cards[2]!.trigger('click');

    expect(wrapper.emitted('apply-prompt')?.[0]?.[0]).toContain('Summarize this page');
    expect(wrapper.emitted('trigger-upload')).toHaveLength(1);
    expect(wrapper.emitted('trigger-form-fill')).toHaveLength(1);
  });

  it('uses host quickPrompts when provided and hides form-fill card when disabled', async () => {
    const wrapper = mount(ChatEmptyState, {
      props: {
        greeting: 'Hello',
        formAutoFillEnabled: false,
        quickPrompts: [{ label: 'Quick Ask', text: 'Summarize docs' }],
      },
    });

    const cards = wrapper.findAll('.ai-empty-starter');
    expect(cards).toHaveLength(1);
    expect(cards[0]!.text()).toContain('Quick Ask');
    await cards[0]!.trigger('click');
    expect(wrapper.emitted('apply-prompt')?.[0]).toEqual(['Summarize docs']);
  });
});
