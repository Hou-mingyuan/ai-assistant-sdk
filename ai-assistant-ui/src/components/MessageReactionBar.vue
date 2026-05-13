<template>
  <div class="ai-reaction-bar" :class="{ 'has-reactions': hasReactions }">
    <button
      v-for="r in reactions"
      :key="r.emoji"
      type="button"
      :class="['ai-reaction-btn', { active: selected === r.emoji }]"
      :aria-label="r.label"
      :aria-pressed="selected === r.emoji"
      @click="onClick(r.emoji)"
    >
      <span class="ai-reaction-emoji">{{ r.emoji }}</span>
      <span v-if="counts[r.emoji]" class="ai-reaction-count">{{ counts[r.emoji] }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface ReactionDef {
  emoji: string;
  label: string;
}

interface Props {
  messageId: string;
  selected?: string;
  counts?: Record<string, number>;
  reactions?: ReactionDef[];
}

const props = withDefaults(defineProps<Props>(), {
  selected: '',
  counts: () => ({}),
  reactions: () => [
    { emoji: '👍', label: '赞 / Useful' },
    { emoji: '👎', label: '不满意 / Not useful' },
    { emoji: '❤️', label: '喜欢 / Love' },
    { emoji: '⭐', label: '收藏 / Favorite' },
    { emoji: '📋', label: '复制 / Copy' },
  ],
});

const emit = defineEmits<{
  (e: 'reaction', payload: { messageId: string; emoji: string; toggled: boolean }): void;
}>();

const hasReactions = computed(() =>
  Object.values(props.counts).some((c) => c > 0) || !!props.selected,
);

function onClick(emoji: string) {
  const toggled = props.selected === emoji;
  emit('reaction', { messageId: props.messageId, emoji, toggled });
}
</script>

<style scoped>
.ai-reaction-bar {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px solid rgba(226, 232, 240, 0.8);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.06);
  opacity: 0;
  transform: translateY(2px);
  transition: opacity 160ms ease, transform 160ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

.ai-reaction-bar.has-reactions,
.ai-msg-assistant:hover .ai-reaction-bar,
.ai-msg-assistant:focus-within .ai-reaction-bar {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-color-scheme: dark) {
  .ai-reaction-bar {
    background: rgba(15, 23, 42, 0.92);
    border-color: rgba(51, 65, 85, 0.8);
  }
}

.ai-reaction-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 8px;
  border: none;
  background: transparent;
  border-radius: 999px;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  transition:
    background-color 140ms,
    transform 140ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

.ai-reaction-btn:hover {
  background: rgba(14, 165, 233, 0.10);
  transform: scale(1.1);
}

.ai-reaction-btn:active {
  transform: scale(0.92);
}

.ai-reaction-btn.active {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.18), rgba(6, 182, 212, 0.14));
}

.ai-reaction-emoji {
  font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
}

.ai-reaction-count {
  font-size: 11px;
  font-weight: 600;
  color: #0ea5e9;
  font-variant-numeric: tabular-nums;
  min-width: 8px;
  text-align: left;
}

@media (prefers-reduced-motion: reduce) {
  .ai-reaction-bar,
  .ai-reaction-btn {
    transition: none;
  }
}
</style>
