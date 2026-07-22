import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import AssistantHeader from './AssistantHeader.vue';
import type { I18nMessages } from '../utils/i18n';

const t = {
  title: 'Assistant',
  newSession: 'New chat',
  settingsLabel: 'More',
  personalizeTitle: 'Personalize',
  diagnosticsTitle: 'Diagnostics',
  sessionsDrawerTitle: 'All sessions',
  themeToggleToDark: 'Dark mode',
  themeToggleToLight: 'Light mode',
  export: 'Export',
  exportJson: 'Download JSON',
  exportMarkdown: 'Markdown',
  exportServerXlsx: 'Excel',
  exportServerDocx: 'Word',
  exportServerPdf: 'PDF',
  selectModeToggle: 'Select messages',
  clear: 'Clear',
  expandPanel: 'Fullscreen',
  shrinkPanel: 'Exit fullscreen',
  closePanel: 'Close',
  headerSectionCommon: 'Common',
  headerSectionManage: 'Manage',
} as unknown as I18nMessages;

function mountHeader(overrides: Partial<Record<string, unknown>> = {}) {
  return mount(AssistantHeader, {
    props: {
      uid: 'assistant',
      sessionTitle: '',
      panelDragging: false,
      mode: 'chat',
      showSystemPromptUi: true,
      diagnosticsOpen: false,
      panelExpanded: false,
      selectMode: false,
      batchExportMenuOpen: false,
      hasMessages: true,
      loading: false,
      hasBaseUrl: true,
      headerPlugins: [],
      isDark: false,
      t,
      ...overrides,
    },
    attachTo: document.body,
  });
}

describe('AssistantHeader action hierarchy', () => {
  it('keeps fullscreen as a direct header control', async () => {
    const wrapper = mountHeader();

    expect(wrapper.find('.ai-new-session').exists()).toBe(true);
    expect(wrapper.find('.ai-panel-expand').exists()).toBe(true);
    expect(wrapper.find('.ai-header-settings').exists()).toBe(true);
    expect(wrapper.find('.ai-close').exists()).toBe(true);

    await wrapper.find('.ai-panel-expand').trigger('click');
    expect(wrapper.emitted('toggle-panel-expand')).toBeTruthy();

    await wrapper.find('.ai-title').trigger('dblclick');
    expect(wrapper.emitted('toggle-panel-expand')).toHaveLength(2);

    await wrapper.find('.ai-header-settings').trigger('click');
    await wrapper.vm.$nextTick();

    const menuText = wrapper.find('.ai-header-settings-menu').text();
    expect(menuText).toContain('Common');
    expect(menuText).toContain('Export');
    expect(menuText).toContain('Manage');
    expect(menuText).not.toContain('Fullscreen');
    const themeAction = wrapper
      .findAll('.ai-header-settings-item')
      .find((item) => item.text().includes('Dark mode'));
    const selectAction = wrapper
      .findAll('.ai-header-settings-item')
      .find((item) => item.text().includes('Select messages'));
    expect(themeAction?.find('svg').exists()).toBe(true);
    expect(selectAction?.find('svg').exists()).toBe(true);

    wrapper.unmount();
  });
});
