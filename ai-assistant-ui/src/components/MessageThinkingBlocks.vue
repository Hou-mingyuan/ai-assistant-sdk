<template>
  <details v-if="thinking && !activeStreaming" class="ai-thinking-details">
    <summary class="ai-thinking-summary">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        class="ai-thinking-icon"
      >
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
        />
      </svg>
      {{ thinkingLabel }}
    </summary>
    <!-- eslint-disable vue/no-v-html -->
    <div class="ai-thinking-content" v-html="renderThinking(false)"></div>
    <!-- eslint-enable vue/no-v-html -->
  </details>
  <div v-if="activeStreaming && thinking && !hasVisibleContent" class="ai-thinking-live">
    <span class="ai-thinking-live-label">{{ thinkingLiveLabel }}</span>
    <!-- eslint-disable vue/no-v-html -->
    <div class="ai-thinking-content" v-html="renderThinking(true)"></div>
    <!-- eslint-enable vue/no-v-html -->
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  thinking?: string;
  activeStreaming: boolean;
  hasVisibleContent: boolean;
  thinkingLabel: string;
  thinkingLiveLabel: string;
  renderBubble: (content: string, isLast: boolean) => string;
}>();

function renderThinking(isLast: boolean) {
  return props.renderBubble(props.thinking || '', isLast);
}
</script>
