<script setup lang="ts">
/**
 * 聊天流内联的 artifact 小卡片：只显示标题/类型/状态，点击在侧边 Canvas 打开。
 * 通过 inject 拿到 ArtifactsController（由 AiAssistant.vue provide）。
 */
import { computed, inject } from 'vue';
import type { Artifact } from '../types/message';
import { ARTIFACTS_KEY } from '../composables/useArtifacts';

const props = defineProps<{ artifact: Artifact }>();

const controller = inject(ARTIFACTS_KEY, null);

const typeIcon = computed(() => {
  switch (props.artifact.type) {
    case 'markdown':
      return '📄';
    case 'html':
      return '🌐';
    case 'svg':
      return '🖼️';
    case 'mermaid':
      return '📊';
    case 'react':
      return '⚛️';
    case 'vue':
      return '🟩';
    default:
      return '💻';
  }
});

const typeLabel = computed(() => {
  const a = props.artifact;
  if (a.type === 'code') return (a.lang || 'code').toUpperCase();
  return a.type.toUpperCase();
});

const isStreaming = computed(() => props.artifact.status === 'streaming');

function open() {
  if (isStreaming.value) return;
  controller?.openArtifact(props.artifact);
}
</script>

<template>
  <button
    type="button"
    class="ai-artifact-card"
    :class="{ 'is-streaming': isStreaming }"
    :disabled="isStreaming"
    @click="open"
  >
    <span class="ai-artifact-card-icon" aria-hidden="true">{{ typeIcon }}</span>
    <span class="ai-artifact-card-body">
      <span class="ai-artifact-card-title">{{ artifact.title }}</span>
      <span class="ai-artifact-card-meta">
        <span class="ai-artifact-card-type">{{ typeLabel }}</span>
        <span v-if="isStreaming" class="ai-artifact-card-status">生成中…</span>
        <span v-else class="ai-artifact-card-open">点击打开 →</span>
      </span>
    </span>
  </button>
</template>
