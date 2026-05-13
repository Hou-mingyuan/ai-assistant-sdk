<template>
  <div
    class="ai-header"
    :class="{ 'ai-header-dragging': panelDragging }"
    @pointerdown="emit('pointerdown-header', $event)"
  >
    <span :id="`${uid}-title`" class="ai-title" :title="t.title">
      {{ t.title }}
    </span>
    <span class="ai-header-spacer" aria-hidden="true" />
    <div class="ai-header-actions">
      <button
        v-if="mode === 'chat' && showSystemPromptUi"
        type="button"
        class="ai-header-personalize"
        :title="t.personalizeTitle"
        :aria-label="t.personalizeTitle"
        @click.stop="emit('open-personalize')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path
            d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span class="ai-header-personalize-text">{{ t.personalizeTitle }}</span>
      </button>
      <button
        v-if="mode === 'chat'"
        type="button"
        class="ai-header-diagnostics"
        :title="t.diagnosticsTitle"
        :aria-label="t.diagnosticsTitle"
        :aria-pressed="diagnosticsOpen ? 'true' : 'false'"
        :aria-controls="`${uid}-diagnostics`"
        @click.stop="emit('toggle-diagnostics')"
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M3 3v18h18" />
          <path d="M7 14l3-3 3 2 5-6" />
          <path d="M18 7h-4" />
          <path d="M18 7v4" />
        </svg>
        <span class="ai-header-diagnostics-text">{{ t.diagnosticsTitle }}</span>
      </button>
      <button
        v-for="pl in headerPlugins"
        :key="pl.id"
        type="button"
        class="ai-plugin-btn"
        :title="pl.label"
        :aria-label="pl.label"
        @click.stop="emit('run-plugin', pl)"
      >
        {{ pl.icon || pl.label.charAt(0) }}
      </button>
      <button
        type="button"
        class="ai-new-session"
        :title="t.newSession"
        :aria-label="t.newSession"
        @click="emit('start-new-session')"
      >
        +
      </button>
      <div v-if="hasMessages" class="ai-batch-export-wrap">
        <button
          type="button"
          class="ai-batch-export-btn"
          :title="t.batchExport"
          :aria-label="t.batchExport"
          @click.stop="emit('toggle-batch-export-menu')"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
          </svg>
        </button>
        <div v-if="batchExportMenuOpen" class="ai-batch-export-menu">
          <button type="button" @click="emit('batch-export-all-json')">
            {{ t.exportJson }}
          </button>
          <button type="button" @click="emit('batch-export-all-markdown')">
            {{ t.exportMarkdown }}
          </button>
          <button v-if="hasBaseUrl" type="button" @click="emit('batch-export-all-server', 'xlsx')">
            {{ t.exportServerXlsx }}
          </button>
          <button v-if="hasBaseUrl" type="button" @click="emit('batch-export-all-server', 'docx')">
            {{ t.exportServerDocx }}
          </button>
          <button v-if="hasBaseUrl" type="button" @click="emit('batch-export-all-server', 'pdf')">
            {{ t.exportServerPdf }}
          </button>
        </div>
      </div>
      <button
        v-if="hasMessages && !loading"
        type="button"
        class="ai-header-btn"
        :class="{ active: selectMode }"
        :title="t.selectModeToggle"
        :aria-label="t.selectModeToggle"
        :aria-pressed="selectMode"
        @click="emit('toggle-select-mode')"
      >
        ☑
      </button>
      <button
        v-if="hasMessages"
        type="button"
        class="ai-clear"
        :title="t.clear"
        :aria-label="t.clear"
        @click="emit('clear-messages')"
      >
        &#x1f5d1;
      </button>
      <button
        type="button"
        class="ai-theme-toggle"
        :title="themeToggleLabel"
        :aria-label="themeToggleLabel"
        @click.stop="emit('toggle-theme')"
      >
        <!-- 太阳：当前 dark，点击切到 light -->
        <svg
          v-if="isDark"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
        <!-- 太阳：当前 light，下一步切到 dark -->
        <svg
          v-else
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </button>
      <button
        type="button"
        class="ai-expand"
        :title="panelExpanded ? t.shrinkPanel : t.expandPanel"
        :aria-label="panelExpanded ? t.shrinkPanel : t.expandPanel"
        :aria-pressed="panelExpanded ? 'true' : 'false'"
        @click.stop="emit('toggle-panel-expand')"
      >
        <svg
          v-if="!panelExpanded"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="5" y="5" width="14" height="14" rx="2.5" />
        </svg>
        <svg
          v-else
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <rect x="4" y="9" width="11" height="11" rx="2.25" />
          <rect x="9" y="4" width="11" height="11" rx="2.25" />
        </svg>
      </button>
      <button
        type="button"
        class="ai-close"
        :aria-label="t.closePanel"
        @click="emit('close-panel')"
      >
        &times;
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, type PropType } from 'vue';
import type { I18nMessages } from '../utils/i18n/types';
import type { AiPlugin } from '../composables/usePluginRegistry';

const props = defineProps({
  uid: {
    type: String,
    required: true,
  },
  sessionTitle: {
    type: String,
    default: '',
  },
  panelDragging: {
    type: Boolean,
    required: true,
  },
  mode: {
    type: String,
    required: true,
  },
  showSystemPromptUi: {
    type: Boolean,
    required: true,
  },
  diagnosticsOpen: {
    type: Boolean,
    required: true,
  },
  panelExpanded: {
    type: Boolean,
    required: true,
  },
  selectMode: {
    type: Boolean,
    required: true,
  },
  batchExportMenuOpen: {
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
  hasBaseUrl: {
    type: Boolean,
    required: true,
  },
  headerPlugins: {
    type: Array as PropType<AiPlugin[]>,
    default: () => [],
  },
  isDark: {
    type: Boolean,
    required: true,
  },
  t: {
    type: Object as PropType<I18nMessages>,
    required: true,
  },
});

const emit = defineEmits<{
  (e: 'pointerdown-header', event: PointerEvent): void;
  (e: 'open-personalize'): void;
  (e: 'toggle-diagnostics'): void;
  (e: 'toggle-panel-expand'): void;
  (e: 'toggle-theme'): void;
  (e: 'run-plugin', plugin: AiPlugin): void;
  (e: 'start-new-session'): void;
  (e: 'toggle-batch-export-menu'): void;
  (e: 'batch-export-all-json'): void;
  (e: 'batch-export-all-markdown'): void;
  (e: 'batch-export-all-server', kind: 'xlsx' | 'docx' | 'pdf'): void;
  (e: 'toggle-select-mode'): void;
  (e: 'clear-messages'): void;
  (e: 'close-panel'): void;
}>();

const themeToggleLabel = computed(() =>
  props.isDark ? props.t.themeToggleToLight || 'Light mode' : props.t.themeToggleToDark || 'Dark mode',
);
</script>
