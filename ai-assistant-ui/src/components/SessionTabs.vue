<template>
  <div v-if="sessions.length > 1" class="ai-session-tabs" role="tablist" aria-label="Chat sessions">
    <button
      v-for="s in sessions"
      :key="s.id"
      type="button"
      class="ai-session-tab"
      role="tab"
      :class="{ active: s.id === activeId }"
      :aria-selected="s.id === activeId ? 'true' : 'false'"
      @click="$emit('switch', s.id)"
    >
      <span class="ai-session-tab-label">{{ s.title || newLabel }}</span>
      <span
        v-if="sessions.length > 1"
        class="ai-session-tab-close"
        @click.stop="$emit('delete', s.id)"
      >&times;</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { SessionEntry } from '../composables/useMultiSession'

defineProps<{
  sessions: SessionEntry[]
  activeId: string
  newLabel: string
}>()

defineEmits<{
  (e: 'switch', id: string): void
  (e: 'delete', id: string): void
}>()
</script>
