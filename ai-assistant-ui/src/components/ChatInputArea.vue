<template>
  <div class="ai-footer">
    <div v-if="pendingImageThumb" class="ai-pending-image">
      <img :src="pendingImageThumb" :alt="t.pendingImage" class="ai-pending-image-thumb" />
      <button
        type="button"
        class="ai-pending-image-remove"
        :aria-label="t.removeImage"
        @click="$emit('clearPendingImage')"
      >
        &times;
      </button>
    </div>
    <div class="ai-footer-input-row">
      <textarea
        :value="modelValue"
        class="ai-footer-textarea"
        :placeholder="`${placeholder} (${ctrlEnterToSend ? 'Ctrl+Enter' : t.newline})`"
        rows="2"
        @input="onTextareaInput"
        @keydown="onTextareaKeydown"
        @paste="$emit('pasteImage', $event)"
      />
      <span
        v-if="charCountLabel"
        class="ai-char-counter"
        :class="{ 'ai-char-counter-warn': charCountNearLimit }"
      >{{ charCountLabel }}</span>
      <div class="ai-footer-send-group">
        <input
          ref="fileInputRef"
          type="file"
          :accept="acceptTypes"
          style="display: none"
          @change="onFileChange"
        />
        <button
          v-if="mode !== 'chat'"
          type="button"
          class="ai-upload"
          :disabled="loading"
          :title="t.uploadFile"
          :aria-label="t.uploadFile"
          @click="fileInputRef?.click()"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-6-6v4h-2v-4H8l4-4 4 4h-2z"
            />
          </svg>
        </button>
        <slot name="footer-plugins" />
        <button
          type="button"
          class="ai-ctrl-enter-toggle"
          :class="{ active: soundEnabled }"
          :title="soundEnabled ? 'Sound: ON' : 'Sound: OFF'"
          @click="$emit('update:soundEnabled', !soundEnabled)"
        >
          {{ soundEnabled ? '🔔' : '🔕' }}
        </button>
        <button
          type="button"
          class="ai-ctrl-enter-toggle"
          :class="{ active: ctrlEnterToSend }"
          :title="ctrlEnterToSend ? 'Ctrl+Enter → Send' : 'Enter → Send'"
          @click="$emit('update:ctrlEnterToSend', !ctrlEnterToSend)"
        >
          ⏎
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
    <div
      v-if="mode === 'chat' && showModelPicker && hasBaseUrl"
      class="ai-footer-model-row"
    >
      <select
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';

const props = defineProps<{
  modelValue: string;
  mode: 'translate' | 'summarize' | 'chat';
  loading: boolean;
  ctrlEnterToSend: boolean;
  soundEnabled: boolean;
  color: string;
  placeholder: string;
  charCountLabel: string;
  charCountNearLimit: boolean;
  pendingImageThumb: string | null;
  acceptTypes: string;
  hasBaseUrl: boolean;
  showModelPicker: boolean;
  selectedModel: string;
  modelChoices: string[];
  modelListMessage: string;
  t: I18nMessages;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:ctrlEnterToSend': [value: boolean];
  'update:soundEnabled': [value: boolean];
  'update:selectedModel': [value: string];
  send: [];
  clearPendingImage: [];
  fileUpload: [file: File];
  pasteImage: [event: ClipboardEvent];
}>();

const fileInputRef = ref<HTMLInputElement>();

function onTextareaInput(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  emit('update:modelValue', el.value);
  el.style.height = 'auto';
  const lineHeight = 22;
  const minH = lineHeight * 2;
  const maxH = lineHeight * 6;
  el.style.height = Math.min(Math.max(el.scrollHeight, minH), maxH) + 'px';
}

function onTextareaKeydown(e: KeyboardEvent) {
  if (e.key !== 'Enter') return;
  if (props.ctrlEnterToSend) {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      emit('send');
    }
  } else {
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
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
