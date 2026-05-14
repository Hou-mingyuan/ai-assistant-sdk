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
    <div class="ai-md-toolbar">
      <button
        type="button"
        class="ai-md-btn"
        title="Bold (Ctrl+B)"
        @click="wrapSelection('**', '**')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"
          />
        </svg>
      </button>
      <button
        type="button"
        class="ai-md-btn"
        title="Italic (Ctrl+I)"
        @click="wrapSelection('*', '*')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
        </svg>
      </button>
      <button type="button" class="ai-md-btn" title="Code" @click="wrapSelection('`', '`')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"
          />
        </svg>
      </button>
      <button
        type="button"
        class="ai-md-btn"
        title="Code block"
        @click="wrapSelection('\n```\n', '\n```\n')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8h16v10zm-8-8l-4 4h3v2h2v-2h3l-4-4z"
          />
        </svg>
      </button>
      <button type="button" class="ai-md-btn" title="Link" @click="insertLink">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
          />
        </svg>
      </button>
      <button type="button" class="ai-md-btn" title="List" @click="insertPrefix('- ')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path
            d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"
          />
        </svg>
      </button>
    </div>
    <div class="ai-footer-input-row">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        class="ai-footer-textarea"
        :placeholder="`${placeholder} (${ctrlEnterToSend ? 'Ctrl+Enter' : t.newline})`"
        rows="2"
        :data-recall-active="recallActive ? 'true' : null"
        @input="onTextareaInput"
        @keydown="onTextareaKeydown"
        @paste="$emit('pasteImage', $event)"
      />
      <span
        v-if="charCountLabel"
        class="ai-char-counter"
        :class="{ 'ai-char-counter-warn': charCountNearLimit }"
        >{{ charCountLabel }}</span
      >
      <div class="ai-footer-send-group">
        <slot name="footer-plugins" />
        <input
          v-if="mode === 'chat'"
          ref="chatImageInputRef"
          type="file"
          accept="image/*"
          style="display: none"
          @change="onChatImageChange"
        />
        <button
          v-if="mode === 'chat'"
          type="button"
          class="ai-attach-image"
          :disabled="loading"
          :title="t.pendingImage"
          :aria-label="t.pendingImage"
          @click="chatImageInputRef?.click()"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
            />
          </svg>
        </button>
        <button
          v-if="voiceSupported"
          class="ai-mic"
          :class="{ recording: voiceRecording }"
          type="button"
          :disabled="loading"
          :title="voiceRecording ? t.micStop : t.micStart"
          :aria-label="voiceRecording ? t.micStop : t.micStart"
          :aria-pressed="voiceRecording ? 'true' : 'false'"
          @click="$emit('toggleVoice')"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"
            />
            <path
              d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"
            />
          </svg>
        </button>
        <button
          v-if="voiceSupported && mode === 'chat'"
          class="ai-voice-loop"
          :class="{ active: voiceConversationActive }"
          type="button"
          :disabled="loading"
          :title="voiceConversationActive ? t.voiceLoopOn : t.voiceLoopOff"
          :aria-label="voiceConversationActive ? t.voiceLoopOn : t.voiceLoopOff"
          :aria-pressed="voiceConversationActive ? 'true' : 'false'"
          @click="$emit('toggleVoiceConversation')"
        >
          ↻
        </button>
        <button
          class="ai-send"
          type="button"
          :style="{ backgroundColor: color }"
          :disabled="!modelValue.trim() || loading"
          :title="t.send"
          :aria-label="t.send"
          @click="$emit('send')"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            class="ai-send-icon"
          >
            <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
          </svg>
        </button>
      </div>
    </div>
    <div class="ai-footer-model-row">
      <div class="ai-mode-segmented" role="tablist" aria-label="Mode">
        <button
          type="button"
          role="tab"
          class="ai-mode-segment"
          :class="{ active: mode === 'chat' }"
          :aria-selected="mode === 'chat' ? 'true' : 'false'"
          @click="$emit('changeMode', 'chat')"
        >
          {{ t.chat }}
        </button>
        <button
          type="button"
          role="tab"
          class="ai-mode-segment"
          :class="{ active: mode === 'translate' }"
          :aria-selected="mode === 'translate' ? 'true' : 'false'"
          @click="$emit('changeMode', 'translate')"
        >
          {{ t.translate }}
        </button>
        <button
          type="button"
          role="tab"
          class="ai-mode-segment"
          :class="{ active: mode === 'summarize' }"
          :aria-selected="mode === 'summarize' ? 'true' : 'false'"
          @click="$emit('changeMode', 'summarize')"
        >
          {{ t.summarize }}
        </button>
      </div>
      <select
        v-if="showModelPicker && hasBaseUrl"
        :value="selectedModel"
        class="ai-model-select"
        :disabled="loading || modelChoices.length === 0"
        :aria-label="t.modelLabel"
        @change="$emit('update:selectedModel', ($event.target as HTMLSelectElement).value)"
      >
        <template v-if="modelChoices.length === 0">
          <option value="" disabled>{{ modelListMessage }}</option>
        </template>
        <template v-else>
          <option v-for="m in modelChoices" :key="m" :value="m">{{ m }}</option>
        </template>
      </select>
      <span class="ai-model-row-spacer" />
      <button
        v-if="pageContextConfigured"
        type="button"
        class="ai-page-context-badge"
        :class="{ 'ai-page-context-badge-off': !pageContextEnabled }"
        :title="
          pageContextEnabled
            ? t.pageContextOnTooltip || 'Page context will be attached to your next message'
            : t.pageContextOffTooltip || 'Page context attachment is disabled'
        "
        :aria-pressed="pageContextEnabled ? 'true' : 'false'"
        @click="$emit('togglePageContext')"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"
          />
        </svg>
        <span class="ai-page-context-badge-label">
          {{
            pageContextEnabled
              ? `${t.pageContextOn || 'Context'}${(pageContextBlockCount ?? 0) > 1 ? ' · ' + pageContextBlockCount : ''}`
              : t.pageContextOff || 'Context off'
          }}
        </span>
      </button>
      <slot name="model-row-actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
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
    pendingImageThumbs: string[];
    acceptTypes: string;
    hasBaseUrl: boolean;
    showModelPicker: boolean;
    selectedModel: string;
    modelChoices: string[];
    modelListMessage: string;
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
  }>(),
  {
    slashVisible: false,
    slashCommands: () => [],
    slashSelectedIndex: 0,
    pageContextConfigured: false,
    pageContextEnabled: true,
    pageContextBlockCount: 0,
    historyEnabled: true,
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
  fileUpload: [file: File];
  pasteImage: [event: ClipboardEvent];
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
}>();

/**
 * K36 prompt-history 回放状态：true 表示当前 textarea 内容是 ↑ 召回出来的，
 * ↓ 继续走更新；Escape 退出回放并清空；用户主动 input 则隐式退出。
 */
const recallActive = ref(false);

const fileInputRef = ref<HTMLInputElement>();
const chatImageInputRef = ref<HTMLInputElement>();
const textareaRef = ref<HTMLTextAreaElement>();

function wrapSelection(before: string, after: string) {
  const el = textareaRef.value;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const val = el.value;
  const selected = val.slice(start, end) || 'text';
  const newVal = val.slice(0, start) + before + selected + after + val.slice(end);
  emit('update:modelValue', newVal);
  requestAnimationFrame(() => {
    el.focus();
    const cursorPos = start + before.length + selected.length;
    el.setSelectionRange(start + before.length, cursorPos);
  });
}

function insertLink() {
  const el = textareaRef.value;
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const val = el.value;
  const selected = val.slice(start, end) || 'text';
  const insert = `[${selected}](url)`;
  const newVal = val.slice(0, start) + insert + val.slice(end);
  emit('update:modelValue', newVal);
  requestAnimationFrame(() => {
    el.focus();
    const urlStart = start + selected.length + 3;
    el.setSelectionRange(urlStart, urlStart + 3);
  });
}

function insertPrefix(prefix: string) {
  const el = textareaRef.value;
  if (!el) return;
  const start = el.selectionStart;
  const val = el.value;
  const lineStart = val.lastIndexOf('\n', start - 1) + 1;
  const newVal = val.slice(0, lineStart) + prefix + val.slice(lineStart);
  emit('update:modelValue', newVal);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(start + prefix.length, start + prefix.length);
  });
}

function onChatImageChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (file) emit('chatImage', file);
}

function onTextareaInput(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  if (recallActive.value) {
    recallActive.value = false;
  }
  emit('update:modelValue', el.value);
  el.style.height = 'auto';
  const lineHeight = 22;
  const minH = lineHeight * 2;
  const maxH = lineHeight * 6;
  el.style.height = Math.min(Math.max(el.scrollHeight, minH), maxH) + 'px';
}

function onTextareaKeydown(e: KeyboardEvent) {
  if (props.slashVisible && props.slashCommands && props.slashCommands.length > 0) {
    if (
      ['ArrowUp', 'ArrowDown', 'Tab', 'Escape'].includes(e.key) ||
      (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey)
    ) {
      e.preventDefault();
      emit('slashKeydown', e);
      return;
    }
  }
  if (props.historyEnabled && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
    if (e.key === 'ArrowUp') {
      const empty = !props.modelValue || !props.modelValue.trim();
      if (empty || recallActive.value) {
        e.preventDefault();
        recallActive.value = true;
        emit('historyOlder');
        return;
      }
    } else if (e.key === 'ArrowDown') {
      if (recallActive.value) {
        e.preventDefault();
        emit('historyNewer');
        return;
      }
    } else if (e.key === 'Escape') {
      if (recallActive.value) {
        e.preventDefault();
        recallActive.value = false;
        emit('historyReset');
        return;
      }
    }
  }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
    if (e.key === 'b') {
      e.preventDefault();
      wrapSelection('**', '**');
      return;
    }
    if (e.key === 'i') {
      e.preventDefault();
      wrapSelection('*', '*');
      return;
    }
    if (e.key === 'e') {
      e.preventDefault();
      wrapSelection('`', '`');
      return;
    }
    if (e.key === 'k') {
      e.preventDefault();
      insertLink();
      return;
    }
  }
  if (e.key !== 'Enter') return;
  if (props.ctrlEnterToSend) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      recallActive.value = false;
      emit('send');
    }
  } else {
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      recallActive.value = false;
      emit('send');
    }
  }
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (file) emit('fileUpload', file);
}
</script>
