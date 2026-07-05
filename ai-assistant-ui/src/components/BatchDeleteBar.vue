<template>
  <div class="ai-batch-delete-bar">
    <span class="ai-batch-delete-count">{{ count }}</span>
    <button type="button" class="ai-batch-delete-btn" @click="$emit('delete')">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6 18 20H6L5 6" />
        <path d="M10 11v5" />
        <path d="M14 11v5" />
      </svg>
      <span>{{ deleteLabel }}</span>
    </button>
    <button type="button" class="ai-batch-cancel-btn" @click="$emit('cancel')">
      {{ cancelLabel }}
    </button>
  </div>
</template>

<script setup lang="ts">
/* Refactor: batch-delete action bar extracted from AiAssistant.vue.
 * Presentational only — behaviour, class names and a11y unchanged. */
defineProps<{ count: number; deleteLabel?: string; cancelLabel?: string }>();
defineEmits<{ (e: 'delete'): void; (e: 'cancel'): void }>();
</script>
