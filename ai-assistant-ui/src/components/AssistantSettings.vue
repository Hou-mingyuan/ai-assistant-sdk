<template>
  <div
    class="ai-settings-backdrop ai-dock-settings-backdrop"
    :class="{ 'ai-dark': isDark }"
    role="dialog"
    aria-modal="false"
    :aria-label="headingText"
    @click.self="emit('close')"
  >
    <div class="ai-settings-sheet ai-dock-settings-sheet" @click.stop>
      <div class="ai-settings-head">
        <div class="ai-settings-title-wrap">
          <AssistantIcon name="sliders-horizontal" :size="15" />
          <span class="ai-settings-title">{{ headingText }}</span>
        </div>
        <div class="ai-settings-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            class="ai-settings-tab"
            :class="{ active: activeTab === 'connection' }"
            :aria-selected="activeTab === 'connection' ? 'true' : 'false'"
            @click="activeTab = 'connection'"
          >
            {{ isZh ? '连接与模型' : 'Model' }}
          </button>
          <button
            type="button"
            role="tab"
            class="ai-settings-tab"
            :class="{ active: activeTab === 'dock' }"
            :aria-selected="activeTab === 'dock' ? 'true' : 'false'"
            @click="activeTab = 'dock'"
          >
            {{ isZh ? '侧边隐藏' : 'Edge Dock' }}
          </button>
        </div>
        <button
          type="button"
          class="ai-settings-close"
          :aria-label="t.closePanel"
          @click="emit('close')"
        >
          <AssistantIcon name="x" :size="15" />
        </button>
      </div>

      <!-- Tab 1: Connection & Magpie-style Multi-Provider Model Settings -->
      <div v-if="activeTab === 'connection'" class="ai-conn-section">
        <div
          class="ai-conn-mode-switch"
          role="radiogroup"
          :aria-label="isZh ? '连接方式' : 'Connection mode'"
        >
          <button
            type="button"
            role="radio"
            class="ai-conn-mode-btn"
            :class="{ active: draft.mode === 'backend' }"
            :aria-checked="draft.mode === 'backend' ? 'true' : 'false'"
            @click="draft.mode = 'backend'"
          >
            {{ isZh ? '后端代理' : 'Backend Proxy' }}
          </button>
          <button
            type="button"
            role="radio"
            class="ai-conn-mode-btn"
            :class="{ active: draft.mode === 'direct' }"
            :aria-checked="draft.mode === 'direct' ? 'true' : 'false'"
            @click="draft.mode = 'direct'"
          >
            {{ isZh ? '直连模型接口' : 'Direct Model API' }}
          </button>
        </div>

        <template v-if="draft.mode === 'backend'">
          <label class="ai-conn-field">
            <span class="ai-conn-label">
              {{ isZh ? '后端接口地址（留空沿用默认）' : 'Backend Base URL (optional)' }}
            </span>
            <input
              v-model="draft.backendBaseUrl"
              type="text"
              class="ai-conn-input"
              :placeholder="hostBaseUrl || '/ai-assistant'"
            />
          </label>

          <label class="ai-conn-field">
            <span class="ai-conn-label">
              {{ isZh ? '访问令牌 Token（可选）' : 'Access Token (optional)' }}
            </span>
            <div class="ai-conn-secret-wrap">
              <input
                v-model="draft.backendToken"
                :type="showBackendToken ? 'text' : 'password'"
                class="ai-conn-input"
                autocomplete="off"
                :placeholder="isZh ? 'X-AI-Token，留空则沿用宿主配置' : 'Optional X-AI-Token'"
              />
              <button
                type="button"
                class="ai-conn-eye-btn"
                :aria-label="showBackendToken ? 'Hide token' : 'Show token'"
                @click="showBackendToken = !showBackendToken"
              >
                <AssistantIcon :name="showBackendToken ? 'eye-off' : 'eye'" :size="14" />
              </button>
            </div>
          </label>

          <div class="ai-conn-models-box">
            <div class="ai-conn-models-head">
              <span class="ai-conn-label">
                {{ isZh ? '当前可用模型' : 'Available Models' }}
              </span>
              <button type="button" class="ai-conn-mini-btn" @click="onRefreshBackendModels">
                <AssistantIcon name="rotate-ccw" :size="12" />
                <span>{{ isZh ? '刷新列表' : 'Refresh' }}</span>
              </button>
            </div>
            <div v-if="backendModels.length > 0" class="ai-conn-chips">
              <button
                v-for="m in backendModels"
                :key="m"
                type="button"
                class="ai-conn-chip"
                :class="{ active: m === selectedBackendModel }"
                @click="emit('select-backend-model', m)"
              >
                {{ m }}
              </button>
            </div>
            <p v-else class="ai-conn-subhint">
              {{
                isZh
                  ? '尚未拉取到后端模型（如未启动后端，可点击上方「直连模型接口」按供应商分别配置）。'
                  : 'No backend models loaded yet. Switch to Direct Model API above to manage providers.'
              }}
            </p>
          </div>
        </template>

        <DirectProviderPanel
          v-else
          v-model:providers="draft.providers"
          v-model:active-provider-id="draft.activeProviderId"
          :is-dark="isDark"
          :is-zh="isZh"
          @status="onProviderStatus"
        />

        <div
          v-if="statusNotice"
          class="ai-conn-status"
          :class="statusOk ? 'is-ok' : 'is-err'"
          role="status"
          aria-live="polite"
        >
          {{ statusNotice }}
        </div>

        <div class="ai-conn-actions">
          <button type="button" class="ai-conn-btn-secondary" @click="onResetConnection">
            {{ isZh ? '恢复默认' : 'Reset' }}
          </button>
          <button type="button" class="ai-conn-btn-primary" @click="onSaveConnection">
            {{ isZh ? '保存并应用' : 'Save & Apply' }}
          </button>
        </div>
      </div>

      <!-- Tab 2: 6 Edge-Dock Orb Styles -->
      <EdgeDockSettingsTab
        v-else
        :model-value="modelValue"
        :edge-dock="edgeDock"
        :dock-heading-text="dockHeadingText"
        :is-dark="isDark"
        :is-zh="isZh"
        @update:model-value="emit('update:modelValue', $event)"
        @dock-now="emit('dock-now', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import AssistantIcon from './AssistantIcon.vue';
import DirectProviderPanel from './DirectProviderPanel.vue';
import EdgeDockSettingsTab from './EdgeDockSettingsTab.vue';
import type { EdgeDockStyle } from '../composables/useEdgeDockStyle';
import type { ConnectionConfig } from '../composables/useConnectionConfig';
import type { I18nMessages } from '../utils/i18n/types';

function cloneConfig(src: ConnectionConfig): ConnectionConfig {
  return {
    ...src,
    providers: src.providers.map((p) => ({ ...p, models: [...p.models] })),
  };
}

const props = defineProps<{
  modelValue: EdgeDockStyle;
  edgeDock: 'none' | 'left' | 'right';
  connectionConfig: ConnectionConfig;
  hostBaseUrl?: string;
  backendModels: string[];
  selectedBackendModel: string;
  isDark: boolean;
  isZh: boolean;
  t: I18nMessages;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: EdgeDockStyle];
  'dock-now': [edge: 'left' | 'right' | 'none'];
  'save-connection': [config: ConnectionConfig];
  'reset-connection': [];
  'select-backend-model': [model: string];
  'refresh-backend-models': [config: ConnectionConfig];
  close: [];
}>();

const activeTab = ref<'connection' | 'dock'>('connection');
const draft = reactive<ConnectionConfig>(cloneConfig(props.connectionConfig));
const showBackendToken = ref(false);
const statusNotice = ref('');
const statusOk = ref(true);

watch(
  () => props.connectionConfig,
  (next) => {
    const cloned = cloneConfig(next);
    draft.mode = cloned.mode;
    draft.backendBaseUrl = cloned.backendBaseUrl;
    draft.backendToken = cloned.backendToken;
    draft.activeProviderId = cloned.activeProviderId;
    draft.providers = cloned.providers;
    draft.directBaseUrl = cloned.directBaseUrl;
    draft.directApiKey = cloned.directApiKey;
    draft.directModel = cloned.directModel;
  },
  { deep: true },
);

const headingText = computed(
  () => props.t.assistantSettingsTitle || (props.isZh ? '小助手设置' : 'Settings'),
);
const dockHeadingText = computed(
  () =>
    props.t.edgeDockSettingsTitle || (props.isZh ? '悬浮球侧边隐藏样式' : 'Edge-Dock Orb Style'),
);

function onProviderStatus(payload: { ok: boolean; text: string }) {
  statusOk.value = payload.ok;
  statusNotice.value = payload.text;
}

function onRefreshBackendModels() {
  statusNotice.value = '';
  emit('refresh-backend-models', cloneConfig({ ...draft, mode: 'backend' }));
}

function onSaveConnection() {
  if (draft.mode === 'direct') {
    const active =
      draft.providers.find((p) => p.id === draft.activeProviderId) ?? draft.providers[0];
    if (!active || !active.baseUrl.trim()) {
      statusOk.value = false;
      statusNotice.value = props.isZh ? '请填写当前供应商的 Base URL' : 'Base URL is required';
      return;
    }
    const chosenModel = active.activeModel.trim() || active.models[0]?.trim() || '';
    if (!chosenModel) {
      statusOk.value = false;
      statusNotice.value = props.isZh ? '请获取或手动添加至少一个模型' : 'Add at least one model';
      return;
    }
    active.activeModel = chosenModel;
    if (!active.models.includes(chosenModel)) {
      active.models.unshift(chosenModel);
    }
    draft.activeProviderId = active.id;
    draft.directBaseUrl = active.baseUrl;
    draft.directApiKey = active.apiKey;
    draft.directModel = chosenModel;
  }
  emit('save-connection', cloneConfig(draft));
  statusOk.value = true;
  statusNotice.value = props.isZh ? '已保存连接与模型配置' : 'Settings saved';
}

function onResetConnection() {
  emit('reset-connection');
  statusOk.value = true;
  statusNotice.value = props.isZh ? '已恢复默认配置' : 'Reset to default';
}
</script>

<style scoped>
.ai-panel > .ai-settings-backdrop,
.ai-settings-backdrop {
  position: absolute;
  inset: 0;
  z-index: 25;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-radius: inherit;
  background: rgba(15, 23, 42, 0.22);
  backdrop-filter: blur(4px);
}
.ai-settings-sheet {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  overflow-y: auto;
  padding: 10px 12px 12px;
  background: var(--ai-color-bg-elevated, #ffffff);
  color: var(--ai-color-text-primary, #171717);
  display: flex;
  flex-direction: column;
  gap: 9px;
  box-sizing: border-box;
}
.ai-settings-backdrop.ai-dark .ai-settings-sheet {
  background: #141923;
  color: #f1f5f9;
}
.ai-settings-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ai-settings-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.ai-settings-tabs {
  display: inline-flex;
  padding: 2px;
  border-radius: 8px;
  background: rgba(148, 163, 184, 0.14);
  gap: 2px;
}
.ai-settings-tab {
  border: 0;
  background: transparent;
  color: inherit;
  opacity: 0.72;
  font-size: 11.5px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}
.ai-settings-tab.active {
  opacity: 1;
  background: #ffffff;
  color: #2457d6;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.1);
}
.ai-settings-backdrop.ai-dark .ai-settings-tab.active {
  background: #1e293b;
  color: var(--ai-theme-mark-dark, #8fb4ff);
}
.ai-settings-close {
  width: 26px;
  height: 26px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: inherit;
  opacity: 0.7;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.ai-settings-close:hover {
  opacity: 1;
  background: rgba(148, 163, 184, 0.16);
}
.ai-conn-section {
  display: flex;
  flex-direction: column;
  gap: 9px;
  flex: 1 1 auto;
}
.ai-conn-mode-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.ai-conn-mode-btn {
  height: 31px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(148, 163, 184, 0.08);
  color: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ai-conn-mode-btn.active {
  border-color: #2457d6;
  background: rgba(36, 87, 214, 0.12);
  color: #2457d6;
}
.ai-settings-backdrop.ai-dark .ai-conn-mode-btn.active {
  border-color: var(--ai-theme-to, #5b8def);
  background: color-mix(in srgb, var(--ai-theme-via, #2457d6) 20%, transparent);
  color: var(--ai-theme-mark-dark, #8fb4ff);
}
.ai-conn-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.ai-conn-label {
  font-size: 11.5px;
  font-weight: 600;
}
.ai-conn-input {
  width: 100%;
  height: 31px;
  padding: 0 10px;
  box-sizing: border-box;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.34);
  background: rgba(248, 250, 252, 0.8);
  color: inherit;
  font-size: 12px;
  outline: none;
}
.ai-settings-backdrop.ai-dark .ai-conn-input {
  background: rgba(15, 23, 42, 0.72);
  border-color: rgba(148, 163, 184, 0.25);
}
.ai-conn-secret-wrap {
  position: relative;
  display: flex;
  align-items: center;
}
.ai-conn-secret-wrap .ai-conn-input {
  padding-right: 32px;
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
.ai-conn-models-box {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 9px;
  background: rgba(148, 163, 184, 0.08);
  border: 1px solid rgba(148, 163, 184, 0.18);
}
.ai-conn-models-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ai-conn-mini-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: transparent;
  color: inherit;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
}
.ai-conn-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  max-height: 82px;
  overflow-y: auto;
}
.ai-conn-chip {
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: transparent;
  color: inherit;
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 7px;
  cursor: pointer;
}
.ai-conn-chip.active {
  border-color: #2457d6;
  background: #2457d6;
  color: #ffffff;
}
.ai-conn-subhint {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--ai-color-text-tertiary, #64748b);
}
.ai-conn-status {
  font-size: 11.5px;
  padding: 6px 9px;
  border-radius: 8px;
}
.ai-conn-status.is-ok {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}
.ai-settings-backdrop.ai-dark .ai-conn-status.is-ok {
  color: #34d399;
}
.ai-conn-status.is-err {
  background: rgba(239, 68, 68, 0.12);
  color: #dc2626;
}
.ai-settings-backdrop.ai-dark .ai-conn-status.is-err {
  color: #f87171;
}
.ai-conn-actions {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 4px;
}
.ai-conn-btn-secondary,
.ai-conn-btn-primary {
  height: 31px;
  padding: 0 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.ai-conn-btn-secondary {
  border: 1px solid rgba(148, 163, 184, 0.34);
  background: transparent;
  color: inherit;
}
.ai-conn-btn-primary {
  border: 0;
  background: linear-gradient(135deg, #2457d6, #163b8c);
  color: #ffffff;
}
</style>
