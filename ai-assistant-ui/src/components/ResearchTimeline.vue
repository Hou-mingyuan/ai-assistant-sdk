<template>
  <div class="ai-agent-steps ai-research-timeline" role="group">
    <div class="ai-research-header">
      <span class="ai-research-spark" aria-hidden="true"></span>
      <span class="ai-research-count">{{ doneCount }}/{{ steps.length }}</span>
      <span v-if="totalElapsedLabel" class="ai-research-elapsed">{{ totalElapsedLabel }}</span>
      <span class="ai-research-progress-track" aria-hidden="true">
        <span class="ai-research-progress-fill" :style="{ width: progressPct + '%' }"></span>
      </span>
    </div>
    <div
      v-for="step in steps"
      :key="step.id"
      class="ai-agent-step ai-research-step"
      :class="'ai-step-' + step.status"
    >
      <span class="ai-agent-step-icon" aria-hidden="true">
        <template v-if="step.status === 'done'">✓</template>
        <template v-else-if="step.status === 'running'">⟳</template>
        <template v-else-if="step.status === 'error'">✗</template>
        <template v-else>○</template>
      </span>
      <span class="ai-agent-step-label">{{ step.label }}</span>
      <span v-if="step.tool" class="ai-research-chip ai-research-chip-tool">{{ step.tool }}</span>
      <span v-if="step.sourceCount" class="ai-research-chip ai-research-chip-src">
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </svg>
        {{ step.sourceCount }}
      </span>
      <span v-if="step.elapsedMs != null" class="ai-research-chip ai-research-chip-time">
        {{ formatElapsed(step.elapsedMs) }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { AgentStep } from '../types/message';

const props = defineProps<{
  steps: AgentStep[];
}>();

const doneCount = computed(() => props.steps.filter((s) => s.status === 'done').length);

const progressPct = computed(() =>
  props.steps.length === 0 ? 0 : Math.round((doneCount.value / props.steps.length) * 100),
);

const totalElapsedMs = computed(() => props.steps.reduce((sum, s) => sum + (s.elapsedMs ?? 0), 0));

const totalElapsedLabel = computed(() =>
  totalElapsedMs.value > 0 ? formatElapsed(totalElapsedMs.value) : '',
);

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
</script>
