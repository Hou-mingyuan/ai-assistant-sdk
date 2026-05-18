<template>
  <div class="ai-footer">
    <div v-if="pendingImageThumbs.length" class="ai-pending-image">
      <span class="ai-pending-image-list">
        <span
          v-for="(thumb, idx) in pendingImageThumbs"
          :key="`${idx}-${thumb.slice(0, 24)}`"
          class="ai-pending-image-item"
        >
          <img :src="thumb" :alt="t.pendingImage" class="ai-pending-image-thumb" />
          <button
            type="button"
            class="ai-pending-image-edit"
            :aria-label="t.editImage"
            @click="$emit('editPendingImage', idx)"
          >
            Edit
          </button>
          <button
            type="button"
            class="ai-pending-image-remove-one"
            :aria-label="t.removeImage"
            @click="$emit('removePendingImage', idx)"
          >
            &times;
          </button>
        </span>
      </span>
      <button
        type="button"
        class="ai-pending-image-remove"
        :aria-label="t.removeImage"
        @click="$emit('clearPendingImage')"
      >
        &times;
      </button>
    </div>
    <div
      v-if="imageRiskVisible"
      class="ai-model-risk"
      role="note"
      :title="t.modelImageRiskWarning.replace('{model}', selectedModel || t.modelStatusUnavailable)"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
      </svg>
      <span>{{
        t.modelImageRiskWarning.replace('{model}', selectedModel || t.modelStatusUnavailable)
      }}</span>
      <button
        v-if="firstVisionModel"
        type="button"
        class="ai-model-risk-action"
        :title="firstVisionModel"
        @click="selectModel(firstVisionModel)"
      >
        {{ t.modelSwitchToVision }}
      </button>
    </div>
    <!-- Slash command popup -->
    <Transition name="ai-slash-fade">
      <div
        v-if="slashVisible && (slashCommands?.length ?? 0) > 0"
        class="ai-slash-popup"
        role="listbox"
      >
        <button
          v-for="(cmd, ci) in slashCommands"
          :key="cmd.name"
          type="button"
          class="ai-slash-item"
          :class="{ 'ai-slash-item-active': ci === slashSelectedIndex }"
          role="option"
          :aria-selected="ci === slashSelectedIndex"
          @pointerenter="$emit('slashHover', ci)"
          @click="$emit('slashSelect', ci)"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            class="ai-slash-icon"
          >
            <path :d="cmd.icon" />
          </svg>
          <span class="ai-slash-name">{{ cmd.name }}</span>
          <span class="ai-slash-desc">{{ cmd.description }}</span>
        </button>
      </div>
    </Transition>
    <div v-if="mode !== 'chat'" class="ai-footer-tools-row">
      <input
        ref="fileInputRef"
        type="file"
        :accept="acceptTypes"
        style="display: none"
        @change="onFileChange"
      />
      <button
        type="button"
        class="ai-upload-inline"
        :disabled="loading"
        @click="fileInputRef?.click()"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-6-6v4h-2v-4H8l4-4 4 4h-2z"
          />
        </svg>
        {{ t.uploadFile }}
      </button>
      <select
        v-if="mode === 'translate'"
        :value="targetLang"
        class="ai-lang-select"
        @change="$emit('update:targetLang', ($event.target as HTMLSelectElement).value)"
      >
        <option value="zh">中文</option>
        <option value="en">English</option>
        <option value="ja">日本語</option>
        <option value="ko">한국어</option>
        <option value="fr">Français</option>
        <option value="de">Deutsch</option>
        <option value="es">Español</option>
        <option value="pt">Português</option>
        <option value="ru">Русский</option>
        <option value="ar">العربية</option>
      </select>
    </div>
    <ChatInputModelRow
      :mode="mode"
      :loading="loading"
      :has-base-url="hasBaseUrl"
      :show-model-picker="showModelPicker"
      :selected-model="selectedModel"
      :default-model="defaultModel"
      :model-choices="modelChoices"
      :model-list-message="modelListMessage"
      :model-status-text="modelStatusText"
      :model-status-kind="modelStatusKind"
      :page-context-configured="pageContextConfigured"
      :page-context-enabled="pageContextEnabled"
      :page-context-block-count="pageContextBlockCount"
      :advanced-tools-open="advancedToolsOpen"
      :t="t"
      @change-mode="$emit('changeMode', $event)"
      @update:selected-model="$emit('update:selectedModel', $event)"
      @toggle-page-context="$emit('togglePageContext')"
    >
      <template #model-row-actions>
        <slot name="model-row-actions" />
      </template>
    </ChatInputModelRow>
    <ChatInputComposer
      :model-value="modelValue"
      :mode="mode"
      :loading="loading"
      :ctrl-enter-to-send="ctrlEnterToSend"
      :color="color"
      :placeholder="placeholder"
      :char-count-label="charCountLabel"
      :char-count-near-limit="charCountNearLimit"
      :char-limit-warning-text="charLimitWarningText"
      :send-blocked-reason="sendBlockedReason"
      :send-blocked-action-label="sendBlockedActionLabel"
      :voice-supported="voiceSupported"
      :voice-recording="voiceRecording"
      :voice-conversation-active="voiceConversationActive"
      :slash-visible="slashVisible"
      :slash-commands="slashCommands"
      :history-enabled="historyEnabled"
      :advanced-tools-open="advancedToolsOpen"
      :quick-toggles-enabled="quickTogglesEnabled"
      :deep-think-enabled="deepThinkEnabled"
      :web-search-enabled="webSearchEnabled"
      :t="t"
      @update:model-value="$emit('update:modelValue', $event)"
      @update:advanced-tools-open="advancedToolsOpen = $event"
      @send="$emit('send')"
      @paste-image="$emit('pasteImage', $event)"
      @paste-text="$emit('pasteText', $event)"
      @chat-image="$emit('chatImage', $event)"
      @slash-keydown="$emit('slashKeydown', $event)"
      @history-older="$emit('historyOlder')"
      @history-newer="$emit('historyNewer')"
      @history-reset="$emit('historyReset')"
      @toggle-voice="$emit('toggleVoice')"
      @toggle-voice-conversation="$emit('toggleVoiceConversation')"
      @toggle-deep-think="$emit('toggleDeepThink', $event)"
      @toggle-web-search="$emit('toggleWebSearch', $event)"
      @send-blocked-action="$emit('sendBlockedAction')"
    >
      <template #footer-plugins>
        <slot name="footer-plugins" />
      </template>
    </ChatInputComposer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import ChatInputComposer from './ChatInputComposer.vue';
import ChatInputModelRow from './ChatInputModelRow.vue';
import type { I18nMessages } from '../utils/i18n';
import type { SlashCommand } from '../composables/useSlashCommands';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    mode: 'translate' | 'summarize' | 'chat';
    loading: boolean;
    ctrlEnterToSend: boolean;
    soundEnabled: boolean;
    color: string;
    placeholder: string;
    charCountLabel: string;
    charCountNearLimit: boolean;
    charLimitWarningText: string;
    sendBlockedReason: string;
    sendBlockedActionLabel: string;
    pendingImageThumbs: string[];
    acceptTypes: string;
    hasBaseUrl: boolean;
    showModelPicker: boolean;
    selectedModel: string;
    defaultModel: string;
    modelChoices: string[];
    modelListMessage: string;
    modelStatusText: string;
    modelStatusKind: 'ready' | 'checking' | 'warning' | 'offline';
    targetLang: string;
    voiceSupported: boolean;
    voiceRecording: boolean;
    voiceConversationActive: boolean;
    t: I18nMessages;
    slashVisible?: boolean;
    slashCommands?: SlashCommand[];
    slashSelectedIndex?: number;
    pageContextConfigured?: boolean;
    pageContextEnabled?: boolean;
    pageContextBlockCount?: number;
    /**
     * K36: 启用 terminal-style ↑/↓ prompt 历史回放。父组件需 wire 对应
     * historyOlder / historyNewer / historyReset 事件到 usePromptHistory。
     * K44 修：Vue 3 给 Boolean 类型 prop 自动默认 false，所以必须 withDefaults
     * 显式默认为 true，否则上层 host 不传 prop 时回放就被错误禁用。
     */
    historyEnabled?: boolean;
    /**
     * Doubao-style quick toggles row above the input. Both default to
     * showing the chips (UI-only stubs) but unchecked. Host can pass
     * `quickTogglesEnabled = false` to hide the whole row, or wire
     * `toggleDeepThink` / `toggleWebSearch` to actual backend flags.
     */
    quickTogglesEnabled?: boolean;
    deepThinkEnabled?: boolean;
    webSearchEnabled?: boolean;
  }>(),
  {
    slashVisible: false,
    slashCommands: () => [],
    slashSelectedIndex: 0,
    pageContextConfigured: false,
    pageContextEnabled: true,
    pageContextBlockCount: 0,
    historyEnabled: true,
    quickTogglesEnabled: true,
    deepThinkEnabled: false,
    webSearchEnabled: false,
    modelStatusText: '',
    modelStatusKind: 'offline',
    defaultModel: '',
    charLimitWarningText: '',
    sendBlockedReason: '',
    sendBlockedActionLabel: '',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:ctrlEnterToSend': [value: boolean];
  'update:soundEnabled': [value: boolean];
  'update:selectedModel': [value: string];
  'update:targetLang': [value: string];
  changeMode: [mode: 'translate' | 'summarize' | 'chat'];
  send: [];
  clearPendingImage: [];
  removePendingImage: [index: number];
  editPendingImage: [index: number];
  fileUpload: [file: File];
  pasteImage: [event: ClipboardEvent];
  /**
   * L1: 普通文本粘贴。除 `pasteImage` 之外额外发出，便于 useFormAutoFill 等
   * 监听者拿到纯文本。`text` 已经从 clipboardData 提取过，不需要消费者再读
   * 一遍；若粘贴中没有文本（如纯图）则不会发射。
   */
  pasteText: [payload: { text: string; event: ClipboardEvent }];
  toggleVoice: [];
  toggleVoiceConversation: [];
  chatImage: [file: File];
  slashKeydown: [event: KeyboardEvent];
  slashSelect: [index: number];
  slashHover: [index: number];
  togglePageContext: [];
  historyOlder: [];
  historyNewer: [];
  historyReset: [];
  /**
   * Doubao-style quick toggles. The host can listen to apply the desired
   * side effects (model param, tool plugin, etc.). `value` is the new
   * desired state after the click.
   */
  toggleDeepThink: [value: boolean];
  toggleWebSearch: [value: boolean];
  sendBlockedAction: [];
}>();

const fileInputRef = ref<HTMLInputElement>();
const advancedToolsOpen = ref(false);
const selectedModelNormalized = computed(() => props.selectedModel.trim().toLowerCase());
const selectedModelLooksVisionCapable = computed(() =>
  isLikelyVisionModel(selectedModelNormalized.value),
);
const imageRiskVisible = computed(
  () =>
    props.mode === 'chat' &&
    props.pendingImageThumbs.length > 0 &&
    !!props.selectedModel.trim() &&
    !selectedModelLooksVisionCapable.value,
);
const firstVisionModel = computed(
  () =>
    props.modelChoices.find(
      (model) => model !== props.selectedModel && isLikelyVisionModel(model.toLowerCase()),
    ) || '',
);

function selectModel(model: string) {
  emit('update:selectedModel', model);
}

function isLikelyVisionModel(model: string) {
  if (!model) return false;
  return (
    /(?:^|[-_:./])(?:vl|vision|visual|image|multimodal|omni)(?:[-_:./]|$)/i.test(model) ||
    /gpt-4o|gemini|pixtral|llava|qwen.*vl|claude-(?:3|4)/i.test(model)
  );
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (file) emit('fileUpload', file);
}
</script>
