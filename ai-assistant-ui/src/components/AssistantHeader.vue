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
      <div class="ai-header-settings-wrap">
        <button
          type="button"
          class="ai-header-settings"
          :title="t.settingsLabel || 'More'"
          :aria-label="t.settingsLabel || 'More'"
          :aria-haspopup="'menu'"
          :aria-expanded="settingsMenuOpen ? 'true' : 'false'"
          @click.stop="settingsMenuOpen = !settingsMenuOpen"
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
        </button>
        <div v-if="settingsMenuOpen" class="ai-header-settings-menu" role="menu">
          <button
            v-if="mode === 'chat' && showSystemPromptUi"
            type="button"
            role="menuitem"
            class="ai-header-settings-item"
            @click="onSettingsPick('personalize')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"
              />
            </svg>
            <span>{{ t.personalizeTitle }}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            class="ai-header-settings-item"
            @click="onSettingsPick('diagnostics')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path
                d="M3 3v18h18v-2H5V3H3zm14 14l-4-4-2 2-4-4 1.41-1.41L11 12.17 13 10l5 5L17 17z"
              />
            </svg>
            <span>{{ t.diagnosticsTitle }}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            class="ai-header-settings-item"
            @click="onSettingsPick('sessions')"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3 5h18v2H3V5zm0 4h18v2H3V9zm0 4h18v2H3v-2zm0 4h18v2H3v-2z" />
            </svg>
            <span>{{ t.sessionsDrawerTitle || 'All sessions' }}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            class="ai-header-settings-item"
            @click="
              settingsMenuOpen = false;
              emit('start-new-session');
            "
          >
            <span aria-hidden="true">+</span>
            <span>{{ t.newSession }}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            class="ai-header-settings-item"
            @click="
              settingsMenuOpen = false;
              emit('toggle-theme');
            "
          >
            <span aria-hidden="true">{{ isDark ? '☼' : '☾' }}</span>
            <span>{{ themeToggleLabel }}</span>
          </button>
          <template v-if="hasMessages">
            <button
              type="button"
              role="menuitem"
              class="ai-header-settings-item"
              @click="
                settingsMenuOpen = false;
                emit('batch-export-all-json');
              "
            >
              <span aria-hidden="true">JSON</span>
              <span>{{ t.exportJson }}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              class="ai-header-settings-item"
              @click="
                settingsMenuOpen = false;
                emit('batch-export-all-markdown');
              "
            >
              <span aria-hidden="true">MD</span>
              <span>{{ t.exportMarkdown }}</span>
            </button>
            <button
              v-if="hasBaseUrl"
              type="button"
              role="menuitem"
              class="ai-header-settings-item"
              @click="
                settingsMenuOpen = false;
                emit('batch-export-all-server', 'xlsx');
              "
            >
              <span aria-hidden="true">XLSX</span>
              <span>{{ t.exportServerXlsx }}</span>
            </button>
            <button
              v-if="hasBaseUrl"
              type="button"
              role="menuitem"
              class="ai-header-settings-item"
              @click="
                settingsMenuOpen = false;
                emit('batch-export-all-server', 'docx');
              "
            >
              <span aria-hidden="true">DOCX</span>
              <span>{{ t.exportServerDocx }}</span>
            </button>
            <button
              v-if="hasBaseUrl"
              type="button"
              role="menuitem"
              class="ai-header-settings-item"
              @click="
                settingsMenuOpen = false;
                emit('batch-export-all-server', 'pdf');
              "
            >
              <span aria-hidden="true">PDF</span>
              <span>{{ t.exportServerPdf }}</span>
            </button>
            <button
              v-if="!loading"
              type="button"
              role="menuitem"
              class="ai-header-settings-item"
              :aria-pressed="selectMode"
              @click="
                settingsMenuOpen = false;
                emit('toggle-select-mode');
              "
            >
              <span aria-hidden="true">☑</span>
              <span>{{ t.selectModeToggle }}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              class="ai-header-settings-item"
              @click="
                settingsMenuOpen = false;
                emit('clear-messages');
              "
            >
              <span aria-hidden="true">×</span>
              <span>{{ t.clear }}</span>
            </button>
          </template>
          <button
            v-for="pl in headerPlugins"
            :key="pl.id"
            type="button"
            role="menuitem"
            class="ai-header-settings-item"
            @click="
              settingsMenuOpen = false;
              emit('run-plugin', pl);
            "
          >
            <span aria-hidden="true">{{ pl.icon || pl.label.charAt(0) }}</span>
            <span>{{ pl.label }}</span>
          </button>
        </div>
      </div>
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
import { computed, ref, onMounted, onBeforeUnmount, type PropType } from 'vue';
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
  (e: 'open-sessions-drawer'): void;
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
  props.isDark
    ? props.t.themeToggleToLight || 'Light mode'
    : props.t.themeToggleToDark || 'Dark mode',
);

/* D2: Settings menu (聚合 personalize + diagnostics 入口) */
const settingsMenuOpen = ref(false);

function onSettingsPick(kind: 'personalize' | 'diagnostics' | 'sessions') {
  settingsMenuOpen.value = false;
  if (kind === 'personalize') emit('open-personalize');
  else if (kind === 'diagnostics') emit('toggle-diagnostics');
  else emit('open-sessions-drawer');
}

function onClickOutsideSettings(event: MouseEvent) {
  if (!settingsMenuOpen.value) return;
  const t = event.target as HTMLElement | null;
  if (t && t.closest('.ai-header-settings-wrap')) return;
  settingsMenuOpen.value = false;
}
onMounted(() => document.addEventListener('mousedown', onClickOutsideSettings));
onBeforeUnmount(() => document.removeEventListener('mousedown', onClickOutsideSettings));
</script>
