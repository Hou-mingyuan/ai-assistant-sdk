<template>
  <Teleport to="body">
    <Transition name="ai-fab-ctx">
      <div
        v-if="show"
        class="ai-fab-ctx-menu ai-msg-ctx-menu"
        role="menu"
        :style="{ left: x + 'px', top: y + 'px', '--fab-accent': color }"
        @contextmenu.prevent
      >
        <div class="ai-fab-ctx-list">
          <button
            type="button"
            role="menuitem"
            class="ai-fab-ctx-item"
            :disabled="!selectionText"
            :title="!selectionText ? t.msgCtxNeedSelection : undefined"
            @click="$emit('copy')"
          >
            <span class="ai-fab-ctx-label">{{ t.msgCtxCopy }}</span>
          </button>
          <button
            type="button"
            role="menuitem"
            class="ai-fab-ctx-item"
            :disabled="!selectionText"
            :title="!selectionText ? t.msgCtxNeedSelection : undefined"
            @click="$emit('translate')"
          >
            <span class="ai-fab-ctx-label">{{ t.msgCtxTranslate }}</span>
          </button>
          <button type="button" role="menuitem" class="ai-fab-ctx-item" @click="$emit('delete')">
            <span class="ai-fab-ctx-label">{{ t.msgCtxDelete }}</span>
          </button>
          <button type="button" role="menuitem" class="ai-fab-ctx-item" @click="$emit('fork')">
            <span class="ai-fab-ctx-label">{{ t.msgCtxFork }}</span>
          </button>
          <button
            v-if="ttsSupported"
            type="button"
            role="menuitem"
            class="ai-fab-ctx-item"
            @click="$emit('tts')"
          >
            <span class="ai-fab-ctx-label">{{ ttsActive ? t.ttsStop : t.ttsPlay }}</span>
          </button>
          <button
            v-if="ttsSupported && ttsActive"
            type="button"
            role="menuitem"
            class="ai-fab-ctx-item"
            @click="$emit('ttsPauseToggle')"
          >
            <span class="ai-fab-ctx-label">{{ ttsPaused ? t.ttsResume : t.ttsPause }}</span>
          </button>
          <template v-if="hasBaseUrl">
            <button
              type="button"
              role="menuitem"
              class="ai-fab-ctx-item"
              :disabled="exportBusy"
              :title="exportBusy ? t.exportPreparing : undefined"
              @click="$emit('export', 'docx')"
            >
              <span class="ai-fab-ctx-label">{{ t.msgCtxExportDocx }}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              class="ai-fab-ctx-item"
              :disabled="exportBusy"
              :title="exportBusy ? t.exportPreparing : undefined"
              @click="$emit('export', 'pdf')"
            >
              <span class="ai-fab-ctx-label">{{ t.msgCtxExportPdf }}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              class="ai-fab-ctx-item"
              :disabled="exportBusy"
              :title="exportBusy ? t.exportPreparing : undefined"
              @click="$emit('export', 'xlsx')"
            >
              <span class="ai-fab-ctx-label">{{ t.msgCtxExportXlsx }}</span>
            </button>
          </template>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { I18nMessages } from '../utils/i18n';
import type { ExportFormat } from '../utils/api';

withDefaults(
  defineProps<{
    show: boolean;
    x: number;
    y: number;
    color: string;
    selectionText: string;
    hasBaseUrl: boolean;
    exportBusy: boolean;
    t: I18nMessages;
    ttsSupported?: boolean;
    ttsActive?: boolean;
    ttsPaused?: boolean;
  }>(),
  { ttsSupported: false, ttsActive: false, ttsPaused: false },
);

defineEmits<{
  (e: 'copy'): void;
  (e: 'translate'): void;
  (e: 'delete'): void;
  (e: 'export', fmt: ExportFormat): void;
  (e: 'fork'): void;
  (e: 'tts'): void;
  (e: 'ttsPauseToggle'): void;
}>();
</script>
