<template>
  <div class="ai-multi-model-overlay" role="dialog" :aria-label="t.compareTitle">
    <div class="ai-multi-model-card">
      <header class="ai-mm-header">
        <h3 class="ai-mm-title">{{ t.compareTitle }}</h3>
        <button
          type="button"
          class="ai-mm-close"
          :aria-label="t.closePanel"
          @click="$emit('close')"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              fill="none"
            />
          </svg>
        </button>
      </header>

      <section class="ai-mm-models">
        <span class="ai-mm-models-label">{{ t.compareSelectModels }}</span>
        <div class="ai-mm-models-list">
          <label
            v-for="model in availableModels"
            :key="model"
            class="ai-mm-model-chip"
            :class="{
              'ai-mm-model-chip-selected': selectedModels.includes(model),
              'ai-mm-model-chip-disabled':
                !selectedModels.includes(model) && selectedModels.length >= maxColumns,
            }"
          >
            <input
              type="checkbox"
              :value="model"
              :checked="selectedModels.includes(model)"
              :disabled="!selectedModels.includes(model) && selectedModels.length >= maxColumns"
              @change="onToggleModel(model)"
            />
            <span>{{ model }}</span>
          </label>
          <span v-if="availableModels.length === 0" class="ai-mm-models-empty">{{
            t.modelsListEmpty
          }}</span>
        </div>
        <span class="ai-mm-models-hint">{{
          replaceTokens(t.compareModelsHint, { max: String(maxColumns) })
        }}</span>
      </section>

      <section class="ai-mm-prompt">
        <textarea
          v-model="promptText"
          class="ai-mm-prompt-input"
          :placeholder="t.compareHint"
          rows="2"
          @keydown.enter.exact.prevent="onStart"
        ></textarea>
        <div class="ai-mm-prompt-actions">
          <button
            v-if="isRunning"
            type="button"
            class="ai-mm-btn ai-mm-btn-stop"
            @click="$emit('stopAll')"
          >
            {{ t.stopAll }}
          </button>
          <button
            v-else
            type="button"
            class="ai-mm-btn ai-mm-btn-primary"
            :disabled="!canStart"
            @click="onStart"
          >
            {{ t.startCompare }}
          </button>
        </div>
      </section>

      <section class="ai-mm-columns" :data-cols="Math.max(columns.length, 1)">
        <div v-if="columns.length === 0" class="ai-mm-empty">{{ t.compareEmpty }}</div>
        <article
          v-for="col in columns"
          :key="col.model"
          class="ai-mm-col"
          :class="{ 'ai-mm-col-error': !!col.error, 'ai-mm-col-loading': col.loading }"
        >
          <header class="ai-mm-col-header">
            <span class="ai-mm-col-model" :title="col.model">{{ col.model }}</span>
            <span class="ai-mm-col-meta">
              <span v-if="col.loading" class="ai-mm-col-spinner" aria-hidden="true"></span>
              <span v-if="col.elapsedMs > 0" class="ai-mm-col-elapsed"
                >{{ (col.elapsedMs / 1000).toFixed(1) }}s</span
              >
              <button
                v-if="col.loading"
                type="button"
                class="ai-mm-col-stop"
                :aria-label="t.stopGenerate"
                @click="$emit('stopOne', col.model)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="6" y="6" width="12" height="12" fill="currentColor" rx="1.5" />
                </svg>
              </button>
            </span>
          </header>
          <div v-if="col.thinking" class="ai-mm-col-thinking">
            <span class="ai-mm-col-thinking-label">{{ t.thinkingLabel }}</span>
            <pre>{{ col.thinking }}</pre>
          </div>
          <div v-if="col.error" class="ai-mm-col-error-body">
            <strong>{{ t.errorPrefix }}:</strong>
            <span>{{ col.error }}</span>
          </div>
          <div class="ai-mm-col-body" v-text="col.content"></div>
        </article>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

import type { I18nMessages } from '../utils/i18n';
import type { MultiModelColumn } from '../composables/useMultiModelChat';

const props = defineProps<{
  availableModels: string[];
  selectedModels: string[];
  columns: MultiModelColumn[];
  isRunning: boolean;
  maxColumns: number;
  initialPrompt?: string;
  t: I18nMessages;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggleModel', model: string): void;
  (e: 'start', prompt: string): void;
  (e: 'stopOne', model: string): void;
  (e: 'stopAll'): void;
}>();

const promptText = ref(props.initialPrompt ?? '');

watch(
  () => props.initialPrompt,
  (val) => {
    if (val && !promptText.value) promptText.value = val;
  },
);

const canStart = computed(
  () => !!promptText.value.trim() && props.selectedModels.length > 0 && !props.isRunning,
);

function onToggleModel(model: string) {
  emit('toggleModel', model);
}

function onStart() {
  if (!canStart.value) return;
  emit('start', promptText.value.trim());
}

function replaceTokens(template: string, vars: Record<string, string>): string {
  if (!template) return '';
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
</script>

<style scoped>
.ai-multi-model-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(4px);
  padding: 12px;
  box-sizing: border-box;
}

.ai-multi-model-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  background: var(--ai-bg, #ffffff);
  color: var(--ai-text, #0f172a);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  border: 1px solid var(--ai-border, rgba(15, 23, 42, 0.08));
}

.ai-mm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ai-border, rgba(15, 23, 42, 0.08));
}

.ai-mm-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--ai-text, #0f172a);
}

.ai-mm-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--ai-text-muted, #64748b);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.ai-mm-close:hover {
  background: var(--ai-hover, rgba(15, 23, 42, 0.06));
  color: var(--ai-text, #0f172a);
}

.ai-mm-models {
  padding: 10px 14px;
  border-bottom: 1px solid var(--ai-border, rgba(15, 23, 42, 0.08));
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-mm-models-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-text-muted, #475569);
}

.ai-mm-models-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.ai-mm-model-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--ai-chip-bg, rgba(99, 102, 241, 0.08));
  border: 1px solid transparent;
  font-size: 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.ai-mm-model-chip:hover {
  background: var(--ai-chip-bg-hover, rgba(99, 102, 241, 0.16));
}

.ai-mm-model-chip-selected {
  background: var(--ai-primary, #6366f1);
  color: #ffffff;
  border-color: var(--ai-primary, #6366f1);
}

.ai-mm-model-chip-selected:hover {
  background: var(--ai-primary, #6366f1);
}

.ai-mm-model-chip-disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ai-mm-model-chip input {
  margin: 0;
  accent-color: var(--ai-primary, #6366f1);
}

.ai-mm-models-empty {
  font-size: 12px;
  color: var(--ai-text-muted, #94a3b8);
  font-style: italic;
}

.ai-mm-models-hint {
  font-size: 11px;
  color: var(--ai-text-muted, #94a3b8);
}

.ai-mm-prompt {
  padding: 10px 14px;
  border-bottom: 1px solid var(--ai-border, rgba(15, 23, 42, 0.08));
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ai-mm-prompt-input {
  width: 100%;
  font: inherit;
  resize: vertical;
  border: 1px solid var(--ai-border, rgba(15, 23, 42, 0.12));
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--ai-input-bg, #f8fafc);
  color: var(--ai-text, #0f172a);
  box-sizing: border-box;
}

.ai-mm-prompt-input:focus {
  outline: none;
  border-color: var(--ai-primary, #6366f1);
  background: var(--ai-bg, #ffffff);
}

.ai-mm-prompt-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ai-mm-btn {
  font: inherit;
  font-size: 12px;
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
}

.ai-mm-btn-primary {
  background: var(--ai-primary, #6366f1);
  color: #ffffff;
}

.ai-mm-btn-primary:hover:not(:disabled) {
  filter: brightness(1.05);
}

.ai-mm-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ai-mm-btn-stop {
  background: var(--ai-danger, #ef4444);
  color: #ffffff;
}

.ai-mm-columns {
  flex: 1;
  padding: 10px 14px 14px 14px;
  display: grid;
  gap: 10px;
  overflow: auto;
  grid-template-columns: 1fr;
}

.ai-mm-columns[data-cols='2'] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ai-mm-columns[data-cols='3'] {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.ai-mm-columns[data-cols='4'] {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1fr));
}

.ai-mm-empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--ai-text-muted, #94a3b8);
  font-size: 13px;
  padding: 40px 16px;
}

.ai-mm-col {
  border: 1px solid var(--ai-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px;
  background: var(--ai-bg-soft, #f8fafc);
  display: flex;
  flex-direction: column;
  min-height: 180px;
  max-height: 100%;
  overflow: hidden;
}

.ai-mm-col-error {
  border-color: var(--ai-danger, #ef4444);
}

.ai-mm-col-loading {
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.18) inset;
}

.ai-mm-col-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--ai-bg, #ffffff);
  border-bottom: 1px solid var(--ai-border, rgba(15, 23, 42, 0.08));
}

.ai-mm-col-model {
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-text, #0f172a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70%;
}

.ai-mm-col-meta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--ai-text-muted, #94a3b8);
}

.ai-mm-col-spinner {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--ai-primary, #6366f1);
  border-top-color: transparent;
  animation: ai-mm-spin 0.7s linear infinite;
}

@keyframes ai-mm-spin {
  to {
    transform: rotate(360deg);
  }
}

.ai-mm-col-stop {
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--ai-danger, #ef4444);
  display: inline-flex;
  align-items: center;
}

.ai-mm-col-thinking {
  padding: 6px 10px;
  font-size: 11px;
  color: var(--ai-text-muted, #64748b);
  background: rgba(99, 102, 241, 0.05);
  border-bottom: 1px solid var(--ai-border, rgba(15, 23, 42, 0.06));
}

.ai-mm-col-thinking-label {
  font-weight: 600;
  margin-right: 4px;
}

.ai-mm-col-thinking pre {
  margin: 4px 0 0 0;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 60px;
  overflow: auto;
}

.ai-mm-col-error-body {
  padding: 6px 10px;
  font-size: 12px;
  color: var(--ai-danger, #ef4444);
  background: rgba(239, 68, 68, 0.05);
  border-bottom: 1px solid rgba(239, 68, 68, 0.18);
}

.ai-mm-col-body {
  flex: 1;
  padding: 10px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--ai-text, #0f172a);
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
