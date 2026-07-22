import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import ArtifactCanvas from './ArtifactCanvas.vue';

describe('ArtifactCanvas actions', () => {
  it('uses semantic icons for run and external-preview actions', () => {
    const wrapper = mount(ArtifactCanvas, {
      props: {
        artifact: {
          id: 'code-1',
          type: 'code',
          title: 'Runnable JavaScript',
          lang: 'js',
          content: 'console.log("ok")',
          status: 'done',
        },
      },
    });

    expect(wrapper.find('.ai-artifact-run-icon').exists()).toBe(true);
    expect(wrapper.find('.ai-artifact-run-icon svg').exists()).toBe(true);
    expect(wrapper.find('.ai-artifact-external-icon svg').exists()).toBe(true);
  });
});
