<template>
  <div v-if="advancedToolsOpen" class="ai-md-toolbar">
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
  <div
    v-if="advancedToolsOpen && quickTogglesEnabled && mode === 'chat'"
    class="ai-footer-quick-toggles"
    role="group"
    :aria-label="t.skillStripLabel || '快捷工具'"
  >
    <button
      type="button"
      class="ai-quick-toggle ai-quick-toggle-deepthink"
      :class="{ active: deepThinkEnabled }"
      :aria-pressed="deepThinkEnabled ? 'true' : 'false'"
      :title="
        deepThinkEnabled ? t.deepThinkOn || '深度思考 已开启' : t.deepThinkOff || '深度思考 已关闭'
      "
      @click="$emit('toggleDeepThink', !deepThinkEnabled)"
    >
      <span class="ai-quick-toggle-icon" aria-hidden="true">🧠</span>
      <span class="ai-quick-toggle-label">{{ t.deepThinkLabel || '深度思考' }}</span>
    </button>
    <button
      type="button"
      class="ai-quick-toggle ai-quick-toggle-websearch"
      :class="{ active: webSearchEnabled }"
      :aria-pressed="webSearchEnabled ? 'true' : 'false'"
      :title="
        webSearchEnabled ? t.webSearchOn || '联网搜索 已开启' : t.webSearchOff || '联网搜索 已关闭'
      "
      @click="$emit('toggleWebSearch', !webSearchEnabled)"
    >
      <span class="ai-quick-toggle-icon" aria-hidden="true">🌐</span>
      <span class="ai-quick-toggle-label">{{ t.webSearchLabel || '联网搜索' }}</span>
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
      @paste="onTextareaPaste"
    />
    <span
      v-if="charCountLabel"
      class="ai-char-counter"
      :class="{ 'ai-char-counter-warn': charCountNearLimit }"
      >{{ charCountLabel }}</span
    >
    <div v-if="charLimitWarningText" class="ai-input-risk" role="note">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M11 7h2v7h-2V7zm0 9h2v2h-2v-2z" />
        <path d="M12 2 1 21h22L12 2zm0 4.04L19.53 19H4.47L12 6.04z" />
      </svg>
      <span>{{ charLimitWarningText }}</span>
    </div>
    <div v-if="sendBlockedReason && modelValue.trim()" class="ai-send-risk" role="note">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
      <span>{{ sendBlockedReason }}</span>
      <button
        v-if="sendBlockedActionLabel"
        type="button"
        class="ai-send-risk-action"
        @click="$emit('sendBlockedAction')"
      >
        {{ sendBlockedActionLabel }}
      </button>
    </div>
    <div class="ai-footer-send-group">
      <slot name="footer-plugins" />
      <div
        class="ai-footer-secondary-actions"
        role="group"
        :aria-label="t.skillStripLabel || 'Tools'"
      >
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 4a8 8 0 0 1 7.75 6H22l-3 4-3-4h1.7A6 6 0 1 0 12 18a5.9 5.9 0 0 0 3.76-1.33l1.27 1.55A8 8 0 1 1 12 4z"
            />
          </svg>
        </button>
        <button
          type="button"
          class="ai-tools-toggle"
          :class="{ active: advancedToolsOpen }"
          :title="t.skillStripLabel || 'Tools'"
          :aria-label="t.skillStripLabel || 'Tools'"
          :aria-expanded="advancedToolsOpen ? 'true' : 'false'"
          @click="$emit('update:advancedToolsOpen', !advancedToolsOpen)"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 8.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm0 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
            />
          </svg>
        </button>
      </div>
      <button
        class="ai-send"
        type="button"
        :style="{ backgroundColor: color }"
        :disabled="sendDisabled"
        :title="sendButtonTitle"
        :aria-label="sendButtonTitle"
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
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { SlashCommand } from '../composables/useSlashCommands';
import type { I18nMessages } from '../utils/i18n';

const props = defineProps<{
  modelValue: string;
  mode: 'translate' | 'summarize' | 'chat';
  loading: boolean;
  ctrlEnterToSend: boolean;
  color: string;
  placeholder: string;
  charCountLabel: string;
  charCountNearLimit: boolean;
  charLimitWarningText: string;
  sendBlockedReason: string;
  sendBlockedActionLabel: string;
  voiceSupported: boolean;
  voiceRecording: boolean;
  voiceConversationActive: boolean;
  slashVisible: boolean;
  slashCommands: SlashCommand[];
  historyEnabled: boolean;
  advancedToolsOpen: boolean;
  quickTogglesEnabled: boolean;
  deepThinkEnabled: boolean;
  webSearchEnabled: boolean;
  t: I18nMessages;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:advancedToolsOpen': [value: boolean];
  send: [];
  pasteImage: [event: ClipboardEvent];
  pasteText: [payload: { text: string; event: ClipboardEvent }];
  chatImage: [file: File];
  slashKeydown: [event: KeyboardEvent];
  historyOlder: [];
  historyNewer: [];
  historyReset: [];
  toggleVoice: [];
  toggleVoiceConversation: [];
  toggleDeepThink: [value: boolean];
  toggleWebSearch: [value: boolean];
  sendBlockedAction: [];
}>();

const recallActive = ref(false);
const chatImageInputRef = ref<HTMLInputElement>();
const textareaRef = ref<HTMLTextAreaElement>();
const COMPOSER_MIN_HEIGHT = 34;
const COMPOSER_MAX_HEIGHT = 78;

const sendDisabled = computed(
  () => !props.modelValue.trim() || props.loading || !!props.sendBlockedReason,
);
const sendButtonTitle = computed(() => props.sendBlockedReason || props.t.send);

function onTextareaPaste(event: ClipboardEvent) {
  emit('pasteImage', event);
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (text) emit('pasteText', { text, event });
}

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
  syncTextareaHeight(el);
}

function syncTextareaHeight(el = textareaRef.value) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height =
    Math.min(
      Math.max(el.scrollHeight || COMPOSER_MIN_HEIGHT, COMPOSER_MIN_HEIGHT),
      COMPOSER_MAX_HEIGHT,
    ) + 'px';
}

watch(
  () => props.modelValue,
  () => {
    void nextTick(() => syncTextareaHeight());
  },
);

function onTextareaKeydown(e: KeyboardEvent) {
  if (props.slashVisible && props.slashCommands.length > 0) {
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
  } else if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    recallActive.value = false;
    emit('send');
  }
}
</script>
