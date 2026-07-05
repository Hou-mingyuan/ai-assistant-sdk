import { computed } from 'vue';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../utils/i18n';
import type { AiAssistantOptions } from '../index';
import { formatFormFillToast, useFormAutoFillUi } from './useFormAutoFillUi';

const t = computed(() => getMessages('en'));

function make(formAutoFill: AiAssistantOptions['formAutoFill']) {
  return useFormAutoFillUi({ options: { formAutoFill } as AiAssistantOptions, t });
}

describe('formatFormFillToast', () => {
  it('returns empty string for a missing summary', () => {
    expect(formatFormFillToast(null, 'Filled {filled} ({failed} failed)')).toBe('');
  });

  it('substitutes filled and failed counts into the template', () => {
    expect(formatFormFillToast({ filled: 3, failed: 1 }, 'Filled {filled} ({failed} failed)')).toBe(
      'Filled 3 (1 failed)',
    );
  });
});

describe('useFormAutoFillUi', () => {
  it('is disabled when options.formAutoFill is falsy', () => {
    expect(make(false).formAutoFillEnabled.value).toBe(false);
    expect(make(undefined).formAutoFillEnabled.value).toBe(false);
  });

  it('is enabled for true or an options object', () => {
    expect(make(true).formAutoFillEnabled.value).toBe(true);
    expect(make({}).formAutoFillEnabled.value).toBe(true);
  });

  it('starts with an empty toast text', () => {
    expect(make(true).formAutoFillToastText.value).toBe('');
  });

  it('exposes the dialog/toast handlers without throwing when disabled', () => {
    const ui = make(false);
    expect(typeof ui.onFormAutoFillToggle).toBe('function');
    expect(() => ui.onChatInputPasteText({ text: 'x', event: {} as ClipboardEvent })).not.toThrow();
  });
});
