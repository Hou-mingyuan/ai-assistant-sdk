import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';

import FormAutoFillDialog from './FormAutoFillDialog.vue';
import type { I18nMessages } from '../utils/i18n';
import type { MatchResult } from '../utils/formAutoFill/matcher';
import type { FormField } from '../utils/formAutoFill/scanner';

const field = {
  el: document.createElement('input'),
  els: [],
  type: 'text',
  labels: ['Name'],
  currentValue: '',
  options: [],
  id: 'name',
  visible: true,
} satisfies FormField;

const matches = [
  {
    pair: { key: 'Name', value: 'Ada', raw: 'Name: Ada' },
    field,
    confidence: 100,
    strategy: 'exact',
    matchedLabel: 'Name',
  },
] satisfies MatchResult[];

function mountDialog(t: Partial<I18nMessages> = {}) {
  return mount(FormAutoFillDialog, {
    props: {
      open: true,
      isDark: false,
      t: {
        closePanel: 'Close',
        formFillSelectRowTemplate: '选择第 {n} 行',
        ...t,
      } as I18nMessages,
      matches,
      selectedIndices: new Set([0]),
      availableFields: [field],
      llmFallbackHinted: false,
      tableInfo: null,
    },
    attachTo: document.body,
  });
}

describe('FormAutoFillDialog accessibility labels', () => {
  it('localizes each row checkbox label', () => {
    const wrapper = mountDialog();
    const rowCheckbox = document.body.querySelector<HTMLInputElement>(
      'tbody input[type="checkbox"]',
    );

    expect(rowCheckbox?.getAttribute('aria-label')).toBe('选择第 1 行');

    wrapper.unmount();
  });
});
