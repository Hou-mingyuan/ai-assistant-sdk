import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import FabButton from './FabButton.vue';

describe('FabButton', () => {
  it('renders the star-only launcher with an accessible hit target', () => {
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
    expect(button.attributes('aria-label')).toBe('Open AI assistant');
    expect(button.find('svg.lucide-sparkles').exists()).toBe(true);
  });
});
