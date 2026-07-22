import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ArtifactCard from './ArtifactCard.vue';

describe('ArtifactCard icons', () => {
  it('renders artifact types with an SVG icon instead of emoji', () => {
    const wrapper = mount(ArtifactCard, {
      props: {
        artifact: {
          id: 'artifact-1',
          type: 'markdown',
          title: 'Release notes',
          content: '# Notes',
          status: 'done',
        },
      },
    });

    expect(wrapper.find('.ai-artifact-card-icon svg').exists()).toBe(true);
    expect(wrapper.find('.ai-artifact-card-icon').text()).toBe('');
  });
});
