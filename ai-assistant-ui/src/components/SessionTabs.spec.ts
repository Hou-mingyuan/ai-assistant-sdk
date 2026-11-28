import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import SessionTabs from './SessionTabs.vue';
import type { SessionEntry } from '../composables/useMultiSession';

function makeSessions(count = 2): SessionEntry[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `s-${idx + 1}`,
    title: idx === 0 ? '' : `Session ${idx + 1}`,
    createdAt: idx + 1,
    updatedAt: idx + 1,
  }));
}

describe('SessionTabs', () => {
  it('stays hidden when there is only one session', () => {
    const wrapper = mount(SessionTabs, {
      props: {
        sessions: makeSessions(1),
        activeId: 's-1',
        newLabel: 'New chat',
      },
    });

    expect(wrapper.find('.ai-session-tabs').exists()).toBe(false);
  });

  it('renders horizontal tab pills with status dots and active state for multiple sessions', () => {
    const wrapper = mount(SessionTabs, {
      props: {
        sessions: makeSessions(3),
        activeId: 's-2',
        newLabel: 'New chat',
      },
    });

    const tabs = wrapper.findAll('.ai-session-tab');
    expect(tabs).toHaveLength(3);
    expect(tabs[0].find('.ai-session-tab-dot').exists()).toBe(true);
    expect(tabs[0].find('.ai-session-tab-label').text()).toBe('New chat');
    expect(tabs[1].classes()).toContain('active');
    expect(tabs[1].attributes('aria-selected')).toBe('true');
    expect(tabs[0].classes()).not.toContain('active');
  });

  it('emits switch on tab click and delete on close click without switching', async () => {
    const wrapper = mount(SessionTabs, {
      props: {
        sessions: makeSessions(2),
        activeId: 's-1',
        newLabel: 'New chat',
        closeLabel: 'Close',
      },
    });

    await wrapper.findAll('.ai-session-tab')[1].trigger('click');
    expect(wrapper.emitted('switch')).toEqual([['s-2']]);

    await wrapper.findAll('.ai-session-tab-close')[0].trigger('click');
    expect(wrapper.emitted('delete')).toEqual([['s-1']]);
    expect(wrapper.emitted('switch')).toEqual([['s-2']]);
  });
});
