<template>
  <div v-if="toolCalls.length > 0" class="ai-tool-calls">
    <details
      v-for="(tc, tci) in toolCalls"
      :key="tci"
      class="ai-tool-call-item"
      :open="tc.status === 'running'"
    >
      <summary class="ai-tool-call-summary">
        <span class="ai-tool-call-status" :class="'ai-tool-' + tc.status">
          <svg
            v-if="tc.status === 'running'"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="ai-tool-spin"
          >
            <path
              d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
            />
          </svg>
          <svg
            v-else-if="tc.status === 'done'"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
            />
          </svg>
        </span>
        <span class="ai-tool-call-name">{{ tc.name }}</span>
      </summary>
      <div class="ai-tool-call-body">
        <pre v-if="tc.arguments" class="ai-tool-call-args">{{ tc.arguments }}</pre>
        <div v-if="tc.result" class="ai-tool-call-result">
          <span class="ai-tool-result-label">{{ toolResultLabel }}</span>
          <pre class="ai-tool-call-result-pre">{{ tc.result }}</pre>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup lang="ts">
import type { ToolCallEntry } from '../types/message';

defineProps<{
  toolCalls: ToolCallEntry[];
  toolResultLabel: string;
}>();
</script>
