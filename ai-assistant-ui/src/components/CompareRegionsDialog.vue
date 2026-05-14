<template>
  <Teleport to="body">
    <Transition name="ai-modal">
      <div
        v-if="open"
        class="ai-personalize-overlay ai-compare-regions-overlay"
        :class="{ 'ai-dark': isDark }"
        role="presentation"
        @click.self="$emit('close')"
        @keydown.esc.stop.prevent="$emit('close')"
      >
        <div
          ref="dialogRef"
          class="ai-personalize-dialog ai-compare-regions-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          tabindex="-1"
          @click.stop
        >
          <div class="ai-personalize-head">
            <h2 :id="titleId" class="ai-personalize-title">
              {{ t.compareDialogTitle || 'Compare regions' }}
            </h2>
            <button
              type="button"
              class="ai-personalize-close"
              :aria-label="t.closePanel"
              @click="$emit('close')"
            >
              &times;
            </button>
          </div>

          <div class="ai-compare-stats" role="status" aria-live="polite">
            <span class="ai-compare-stat ai-compare-stat-equal"> {{ summary.equal }} = </span>
            <span class="ai-compare-stat ai-compare-stat-change"> {{ summary.changed }} ~ </span>
            <span class="ai-compare-stat ai-compare-stat-add"> +{{ summary.added }} </span>
            <span class="ai-compare-stat ai-compare-stat-remove"> -{{ summary.removed }} </span>
            <span class="ai-compare-stat ai-compare-stat-delta"> Δ {{ summary.delta }} </span>
            <span class="ai-compare-stats-spacer" />
            <label class="ai-compare-stats-toggle">
              <input v-model="hideEqual" type="checkbox" />
              <span>{{ t.compareDialogHideEqual || 'Hide unchanged' }}</span>
            </label>
          </div>

          <div class="ai-compare-pair-head">
            <div class="ai-compare-pair-head-left">
              <span class="ai-compare-pair-badge ai-compare-pair-badge-a">A</span>
              <span class="ai-compare-pair-label">{{
                leftLabel || t.compareDialogLeftDefault || 'Side A'
              }}</span>
            </div>
            <div class="ai-compare-pair-head-right">
              <span class="ai-compare-pair-badge ai-compare-pair-badge-b">B</span>
              <span class="ai-compare-pair-label">{{
                rightLabel || t.compareDialogRightDefault || 'Side B'
              }}</span>
            </div>
          </div>

          <div v-if="rows.length === 0" class="ai-compare-empty">
            {{ t.compareDialogEmpty || 'No content to compare.' }}
          </div>

          <div v-else class="ai-compare-rows" role="table">
            <div
              v-for="(row, idx) in visibleRows"
              :key="idx"
              class="ai-compare-row"
              :class="`ai-compare-row-${row.kind}`"
              role="row"
            >
              <div class="ai-compare-cell ai-compare-cell-num" role="cell">
                {{ row.leftLine ?? '' }}
              </div>
              <div class="ai-compare-cell ai-compare-cell-left" role="cell">
                <pre class="ai-compare-pre">{{ row.leftText }}</pre>
              </div>
              <div class="ai-compare-cell ai-compare-cell-num" role="cell">
                {{ row.rightLine ?? '' }}
              </div>
              <div class="ai-compare-cell ai-compare-cell-right" role="cell">
                <pre class="ai-compare-pre">{{ row.rightText }}</pre>
              </div>
            </div>
          </div>

          <div class="ai-personalize-actions">
            <button
              type="button"
              class="ai-personalize-done ai-compare-swap"
              @click="$emit('swap')"
            >
              {{ t.compareDialogSwap || 'Swap A ⇄ B' }}
            </button>
            <button type="button" class="ai-personalize-done" @click="$emit('close')">
              {{ t.personalizeDone || 'Done' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import { diffLines } from '../composables/useLineDiff';

const props = defineProps<{
  open: boolean;
  isDark: boolean;
  t: I18nMessages;
  /** Left text (side A). */
  leftText: string;
  /** Right text (side B). */
  rightText: string;
  /** Optional human-readable labels (e.g. "Msg #4 (assistant)"). */
  leftLabel?: string;
  rightLabel?: string;
}>();

defineEmits<{
  (e: 'close'): void;
  (e: 'swap'): void;
}>();

const titleId = `ai-compare-title-${Math.random().toString(36).slice(2, 8)}`;
const hideEqual = ref(false);
/** K41 a11y: focus target so Esc / Tab work the moment the dialog opens. */
const dialogRef = ref<HTMLDivElement>();
watch(
  () => props.open,
  (v) => {
    if (v) {
      void nextTick(() => {
        dialogRef.value?.focus();
      });
    }
  },
);

const diff = computed(() => diffLines(props.leftText ?? '', props.rightText ?? ''));
const rows = computed(() => diff.value.rows);
const summary = computed(() => diff.value.summary);
const visibleRows = computed(() =>
  hideEqual.value ? rows.value.filter((r) => r.kind !== 'equal') : rows.value,
);
</script>

<style scoped>
.ai-compare-regions-dialog {
  width: min(960px, calc(100vw - 32px));
  max-width: none;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}

.ai-compare-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0 10px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  font-size: 12px;
  color: #475569;
  font-variant-numeric: tabular-nums;
}

.ai-dark .ai-compare-stats {
  color: #cbd5e1;
  border-bottom-color: rgba(71, 85, 105, 0.45);
}

.ai-compare-stat {
  display: inline-flex;
  padding: 1px 8px;
  border-radius: 4px;
  font-weight: 600;
  background: rgba(148, 163, 184, 0.18);
}

.ai-compare-stat-equal {
  background: rgba(148, 163, 184, 0.18);
}
.ai-compare-stat-change {
  background: rgba(250, 204, 21, 0.18);
  color: #92400e;
}
.ai-dark .ai-compare-stat-change {
  color: #fef3c7;
}
.ai-compare-stat-add {
  background: rgba(34, 197, 94, 0.18);
  color: #15803d;
}
.ai-dark .ai-compare-stat-add {
  color: #bbf7d0;
}
.ai-compare-stat-remove {
  background: rgba(239, 68, 68, 0.18);
  color: #b91c1c;
}
.ai-dark .ai-compare-stat-remove {
  color: #fecaca;
}
.ai-compare-stat-delta {
  background: rgba(59, 130, 246, 0.18);
  color: #1d4ed8;
}
.ai-dark .ai-compare-stat-delta {
  color: #bfdbfe;
}
.ai-compare-stats-spacer {
  flex: 1 1 auto;
}
.ai-compare-stats-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  font-weight: 500;
}
.ai-compare-stats-toggle input[type='checkbox'] {
  accent-color: #3b82f6;
  cursor: pointer;
}

.ai-compare-pair-head {
  display: grid;
  grid-template-columns: 40px 1fr 40px 1fr;
  align-items: center;
  padding: 10px 0 6px;
  font-size: 12px;
  color: #1e293b;
  font-weight: 600;
}
.ai-dark .ai-compare-pair-head {
  color: #e2e8f0;
}
.ai-compare-pair-head-left,
.ai-compare-pair-head-right {
  grid-column: span 2;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 6px;
}
.ai-compare-pair-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
}
.ai-compare-pair-badge-a {
  background: #ef4444;
}
.ai-compare-pair-badge-b {
  background: #22c55e;
}
.ai-compare-pair-label {
  font-size: 12px;
  font-weight: 500;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-compare-empty {
  padding: 28px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.ai-compare-rows {
  flex: 1 1 auto;
  overflow: auto;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
  border-bottom: 1px solid rgba(148, 163, 184, 0.2);
  background: #fafafa;
}
.ai-dark .ai-compare-rows {
  background: rgba(15, 23, 42, 0.5);
  border-top-color: rgba(71, 85, 105, 0.5);
  border-bottom-color: rgba(71, 85, 105, 0.5);
}

.ai-compare-row {
  display: grid;
  grid-template-columns: 40px 1fr 40px 1fr;
  min-height: 22px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.1);
}
.ai-compare-row:hover {
  background: rgba(148, 163, 184, 0.06);
}

.ai-compare-cell {
  padding: 2px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.45;
  overflow: hidden;
}
.ai-compare-cell-num {
  text-align: right;
  color: #94a3b8;
  font-size: 11px;
  padding-right: 8px;
  background: rgba(148, 163, 184, 0.08);
  border-right: 1px solid rgba(148, 163, 184, 0.18);
}
.ai-compare-cell-left,
.ai-compare-cell-right {
  white-space: pre-wrap;
  word-break: break-word;
  min-width: 0;
}

.ai-compare-pre {
  margin: 0;
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-word;
}

/* Row kinds: green added, red removed, amber changed, neutral equal. */
.ai-compare-row-add .ai-compare-cell-right {
  background: rgba(34, 197, 94, 0.16);
  color: #15803d;
}
.ai-compare-row-remove .ai-compare-cell-left {
  background: rgba(239, 68, 68, 0.16);
  color: #b91c1c;
}
.ai-compare-row-change .ai-compare-cell-left {
  background: rgba(239, 68, 68, 0.1);
}
.ai-compare-row-change .ai-compare-cell-right {
  background: rgba(34, 197, 94, 0.1);
}

.ai-dark .ai-compare-row-add .ai-compare-cell-right {
  background: rgba(34, 197, 94, 0.18);
  color: #bbf7d0;
}
.ai-dark .ai-compare-row-remove .ai-compare-cell-left {
  background: rgba(239, 68, 68, 0.18);
  color: #fecaca;
}
.ai-dark .ai-compare-row-change .ai-compare-cell-left {
  background: rgba(239, 68, 68, 0.12);
}
.ai-dark .ai-compare-row-change .ai-compare-cell-right {
  background: rgba(34, 197, 94, 0.12);
}

.ai-compare-swap {
  background: rgba(59, 130, 246, 0.12) !important;
  color: #1d4ed8 !important;
  margin-right: 8px;
}
.ai-dark .ai-compare-swap {
  background: rgba(59, 130, 246, 0.22) !important;
  color: #93c5fd !important;
}
</style>
