import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import AssistantHeader from './AssistantHeader.vue';
import { getMessages } from '../utils/i18n';

function mountHeader(overrides: Partial<Record<string, unknown>> = {}) {
  return mount(AssistantHeader, {
    props: {
      uid: 'ai-test',
      selectedModel: 'gpt-4o-mini',
      panelDragging: false,
      panelExpanded: false,
      hasMessages: true,
      loading: false,
      isDark: false,
      t: getMessages('en'),
      ...overrides,
    },
  });
}

describe('AssistantHeader', () => {
  it('renders direct icon controls including the edge-dock settings trigger', () => {
    const wrapper = mountHeader();

    expect(wrapper.find('.ai-header-settings').exists()).toBe(true);
    expect(wrapper.find('.ai-new-session').exists()).toBe(true);
    expect(wrapper.find('.ai-header-sessions').exists()).toBe(true);
    expect(wrapper.find('.ai-panel-expand').exists()).toBe(true);
    expect(wrapper.find('.ai-header-theme-toggle').exists()).toBe(true);
    expect(wrapper.find('.ai-header-clear').exists()).toBe(true);
    expect(wrapper.find('.ai-close').exists()).toBe(true);
  });

  it('hides the clear button when there are no messages or while loading', async () => {
    const wrapper = mountHeader({ hasMessages: false });
    expect(wrapper.find('.ai-header-clear').exists()).toBe(false);

    await wrapper.setProps({ hasMessages: true, loading: true });
    expect(wrapper.find('.ai-header-clear').exists()).toBe(false);
  });

  it('emits header action events cleanly', async () => {
    const wrapper = mountHeader();

    await wrapper.find('.ai-new-session').trigger('click');
    await wrapper.find('.ai-header-sessions').trigger('click');
    await wrapper.find('.ai-panel-expand').trigger('click');
    await wrapper.find('.ai-header-theme-toggle').trigger('click');
    await wrapper.find('.ai-header-settings').trigger('click');
    await wrapper.find('.ai-header-clear').trigger('click');
    await wrapper.find('.ai-close').trigger('click');

    expect(wrapper.emitted('start-new-session')).toHaveLength(1);
    expect(wrapper.emitted('open-sessions-drawer')).toHaveLength(1);
    expect(wrapper.emitted('toggle-panel-expand')).toHaveLength(1);
    expect(wrapper.emitted('toggle-theme')).toHaveLength(1);
    expect(wrapper.emitted('toggle-dock-settings')).toHaveLength(1);
    expect(wrapper.emitted('clear-messages')).toHaveLength(1);
    expect(wrapper.emitted('close-panel')).toHaveLength(1);
  });

  it('renders title subtitle with active model name', () => {
    const wrapper = mountHeader({ selectedModel: 'qwen-max' });
    expect(wrapper.find('.ai-title-subtitle').text()).toBe('qwen-max');
  });
});
