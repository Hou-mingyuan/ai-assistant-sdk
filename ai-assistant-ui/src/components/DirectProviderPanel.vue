<template>
  <div class="ai-prov-panel" :class="{ 'is-dark': isDark }">
    <!-- Magpie-style provider list + Add provider button -->
    <div class="ai-prov-bar-head">
      <span class="ai-prov-section-label">
        {{ isZh ? '供应商列表' : 'Providers' }}
      </span>
      <button
        type="button"
        class="ai-prov-add-btn"
        :class="{ active: showAddPicker }"
        @click="showAddPicker = !showAddPicker"
      >
        <AssistantIcon name="plus" :size="12" />
        <span>{{ isZh ? '添加供应商' : 'Add Provider' }}</span>
      </button>
    </div>

    <div
      class="ai-prov-list"
      role="radiogroup"
      :aria-label="isZh ? '已添加供应商' : 'Saved providers'"
    >
      <button
        v-for="item in providers"
        :key="item.id"
        type="button"
        role="radio"
        class="ai-prov-item"
        :class="{ active: item.id === activeProviderId }"
        :aria-checked="item.id === activeProviderId ? 'true' : 'false'"
        @click="selectProvider(item.id)"
      >
        <span class="ai-prov-item-dot" aria-hidden="true" />
        <span class="ai-prov-item-name">{{ item.name }}</span>
        <span class="ai-prov-item-proto">{{ protocolShortLabel(item.protocol) }}</span>
      </button>
    </div>

    <!-- Preset / Custom provider picker -->
    <div v-if="showAddPicker" class="ai-prov-picker">
      <div class="ai-prov-picker-hint">
        {{
          isZh ? '选择预设供应商一键添加，或创建自定义供应商：' : 'Add a preset or custom provider:'
        }}
      </div>
      <div class="ai-prov-picker-grid">
        <button
          v-for="preset in DIRECT_MODEL_PRESETS"
          :key="preset.id"
          type="button"
          class="ai-conn-preset-pill"
          @click="addFromPreset(preset)"
        >
          {{ preset.label }}
        </button>
        <button type="button" class="ai-conn-preset-pill is-custom" @click="addCustom">
          {{ isZh ? '+ 自定义供应商' : '+ Custom' }}
        </button>
      </div>
    </div>

    <!-- Selected Provider Editor -->
    <div v-if="current" class="ai-prov-editor">
      <div class="ai-prov-name-row">
        <label class="ai-prov-name-field">
          <span class="ai-prov-field-label">{{ isZh ? '供应商名称' : 'Name' }}</span>
          <input
            :value="current.name"
            type="text"
            class="ai-conn-input"
            :placeholder="isZh ? '例如 deepseek / my-relay' : 'Provider name'"
            @input="patchCurrent({ name: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <button
          v-if="providers.length > 1"
          type="button"
          class="ai-prov-delete-btn"
          :title="isZh ? '删除该供应商' : 'Delete provider'"
          :aria-label="isZh ? '删除该供应商' : 'Delete provider'"
          @click="removeCurrent"
        >
          <AssistantIcon name="trash-2" :size="13" />
        </button>
      </div>

      <div class="ai-prov-field">
        <span class="ai-prov-field-label">{{ isZh ? '接口协议（Protocol）' : 'Protocol' }}</span>
        <div
          class="ai-prov-proto-switch"
          role="radiogroup"
          :aria-label="isZh ? '接口协议' : 'Protocol'"
        >
          <button
            v-for="proto in PROTOCOL_OPTIONS"
            :key="proto.id"
            type="button"
            role="radio"
            class="ai-prov-proto-btn"
            :class="{ active: current.protocol === proto.id }"
            :aria-checked="current.protocol === proto.id ? 'true' : 'false'"
            @click="switchProtocol(proto.id)"
          >
            {{ isZh ? proto.labelZh : proto.labelEn }}
          </button>
        </div>
      </div>

      <label class="ai-prov-field">
        <span class="ai-prov-field-label">
          <span>Base URL</span>
          <em class="ai-prov-field-note">{{ baseUrlHint }}</em>
        </span>
        <input
          :value="current.baseUrl"
          type="text"
          class="ai-conn-input"
          :placeholder="baseUrlPlaceholder"
          @input="patchCurrent({ baseUrl: ($event.target as HTMLInputElement).value })"
        />
      </label>

      <label class="ai-prov-field">
        <span class="ai-prov-field-label">
          <span>API Key</span>
          <em class="ai-prov-field-note">
            {{ isZh ? '仅存当前浏览器 localStorage' : 'Stored locally in browser' }}
          </em>
        </span>
        <div class="ai-conn-secret-wrap">
          <input
            :value="current.apiKey"
            :type="showKey ? 'text' : 'password'"
            class="ai-conn-input"
            autocomplete="off"
            :placeholder="isZh ? '输入供应商 API Key（如 sk-...）' : 'Enter API Key (e.g. sk-...)'"
            @input="patchCurrent({ apiKey: ($event.target as HTMLInputElement).value })"
          />
          <button
            type="button"
            class="ai-conn-eye-btn"
            :aria-label="showKey ? 'Hide API key' : 'Show API key'"
            @click="showKey = !showKey"
          >
            <AssistantIcon :name="showKey ? 'eye-off' : 'eye'" :size="14" />
          </button>
        </div>
      </label>

      <!-- Models Section (Auto Fetch + Manual Add + Active Select) -->
      <div class="ai-prov-models-box">
        <div class="ai-prov-models-head">
          <span class="ai-prov-field-label">
            {{ isZh ? '模型列表' : 'Models' }}
            <em v-if="current.activeModel" class="ai-prov-active-tag">{{ current.activeModel }}</em>
          </span>
          <button
            type="button"
            class="ai-conn-mini-btn"
            :disabled="fetchingModels || !current.baseUrl.trim()"
            @click="fetchModelsForCurrent"
          >
            <AssistantIcon name="zap" :size="12" />
            <span>
              {{
                fetchingModels
                  ? isZh
                    ? '获取中...'
                    : 'Fetching...'
                  : isZh
                    ? '获取模型'
                    : 'Fetch Models'
              }}
            </span>
          </button>
        </div>

        <div class="ai-prov-manual-add">
          <input
            v-model="manualModelInput"
            type="text"
            class="ai-conn-input ai-prov-model-input"
            :placeholder="modelPlaceholder"
            @keydown.enter.prevent="addManualModel"
          />
          <button
            type="button"
            class="ai-prov-add-model-btn"
            :disabled="!manualModelInput.trim()"
            @click="addManualModel"
          >
            {{ isZh ? '添加' : 'Add' }}
          </button>
        </div>

        <div v-if="current.models.length > 0" class="ai-conn-chips">
          <div
            v-for="m in current.models"
            :key="m"
            class="ai-conn-chip-wrap"
            :class="{ active: current.activeModel === m }"
          >
            <button
              type="button"
              class="ai-conn-chip"
              :class="{ active: current.activeModel === m }"
              @click="patchCurrent({ activeModel: m })"
            >
              {{ m }}
            </button>
            <button
              v-if="current.models.length > 1"
              type="button"
              class="ai-conn-chip-remove"
              :aria-label="isZh ? `移除模型 ${m}` : `Remove ${m}`"
              @click="removeModel(m)"
            >
              ×
            </button>
          </div>
        </div>
        <p v-else class="ai-prov-empty-hint">
          {{
            isZh
              ? '点击「获取模型」自动拉取，或在上方手动输入 Model ID 添加。'
              : 'Click "Fetch Models" or enter a Model ID manually above.'
          }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import AssistantIcon from './AssistantIcon.vue';
import {
  createCustomProvider,
  createProviderFromPreset,
  DIRECT_MODEL_PRESETS,
  type DirectModelPreset,
  type DirectProviderConfig,
  type ProviderProtocol,
} from '../composables/useConnectionConfig';
import { fetchProviderModels } from '../utils/directOpenAi';

const PROTOCOL_OPTIONS: ReadonlyArray<{
  id: ProviderProtocol;
  labelZh: string;
  labelEn: string;
}> = [
  { id: 'openai', labelZh: 'OpenAI 兼容', labelEn: 'OpenAI' },
  { id: 'anthropic', labelZh: 'Anthropic', labelEn: 'Anthropic' },
  { id: 'gemini', labelZh: 'Gemini', labelEn: 'Gemini' },
];

const props = defineProps<{
  providers: DirectProviderConfig[];
  activeProviderId: string;
  isDark: boolean;
  isZh: boolean;
}>();

const emit = defineEmits<{
  'update:providers': [value: DirectProviderConfig[]];
  'update:activeProviderId': [value: string];
  status: [value: { ok: boolean; text: string }];
}>();

const showAddPicker = ref(false);
const showKey = ref(false);
const fetchingModels = ref(false);
const manualModelInput = ref('');

const current = computed(
  () => props.providers.find((p) => p.id === props.activeProviderId) ?? props.providers[0],
);

const baseUrlPlaceholder = computed(() => {
  const proto = current.value?.protocol ?? 'openai';
  if (proto === 'anthropic') return 'https://api.anthropic.com';
  if (proto === 'gemini') return 'https://generativelanguage.googleapis.com';
  return 'https://api.openai.com/v1';
});

const modelPlaceholder = computed(() => {
  const proto = current.value?.protocol ?? 'openai';
  if (proto === 'anthropic') return 'claude-sonnet-4-20250514';
  if (proto === 'gemini') return 'gemini-2.5-flash';
  return '手动输入模型 ID 后按回车添加，如 deepseek-chat';
});

const baseUrlHint = computed(() => {
  const proto = current.value?.protocol ?? 'openai';
  if (!props.isZh) {
    if (proto === 'anthropic') return 'Root or /v1 base URL';
    if (proto === 'gemini') return 'Root or /v1beta base URL';
    return 'Up to /v1 only (no /chat/completions)';
  }
  if (proto === 'anthropic') return '写到根路径或 /v1 即可';
  if (proto === 'gemini') return '写到根路径或 /v1beta 即可';
  return '写到 /v1 即可，无需 /chat/completions';
});

function protocolShortLabel(proto: ProviderProtocol): string {
  if (proto === 'anthropic') return 'ANT';
  if (proto === 'gemini') return 'GEM';
  return 'OAI';
}

function selectProvider(id: string) {
  emit('update:activeProviderId', id);
  showAddPicker.value = false;
  emit('status', { ok: true, text: '' });
}

function patchCurrent(patch: Partial<DirectProviderConfig>) {
  if (!current.value) return;
  const nextList = props.providers.map((p) =>
    p.id === current.value!.id ? { ...p, ...patch } : p,
  );
  emit('update:providers', nextList);
}

function switchProtocol(protocol: ProviderProtocol) {
  patchCurrent({ protocol });
}

function addFromPreset(preset: DirectModelPreset) {
  const nextItem = createProviderFromPreset(preset, props.providers);
  emit('update:providers', [...props.providers, nextItem]);
  emit('update:activeProviderId', nextItem.id);
  showAddPicker.value = false;
  emit('status', {
    ok: true,
    text: props.isZh
      ? `已添加「${nextItem.name}」，请确认密钥或模型后点击「保存并应用」`
      : `Added ${nextItem.name}. Click Save & Apply to activate.`,
  });
}

function addCustom() {
  const nextItem = createCustomProvider(
    props.providers,
    props.isZh ? '自定义供应商' : 'Custom Provider',
  );
  emit('update:providers', [...props.providers, nextItem]);
  emit('update:activeProviderId', nextItem.id);
  showAddPicker.value = false;
  emit('status', {
    ok: true,
    text: props.isZh ? '已新建自定义供应商' : 'Created custom provider',
  });
}

function removeCurrent() {
  if (!current.value || props.providers.length <= 1) return;
  const remaining = props.providers.filter((p) => p.id !== current.value!.id);
  emit('update:providers', remaining);
  emit('update:activeProviderId', remaining[0].id);
  emit('status', { ok: true, text: '' });
}

function addManualModel() {
  if (!current.value) return;
  const name = manualModelInput.value.trim();
  if (!name) return;
  const models = Array.from(new Set([name, ...current.value.models]));
  patchCurrent({ models, activeModel: name });
  manualModelInput.value = '';
}

function removeModel(modelId: string) {
  if (!current.value || current.value.models.length <= 1) return;
  const nextModels = current.value.models.filter((m) => m !== modelId);
  const nextActive =
    current.value.activeModel === modelId ? nextModels[0] || '' : current.value.activeModel;
  patchCurrent({ models: nextModels, activeModel: nextActive });
}

async function fetchModelsForCurrent() {
  if (!current.value || !current.value.baseUrl.trim() || fetchingModels.value) return;
  fetchingModels.value = true;
  emit('status', { ok: true, text: '' });
  try {
    const res = await fetchProviderModels(
      current.value.protocol,
      current.value.baseUrl,
      current.value.apiKey,
    );
    if (res.success) {
      const merged = Array.from(new Set([...res.models, ...current.value.models].filter(Boolean)));
      const nextActive =
        current.value.activeModel && merged.includes(current.value.activeModel)
          ? current.value.activeModel
          : merged[0] || '';
      patchCurrent({ models: merged, activeModel: nextActive });
      emit('status', {
        ok: true,
        text: props.isZh
          ? `连接成功，获取到 ${res.models.length} 个模型`
          : `Connected (${res.models.length} models)`,
      });
    } else {
      emit('status', {
        ok: false,
        text: res.error || (props.isZh ? '获取模型失败' : 'Failed to fetch models'),
      });
    }
  } finally {
    fetchingModels.value = false;
  }
}
</script>

<style scoped>
.ai-prov-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ai-prov-bar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ai-prov-section-label,
.ai-prov-field-label {
  font-size: 11.5px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.ai-prov-field-note {
  font-style: normal;
  font-weight: 400;
  font-size: 10.5px;
  color: var(--ai-color-text-tertiary, #64748b);
}
.ai-prov-panel.is-dark .ai-prov-field-note {
  color: #94a3b8;
}
.ai-prov-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  border-radius: 6px;
  border: 1px dashed rgba(36, 87, 214, 0.55);
  background: rgba(36, 87, 214, 0.06);
  color: #2457d6;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.ai-prov-panel.is-dark .ai-prov-add-btn {
  color: var(--ai-theme-mark-dark, #8fb4ff);
  border-color: color-mix(in srgb, var(--ai-theme-to, #5b8def) 50%, transparent);
  background: color-mix(in srgb, var(--ai-theme-via, #2457d6) 14%, transparent);
}
.ai-prov-list {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.ai-prov-item {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 8px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(148, 163, 184, 0.06);
  color: inherit;
  font-size: 11.5px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}
.ai-prov-item.active {
  border-color: #2457d6;
  background: rgba(36, 87, 214, 0.12);
  color: #2457d6;
  font-weight: 600;
}
.ai-prov-panel.is-dark .ai-prov-item.active {
  border-color: var(--ai-theme-to, #5b8def);
  background: color-mix(in srgb, var(--ai-theme-via, #2457d6) 22%, transparent);
  color: var(--ai-theme-mark-dark, #8fb4ff);
}
.ai-prov-item-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.35;
}
.ai-prov-item.active .ai-prov-item-dot {
  opacity: 1;
}
.ai-prov-item-proto {
  font-size: 9.5px;
  font-weight: 700;
  padding: 1px 4px;
  border-radius: 4px;
  background: rgba(148, 163, 184, 0.18);
  opacity: 0.85;
}
.ai-prov-picker {
  padding: 8px;
  border-radius: 9px;
  border: 1px solid rgba(36, 87, 214, 0.26);
  background: rgba(36, 87, 214, 0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ai-prov-picker-hint {
  font-size: 11px;
  color: var(--ai-color-text-tertiary, #64748b);
}
.ai-prov-picker-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}
.ai-conn-preset-pill {
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: transparent;
  color: inherit;
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 999px;
  cursor: pointer;
}
.ai-conn-preset-pill:hover,
.ai-conn-preset-pill.is-custom {
  border-color: #2457d6;
  color: #2457d6;
}
.ai-prov-panel.is-dark .ai-conn-preset-pill:hover,
.ai-prov-panel.is-dark .ai-conn-preset-pill.is-custom {
  border-color: var(--ai-theme-to, #5b8def);
  color: var(--ai-theme-mark-dark, #8fb4ff);
}
.ai-prov-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 9px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  background: rgba(148, 163, 184, 0.05);
}
.ai-prov-name-row {
  display: flex;
  align-items: flex-end;
  gap: 6px;
}
.ai-prov-name-field {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ai-prov-delete-btn {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 8px;
  border: 1px solid rgba(239, 68, 68, 0.28);
  background: rgba(239, 68, 68, 0.06);
  color: #dc2626;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ai-prov-panel.is-dark .ai-prov-delete-btn {
  color: #f87171;
}
.ai-prov-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ai-prov-proto-switch {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}
.ai-prov-proto-btn {
  height: 27px;
  border-radius: 7px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: transparent;
  color: inherit;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.ai-prov-proto-btn.active {
  border-color: #2457d6;
  background: rgba(36, 87, 214, 0.12);
  color: #2457d6;
}
.ai-prov-panel.is-dark .ai-prov-proto-btn.active {
  border-color: var(--ai-theme-to, #5b8def);
  background: color-mix(in srgb, var(--ai-theme-via, #2457d6) 20%, transparent);
  color: var(--ai-theme-mark-dark, #8fb4ff);
}
.ai-conn-input {
  width: 100%;
  height: 30px;
  padding: 0 9px;
  box-sizing: border-box;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  background: rgba(255, 255, 255, 0.85);
  color: inherit;
  font-size: 12px;
  outline: none;
}
.ai-prov-panel.is-dark .ai-conn-input {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.25);
}
.ai-conn-input:focus {
  border-color: #2457d6;
}
.ai-conn-secret-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.ai-conn-secret-wrap .ai-conn-input {
  padding-right: 30px;
}
.ai-conn-eye-btn {
  position: absolute;
  right: 4px;
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  opacity: 0.65;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ai-prov-models-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ai-prov-models-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ai-prov-active-tag {
  font-style: normal;
  font-size: 10.5px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(36, 87, 214, 0.1);
  color: #2457d6;
}
.ai-prov-panel.is-dark .ai-prov-active-tag {
  background: color-mix(in srgb, var(--ai-theme-via, #2457d6) 22%, transparent);
  color: var(--ai-theme-mark-dark, #8fb4ff);
}
.ai-conn-mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  background: transparent;
  color: inherit;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.ai-conn-mini-btn:hover:not(:disabled) {
  border-color: #2457d6;
  color: #2457d6;
}
.ai-prov-manual-add {
  display: flex;
  gap: 5px;
}
.ai-prov-model-input {
  height: 28px;
  font-size: 11.5px;
}
.ai-prov-add-model-btn {
  height: 28px;
  padding: 0 10px;
  flex-shrink: 0;
  border-radius: 7px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  background: transparent;
  color: inherit;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
}
.ai-conn-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 78px;
  overflow-y: auto;
}
.ai-conn-chip-wrap {
  display: inline-flex;
  align-items: center;
  border-radius: 7px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  overflow: hidden;
}
.ai-conn-chip-wrap.active {
  border-color: #2457d6;
  background: #2457d6;
  color: #ffffff;
}
.ai-conn-chip {
  border: 0;
  background: transparent;
  color: inherit;
  font-size: 11px;
  padding: 3px 7px;
  cursor: pointer;
}
.ai-conn-chip-remove {
  border: 0;
  background: transparent;
  color: inherit;
  opacity: 0.72;
  font-size: 12px;
  line-height: 1;
  padding: 3px 5px 3px 0;
  cursor: pointer;
}
.ai-prov-empty-hint {
  margin: 0;
  font-size: 11px;
  color: var(--ai-color-text-tertiary, #64748b);
}
</style>
