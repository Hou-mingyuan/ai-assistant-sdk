<template>
  <div class="ai-reading-preview">
    <div class="ai-reading-preview-head">
      <span class="ai-reading-preview-kicker">阅读摘要</span>
      <button
        type="button"
        class="ai-reading-preview-toggle"
        :aria-expanded="expanded ? 'true' : 'false'"
        @click.stop="emit('toggle')"
      >
        {{ expanded ? '收起原文' : '展开原文' }}
      </button>
    </div>
    <ul class="ai-reading-preview-list">
      <li v-for="(line, lineIdx) in previewLines" :key="`${messageKey}-reading-${lineIdx}`">
        {{ line }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  content: string;
  expanded: boolean;
  messageKey: string;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
}>();

const previewLines = computed(() => {
  const cleaned = props.content
    .replace(/```[\s\S]*?```/g, '代码块内容已收起，可展开原文查看。')
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^#{1,6}\s*/, '')
        .replace(/^[-*+]\s+/, '')
        .replace(/^\d+\.\s+/, '')
        .replace(/\*\*|__|`/g, '')
        .trim(),
    )
    .filter(Boolean);
  const unique: string[] = [];
  for (const line of cleaned) {
    if (unique.includes(line)) continue;
    unique.push(line.length > 92 ? `${line.slice(0, 92)}...` : line);
    if (unique.length >= 4) break;
  }
  return unique.length ? unique : ['这是一段较长回复，已先收起正文，展开后可查看完整内容。'];
});
</script>
