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
            type="button"
            role="menuitem"
            class="ai-fab-ctx-item"
            :class="{ 'ai-fab-ctx-item-active': compareMarkActiveForThis && !selectionText }"
            :disabled="(!compareMarkActiveForThis || !!selectionText) && compareSetFull"
            :title="
              compareSetFull && (!compareMarkActiveForThis || selectionText)
                ? t.msgCtxCompareSetFull || 'Compare set is full (max 4)'
                : undefined
            "
            @click="$emit('compareMark')"
          >
            <span class="ai-fab-ctx-label">
              {{
                selectionText
                  ? t.msgCtxCompareMarkSelection || 'Mark selection for Compare'
                  : compareMarkActiveForThis
                    ? t.msgCtxCompareUnmark || 'Unmark as Compare A'
                    : t.msgCtxCompareMark || 'Mark as Compare A'
              }}
            </span>
          </button>
          <button
            v-if="compareMarkActive && (!compareMarkActiveForThis || !!selectionText)"
            type="button"
            role="menuitem"
            class="ai-fab-ctx-item"
            @click="$emit('compareWith')"
          >
            <span class="ai-fab-ctx-label">
              {{
                selectionText
                  ? t.msgCtxCompareWithSelection || 'Compare A vs selection'
                  : compareSetCount >= 2
                    ? t.msgCtxCompareOpenSet || 'Open Compare view'
                    : t.msgCtxCompareWith || 'Compare A vs this'
              }}
            </span>
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
    /** K40: any message is currently in the compare set. */
    compareMarkActive?: boolean;
    /** K40: THIS specific message is in the compare set. */
    compareMarkActiveForThis?: boolean;
    /** K42: current compare set size; used to switch the "open" label. */
    compareSetCount?: number;
    /** K42: true when compareSet is at MAX_COMPARE_SIDES (4); disables Add. */
    compareSetFull?: boolean;
  }>(),
  {
    ttsSupported: false,
    ttsActive: false,
    ttsPaused: false,
    compareMarkActive: false,
    compareMarkActiveForThis: false,
    compareSetCount: 0,
    compareSetFull: false,
  },
);

defineEmits<{
  (e: 'copy'): void;
  (e: 'translate'): void;
  (e: 'delete'): void;
  (e: 'export', fmt: ExportFormat): void;
  (e: 'fork'): void;
  (e: 'tts'): void;
  (e: 'ttsPauseToggle'): void;
  /** K40: mark / unmark this message as the left side of a comparison. */
  (e: 'compareMark'): void;
  /** K40: open the compare dialog with previously-marked A vs this msg. */
  (e: 'compareWith'): void;
}>();
</script>
