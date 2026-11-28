<template>
  <div
    class="ai-header"
    :class="{ 'ai-header-dragging': panelDragging }"
    @pointerdown="emit('pointerdown-header', $event)"
    @dblclick="onHeaderDblclick"
  >
    <span :id="`${uid}-title`" class="ai-title" :title="t.title">
      <span v-if="hasMessages" class="ai-header-brand-badge" aria-hidden="true">
        <BrandMark
          class="ai-header-brand-icon"
          :size="15"
          :active="loading"
          data-assistant-icon="sparkles"
        />
      </span>
      <span class="ai-title-meta">
        <span class="ai-title-text">{{ t.title }}</span>
        <span v-if="selectedModel" class="ai-title-subtitle">{{ selectedModel }}</span>
      </span>
    </span>
    <span class="ai-header-spacer" aria-hidden="true" />
    <div class="ai-header-actions">
      <button
        type="button"
        class="ai-new-session"
        :title="t.newSession"
        :aria-label="t.newSession"
        @click.stop="emit('start-new-session')"
      >
        <AssistantIcon name="plus" :size="15" :stroke-width="1.9" />
      </button>
      <button
        type="button"
        class="ai-header-sessions"
        :title="t.sessionsDrawerTitle || 'All sessions'"
        :aria-label="t.sessionsDrawerTitle || 'All sessions'"
        @click.stop="emit('open-sessions-drawer')"
      >
        <AssistantIcon name="history" :size="15" :stroke-width="1.9" />
      </button>
      <button
        type="button"
        class="ai-panel-expand"
        :class="{ 'ai-panel-expand-active': panelExpanded }"
        :title="panelExpanded ? t.shrinkPanel : t.expandPanel"
        :aria-label="panelExpanded ? t.shrinkPanel : t.expandPanel"
        :aria-pressed="panelExpanded ? 'true' : 'false'"
        @click.stop="emit('toggle-panel-expand')"
      >
        <AssistantIcon
          :name="panelExpanded ? 'minimize-2' : 'maximize-2'"
          :size="15"
          :stroke-width="1.9"
        />
      </button>
      <button
        type="button"
        class="ai-header-theme-toggle"
        :title="themeToggleLabel"
        :aria-label="themeToggleLabel"
        @click.stop="emit('toggle-theme')"
      >
        <AssistantIcon :name="isDark ? 'sun' : 'moon'" :size="15" :stroke-width="1.9" />
      </button>
      <button
        type="button"
        class="ai-header-settings"
        :class="{ 'ai-header-settings-active': settingsOpen }"
        :title="settingsTitleLabel"
        :aria-label="settingsTitleLabel"
        :aria-pressed="settingsOpen ? 'true' : 'false'"
        @click.stop="emit('toggle-dock-settings')"
      >
        <AssistantIcon name="sliders-horizontal" :size="15" :stroke-width="1.9" />
      </button>
      <button
        v-if="hasMessages && !loading"
        type="button"
        class="ai-header-clear"
        :title="t.clear"
        :aria-label="t.clear"
        @click.stop="emit('clear-messages')"
      >
        <AssistantIcon name="trash-2" :size="15" :stroke-width="1.9" />
      </button>
      <button
        type="button"
        class="ai-close"
        :aria-label="t.closePanel"
        @click="emit('close-panel')"
      >
        <AssistantIcon name="x" :size="15" :stroke-width="1.9" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue';
import AssistantIcon from './AssistantIcon.vue';
import BrandMark from './BrandMark.vue';
import type { I18nMessages } from '../utils/i18n/types';

const props = defineProps({
  uid: {
    type: String,
    required: true,
  },
  selectedModel: {
    type: String,
    default: '',
  },
  panelDragging: {
    type: Boolean,
    required: true,
  },
  panelExpanded: {
    type: Boolean,
    required: true,
  },
  hasMessages: {
    type: Boolean,
    required: true,
  },
  loading: {
    type: Boolean,
    required: true,
  },
  isDark: {
    type: Boolean,
    required: true,
  },
  settingsOpen: {
    type: Boolean,
    default: false,
  },
  t: {
    type: Object as PropType<I18nMessages>,
    required: true,
  },
});

const emit = defineEmits<{
  (e: 'pointerdown-header', event: PointerEvent): void;
  (e: 'open-sessions-drawer'): void;
  (e: 'toggle-panel-expand'): void;
  (e: 'toggle-theme'): void;
  (e: 'toggle-dock-settings'): void;
  (e: 'start-new-session'): void;
  (e: 'clear-messages'): void;
  (e: 'close-panel'): void;
}>();

const themeToggleLabel = computed(() =>
  props.isDark
    ? props.t.themeToggleToLight || 'Light mode'
    : props.t.themeToggleToDark || 'Dark mode',
);

const settingsTitleLabel = computed(
  () => props.t.assistantSettingsTitle || props.t.edgeDockSettingsTitle || 'Settings',
);

function onHeaderDblclick(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest('button, a, input, textarea, select')) return;
  emit('toggle-panel-expand');
}
</script>
