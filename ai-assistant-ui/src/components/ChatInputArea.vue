<template>
  <div class="ai-footer">
    <!-- Pending document pill for File Upload Q&A -->
    <div v-if="pendingFile" class="ai-pending-file">
      <AssistantIcon name="file-text" :size="14" />
      <span class="ai-pending-file-name" :title="pendingFile.name">
        {{ pendingFile.name }} ({{ formatFileSize(pendingFile.size) }})
      </span>
      <button
        type="button"
        class="ai-pending-file-remove"
        aria-label="移除文件"
        @click="$emit('clearPendingFile')"
      >
        &times;
      </button>
    </div>

    <!-- Pending pasted / selected images -->
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

    <!-- Minimal slash command popup -->
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

    <div class="ai-footer-input-row">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        class="ai-footer-textarea"
        :placeholder="effectivePlaceholder"
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
      >
        {{ charCountLabel }}
      </span>
      <div v-if="charLimitWarningText" class="ai-input-risk" role="note">
        <AssistantIcon name="triangle-alert" :size="14" />
        <span>{{ charLimitWarningText }}</span>
      </div>

      <div class="ai-footer-send-group">
        <div class="ai-footer-secondary-actions" role="group" :aria-label="t.uploadFile || 'Tools'">
          <input
            ref="fileInputRef"
            type="file"
            :accept="acceptTypes"
            style="display: none"
            @change="onFileChange"
          />
          <button
            type="button"
            class="ai-attach-file"
            :disabled="loading"
            :title="t.uploadFile || 'Upload file'"
            :aria-label="t.uploadFile || 'Upload file'"
            @click="openFilePicker"
          >
            <AssistantIcon name="file-up" :size="15" :stroke-width="1.9" />
          </button>
          <input
            ref="chatImageInputRef"
            type="file"
            accept="image/*"
            style="display: none"
            @change="onChatImageChange"
          />
          <button
            type="button"
            class="ai-attach-image"
            :disabled="loading"
            :title="t.pendingImage"
            :aria-label="t.pendingImage"
            @click="chatImageInputRef?.click()"
          >
            <AssistantIcon name="image" :size="15" :stroke-width="1.9" />
          </button>
          <button
            v-if="formAutoFillEnabled"
            type="button"
            class="ai-form-fill-trigger"
            :disabled="loading"
            :title="t.formFillAction || 'Auto-fill form'"
            :aria-label="t.formFillAction || 'Auto-fill form'"
            @click="$emit('triggerFormFill')"
          >
            <AssistantIcon name="square-check-big" :size="15" :stroke-width="1.9" />
          </button>
          <select
            v-if="showModelPicker && hasBaseUrl && modelChoices.length > 1"
            :value="selectedModel"
            class="ai-model-mini-select"
            :disabled="loading"
            :aria-label="t.modelLabel"
            @change="$emit('update:selectedModel', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="m in modelChoices" :key="m" :value="m">{{ m }}</option>
          </select>
        </div>
        <button
          class="ai-send"
          type="button"
          :style="{ backgroundColor: color }"
          :disabled="sendDisabled"
          :title="t.send"
          :aria-label="t.send"
          @click="$emit('send')"
        >
          <AssistantIcon name="arrow-up" :size="17" :stroke-width="2.2" class="ai-send-icon" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import AssistantIcon from './AssistantIcon.vue';
import type { I18nMessages } from '../utils/i18n';
import type { SlashCommand } from '../composables/useSlashCommands';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    loading: boolean;
    ctrlEnterToSend: boolean;
    color: string;
    placeholder: string;
    charCountLabel: string;
    charCountNearLimit: boolean;
    charLimitWarningText: string;
    pendingFile?: File | null;
    pendingImageThumbs: string[];
    acceptTypes: string;
    hasBaseUrl: boolean;
    showModelPicker: boolean;
    selectedModel: string;
    modelChoices: string[];
    formAutoFillEnabled?: boolean;
    t: I18nMessages;
    slashVisible?: boolean;
    slashCommands?: SlashCommand[];
    slashSelectedIndex?: number;
    historyEnabled?: boolean;
  }>(),
  {
    pendingFile: null,
    formAutoFillEnabled: false,
    slashVisible: false,
    slashCommands: () => [],
    slashSelectedIndex: 0,
    historyEnabled: true,
    charLimitWarningText: '',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'update:selectedModel': [value: string];
  send: [];
  clearPendingFile: [];
  clearPendingImage: [];
  removePendingImage: [index: number];
  fileSelect: [file: File];
  pasteImage: [event: ClipboardEvent];
  pasteText: [payload: { text: string; event: ClipboardEvent }];
  chatImage: [file: File];
  triggerFormFill: [];
  slashKeydown: [event: KeyboardEvent];
  slashSelect: [index: number];
  slashHover: [index: number];
  historyOlder: [];
  historyNewer: [];
  historyReset: [];
}>();

const fileInputRef = ref<HTMLInputElement>();
const chatImageInputRef = ref<HTMLInputElement>();
const textareaRef = ref<HTMLTextAreaElement>();
const recallActive = ref(false);

const COMPOSER_MIN_HEIGHT = 34;
const COMPOSER_MAX_HEIGHT_COMPACT = 88;
const COMPOSER_MAX_HEIGHT_EXPANDED = 150;
let textareaResizeObserver: ResizeObserver | null = null;

const sendDisabled = computed(
  () =>
    props.loading ||
    (!props.modelValue.trim() && !props.pendingFile && props.pendingImageThumbs.length === 0),
);

const effectivePlaceholder = computed(() => {
  if (props.pendingFile) {
    return `${props.pendingFile.name} · 输入问题后发送（留空直接总结）`;
  }
  return `${props.placeholder} (${props.ctrlEnterToSend ? 'Ctrl+Enter' : props.t.newline})`;
});

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function openFilePicker() {
  fileInputRef.value?.click();
}

function focusInput() {
  textareaRef.value?.focus({ preventScroll: true });
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (file) emit('fileSelect', file);
}

function onChatImageChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  target.value = '';
  if (file) emit('chatImage', file);
}

function onTextareaPaste(event: ClipboardEvent) {
  emit('pasteImage', event);
  const text = event.clipboardData?.getData('text/plain') ?? '';
  if (text) emit('pasteText', { text, event });
}

function onTextareaInput(event: Event) {
  const el = event.target as HTMLTextAreaElement;
  if (recallActive.value) recallActive.value = false;
  emit('update:modelValue', el.value);
  syncTextareaHeight(el);
}

function syncTextareaHeight(el = textareaRef.value) {
  if (!el) return;
  el.style.height = 'auto';
  const wrapper = el.closest('.ai-assistant-wrapper') as HTMLElement | null;
  const maxH = wrapper?.classList.contains('panel-expanded')
    ? COMPOSER_MAX_HEIGHT_EXPANDED
    : COMPOSER_MAX_HEIGHT_COMPACT;
  el.style.height =
    Math.min(Math.max(el.scrollHeight || COMPOSER_MIN_HEIGHT, COMPOSER_MIN_HEIGHT), maxH) + 'px';
}

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
    if (e.key === 'ArrowUp' && (!props.modelValue.trim() || recallActive.value)) {
      e.preventDefault();
      recallActive.value = true;
      emit('historyOlder');
      return;
    }
    if (e.key === 'ArrowDown' && recallActive.value) {
      e.preventDefault();
      emit('historyNewer');
      return;
    }
    if (e.key === 'Escape' && recallActive.value) {
      e.preventDefault();
      recallActive.value = false;
      emit('historyReset');
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

onMounted(() => {
  void nextTick(() => {
    syncTextareaHeight();
    const wrapper = textareaRef.value?.closest('.ai-assistant-wrapper');
    if (!wrapper || typeof ResizeObserver === 'undefined') return;
    textareaResizeObserver = new ResizeObserver(() => syncTextareaHeight());
    textareaResizeObserver.observe(wrapper);
  });
});

onBeforeUnmount(() => {
  textareaResizeObserver?.disconnect();
  textareaResizeObserver = null;
});

watch(
  () => props.modelValue,
  () => void nextTick(() => syncTextareaHeight()),
);

defineExpose({ openFilePicker, focusInput });
</script>
