import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

import CommandPalette from './CommandPalette.vue';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('CommandPalette icons', () => {
  it('renders a semantic command icon as SVG', () => {
    const wrapper = mount(CommandPalette, {
      props: {
        open: true,
        commands: [
          {
            id: 'ai.open-memory',
            label: 'Memory',
            icon: 'brain',
            action: vi.fn(),
          },
        ],
      },
      attachTo: document.body,
    });

    expect(document.body.querySelector('.ai-cmd-palette-search svg')).not.toBeNull();
    expect(document.body.querySelector('.ai-cmd-palette-item-icon svg')).not.toBeNull();
    wrapper.unmount();
  });

  it('closes on Ctrl+K without leaking the shortcut to global listeners', async () => {
    const globalKeydown = vi.fn();
    window.addEventListener('keydown', globalKeydown);
    const wrapper = mount(CommandPalette, {
      props: {
        open: true,
        commands: [],
      },
      attachTo: document.body,
    });
    const input = document.body.querySelector<HTMLInputElement>('.ai-cmd-palette-input');
    expect(input).not.toBeNull();

    input!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'k',
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:open')).toEqual([[false]]);
    expect(globalKeydown).not.toHaveBeenCalled();
    window.removeEventListener('keydown', globalKeydown);
    wrapper.unmount();
  });

  it('focuses the search input on initial open and closes on Escape', async () => {
    const wrapper = mount(CommandPalette, {
      props: {
        open: true,
        commands: [],
      },
      attachTo: document.body,
    });

    await flushPromises();
    const input = document.body.querySelector<HTMLInputElement>('.ai-cmd-palette-input');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);

    input!.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    await wrapper.vm.$nextTick();

    expect(wrapper.emitted('update:open')).toEqual([[false]]);
    wrapper.unmount();
  });
});
