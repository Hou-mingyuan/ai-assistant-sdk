<template>
  <Teleport to="body">
    <Transition name="ai-fab-ctx">
      <div
        v-if="show"
        class="ai-fab-ctx-menu"
        :class="{ 'ai-dark': isDark }"
        :style="{ left: x + 'px', top: y + 'px', '--fab-accent': color }"
        role="menu"
        @click.stop
      >
        <div class="ai-fab-ctx-head">
          <span class="ai-fab-ctx-head-dot" aria-hidden="true" />
          <span class="ai-fab-ctx-head-text">{{ t.title }}</span>
        </div>
        <div class="ai-fab-ctx-list">
          <button
            v-if="edgeDock !== 'left'"
            type="button"
            role="menuitem"
            class="ai-fab-ctx-item"
            @click="$emit('dock', 'left')"
          >
            <span class="ai-fab-ctx-icon-wrap" aria-hidden="true">
              <svg class="ai-fab-ctx-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3.5" y="5" width="17" height="14" rx="2.5" opacity="0.9" />
                <line x1="9.25" y1="5" x2="9.25" y2="19" opacity="0.95" />
              </svg>
            </span>
            <span class="ai-fab-ctx-label">{{ t.fabDockLeft }}</span>
          </button>
          <button
            v-if="edgeDock !== 'right'"
            type="button"
            role="menuitem"
            class="ai-fab-ctx-item"
            @click="$emit('dock', 'right')"
          >
            <span class="ai-fab-ctx-icon-wrap" aria-hidden="true">
              <svg class="ai-fab-ctx-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3.5" y="5" width="17" height="14" rx="2.5" opacity="0.9" />
                <line x1="14.75" y1="5" x2="14.75" y2="19" opacity="0.95" />
              </svg>
            </span>
            <span class="ai-fab-ctx-label">{{ t.fabDockRight }}</span>
          </button>
          <button
            v-if="edgeDock !== 'none'"
            type="button"
            role="menuitem"
            class="ai-fab-ctx-item"
            @click="$emit('dock', 'none')"
          >
            <span class="ai-fab-ctx-icon-wrap" aria-hidden="true">
              <svg class="ai-fab-ctx-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3.2" />
                <path d="M12 4.25v2.35M12 17.4v2.35M4.25 12h2.35M17.4 12h2.35" />
              </svg>
            </span>
            <span class="ai-fab-ctx-label">{{ t.fabUndock }}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            class="ai-fab-ctx-item"
            @click="$emit('hide')"
          >
            <span class="ai-fab-ctx-icon-wrap" aria-hidden="true">
              <svg class="ai-fab-ctx-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                <line x1="4" y1="4" x2="20" y2="20" />
              </svg>
            </span>
            <span class="ai-fab-ctx-label">{{ t.fabHideUntilRefresh }}</span>
          </button>
        </div>
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
  edgeDock: 'none' | 'left' | 'right'
  t: I18nMessages
}>()

defineEmits<{
  (e: 'dock', edge: 'none' | 'left' | 'right'): void
  (e: 'hide'): void
}>()
</script>
