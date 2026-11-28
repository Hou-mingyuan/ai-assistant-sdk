import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { describe, expect, it } from 'vitest';

import FabButton from './FabButton.vue';

describe('FabButton', () => {
  it('renders the animated brand launcher with an accessible hit target and state classes', () => {
    const wrapper = mount(FabButton, {
      props: {
        fabHidden: false,
        isOpen: false,
        showFabDuringPanelAnim: false,
        fabDragging: false,
        fabDropActive: false,
        fabLayoutStyle: {},
        ariaLabel: 'Open AI assistant',
        dropHintText: 'Drop files here',
        loading: true,
        edgeDock: 'right',
      },
    });

    const button = wrapper.get('button.ai-fab');
    expect(button.attributes('aria-label')).toBe('Open AI assistant');
    expect(button.classes()).toContain('ai-fab-loading');
    expect(button.classes()).toContain('ai-fab-docked');
    expect(button.find('svg.ai-brand-mark.ai-brand-mark-bot').exists()).toBe(true);
    expect(button.find('.ai-brand-bot-eyes').exists()).toBe(true);
    expect(button.find('.ai-fab-live-dot').exists()).toBe(true);
  });

  it('tracks pointer coordinates inside the circular ball and resets on pointerleave', async () => {
    const wrapper = mount(FabButton, {
      props: {
        fabHidden: false,
        isOpen: false,
        showFabDuringPanelAnim: false,
        fabDragging: false,
        fabDropActive: false,
        fabLayoutStyle: {},
        ariaLabel: 'Open AI assistant',
        dropHintText: 'Drop files here',
      },
    });

    const button = wrapper.get('button.ai-fab');
    button.element.getBoundingClientRect = () =>
      ({
        left: 100,
        top: 200,
        width: 58,
        height: 58,
        right: 158,
        bottom: 258,
        x: 100,
        y: 200,
        toJSON: () => ({}),
      }) as DOMRect;

    button.element.dispatchEvent(
      new MouseEvent('pointermove', { bubbles: true, clientX: 158, clientY: 200 }),
    );
    await nextTick();
    expect(wrapper.get('.ai-brand-bot-eyes-track').attributes('style')).toContain(
      'translate(2.1px, -1.6px)',
    );

    await button.trigger('pointerleave');
    expect(wrapper.get('.ai-brand-bot-eyes-track').attributes('style')).toContain(
      'translate(0px, 0px)',
    );
  });

  it('renders style-specific helper primitives only while edge-docked', async () => {
    const wrapper = mount(FabButton, {
      props: {
        fabHidden: false,
        isOpen: false,
        showFabDuringPanelAnim: false,
        fabDragging: false,
        fabDropActive: false,
        fabLayoutStyle: {},
        ariaLabel: 'Open AI assistant',
        dropHintText: 'Drop files here',
        edgeDock: 'right',
        edgeDockStyle: 'handle-bar',
      },
    });

    expect(wrapper.find('.ai-fab-dock-bar-glow').exists()).toBe(true);
    expect(wrapper.find('.ai-fab-dock-mini-eyes').exists()).toBe(false);

    await wrapper.setProps({ edgeDockStyle: 'eye-strip' });
    expect(wrapper.find('.ai-fab-dock-mini-eyes').exists()).toBe(true);
    expect(wrapper.find('.ai-fab-dock-bar-glow').exists()).toBe(false);

    await wrapper.setProps({ edgeDockStyle: 'nap-lean' });
    expect(wrapper.find('.ai-fab-dock-halo-dot').exists()).toBe(true);
  });
});
