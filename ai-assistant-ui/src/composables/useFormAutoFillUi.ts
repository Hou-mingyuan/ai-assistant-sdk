import { computed, type ComputedRef } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import type { AiAssistantOptions } from '../index';
import { useFormAutoFill } from './useFormAutoFill';

/**
 * Form auto-fill UI adapter extracted from AiAssistant.vue (refactor batch 7).
 *
 * Normalizes the `options.formAutoFill` switch, owns the underlying
 * useFormAutoFill instance and exposes the thin event handlers + toast text the
 * dialog/toast components bind to. Behaviour identical to the previous inline
 * implementation.
 */

/** Render the fill summary toast text from the template (pure, easy to unit test). */
export function formatFormFillToast(
  summary: { filled: number; failed: number } | null,
  template: string,
): string {
  if (!summary) return '';
  return template
    .replace('{filled}', String(summary.filled))
    .replace('{failed}', String(summary.failed));
}

export interface UseFormAutoFillUiOptions {
  options: AiAssistantOptions;
  t: ComputedRef<I18nMessages>;
}

export function useFormAutoFillUi(deps: UseFormAutoFillUiOptions) {
  const { options, t } = deps;

  const formAutoFillOptions = computed(() => {
    const raw = options.formAutoFill;
    if (!raw) return null;
    if (raw === true) return {};
    return raw;
  });
  const formAutoFillEnabled = computed(() => formAutoFillOptions.value !== null);
  const formAutoFill = useFormAutoFill({
    options: computed(() => formAutoFillOptions.value ?? {}),
  });

  function onChatInputPasteText(payload: { text: string; event: ClipboardEvent }) {
    if (!formAutoFillEnabled.value) return;
    formAutoFill.inspectPasteText(payload.text);
  }

  function onFormAutoFillToggle(idx: number) {
    formAutoFill.toggleSelection(idx);
  }

  function onFormAutoFillToggleAll(checked: boolean) {
    formAutoFill.setAllSelections(checked);
  }

  function onFormAutoFillOverride(payload: { pairIdx: number; fieldId: string | null }) {
    formAutoFill.overrideMatch(payload.pairIdx, payload.fieldId);
  }

  function onFormAutoFillConfirm() {
    formAutoFill.confirmFill();
  }

  function onFormAutoFillUndo() {
    formAutoFill.undoLastFill();
  }

  function onFormAutoFillToastDismiss() {
    formAutoFill.dismissToast();
  }

  const formAutoFillToastText = computed(() =>
    formatFormFillToast(
      formAutoFill.toastSummary.value,
      t.value.formFillToastTemplate || 'Filled {filled} field(s) ({failed} failed)',
    ),
  );

  return {
    formAutoFill,
    formAutoFillEnabled,
    onChatInputPasteText,
    onFormAutoFillToggle,
    onFormAutoFillToggleAll,
    onFormAutoFillOverride,
    onFormAutoFillConfirm,
    onFormAutoFillUndo,
    onFormAutoFillToastDismiss,
    formAutoFillToastText,
  };
}
