<template>
  <div v-if="hiddenOlderCount > 0 && !renderAllMessages" class="ai-older-msgs-banner">
    <button type="button" class="ai-older-msgs-btn" @click="emit('show-all-older-messages')">
      {{ showEarlierLabel }}
    </button>
  </div>
  <!--
    C10 虚拟窗口：当 `virtualSlice` 启用时，只渲染 [startIndex, endIndex) 区间
    的消息，用 spacer div 撑开剩余高度以保持 scrollbar 行为正确。spacer 通过
    `min-height` 而非 height 避免与 flex 父容器冲突。
  -->
  <div
    v-if="virtualSlice && virtualSlice.enabled && virtualSlice.topSpacer > 0"
    class="ai-msg-virtual-spacer ai-msg-virtual-spacer-top"
    :style="{ minHeight: virtualSlice.topSpacer + 'px' }"
    aria-hidden="true"
  ></div>
  <div
    v-for="(msg, idx) in renderedMessages"
    :key="`${displayOffset + renderedStart + idx}-${msg.role}`"
    v-show="!isTransientAbort(msg)"
    :class="[
      'ai-msg',
      msg.role,
      { 'ai-msg-streaming': isActiveStreaming(displayOffset + renderedStart + idx, msg) },
      { 'ai-msg-selected': selectMode && selectedIndices.has(displayOffset + renderedStart + idx) },
    ]"
    :data-ai-msg-global-idx="displayOffset + renderedStart + idx"
    @click="selectMode ? emit('toggle-selection', displayOffset + renderedStart + idx) : undefined"
  >
    <input
      v-if="selectMode"
      type="checkbox"
      class="ai-msg-checkbox"
      :checked="selectedIndices.has(displayOffset + renderedStart + idx)"
      @click.stop="emit('toggle-selection', displayOffset + renderedStart + idx)"
    />
    <span
      v-if="msg.role === 'assistant'"
      class="ai-assistant-avatar"
      :class="{
        'ai-assistant-avatar-loading': isActiveStreaming(displayOffset + renderedStart + idx, msg),
      }"
      aria-hidden="true"
    ></span>
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
      <span v-if="msg.timestamp" class="ai-msg-time">{{
        formatRelativeTime(msg.timestamp)
      }}</span>
    </template>
    <template v-else>
      <div
        v-if="
          isActiveStreaming(displayOffset + renderedStart + idx, msg) && !hasVisibleContent(msg.content)
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
      <details
        v-if="msg.thinking && msg.role === 'assistant' && !isActiveStreaming(displayOffset + renderedStart + idx, msg)"
        class="ai-thinking-details"
      >
        <summary class="ai-thinking-summary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" class="ai-thinking-icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          {{ t.thinkingLabel || '思考过程' }}
        </summary>
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="ai-thinking-content"
          v-html="renderBubble(msg.thinking, displayOffset + renderedStart + idx, false)"
        ></div>
        <!-- eslint-enable vue/no-v-html -->
      </details>
      <div
        v-if="isActiveStreaming(displayOffset + renderedStart + idx, msg) && msg.thinking && !hasVisibleContent(msg.content)"
        class="ai-thinking-live"
      >
        <span class="ai-thinking-live-label">{{ t.thinkingLive || '正在思考…' }}</span>
        <!-- eslint-disable vue/no-v-html -->
        <div class="ai-thinking-content" v-html="renderBubble(msg.thinking, displayOffset + renderedStart + idx, true)"></div>
        <!-- eslint-enable vue/no-v-html -->
      </div>
      <!-- Agent steps display -->
      <div v-if="msg.agentSteps && msg.agentSteps.length > 0" class="ai-agent-steps">
        <div v-for="step in msg.agentSteps" :key="step.id" class="ai-agent-step" :class="'ai-step-' + step.status">
          <span class="ai-agent-step-icon">
            <template v-if="step.status === 'done'">✓</template>
            <template v-else-if="step.status === 'running'">⟳</template>
            <template v-else-if="step.status === 'error'">✗</template>
            <template v-else>○</template>
          </span>
          <span class="ai-agent-step-label">{{ step.label }}</span>
        </div>
      </div>
      <!-- Tool calls display -->
      <div v-if="msg.toolCalls && msg.toolCalls.length > 0" class="ai-tool-calls">
        <details v-for="(tc, tci) in msg.toolCalls" :key="tci" class="ai-tool-call-item" :open="tc.status === 'running'">
          <summary class="ai-tool-call-summary">
            <span class="ai-tool-call-status" :class="'ai-tool-' + tc.status">
              <svg v-if="tc.status === 'running'" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="ai-tool-spin"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
              <svg v-else-if="tc.status === 'done'" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            </span>
            <span class="ai-tool-call-name">{{ tc.name }}</span>
          </summary>
          <div class="ai-tool-call-body">
            <pre v-if="tc.arguments" class="ai-tool-call-args">{{ tc.arguments }}</pre>
            <div v-if="tc.result" class="ai-tool-call-result">
              <span class="ai-tool-result-label">{{ t.toolResult || '结果' }}</span>
              <pre class="ai-tool-call-result-pre">{{ tc.result }}</pre>
            </div>
          </div>
        </details>
      </div>
      <!-- eslint-disable vue/no-v-html -- 渲染内容已由 useAiMarkdownRenderer 统一清洗 -->
      <div
        v-else
        class="ai-bubble"
        @contextmenu="onBubbleContextMenu($event, displayOffset + renderedStart + idx, msg.role)"
        v-html="
          renderBubble(
            msg.content,
            displayOffset + renderedStart + idx,
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
          emit('copy-message', msg.contentArchive ?? msg.content, displayOffset + renderedStart + idx)
        "
      >
        {{ copiedIndex === displayOffset + renderedStart + idx ? t.codeCopied : '📋' }}
      </button>
      <button
        type="button"
        class="ai-msg-regenerate"
        :title="t.regenerate"
        :aria-label="t.regenerate"
        @click="emit('regenerate-at', displayOffset + renderedStart + idx)"
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
        @click="emit('set-feedback', displayOffset + renderedStart + idx, 'up')"
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
        @click="emit('set-feedback', displayOffset + renderedStart + idx, 'down')"
      >
        👎
      </button>
    </div>
    <button
      v-if="isErrorMessage(msg) && !loading"
      type="button"
      class="ai-retry-btn"
      @click="emit('retry-last-error', displayOffset + renderedStart + idx)"
    >
      🔄 {{ t.retryError }}
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
import { computed, ref, watch, nextTick } from 'vue';
import type { Message } from '../types/message';
import type { I18nMessages } from '../utils/i18n/types';

/** C10: Virtual scroll slice passed from the parent. When `enabled` is true,
 *  MessageList only renders `[startIndex, endIndex)` of `messages` and pads
 *  the surrounding scroll area with two spacer divs to preserve scrollbar
 *  geometry. Defaults to undefined → full render (legacy behaviour). */
export interface VirtualSlice {
  enabled: boolean;
  startIndex: number;
  endIndex: number;
  topSpacer: number;
  bottomSpacer: number;
}

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
  virtualSlice: {
    type: Object as PropType<VirtualSlice | null>,
    default: null,
  },
});

/* When virtualization is active, slice the messages array to the visible
   window; otherwise pass through as-is. `renderedStart` always carries the
   correct offset so child handlers can rebuild the global message index. */
const renderedStart = computed(() =>
  props.virtualSlice && props.virtualSlice.enabled ? props.virtualSlice.startIndex : 0,
);
const renderedMessages = computed(() => {
  if (!props.virtualSlice || !props.virtualSlice.enabled) return props.messages;
  return props.messages.slice(props.virtualSlice.startIndex, props.virtualSlice.endIndex);
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
