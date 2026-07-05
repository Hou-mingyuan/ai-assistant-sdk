import { computed, type ComputedRef, type Ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import type { AiAssistantOptions } from '../index';

/**
 * Input character-limit + send-availability UI logic extracted from
 * AiAssistant.vue (refactor batch 2).
 *
 * Pure presentation derivations only: it maps the current input text and the
 * host options into the char-count label, near/over-limit warnings and the
 * "why can't I send" reason/action labels the composer renders. Behaviour is
 * identical to the previous inline computed properties.
 */
export interface UseInputConstraintsOptions {
  input: Ref<string>;
  options: AiAssistantOptions;
  t: ComputedRef<I18nMessages>;
}

export function useInputConstraints(deps: UseInputConstraintsOptions) {
  const { input, options, t } = deps;

  const maxUserChars = computed(() => {
    const n = options.maxUserMessageChars;
    return n && n > 0 ? n : 0;
  });

  const charCountLabel = computed(() => {
    if (!maxUserChars.value) return '';
    return `${input.value.length}/${maxUserChars.value}`;
  });

  const charCountNearLimit = computed(() => {
    if (!maxUserChars.value) return false;
    return input.value.length > maxUserChars.value * 0.85;
  });

  const charLimitWarningText = computed(() => {
    if (!maxUserChars.value || !input.value) return '';
    if (input.value.length > maxUserChars.value) {
      return t.value.inputOverLimitWarning.replace('{max}', String(maxUserChars.value));
    }
    if (input.value.length > maxUserChars.value * 0.85) {
      return t.value.inputNearLimitWarning.replace('{max}', String(maxUserChars.value));
    }
    return '';
  });

  const sendBlockedReason = computed(() => {
    if (!input.value.trim()) return '';
    if (!options.baseUrl) return t.value.sendUnavailableNoBackend;
    return '';
  });

  const sendBlockedActionLabel = computed(() => {
    if (!input.value.trim()) return '';
    if (!options.baseUrl) return t.value.diagnosticsUseDefaultBaseUrl;
    return '';
  });

  return {
    maxUserChars,
    charCountLabel,
    charCountNearLimit,
    charLimitWarningText,
    sendBlockedReason,
    sendBlockedActionLabel,
  };
}
