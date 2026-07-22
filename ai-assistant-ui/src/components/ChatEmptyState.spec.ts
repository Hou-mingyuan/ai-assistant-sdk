import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ChatEmptyState from './ChatEmptyState.vue';

function mountEmptyState() {
  return mount(ChatEmptyState, {
    props: {
      mode: 'chat',
      greeting: 'Hello',
      skillStripLabel: 'Quick skills',
      taskLauncherLabel: 'Browse starter tasks',
      taskLauncherCloseLabel: 'Hide starter tasks',
      starterSectionLabel: 'Recommended tasks',
      capabilitySectionLabel: 'Capabilities',
      templateSectionLabel: 'Templates',
      skills: [{ icon: 'pen-line', label: 'Write', tone: 'violet', prompt: 'Write ' }],
      starters: [
        {
          icon: 'briefcase-business',
          title: 'Draft mail',
          desc: 'Polished tone',
          prompt: 'Draft ',
          tone: 'cyan',
        },
      ],
      capabilityHints: [{ icon: 'command', label: 'Context aware' }],
      promptTemplates: [{ label: 'Weekly report', template: 'Report' }],
    },
  });
}

describe('ChatEmptyState task launcher', () => {
  it('keeps task suggestions collapsed until the user opens the launcher', async () => {
    const wrapper = mountEmptyState();

    expect(wrapper.find('.ai-empty-task-panel').exists()).toBe(false);
    expect(wrapper.find('.ai-empty-task-toggle').attributes('aria-expanded')).toBe('false');

    await wrapper.find('.ai-empty-task-toggle').trigger('click');

    expect(wrapper.find('.ai-empty-task-toggle').attributes('aria-expanded')).toBe('true');
    expect(wrapper.find('.ai-empty-task-panel').text()).toContain('Recommended tasks');
    expect(wrapper.find('.ai-empty-task-panel').text()).toContain('Draft mail');
    expect(wrapper.find('.ai-empty-task-panel').text()).toContain('Capabilities');
    expect(wrapper.find('.ai-empty-task-panel').text()).toContain('Templates');
    expect(wrapper.findAll('.ai-empty-task-panel [data-assistant-icon]')).toHaveLength(3);

    await wrapper.find('.ai-empty-starter').trigger('click');
    expect(wrapper.emitted('apply-starter')?.[0]?.[0]).toMatchObject({ title: 'Draft mail' });
  });
});
