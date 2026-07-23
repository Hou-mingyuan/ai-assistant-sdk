<template>
  <Teleport to="body">
    <Transition name="ai-modal">
      <div
        v-if="open"
        class="ai-personalize-overlay ai-form-fill-overlay"
        :class="{ 'ai-dark': isDark }"
        role="presentation"
        @click.self="$emit('close')"
      >
        <div
          class="ai-personalize-dialog ai-form-fill-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @click.stop
        >
          <div class="ai-personalize-head">
            <h2 :id="titleId" class="ai-personalize-title">
              {{ t.formFillDialogTitle || 'Auto-fill form fields' }}
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

          <p class="ai-form-fill-summary">
            <span>{{ summaryText }}</span>
            <span v-if="tableInfo" class="ai-form-fill-table-badge">
              {{ tableSummaryText }}
            </span>
            <span v-if="tableInfo && tableInfo.truncatedRows > 0" class="ai-form-fill-table-warn">
              {{ tableTruncatedText }}
            </span>
            <span v-if="llmFallbackHinted" class="ai-form-fill-llm-hint">
              {{
                t.formFillLlmHint ||
                'Some fields unmatched — enable LLM fallback for smarter guess.'
              }}
            </span>
          </p>

          <div class="ai-form-fill-toolbar">
            <label class="ai-form-fill-check">
              <input
                type="checkbox"
                :checked="allChecked"
                :indeterminate.prop="someChecked && !allChecked"
                @change="onToggleAll"
              />
              <span>{{ t.formFillSelectAll || 'Select all matched' }}</span>
            </label>
            <span class="ai-form-fill-counter"> {{ selectedCount }} / {{ matchedCount }} </span>
          </div>

          <div
            class="ai-form-fill-table-wrapper"
            role="region"
            :aria-label="t.formFillDialogTitle || 'Form field preview'"
            tabindex="0"
          >
            <table class="ai-form-fill-table">
              <thead>
                <tr>
                  <th class="ai-form-fill-col-check"></th>
                  <th>{{ t.formFillColField || 'Field' }}</th>
                  <th>{{ t.formFillColCurrent || 'Current' }}</th>
                  <th>{{ t.formFillColNew || 'New value' }}</th>
                  <th class="ai-form-fill-col-conf">
                    {{ t.formFillColConfidence || 'Confidence' }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(m, idx) in matches"
                  :key="m.pair.raw + '-' + idx"
                  :class="{ 'ai-form-fill-row-unmatched': !m.field }"
                >
                  <td>
                    <input
                      type="checkbox"
                      :checked="selectedIndices.has(idx)"
                      :disabled="!m.field"
                      :aria-label="rowCheckboxLabel(idx)"
                      @change="$emit('toggle', idx)"
                    />
                  </td>
                  <td class="ai-form-fill-cell-field">
                    <div class="ai-form-fill-pair-key">
                      {{ m.pair.key }}
                      <span
                        v-if="m.matchedLabel && m.matchedLabel !== m.pair.key"
                        class="ai-form-fill-matched-label"
                        :title="m.matchedLabel"
                      >
                        → {{ m.matchedLabel }}
                      </span>
                    </div>
                    <select
                      class="ai-form-fill-field-picker"
                      :value="m.field?.id ?? ''"
                      @change="onPickField(idx, ($event.target as HTMLSelectElement).value)"
                    >
                      <option value="">{{ t.formFillFieldNone || '(no field)' }}</option>
                      <option
                        v-for="f in availableFields"
                        :key="f.id"
                        :value="f.id"
                        :disabled="isFieldUsedElsewhere(f.id, idx)"
                      >
                        {{ fieldDisplayLabel(f) }}
                      </option>
                    </select>
                  </td>
                  <td class="ai-form-fill-cell-current">
                    <span v-if="m.field?.currentValue" class="ai-form-fill-value-text">
                      {{ truncate(m.field.currentValue) }}
                    </span>
                    <span v-else class="ai-form-fill-empty">
                      {{ t.formFillEmpty || '(empty)' }}
                    </span>
                  </td>
                  <td class="ai-form-fill-cell-new">
                    <span class="ai-form-fill-value-text">{{ truncate(m.pair.value) }}</span>
                  </td>
                  <td class="ai-form-fill-cell-conf">
                    <span
                      class="ai-form-fill-conf-badge"
                      :data-level="confidenceLevel(m.confidence)"
                    >
                      <span class="ai-form-fill-conf-dots" aria-hidden="true">
                        <span
                          v-for="n in 3"
                          :key="n"
                          :class="{ on: confidenceDots(m.confidence) >= n }"
                        />
                      </span>
                      <span class="ai-form-fill-conf-num">{{ Math.round(m.confidence) }}</span>
                    </span>
                  </td>
                </tr>
                <tr v-if="matches.length === 0">
                  <td colspan="5" class="ai-form-fill-empty-row">
                    {{ t.formFillNoPairs || 'No key:value pairs detected.' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="ai-form-fill-footer">
            <button type="button" class="ai-form-fill-btn-secondary" @click="$emit('close')">
              {{ t.formFillCancel || 'Cancel' }}
            </button>
            <button
              type="button"
              class="ai-form-fill-btn-primary"
              :disabled="selectedCount === 0"
              @click="$emit('confirm')"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import type { FormField } from '../utils/formAutoFill/scanner';
import type { MatchResult } from '../utils/formAutoFill/matcher';

const props = defineProps<{
  open: boolean;
  isDark: boolean;
  t: I18nMessages;
  matches: MatchResult[];
  selectedIndices: Set<number>;
  availableFields: FormField[];
  llmFallbackHinted: boolean;
  tableInfo: {
    headers: string[];
    dataRowCount: number;
    formRowCount: number;
    truncatedRows: number;
  } | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggle', idx: number): void;
  (e: 'toggle-all', checked: boolean): void;
  (e: 'override', payload: { pairIdx: number; fieldId: string | null }): void;
  (e: 'confirm'): void;
}>();

const titleId = `ai-form-fill-title-${Math.random().toString(36).slice(2, 8)}`;

const matchedCount = computed(() => props.matches.filter((m) => m.field).length);
const selectedCount = computed(() => props.selectedIndices.size);

const allChecked = computed(
  () => matchedCount.value > 0 && selectedCount.value === matchedCount.value,
);
const someChecked = computed(() => selectedCount.value > 0 && !allChecked.value);

const summaryText = computed(() => {
  const tpl = props.t.formFillSummaryTemplate || '{matched} of {total} pairs matched';
  const total = props.matches.length;
  return tpl.replace('{matched}', String(matchedCount.value)).replace('{total}', String(total));
});

const tableSummaryText = computed(() => {
  if (!props.tableInfo) return '';
  const tpl =
    props.t.formFillTableSummary || 'Table mode · {dataRows} × {cols} → {formRows} form rows';
  const cols = props.tableInfo.headers.length;
  const usedFormRows = Math.max(0, props.tableInfo.dataRowCount - props.tableInfo.truncatedRows);
  return tpl
    .replace('{dataRows}', String(props.tableInfo.dataRowCount))
    .replace('{cols}', String(cols))
    .replace('{formRows}', String(usedFormRows));
});

const tableTruncatedText = computed(() => {
  if (!props.tableInfo) return '';
  const tpl =
    props.t.formFillTableTruncated ||
    '{n} pasted row(s) skipped — form has no slot (configure onAddRow to grow)';
  return tpl.replace('{n}', String(props.tableInfo.truncatedRows));
});

const confirmLabel = computed(() => {
  const tpl = props.t.formFillConfirmTemplate || 'Fill {n} field(s)';
  return tpl.replace('{n}', String(selectedCount.value));
});

function onToggleAll(e: Event) {
  emit('toggle-all', (e.target as HTMLInputElement).checked);
}

function onPickField(pairIdx: number, fieldId: string) {
  emit('override', { pairIdx, fieldId: fieldId === '' ? null : fieldId });
}

function rowCheckboxLabel(idx: number): string {
  const tpl = props.t.formFillSelectRowTemplate || 'Select row {n}';
  return tpl.replace('{n}', String(idx + 1));
}

function isFieldUsedElsewhere(fieldId: string, currentPairIdx: number): boolean {
  for (let i = 0; i < props.matches.length; i++) {
    if (i === currentPairIdx) continue;
    if (props.matches[i]?.field?.id === fieldId) return true;
  }
  return false;
}

function fieldDisplayLabel(f: FormField): string {
  const head = f.labels[0] ?? f.id;
  const typeBadge = f.type === 'text' ? '' : ` [${f.type}]`;
  return `${head}${typeBadge}`;
}

function truncate(s: string, max = 60): string {
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function confidenceLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

function confidenceDots(score: number): number {
  if (score >= 80) return 3;
  if (score >= 50) return 2;
  if (score >= 30) return 1;
  return 0;
}
</script>

<style>
.ai-form-fill-overlay {
  align-items: center;
  justify-content: center;
}
.ai-form-fill-dialog {
  max-width: 720px;
  width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.ai-form-fill-summary {
  margin: 0 16px 12px;
  font-size: 13px;
  color: var(--ai-color-text-secondary, #6b7280);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ai-form-fill-llm-hint {
  color: #d97706;
  font-size: 12px;
}
.ai-form-fill-table-badge {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: rgba(17, 17, 17, 0.12);
  color: #090909;
  width: fit-content;
}
.ai-form-fill-table-warn {
  color: #b45309;
  font-size: 12px;
}
.ai-form-fill-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 12px;
  font-size: 13px;
}
.ai-form-fill-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}
.ai-form-fill-counter {
  color: var(--ai-color-text-tertiary, #9ca3af);
  font-variant-numeric: tabular-nums;
}
.ai-form-fill-table-wrapper {
  flex: 1;
  overflow: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  margin: 0 16px;
  border: 1px solid var(--ai-color-border, #e5e7eb);
  border-radius: 8px;
}
.ai-form-fill-table {
  width: 100%;
  min-width: 600px;
  border-collapse: collapse;
  font-size: 13px;
}
.ai-form-fill-table th,
.ai-form-fill-table td {
  padding: 8px 10px;
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--ai-color-border, #e5e7eb);
}
.ai-form-fill-table th {
  background: var(--ai-color-surface, #f9fafb);
  font-weight: 500;
  font-size: 12px;
  color: var(--ai-color-text-secondary, #6b7280);
  position: sticky;
  top: 0;
  z-index: 1;
}
.ai-form-fill-col-check {
  width: 32px;
}
.ai-form-fill-col-conf {
  width: 110px;
  text-align: right;
}
.ai-form-fill-cell-field {
  min-width: 180px;
}
.ai-form-fill-pair-key {
  font-weight: 500;
}
.ai-form-fill-matched-label {
  margin-left: 4px;
  font-weight: 400;
  font-size: 12px;
  color: var(--ai-color-text-tertiary, #9ca3af);
}
.ai-form-fill-field-picker {
  margin-top: 4px;
  width: 100%;
  font-size: 12px;
  padding: 2px 4px;
  border: 1px solid var(--ai-color-border, #e5e7eb);
  border-radius: 4px;
  background: transparent;
  color: inherit;
}
.ai-form-fill-cell-current,
.ai-form-fill-cell-new {
  max-width: 220px;
  word-break: break-word;
}
.ai-form-fill-empty {
  color: var(--ai-color-text-tertiary, #9ca3af);
  font-style: italic;
}
.ai-form-fill-value-text {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
.ai-form-fill-row-unmatched {
  opacity: 0.6;
}
.ai-form-fill-conf-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.ai-form-fill-conf-badge[data-level='high'] {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}
.ai-form-fill-conf-badge[data-level='medium'] {
  background: rgba(245, 158, 11, 0.14);
  color: #b45309;
}
.ai-form-fill-conf-badge[data-level='low'] {
  background: rgba(239, 68, 68, 0.14);
  color: #b91c1c;
}
.ai-form-fill-conf-dots {
  display: inline-flex;
  gap: 2px;
}
.ai-form-fill-conf-dots span {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.25;
}
.ai-form-fill-conf-dots span.on {
  opacity: 1;
}
.ai-form-fill-empty-row {
  text-align: center;
  color: var(--ai-color-text-tertiary, #9ca3af);
  padding: 24px;
}
.ai-form-fill-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--ai-color-border, #e5e7eb);
  margin-top: 12px;
}
.ai-form-fill-btn-secondary,
.ai-form-fill-btn-primary {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  border: 1px solid transparent;
  background: transparent;
  color: inherit;
}
.ai-form-fill-btn-secondary {
  border-color: var(--ai-color-border, #e5e7eb);
}
.ai-form-fill-btn-primary {
  background: var(--ai-color-primary, #181818);
  color: #fff;
}
.ai-form-fill-btn-primary:disabled {
  background: var(--ai-color-border, #d1d5db);
  color: #6b7280;
  cursor: not-allowed;
}
@media (max-width: 600px) {
  .ai-form-fill-dialog {
    width: calc(100vw - 24px);
    max-height: calc(100dvh - 24px);
  }
  .ai-form-fill-summary {
    margin-inline: 12px;
  }
  .ai-form-fill-toolbar {
    padding-inline: 12px;
  }
  .ai-form-fill-check,
  .ai-form-fill-field-picker {
    min-height: 32px;
  }
  .ai-form-fill-table-wrapper {
    margin-inline: 12px;
  }
  .ai-form-fill-footer {
    padding: 10px 12px;
  }
  .ai-form-fill-btn-secondary,
  .ai-form-fill-btn-primary {
    min-height: 40px;
  }
}
.ai-dark.ai-form-fill-overlay .ai-form-fill-table th {
  background: rgba(255, 255, 255, 0.04);
}
.ai-dark.ai-form-fill-overlay .ai-form-fill-table th,
.ai-dark.ai-form-fill-overlay .ai-form-fill-table td {
  border-bottom-color: rgba(255, 255, 255, 0.08);
}
.ai-dark.ai-form-fill-overlay .ai-form-fill-field-picker {
  border-color: rgba(255, 255, 255, 0.12);
}

/* Post-fill toast (rendered in AiAssistant.vue but styled here to keep the
 * feature self-contained). Sits bottom-center above the page; auto-dismisses
 * via the composable's 5s timer. */
.ai-form-fill-toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #111827;
  color: #f9fafb;
  border-radius: 999px;
  font-size: 13px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  z-index: 2147483646;
  max-width: 92vw;
}
.ai-form-fill-toast.ai-dark {
  background: #1f2937;
}
.ai-form-fill-toast-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ai-form-fill-toast-btn {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.32);
  color: inherit;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  cursor: pointer;
}
.ai-form-fill-toast-btn:hover {
  background: rgba(255, 255, 255, 0.08);
}
.ai-form-fill-toast-close {
  background: transparent;
  border: 0;
  color: inherit;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  padding: 0 4px;
  opacity: 0.7;
}
.ai-form-fill-toast-close:hover {
  opacity: 1;
}
</style>
