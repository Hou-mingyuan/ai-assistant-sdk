<template>
  <Teleport to="body">
    <Transition name="ai-page-sel">
      <div
        v-if="show"
        class="ai-page-sel-bar"
        :class="{ 'ai-dark': isDark }"
        :style="{ left: x + 'px', top: y + 'px', '--primary': color }"
        role="toolbar"
        aria-label="AI Quick Actions"
        @mousedown.stop
      >
        <button type="button" class="ai-page-sel-btn" @click="$emit('action', 'ask')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
          <span>{{ t.pageSelAsk }}</span>
        </button>
        <button type="button" class="ai-page-sel-btn" @click="$emit('action', 'translate')">
          <span>{{ t.translate }}</span>
        </button>
        <button type="button" class="ai-page-sel-btn" @click="$emit('action', 'summarize')">
          <span>{{ t.summarize }}</span>
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { I18nMessages } from '../utils/i18n'

defineProps<{
  show: boolean
  x: number
  y: number
  color: string
  isDark: boolean
  t: I18nMessages
}>()

defineEmits<{
  (e: 'action', type: 'ask' | 'translate' | 'summarize'): void
}>()
</script>
