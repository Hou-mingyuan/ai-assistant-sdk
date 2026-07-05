import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../utils/i18n';
import type { AiAssistantOptions } from '../index';
import { useInputConstraints } from './useInputConstraints';

const t = computed(() => getMessages('en'));
const en = getMessages('en');

function make(input: string, options: Partial<AiAssistantOptions>) {
  return useInputConstraints({
    input: ref(input),
    options: options as AiAssistantOptions,
    t,
  });
}

describe('useInputConstraints', () => {
  it('reports no limit when maxUserMessageChars is unset or non-positive', () => {
    const c = make('hello', { baseUrl: '/api' });
    expect(c.maxUserChars.value).toBe(0);
    expect(c.charCountLabel.value).toBe('');
    expect(c.charCountNearLimit.value).toBe(false);
    expect(c.charLimitWarningText.value).toBe('');
  });

  it('formats the char count label against the configured limit', () => {
    const c = make('hello', { baseUrl: '/api', maxUserMessageChars: 10 });
    expect(c.maxUserChars.value).toBe(10);
    expect(c.charCountLabel.value).toBe('5/10');
  });

  it('flags near-limit once input passes 85% of the max', () => {
    const near = make('123456789', { baseUrl: '/api', maxUserMessageChars: 10 });
    expect(near.charCountNearLimit.value).toBe(true);
    expect(near.charLimitWarningText.value).toContain('10');

    const safe = make('12345', { baseUrl: '/api', maxUserMessageChars: 10 });
    expect(safe.charCountNearLimit.value).toBe(false);
    expect(safe.charLimitWarningText.value).toBe('');
  });

  it('warns when input exceeds the max', () => {
    const over = make('123456789012', { baseUrl: '/api', maxUserMessageChars: 10 });
    expect(over.charLimitWarningText.value).toContain('10');
    expect(over.charLimitWarningText.value).toBe(en.inputOverLimitWarning.replace('{max}', '10'));
  });

  it('blocks sending only when there is input but no backend base URL', () => {
    expect(make('', { baseUrl: '' }).sendBlockedReason.value).toBe('');
    expect(make('hi', { baseUrl: '' }).sendBlockedReason.value).toBe(en.sendUnavailableNoBackend);
    expect(make('hi', { baseUrl: '/api' }).sendBlockedReason.value).toBe('');
  });

  it('offers the default-base-url action label under the same condition', () => {
    expect(make('', { baseUrl: '' }).sendBlockedActionLabel.value).toBe('');
    expect(make('hi', { baseUrl: '' }).sendBlockedActionLabel.value).toBe(
      en.diagnosticsUseDefaultBaseUrl,
    );
    expect(make('hi', { baseUrl: '/api' }).sendBlockedActionLabel.value).toBe('');
  });
});
