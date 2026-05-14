<template>
  <Teleport to="body">
    <Transition name="ai-modal">
    <div
      v-if="open"
      class="ai-personalize-overlay"
      :class="{ 'ai-dark': isDark }"
      role="presentation"
      @click.self="$emit('close')"
    >
      <div
        class="ai-personalize-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="titleId"
        @click.stop
      >
        <div class="ai-personalize-head">
          <h2 :id="titleId" class="ai-personalize-title">{{ t.personalizeTitle }}</h2>
          <button
            type="button"
            class="ai-personalize-close"
            :aria-label="t.closePanel"
            @click="$emit('close')"
          >
            &times;
          </button>
        </div>
        <p class="ai-personalize-desc">{{ t.systemPromptPlaceholder }}</p>
        <textarea
          ref="taRef"
          :value="modelValue"
          class="ai-personalize-textarea"
          rows="5"
          :disabled="disabled"
          :maxlength="maxChars"
          :placeholder="t.personalizePlaceholder"
          :aria-label="t.personalizeTitle"
          @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        />
        <div class="ai-personalize-meta" aria-live="polite">
          {{
            t.personalizeCharCount
              .replace('{cur}', String(modelValue.length))
              .replace('{max}', String(maxChars))
          }}
        </div>
        <!-- K25: optional ColorThemeSwitcher row. Only rendered when the host
             actually passes a `theme` prop, so legacy hosts that don't wire it
             see no visual change. -->
        <div v-if="theme !== undefined" class="ai-personalize-theme-row">
          <span class="ai-personalize-theme-label">
            {{ t.personalizeThemeLabel || '主题色 / Theme' }}
          </span>
          <ColorThemeSwitcher
            :model-value="theme"
            @update:model-value="(v) => $emit('update:theme', v)"
          />
        </div>
        <div class="ai-personalize-actions">
          <button type="button" class="ai-personalize-done" @click="$emit('close')">
            {{ t.personalizeDone }}
          </button>
        </div>
      </div>
    </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, defineAsyncComponent } from 'vue';
import type { I18nMessages } from '../utils/i18n';

/* K25: lazy-load ColorThemeSwitcher so the dialog stays slim when the host
 * doesn't wire it. */
const ColorThemeSwitcher = defineAsyncComponent(() => import('./ColorThemeSwitcher.vue'));

const props = defineProps<{
  open: boolean;
  modelValue: string;
  isDark: boolean;
  disabled: boolean;
  maxChars: number;
  t: I18nMessages;
  /** K25: optional theme id (sky / sunset / forest / plum / graphite). */
  theme?: string;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'update:modelValue', value: string): void;
  /** K25: emitted when user clicks a new theme swatch. */
  (e: 'update:theme', value: string): void;
}>();

const titleId = `ai-personalize-title-${Math.random().toString(36).slice(2, 8)}`;
const taRef = ref<HTMLTextAreaElement>();

watch(
  () => props.open,
  (v) => {
    if (v) nextTick(() => taRef.value?.focus());
  },
);
</script>

<style scoped>
/* K25: theme-row styling matches the existing dialog typography spacing. */
.ai-personalize-theme-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding: 8px 0;
}

.ai-personalize-theme-label {
  font-size: 13px;
  color: #475569;
  font-weight: 500;
  white-space: nowrap;
}

.ai-dark .ai-personalize-theme-label {
  color: #cbd5e1;
}
</style>
