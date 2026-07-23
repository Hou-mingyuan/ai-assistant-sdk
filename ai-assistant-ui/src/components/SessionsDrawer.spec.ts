import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getMessages } from '../utils/i18n';
import SessionsDrawer from './SessionsDrawer.vue';

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('SessionsDrawer icons', () => {
  it('renders session actions and search roles with semantic icons', async () => {
    vi.useFakeTimers();
    const wrapper = mount(SessionsDrawer, {
      props: {
        open: true,
        isDark: false,
        t: getMessages('en'),
        sessions: [
          {
            id: 'session-1',
            title: 'Pinned session',
            createdAt: Date.now(),
            pinned: true,
            messages: [{ role: 'user', content: 'hello from the user' }],
          },
          {
            id: 'session-2',
            title: 'Other session',
            createdAt: Date.now() - 1000,
            messages: [{ role: 'assistant', content: 'hello from the assistant' }],
          },
        ],
        activeId: 'session-1',
      },
      attachTo: document.body,
      global: {
        stubs: {
          Teleport: true,
        },
      },
    });

    expect(wrapper.find('.ai-sessions-drawer-item-pin svg').exists()).toBe(true);
    expect(wrapper.findAll('.ai-sessions-drawer-item-actions svg')).toHaveLength(6);

    await wrapper.find('.ai-sessions-drawer-input').setValue('hello');
    await vi.advanceTimersByTimeAsync(201);
    expect(wrapper.findAll('.ai-sessions-drawer-match-role svg')).toHaveLength(2);

    wrapper.unmount();
  });
});
