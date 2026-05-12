<template>
  <div v-if="hiddenOlderCount > 0 && !renderAllMessages" class="ai-older-msgs-banner">
    <button type="button" class="ai-older-msgs-btn" @click="emit('show-all-older-messages')">
      {{ showEarlierLabel }}
    </button>
  </div>
  <div
    v-for="(msg, idx) in messages"
    :key="`${displayOffset + idx}-${msg.role}`"
    v-show="!isTransientAbort(msg)"
    :class="[
      'ai-msg',
      msg.role,
      { 'ai-msg-streaming': isActiveStreaming(displayOffset + idx, msg) },
      { 'ai-msg-selected': selectMode && selectedIndices.has(displayOffset + idx) },
    ]"
    :data-ai-msg-global-idx="displayOffset + idx"
    @click="selectMode ? emit('toggle-selection', displayOffset + idx) : undefined"
  >
    <input
      v-if="selectMode"
      type="checkbox"
      class="ai-msg-checkbox"
      :checked="selectedIndices.has(displayOffset + idx)"
      @click.stop="emit('toggle-selection', displayOffset + idx)"
    />
    <span
      v-if="msg.role === 'assistant'"
      class="ai-assistant-avatar"
      :class="{
        'ai-assistant-avatar-loading': isActiveStreaming(displayOffset + idx, msg),
      }"
      aria-hidden="true"
    ></span>
    <template v-if="editingIdx === displayOffset + idx">
      <div class="ai-bubble ai-bubble-editing">
        <textarea
          ref="editTextareaRef"
          :value="editingText"
          class="ai-edit-textarea"
          rows="3"
          @input="onEditInput($event)"
          @keydown.enter.exact.prevent="emit('confirm-edit', displayOffset + idx)"
          @keydown.escape="emit('cancel-edit')"
        ></textarea>
        <div class="ai-edit-actions">
          <button type="button" class="ai-edit-cancel" @click="emit('cancel-edit')">
            {{ t.closePanel }}
          </button>
          <button
            type="button"
            class="ai-edit-confirm"
            @click="emit('confirm-edit', displayOffset + idx)"
          >
            {{ t.send }}
          </button>
        </div>
      </div>
      <span v-if="msg.timestamp" class="ai-msg-time">{{
        formatRelativeTime(msg.timestamp)
      }}</span>
    </template>
    <template v-else>
      <div
        v-if="
          isActiveStreaming(displayOffset + idx, msg) && !hasVisibleContent(msg.content)
        "
        class="ai-thinking-bubble"
        role="status"
        aria-live="polite"
      >
        <span class="ai-thinking-orb" aria-hidden="true"></span>
        <span class="ai-thinking-text">{{ t.replying }}</span>
        <span class="ai-thinking-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>
      <!-- eslint-disable vue/no-v-html -- 渲染内容已由 useAiMarkdownRenderer 统一清洗 -->
      <div
        v-else
        class="ai-bubble"
        @contextmenu="onBubbleContextMenu($event, displayOffset + idx, msg.role)"
        v-html="
          renderBubble(
            msg.content,
            displayOffset + idx,
            loading && msg.role === 'assistant' && idx === messages.length - 1,
          )
        "
      ></div>
      <!-- eslint-enable vue/no-v-html -->
      <span v-if="msg.timestamp" class="ai-msg-time">{{
        formatRelativeTime(msg.timestamp)
      }}</span>
    </template>
    <button
      v-if="isActiveStreaming(displayOffset + idx, msg)"
      type="button"
      class="ai-stop-generate ai-msg-stop"
      :title="t.stopGenerate"
      :aria-label="t.stopGenerate"
      @click="emit('stop-generate')"
    >
      {{ t.stopGenerate }}
    </button>
    <div
      v-if="msg.role === 'user' && !loading && editingIdx !== displayOffset + idx"
      class="ai-msg-actions"
    >
      <button
        type="button"
        class="ai-msg-edit"
        :title="t.msgCtxEdit"
        :aria-label="t.msgCtxEdit"
        @click="emit('start-edit', displayOffset + idx)"
      >
        ✏️
      </button>
    </div>
    <div v-if="msg.role === 'assistant' && msg.content && !loading" class="ai-msg-actions">
      <button
        type="button"
        class="ai-msg-copy"
        :title="t.copyCode"
        :aria-label="t.copyCode"
        @click="
          emit('copy-message', msg.contentArchive ?? msg.content, displayOffset + idx)
        "
      >
        {{ copiedIndex === displayOffset + idx ? t.codeCopied : '📋' }}
      </button>
      <button
        type="button"
        class="ai-msg-regenerate"
        :title="t.regenerate"
        :aria-label="t.regenerate"
        @click="emit('regenerate-at', displayOffset + idx)"
      >
        🔄
      </button>
      <button
        type="button"
        class="ai-msg-feedback"
        :class="{ active: msg.feedback === 'up' }"
        :title="t.thumbsUp"
        :aria-label="t.thumbsUp"
        :aria-pressed="msg.feedback === 'up' ? 'true' : 'false'"
        @click="emit('set-feedback', displayOffset + idx, 'up')"
      >
        👍
      </button>
      <button
        type="button"
        class="ai-msg-feedback"
        :class="{ active: msg.feedback === 'down' }"
        :title="t.thumbsDown"
        :aria-label="t.thumbsDown"
        :aria-pressed="msg.feedback === 'down' ? 'true' : 'false'"
        @click="emit('set-feedback', displayOffset + idx, 'down')"
      >
        👎
      </button>
    </div>
    <button
      v-if="isErrorMessage(msg) && !loading"
      type="button"
      class="ai-retry-btn"
      @click="emit('retry-last-error', displayOffset + idx)"
    >
      🔄 {{ t.retryError }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import { ref, watch, nextTick } from 'vue';
import type { Message } from '../types/message';
import type { I18nMessages } from '../utils/i18n/types';

const props = defineProps({
  messages: {
    type: Array as PropType<Message[]>,
    required: true,
  },
  displayOffset: {
    type: Number,
    required: true,
  },
  hiddenOlderCount: {
    type: Number,
    required: true,
  },
  renderAllMessages: {
    type: Boolean,
    required: true,
  },
  selectMode: {
    type: Boolean,
    required: true,
  },
  selectedIndices: {
    type: Object as PropType<Set<number>>,
    required: true,
  },
  loading: {
    type: Boolean,
    required: true,
  },
  editingIdx: {
    type: Number as PropType<number | null>,
    default: null,
  },
  editingText: {
    type: String,
    required: true,
  },
  copiedIndex: {
    type: Number as PropType<number | null>,
    default: null,
  },
  showEarlierLabel: {
    type: String,
    required: true,
  },
  t: {
    type: Object as PropType<I18nMessages>,
    required: true,
  },
  isTransientAbort: {
    type: Function as PropType<(msg: Message) => boolean>,
    required: true,
  },
  isActiveStreaming: {
    type: Function as PropType<(globalIdx: number, msg: Message) => boolean>,
    required: true,
  },
  hasVisibleContent: {
    type: Function as PropType<(content: string) => boolean>,
    required: true,
  },
  formatRelativeTime: {
    type: Function as PropType<(timestamp: number) => string>,
    required: true,
  },
  renderBubble: {
    type: Function as PropType<(content: string, globalIdx: number, isLast: boolean) => string>,
    required: true,
  },
  onBubbleContextMenu: {
    type: Function as PropType<(event: MouseEvent, globalIdx: number, role: string) => void>,
    required: true,
  },
  isErrorMessage: {
    type: Function as PropType<(msg: Message) => boolean>,
    required: true,
  },
});

const emit = defineEmits<{
  (e: 'show-all-older-messages'): void;
  (e: 'toggle-selection', globalIdx: number): void;
  (e: 'confirm-edit', globalIdx: number): void;
  (e: 'cancel-edit'): void;
  (e: 'update:editing-text', text: string): void;
  (e: 'stop-generate'): void;
  (e: 'start-edit', globalIdx: number): void;
  (e: 'copy-message', text: string, globalIdx: number): void;
  (e: 'regenerate-at', globalIdx: number): void;
  (e: 'set-feedback', globalIdx: number, kind: 'up' | 'down'): void;
  (e: 'retry-last-error', globalIdx: number): void;
}>();

function onEditInput(event: Event) {
  const target = event.target as HTMLTextAreaElement | null;
  if (!target) return;
  emit('update:editing-text', target.value);
}

const editTextareaRef = ref<HTMLTextAreaElement | null>(null);

watch(
  () => props.editingIdx,
  (idx) => {
    if (idx == null) return;
    nextTick(() => {
      const el = editTextareaRef.value;
      if (el) {
        el.focus();
        try {
          el.setSelectionRange(el.value.length, el.value.length);
        } catch {
          // ignore selection failures (older browsers)
        }
      }
    });
  },
);
</script>
