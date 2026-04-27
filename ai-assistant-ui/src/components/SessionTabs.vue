<template>
  <div v-if="sessions.length > 1" class="ai-session-tabs" role="tablist" :aria-label="tabListLabel">
    <div
      v-for="s in sessions"
      :key="s.id"
      class="ai-session-tab"
      role="tab"
      :class="{ active: s.id === activeId }"
      :aria-selected="s.id === activeId ? 'true' : 'false'"
      :tabindex="s.id === activeId ? 0 : -1"
      @click="$emit('switch', s.id)"
      @keydown.enter="$emit('switch', s.id)"
      @keydown.space.prevent="$emit('switch', s.id)"
    >
      <span class="ai-session-tab-label">{{ s.title || newLabel }}</span>
      <button
        v-if="sessions.length > 1"
        type="button"
        class="ai-session-tab-close"
        :aria-label="closeLabel + ' ' + (s.title || newLabel)"
        tabindex="0"
        @click.stop="$emit('delete', s.id)"
        @keydown.enter.stop="$emit('delete', s.id)"
        @keydown.space.prevent.stop="$emit('delete', s.id)"
      >&times;</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SessionEntry } from '../composables/useMultiSession'

withDefaults(defineProps<{
  sessions: SessionEntry[]
  activeId: string
  newLabel: string
  tabListLabel?: string
  closeLabel?: string
}>(), {
  tabListLabel: 'Chat sessions',
  closeLabel: 'Close',
})

defineEmits<{
  (e: 'switch', id: string): void
  (e: 'delete', id: string): void
}>()
</script>
