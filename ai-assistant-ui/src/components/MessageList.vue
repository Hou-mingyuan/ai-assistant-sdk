<template>
  <div v-if="hiddenOlderCount > 0 && !renderAllMessages" class="ai-older-msgs-banner">
    <button type="button" class="ai-older-msgs-btn" @click="emit('show-all-older-messages')">
      {{ showEarlierLabel }}
    </button>
  </div>
  <div
    v-if="virtualSlice && virtualSlice.enabled && virtualSlice.topSpacer > 0"
    class="ai-msg-virtual-spacer ai-msg-virtual-spacer-top"
    :style="{ minHeight: virtualSlice.topSpacer + 'px' }"
    aria-hidden="true"
  ></div>
  <div
    v-for="(msg, idx) in renderedMessages"
    v-show="!isTransientAbort(msg)"
    :key="`${displayOffset + renderedStart + idx}-${msg.role}`"
    :ref="(el) => attachMeasureRef(el, renderedStart + idx)"
    :class="[
      'ai-msg',
      msg.role,
      { 'ai-msg-streaming': isActiveStreaming(displayOffset + renderedStart + idx, msg) },
    ]"
    :data-ai-msg-global-idx="displayOffset + renderedStart + idx"
  >
    <span
      v-if="msg.role === 'assistant'"
      class="ai-assistant-avatar"
      :class="{
        'ai-assistant-avatar-loading': isActiveStreaming(displayOffset + renderedStart + idx, msg),
      }"
      aria-hidden="true"
    >
      <BrandMark
        class="ai-assistant-avatar-icon"
        :size="16"
        :active="isActiveStreaming(displayOffset + renderedStart + idx, msg)"
        data-assistant-icon="sparkles"
      />
    </span>
    <template v-if="editingIdx === displayOffset + renderedStart + idx">
      <div class="ai-bubble ai-bubble-editing">
        <textarea
          ref="editTextareaRef"
          :value="editingText"
          class="ai-edit-textarea"
          rows="3"
          @input="onEditInput($event)"
          @keydown.enter.exact.prevent="emit('confirm-edit', displayOffset + renderedStart + idx)"
          @keydown.escape="emit('cancel-edit')"
        ></textarea>
        <div class="ai-edit-actions">
          <button type="button" class="ai-edit-cancel" @click="emit('cancel-edit')">
            {{ t.closePanel }}
          </button>
          <button
            type="button"
            class="ai-edit-confirm"
            @click="emit('confirm-edit', displayOffset + renderedStart + idx)"
          >
            {{ t.send }}
          </button>
        </div>
      </div>
      <span v-if="msg.timestamp" class="ai-msg-time">{{ formatRelativeTime(msg.timestamp) }}</span>
    </template>
    <template v-else>
      <div
        v-if="
          isActiveStreaming(displayOffset + renderedStart + idx, msg) &&
          !hasVisibleContent(msg.content)
        "
        class="ai-thinking-bubble"
        role="status"
        aria-live="polite"
      >
        <span class="ai-thinking-orb" aria-hidden="true"></span>
        <span class="ai-thinking-text">{{ t.replying }}</span>
      </div>
      <div
        v-if="
          isActiveStreaming(displayOffset + renderedStart + idx, msg) &&
          !hasVisibleContent(msg.content)
        "
        class="ai-skeleton"
        aria-hidden="true"
      >
        <span class="ai-skeleton-line"></span>
        <span class="ai-skeleton-line"></span>
        <span class="ai-skeleton-line ai-skeleton-line-sm"></span>
      </div>
      <div v-if="msg.role === 'user' && messageImageThumbs(msg).length > 0" class="ai-user-images">
        <img
          v-for="(thumb, imageIdx) in messageImageThumbs(msg)"
          :key="`${displayOffset + renderedStart + idx}-${imageIdx}`"
          :src="thumb"
          :alt="t.pendingImage"
          class="ai-user-image-thumb"
        />
      </div>
      <!-- eslint-disable vue/no-v-html -- 渲染内容已由 useAiMarkdownRenderer 统一清洗 -->
      <div
        v-if="
          !(
            isActiveStreaming(displayOffset + renderedStart + idx, msg) &&
            !hasVisibleContent(msg.content)
          )
        "
        class="ai-bubble"
        v-html="
          renderBubble(
            msg.content,
            displayOffset + renderedStart + idx,
            loading && msg.role === 'assistant' && idx === messages.length - 1,
          )
        "
      ></div>
      <!-- eslint-enable vue/no-v-html -->
      <span v-if="msg.role !== 'assistant' && msg.timestamp" class="ai-msg-time">
        {{ formatRelativeTime(msg.timestamp) }}
      </span>
    </template>
    <span
      v-if="
        isActiveStreaming(displayOffset + renderedStart + idx, msg) &&
        hasVisibleContent(msg.content) &&
        streamStartedAt != null &&
        streamingNowMs > 0
      "
      class="ai-stream-progress"
      role="status"
      aria-live="polite"
    >
      <span class="ai-stream-progress-dot" aria-hidden="true"></span>
      {{ msg.content.length }} {{ t.streamProgressChars || 'chars' }} ·
      {{ ((streamingNowMs - streamStartedAt) / 1000).toFixed(1) }}s
    </span>
    <button
      v-if="isActiveStreaming(displayOffset + renderedStart + idx, msg)"
      type="button"
      class="ai-stop-generate ai-msg-stop"
      :title="t.stopGenerate"
      :aria-label="t.stopGenerate"
      @click="emit('stop-generate')"
    >
      {{ t.stopGenerate }}
    </button>
    <div
      v-if="msg.role === 'user' && !loading && editingIdx !== displayOffset + renderedStart + idx"
      class="ai-msg-actions"
    >
      <button
        type="button"
        class="ai-msg-edit"
        :title="t.msgCtxEdit"
        :aria-label="t.msgCtxEdit"
        @click="emit('start-edit', displayOffset + renderedStart + idx)"
      >
        <AssistantIcon name="pencil" :size="14" />
      </button>
    </div>
    <div
      v-if="msg.role === 'assistant' && !loading && (msg.content || msg.timestamp || msg.meta)"
      class="ai-msg-footer"
    >
      <div v-if="msg.content" class="ai-msg-actions">
        <button
          type="button"
          class="ai-msg-copy"
          :title="t.copyCode"
          :aria-label="t.copyCode"
          @click="
            emit(
              'copy-message',
              msg.contentArchive ?? msg.content,
              displayOffset + renderedStart + idx,
            )
          "
        >
          <span
            v-if="copiedIndex === displayOffset + renderedStart + idx"
            class="ai-msg-action-text"
          >
            {{ t.codeCopied }}
          </span>
          <AssistantIcon v-else name="copy" :size="14" />
        </button>
        <button
          v-if="formAutoFillEnabled"
          type="button"
          class="ai-msg-form-fill"
          :title="t.formFillAction || 'Fill form'"
          :aria-label="t.formFillAction || 'Fill form'"
          @click="emit('form-fill', displayOffset + renderedStart + idx)"
        >
          <AssistantIcon name="square-check-big" :size="14" />
        </button>
        <button
          type="button"
          class="ai-msg-regenerate"
          :title="t.regenerate"
          :aria-label="t.regenerate"
          @click="emit('regenerate-at', displayOffset + renderedStart + idx)"
        >
          <AssistantIcon name="rotate-ccw" :size="14" />
        </button>
      </div>
      <span v-if="msg.timestamp" class="ai-msg-time">{{ formatRelativeTime(msg.timestamp) }}</span>
      <span v-if="msg.meta?.elapsedMs != null" class="ai-msg-meta">
        <span class="ai-msg-meta-pill">{{ (msg.meta.elapsedMs / 1000).toFixed(1) }}s</span>
      </span>
    </div>
    <button
      v-if="isErrorMessage(msg) && !loading"
      type="button"
      class="ai-retry-btn"
      @click="emit('retry-last-error', displayOffset + renderedStart + idx)"
    >
      <AssistantIcon name="rotate-ccw" :size="15" />
      <span>{{ t.retryError }}</span>
    </button>
  </div>
  <div
    v-if="virtualSlice && virtualSlice.enabled && virtualSlice.bottomSpacer > 0"
    class="ai-msg-virtual-spacer ai-msg-virtual-spacer-bottom"
    :style="{ minHeight: virtualSlice.bottomSpacer + 'px' }"
    aria-hidden="true"
  ></div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import type { Message } from '../types/message';
import type { I18nMessages } from '../utils/i18n/types';
import type { VirtualWindow } from '../composables/useMessageVirtualScroll';
import AssistantIcon from './AssistantIcon.vue';
import BrandMark from './BrandMark.vue';

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
  isErrorMessage: {
    type: Function as PropType<(msg: Message) => boolean>,
    required: true,
  },
  virtualSlice: {
    type: Object as PropType<VirtualWindow | null>,
    default: null,
  },
  streamStartedAt: {
    type: Number as PropType<number | null>,
    default: null,
  },
  streamingNowMs: {
    type: Number,
    default: 0,
  },
  onMeasureHeight: {
    type: Function as PropType<(globalIdx: number, height: number) => void>,
    default: undefined,
  },
  formAutoFillEnabled: {
    type: Boolean,
    default: false,
  },
});

const renderedStart = computed(() =>
  props.virtualSlice && props.virtualSlice.enabled ? props.virtualSlice.startIndex : 0,
);
const renderedMessages = computed(() => {
  if (!props.virtualSlice || !props.virtualSlice.enabled) return props.messages;
  return props.messages.slice(props.virtualSlice.startIndex, props.virtualSlice.endIndex);
});

const emit = defineEmits<{
  (e: 'show-all-older-messages'): void;
  (e: 'confirm-edit', globalIdx: number): void;
  (e: 'cancel-edit'): void;
  (e: 'update:editing-text', text: string): void;
  (e: 'stop-generate'): void;
  (e: 'start-edit', globalIdx: number): void;
  (e: 'copy-message', text: string, globalIdx: number): void;
  (e: 'form-fill', globalIdx: number): void;
  (e: 'regenerate-at', globalIdx: number): void;
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
          // ignore
        }
      }
    });
  },
);

const measuredElements = new Map<number, Element>();
const measuredElementIndexes = new WeakMap<Element, number>();
let measureObserver: ResizeObserver | null = null;

function getMeasureObserver(): ResizeObserver | null {
  if (typeof props.onMeasureHeight !== 'function' || typeof ResizeObserver === 'undefined') {
    return null;
  }
  if (!measureObserver) {
    measureObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const globalIdx = measuredElementIndexes.get(entry.target);
        if (globalIdx == null) continue;
        const h = entry.contentRect.height || (entry.target as HTMLElement).offsetHeight;
        if (h > 0) props.onMeasureHeight!(globalIdx, h);
      }
    });
  }
  return measureObserver;
}

function attachMeasureRef(el: unknown, globalIdx: number) {
  const observer = getMeasureObserver();
  if (!observer) return;
  const existing = measuredElements.get(globalIdx);
  if (existing) {
    observer.unobserve(existing);
    measuredElements.delete(globalIdx);
  }
  if (el && el instanceof Element) {
    measuredElements.set(globalIdx, el);
    measuredElementIndexes.set(el, globalIdx);
    observer.observe(el);
  }
}

onBeforeUnmount(() => {
  measureObserver?.disconnect();
  measureObserver = null;
  measuredElements.clear();
});

function messageImageThumbs(msg: Message): string[] {
  if (msg.imageThumbs?.length) return msg.imageThumbs;
  return msg.imageThumb ? [msg.imageThumb] : [];
}
</script>
