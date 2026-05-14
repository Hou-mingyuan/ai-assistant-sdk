<template>
  <ExportToast :text="exportToastText" :color="color" :is-dark="isDark" />

  <PageSelectionBar
    :show="pageSel.show && !assistantOpen"
    :x="pageSel.x"
    :y="pageSel.y"
    :color="color"
    :is-dark="isDark"
    :t="t"
    @action="(action) => emit('page-sel-action', action)"
  />

  <InlineTranslatePopover
    :show="inlineTranslate.show"
    :x="inlineTranslate.x"
    :y="inlineTranslate.y"
    :text="inlineTranslate.text"
    :loading="inlineTranslate.loading"
    :error="inlineTranslate.error"
    :color="color"
    :is-dark="isDark"
    :t="t"
  />
</template>

<script setup lang="ts">
/**
 * AssistantBottomTransients
 * --------------------------
 * Groups the three transient bottom-of-screen popovers that the user only
 * sees for a fraction of a second:
 *
 *  - ExportToast (after a file export)
 *  - PageSelectionBar (when text is selected on the host page)
 *  - InlineTranslatePopover (when the user picks "translate" on a selection)
 *
 * K21 Phase 2 / K34 split-out from AiAssistant.vue. These three share a
 * common visual cluster (bottom-of-viewport popovers) and a low-coupling
 * prop surface (no internal state mutation, no template refs read by the
 * parent), so the extraction is safe and reduces ~25 lines of template
 * + 4 imports from the host file.
 *
 * Why ONE component for THREE popovers: each is too small (3-8 lines of
 * template) to justify its own AsyncComponent chunk, and they always
 * mount/unmount together. Combining them keeps the lazy-chunk count
 * sensible while preserving the K21 "extract first, optimise later"
 * pattern.
 */
import { defineAsyncComponent } from 'vue';
import type { I18nMessages } from '../utils/i18n';

const ExportToast = defineAsyncComponent(() => import('./ExportToast.vue'));
const PageSelectionBar = defineAsyncComponent(() => import('./PageSelectionBar.vue'));
const InlineTranslatePopover = defineAsyncComponent(() => import('./InlineTranslatePopover.vue'));

interface PageSelectionState {
  show: boolean;
  x: number;
  y: number;
  text: string;
}

interface InlineTranslateState {
  show: boolean;
  x: number;
  y: number;
  text: string;
  loading: boolean;
  error: string;
}

defineProps<{
  exportToastText: string;
  color: string;
  isDark: boolean;
  assistantOpen: boolean;
  pageSel: PageSelectionState;
  inlineTranslate: InlineTranslateState;
  t: I18nMessages;
}>();

const emit = defineEmits<{
  (e: 'page-sel-action', action: 'ask' | 'translate' | 'summarize'): void;
}>();
</script>
