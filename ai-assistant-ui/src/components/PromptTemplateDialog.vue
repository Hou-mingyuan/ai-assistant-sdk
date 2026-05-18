<template>
  <div
    class="ai-tpl-overlay"
    role="dialog"
    :aria-label="t.tplDialogTitle"
    @click.self="$emit('close')"
  >
    <div class="ai-tpl-card">
      <header class="ai-tpl-header">
        <h3 class="ai-tpl-title">{{ t.tplDialogTitle }}</h3>
        <button
          type="button"
          class="ai-tpl-close"
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

      <div class="ai-tpl-body">
        <aside class="ai-tpl-list">
          <button type="button" class="ai-tpl-add" @click="onClickNew">+ {{ t.tplCreate }}</button>
          <div v-if="templates.length === 0" class="ai-tpl-empty">{{ t.tplEmpty }}</div>
          <button
            v-for="tpl in templates"
            :key="tpl.id"
            type="button"
            class="ai-tpl-list-item"
            :class="{ 'ai-tpl-list-item-active': selectedId === tpl.id }"
            @click="selectTemplate(tpl.id)"
          >
            <span class="ai-tpl-list-item-label">{{ tpl.label }}</span>
            <span v-if="tpl.source === 'preset'" class="ai-tpl-badge ai-tpl-badge-preset">{{
              t.tplPresetBadge
            }}</span>
            <span v-else class="ai-tpl-badge ai-tpl-badge-user">{{ t.tplUserBadge }}</span>
          </button>
        </aside>

        <section class="ai-tpl-editor">
          <template v-if="selected">
            <div class="ai-tpl-field">
              <label class="ai-tpl-label">{{ t.tplLabel }}</label>
              <input
                v-model="draft.label"
                type="text"
                class="ai-tpl-input"
                :disabled="selected.source === 'preset'"
              />
            </div>
            <div class="ai-tpl-field">
              <label class="ai-tpl-label">{{ t.tplBody }}</label>
              <textarea
                v-model="draft.template"
                rows="5"
                class="ai-tpl-textarea"
                :disabled="selected.source === 'preset'"
                :placeholder="t.tplBodyHint"
              ></textarea>
            </div>

            <div class="ai-tpl-field">
              <label class="ai-tpl-label">
                {{ t.tplVariables }}
                <button
                  v-if="selected.source !== 'preset'"
                  type="button"
                  class="ai-tpl-mini-btn"
                  @click="addVariable"
                >
                  +
                </button>
              </label>
              <div v-if="draft.variables && draft.variables.length > 0" class="ai-tpl-vars">
                <div v-for="i in draft.variables.length" :key="i - 1" class="ai-tpl-var-row">
                  <input
                    v-model="draft.variables[i - 1].name"
                    type="text"
                    class="ai-tpl-input ai-tpl-var-name"
                    placeholder="name"
                    :disabled="selected.source === 'preset'"
                  />
                  <input
                    v-model="draft.variables[i - 1].label"
                    type="text"
                    class="ai-tpl-input ai-tpl-var-label"
                    :placeholder="t.tplVarLabelPlaceholder"
                    :disabled="selected.source === 'preset'"
                  />
                  <input
                    v-model="draft.variables[i - 1].default"
                    type="text"
                    class="ai-tpl-input ai-tpl-var-default"
                    :placeholder="t.tplVarDefaultPlaceholder"
                    :disabled="selected.source === 'preset'"
                  />
                  <button
                    v-if="selected.source !== 'preset'"
                    type="button"
                    class="ai-tpl-mini-btn"
                    @click="removeVariable(i - 1)"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>

            <div v-if="hasFillForm" class="ai-tpl-field ai-tpl-fillform">
              <label class="ai-tpl-label">{{ t.tplFillVars }}</label>
              <div
                v-for="(v, idx) in draft.variables ?? []"
                :key="`fill-${idx}`"
                class="ai-tpl-fill-row"
              >
                <span class="ai-tpl-fill-name">{{ v.label || v.name }}</span>
                <input
                  v-model="fillValues[v.name]"
                  type="text"
                  class="ai-tpl-input"
                  :placeholder="v.default || v.placeholder || ''"
                />
              </div>
            </div>

            <div class="ai-tpl-preview">
              <span class="ai-tpl-label">{{ t.tplPreview }}</span>
              <pre>{{ previewText }}</pre>
            </div>

            <div class="ai-tpl-actions">
              <button
                v-if="selected.source !== 'preset'"
                type="button"
                class="ai-tpl-btn ai-tpl-btn-danger"
                @click="onDelete"
              >
                {{ t.tplDelete }}
              </button>
              <button
                v-if="isDirty && selected.source !== 'preset'"
                type="button"
                class="ai-tpl-btn"
                @click="onSave"
              >
                {{ t.tplSave }}
              </button>
              <button type="button" class="ai-tpl-btn ai-tpl-btn-primary" @click="onUse">
                {{ t.tplUse }}
              </button>
            </div>
          </template>
          <div v-else class="ai-tpl-placeholder">{{ t.tplSelectHint }}</div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';

import type { I18nMessages } from '../utils/i18n';
import {
  renderPromptTemplate,
  type PromptTemplate,
  type PromptTemplateVariable,
} from '../composables/usePromptTemplateLibrary';

const props = defineProps<{
  templates: PromptTemplate[];
  t: I18nMessages;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'createUser', tpl: Omit<PromptTemplate, 'id' | 'source' | 'createdAt'>): void;
  (e: 'updateUser', id: string, patch: Partial<Omit<PromptTemplate, 'id' | 'source'>>): void;
  (e: 'deleteUser', id: string): void;
  (e: 'use', rendered: string, template: PromptTemplate): void;
}>();

const selectedId = ref<string | null>(null);

interface DraftTemplate {
  id: string;
  label: string;
  template: string;
  variables: PromptTemplateVariable[];
}

const draft = reactive<DraftTemplate>({
  id: '',
  label: '',
  template: '',
  variables: [],
});

const fillValues = reactive<Record<string, string>>({});

const selected = computed<PromptTemplate | undefined>(() =>
  props.templates.find((t) => t.id === selectedId.value),
);

const isDirty = computed(() => {
  if (!selected.value) return false;
  if (selected.value.source === 'preset') return false;
  return (
    draft.label !== selected.value.label ||
    draft.template !== selected.value.template ||
    JSON.stringify(draft.variables ?? []) !== JSON.stringify(selected.value.variables ?? [])
  );
});

const hasFillForm = computed(
  () => (draft.variables?.length ?? 0) > 0 && (draft.template?.length ?? 0) > 0,
);

const previewText = computed(() =>
  renderPromptTemplate(draft.template, fillValues, draft.variables ?? []),
);

watch(
  () => props.templates,
  (list) => {
    if (selectedId.value && list.some((t) => t.id === selectedId.value)) return;
    if (list.length > 0) selectTemplate(list[0].id);
  },
  { immediate: true },
);

watch(
  () => selected.value,
  (tpl) => {
    if (!tpl) {
      draft.id = '';
      draft.label = '';
      draft.template = '';
      draft.variables = [];
      for (const k of Object.keys(fillValues)) delete fillValues[k];
      return;
    }
    draft.id = tpl.id;
    draft.label = tpl.label;
    draft.template = tpl.template;
    draft.variables = tpl.variables ? tpl.variables.map((v) => ({ ...v })) : [];
    for (const k of Object.keys(fillValues)) delete fillValues[k];
    for (const v of draft.variables) {
      fillValues[v.name] = v.default ?? '';
    }
  },
  { immediate: true },
);

function selectTemplate(id: string) {
  selectedId.value = id;
}

function addVariable() {
  draft.variables.push({ name: `var${draft.variables.length + 1}`, label: '', default: '' });
}

function removeVariable(i: number) {
  draft.variables.splice(i, 1);
}

function onClickNew() {
  emit('createUser', {
    label: props.t.tplNewDefaultLabel,
    template: props.t.tplNewDefaultBody,
    variables: [],
  });
}

function onSave() {
  if (!selected.value || selected.value.source === 'preset') return;
  emit('updateUser', selected.value.id, {
    label: draft.label,
    template: draft.template,
    variables: draft.variables,
  });
}

function onDelete() {
  if (!selected.value || selected.value.source === 'preset') return;
  emit('deleteUser', selected.value.id);
}

function onUse() {
  if (!selected.value) return;
  const rendered = renderPromptTemplate(draft.template, fillValues, draft.variables ?? []);
  emit('use', rendered, selected.value);
}
</script>

<style scoped>
.ai-tpl-overlay {
  position: absolute;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: stretch;
  justify-content: stretch;
  background: rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(4px);
  padding: 12px;
  box-sizing: border-box;
}

.ai-tpl-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--ai-bg, #ffffff);
  color: var(--ai-text, #0f172a);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18);
  overflow: hidden;
  border: 1px solid var(--ai-border, rgba(15, 23, 42, 0.08));
  min-width: 0;
}

.ai-tpl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--ai-border, rgba(15, 23, 42, 0.08));
}

.ai-tpl-title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
}

.ai-tpl-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--ai-text-muted, #64748b);
}

.ai-tpl-close:hover {
  background: var(--ai-hover, rgba(15, 23, 42, 0.06));
  color: var(--ai-text, #0f172a);
}

.ai-tpl-body {
  flex: 1;
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 0;
  overflow: hidden;
}

.ai-tpl-list {
  border-right: 1px solid var(--ai-border, rgba(15, 23, 42, 0.08));
  background: var(--ai-bg-soft, #f8fafc);
  padding: 8px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-tpl-add {
  font: inherit;
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px dashed var(--ai-primary, #6366f1);
  color: var(--ai-primary, #6366f1);
  background: transparent;
  cursor: pointer;
  margin-bottom: 4px;
}

.ai-tpl-add:hover {
  background: rgba(99, 102, 241, 0.08);
}

.ai-tpl-empty {
  text-align: center;
  font-size: 12px;
  color: var(--ai-text-muted, #94a3b8);
  padding: 16px 4px;
  font-style: italic;
}

.ai-tpl-list-item {
  font: inherit;
  font-size: 12px;
  padding: 8px 10px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.ai-tpl-list-item:hover {
  background: var(--ai-hover, rgba(15, 23, 42, 0.05));
}

.ai-tpl-list-item-active {
  background: var(--ai-bg, #ffffff);
  border-color: var(--ai-primary, #6366f1);
  color: var(--ai-text, #0f172a);
}

.ai-tpl-list-item-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ai-tpl-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 999px;
  font-weight: 500;
}

.ai-tpl-badge-preset {
  background: rgba(99, 102, 241, 0.12);
  color: var(--ai-primary, #6366f1);
}

.ai-tpl-badge-user {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.ai-tpl-editor {
  padding: 12px 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.ai-tpl-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-tpl-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--ai-text-muted, #475569);
  display: flex;
  align-items: center;
  gap: 6px;
}

.ai-tpl-input,
.ai-tpl-textarea {
  font: inherit;
  font-size: 13px;
  padding: 6px 8px;
  border: 1px solid var(--ai-border, rgba(15, 23, 42, 0.12));
  border-radius: 6px;
  background: var(--ai-input-bg, #f8fafc);
  color: var(--ai-text, #0f172a);
  box-sizing: border-box;
  width: 100%;
}

.ai-tpl-input:focus,
.ai-tpl-textarea:focus {
  outline: none;
  border-color: var(--ai-primary, #6366f1);
  background: var(--ai-bg, #ffffff);
}

.ai-tpl-input:disabled,
.ai-tpl-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.ai-tpl-textarea {
  resize: vertical;
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 12px;
}

.ai-tpl-vars {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-tpl-var-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr auto;
  gap: 4px;
  align-items: center;
}

.ai-tpl-var-row .ai-tpl-input {
  font-size: 12px;
  padding: 4px 6px;
}

.ai-tpl-mini-btn {
  font: inherit;
  font-size: 14px;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 4px;
  border: 1px solid var(--ai-border, rgba(15, 23, 42, 0.12));
  background: var(--ai-bg, #ffffff);
  color: var(--ai-text-muted, #64748b);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.ai-tpl-mini-btn:hover {
  background: var(--ai-hover, rgba(15, 23, 42, 0.06));
}

.ai-tpl-fillform {
  background: rgba(99, 102, 241, 0.04);
  border-radius: 6px;
  padding: 8px 10px;
}

.ai-tpl-fill-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 4px;
}

.ai-tpl-fill-name {
  font-size: 12px;
  color: var(--ai-text-muted, #475569);
}

.ai-tpl-preview {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ai-tpl-preview pre {
  margin: 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--ai-bg-soft, #f1f5f9);
  font-size: 12px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 140px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, monospace;
}

.ai-tpl-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--ai-border, rgba(15, 23, 42, 0.06));
}

.ai-tpl-btn {
  font: inherit;
  font-size: 12px;
  padding: 6px 14px;
  border: 1px solid var(--ai-border, rgba(15, 23, 42, 0.12));
  background: var(--ai-bg, #ffffff);
  color: var(--ai-text, #0f172a);
  border-radius: 6px;
  cursor: pointer;
}

.ai-tpl-btn:hover {
  background: var(--ai-hover, rgba(15, 23, 42, 0.06));
}

.ai-tpl-btn-primary {
  background: var(--ai-primary, #6366f1);
  color: #ffffff;
  border-color: var(--ai-primary, #6366f1);
}

.ai-tpl-btn-primary:hover {
  filter: brightness(1.05);
  background: var(--ai-primary, #6366f1);
}

.ai-tpl-btn-danger {
  background: transparent;
  color: var(--ai-danger, #ef4444);
  border-color: rgba(239, 68, 68, 0.4);
}

.ai-tpl-btn-danger:hover {
  background: rgba(239, 68, 68, 0.08);
}

.ai-tpl-placeholder {
  margin: auto;
  color: var(--ai-text-muted, #94a3b8);
  font-size: 13px;
}
</style>
