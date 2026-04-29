<template>
  <Teleport to="body">
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
        <div class="ai-personalize-actions">
          <button type="button" class="ai-personalize-done" @click="$emit('close')">
            {{ t.personalizeDone }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { I18nMessages } from '../utils/i18n';

const props = defineProps<{
  open: boolean;
  modelValue: string;
  isDark: boolean;
  disabled: boolean;
  maxChars: number;
  t: I18nMessages;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'update:modelValue', value: string): void;
}>();

const titleId = 'ai-assistant-personalize-title';
const taRef = ref<HTMLTextAreaElement>();

watch(
  () => props.open,
  (v) => {
    if (v) nextTick(() => taRef.value?.focus());
  },
);
</script>
