<template>
  <Teleport to="body">
    <div
      v-if="show"
      ref="popRef"
      class="ai-inline-trans-pop"
      :class="{ 'ai-dark': isDark }"
      role="dialog"
      aria-live="polite"
      :style="{ left: x + 'px', top: y + 'px', '--primary': color }"
    >
      <div v-if="loading" class="ai-inline-trans-loading">{{ t.replying }}</div>
      <div v-else-if="error" class="ai-inline-trans-error">{{ error }}</div>
      <div v-else class="ai-inline-trans-body">{{ text }}</div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';

defineProps<{
  show: boolean;
  x: number;
  y: number;
  text: string;
  loading: boolean;
  error: string;
  color: string;
  isDark: boolean;
  t: I18nMessages;
}>();

const popRef = ref<HTMLElement | null>(null);

defineExpose({ popRef });
</script>
