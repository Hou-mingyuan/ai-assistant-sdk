<template>
  <button type="button" class="ai-scroll-bottom-btn" :aria-label="label" @click="$emit('click')">
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2.2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </svg>
  </button>
</template>

<script setup lang="ts">
/* Refactor: scroll-to-bottom button extracted from AiAssistant.vue.
 * Presentational only — behaviour, class names and a11y unchanged. */
defineProps<{ label?: string }>();
defineEmits<{ (e: 'click'): void }>();
</script>
