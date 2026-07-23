import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ColorThemeSwitcher from './ColorThemeSwitcher.vue';

describe('ColorThemeSwitcher', () => {
  it('renders accessible technology presets and emits the selected tone', async () => {
    const wrapper = mount(ColorThemeSwitcher, {
      props: { modelValue: 'graphite' },
    });

    const group = wrapper.get('[role="radiogroup"]');
    const radios = group.findAll('[role="radio"]');

    expect(group.attributes('aria-label')).toBe('界面色调 / Interface tone');
    expect(radios).toHaveLength(5);
    expect(radios.map((radio) => radio.attributes('title'))).toEqual([
      'Obsidian',
      'Cobalt',
      'Pulse',
      'Circuit',
      'Ember',
    ]);
    expect(radios[0]?.attributes('aria-checked')).toBe('true');

    await radios[1]?.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['sky']]);
  });
});
