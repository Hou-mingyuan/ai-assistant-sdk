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
    v-show="!isTransientAbort(msg)"
    :key="`${displayOffset + renderedStart + idx}-${msg.role}`"
    :ref="(el) => attachMeasureRef(el, renderedStart + idx)"
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
        <span class="ai-thinking-text">
          {{ streamStageText(displayOffset + renderedStart + idx, msg) }}
        </span>
        <span class="ai-thinking-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </div>
      <MessageWebSearchMeta
        v-if="
          msg.role === 'assistant' &&
          isActiveStreaming(displayOffset + renderedStart + idx, msg) &&
          !hasVisibleContent(msg.content)
        "
        :meta="msg.meta"
        :content="msg.content"
        :message-key="`${displayOffset + renderedStart + idx}-early`"
        :references-label="t.responseMetaWebSearchReferences || 'References'"
        mode="early"
      />
      <details
        v-if="
          msg.thinking &&
          msg.role === 'assistant' &&
          !isActiveStreaming(displayOffset + renderedStart + idx, msg)
        "
        class="ai-thinking-details"
      >
        <summary class="ai-thinking-summary">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
            class="ai-thinking-icon"
          >
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
            />
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
        v-if="
          isActiveStreaming(displayOffset + renderedStart + idx, msg) &&
          msg.thinking &&
          !hasVisibleContent(msg.content)
        "
        class="ai-thinking-live"
      >
        <span class="ai-thinking-live-label">{{ t.thinkingLive || '正在思考…' }}</span>
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="ai-thinking-content"
          v-html="renderBubble(msg.thinking, displayOffset + renderedStart + idx, true)"
        ></div>
        <!-- eslint-enable vue/no-v-html -->
      </div>
      <!-- Agent steps display -->
      <div v-if="msg.agentSteps && msg.agentSteps.length > 0" class="ai-agent-steps">
        <div
          v-for="step in msg.agentSteps"
          :key="step.id"
          class="ai-agent-step"
          :class="'ai-step-' + step.status"
        >
          <span class="ai-agent-step-icon">
            <template v-if="step.status === 'done'">✓</template>
            <template v-else-if="step.status === 'running'">⟳</template>
            <template v-else-if="step.status === 'error'">✗</template>
            <template v-else>○</template>
          </span>
          <span class="ai-agent-step-label">{{ step.label }}</span>
        </div>
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
      <!-- Tool calls display -->
      <div v-if="msg.toolCalls && msg.toolCalls.length > 0" class="ai-tool-calls">
        <details
          v-for="(tc, tci) in msg.toolCalls"
          :key="tci"
          class="ai-tool-call-item"
          :open="tc.status === 'running'"
        >
          <summary class="ai-tool-call-summary">
            <span class="ai-tool-call-status" :class="'ai-tool-' + tc.status">
              <svg
                v-if="tc.status === 'running'"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
                class="ai-tool-spin"
              >
                <path
                  d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
                />
              </svg>
              <svg
                v-else-if="tc.status === 'done'"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
                />
              </svg>
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
      <template
        v-else-if="
          !(
            isActiveStreaming(displayOffset + renderedStart + idx, msg) &&
            !hasVisibleContent(msg.content)
          )
        "
      >
        <MessageReadingPreview
          v-if="shouldShowReadingPreview(msg, displayOffset + renderedStart + idx)"
          :content="msg.content"
          :expanded="isReadingExpanded(displayOffset + renderedStart + idx)"
          :message-key="`${displayOffset + renderedStart + idx}`"
          @toggle="toggleReadingExpanded(displayOffset + renderedStart + idx)"
        />
        <!-- eslint-disable vue/no-v-html -- 渲染内容已由 useAiMarkdownRenderer 统一清洗 -->
        <div
          v-if="
            !shouldShowReadingPreview(msg, displayOffset + renderedStart + idx) ||
            isReadingExpanded(displayOffset + renderedStart + idx)
          "
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
        <MessageWebSearchMeta
          v-if="msg.role === 'assistant'"
          :meta="msg.meta"
          :content="msg.content"
          :message-key="`${displayOffset + renderedStart + idx}`"
          :references-label="t.responseMetaWebSearchReferences || 'References'"
          @regenerate-with-citations="
            emit('regenerate-with-citations', displayOffset + renderedStart + idx)
          "
        />
      </template>
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
      <span class="ai-stream-progress-stage">
        {{ streamStageText(displayOffset + renderedStart + idx, msg) }}
      </span>
      ·
      <span v-if="firstTokenAt != null" class="ai-stream-progress-ttft">
        {{ t.streamTtftLabel || 'TTFT' }}
        {{ ((firstTokenAt - streamStartedAt) / 1000).toFixed(1) }}s ·
      </span>
      {{ msg.content.length }} {{ t.streamProgressChars || 'chars' }}
      ·
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
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
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
          <svg
            v-else
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        <button
          type="button"
          class="ai-msg-regenerate"
          :title="t.regenerate"
          :aria-label="t.regenerate"
          @click="emit('regenerate-at', displayOffset + renderedStart + idx)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M21 12a9 9 0 0 1-15.1 6.64" />
            <path d="M3 12A9 9 0 0 1 18.1 5.36" />
            <path d="M21 3v6h-6" />
            <path d="M3 21v-6h6" />
          </svg>
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M7 10v12" />
            <path
              d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"
            />
          </svg>
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
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M17 14V2" />
            <path
              d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"
            />
          </svg>
        </button>
      </div>
      <span v-if="msg.timestamp" class="ai-msg-time">{{ formatRelativeTime(msg.timestamp) }}</span>
      <div v-if="msg.meta" class="ai-msg-meta">
        <span v-if="runtimeModelLabel(msg)" class="ai-msg-meta-pill">
          {{ t.responseMetaEffectiveModel || 'Actual' }} {{ runtimeModelLabel(msg) }}
        </span>
        <span v-if="msg.meta.fallback" class="ai-msg-meta-pill">
          {{ t.responseMetaFallback || 'Model switched' }}
        </span>
        <span v-if="msg.meta.webSearchEnabled" class="ai-msg-meta-pill">
          {{ t.responseMetaWebSearch || 'Web' }} {{ webSearchProviderLabel(msg.meta) }}
        </span>
        <span v-if="msg.meta.webSearchResultCount != null" class="ai-msg-meta-pill">
          {{ webSearchResultLabel(msg.meta.webSearchResultCount) }}
        </span>
        <span v-if="msg.meta.webSearchFallback" class="ai-msg-meta-pill">
          {{ t.responseMetaWebSearchFallback || 'Search fallback' }}
        </span>
        <span v-if="msg.meta.webSearchFailureReason" class="ai-msg-meta-pill">
          {{ msg.meta.webSearchFailureReason }}
        </span>
        <span v-if="msg.meta.elapsedMs != null" class="ai-msg-meta-pill">
          {{ t.responseMetaElapsed || 'Elapsed' }} {{ formatMs(msg.meta.elapsedMs) }}
        </span>
        <button
          v-if="hasSecondaryMeta(msg.meta)"
          type="button"
          class="ai-msg-meta-toggle"
          :aria-expanded="
            isMetaDetailsExpanded(displayOffset + renderedStart + idx) ? 'true' : 'false'
          "
          :aria-label="
            isMetaDetailsExpanded(displayOffset + renderedStart + idx)
              ? t.responseMetaHideLabel || 'Hide details'
              : t.responseMetaMoreLabel || 'More details'
          "
          :title="
            isMetaDetailsExpanded(displayOffset + renderedStart + idx)
              ? t.responseMetaHideLabel || 'Hide details'
              : t.responseMetaMoreLabel || 'More details'
          "
          @click="toggleMetaDetails(displayOffset + renderedStart + idx)"
        >
          ⋯
        </button>
        <div
          v-if="
            hasSecondaryMeta(msg.meta) && isMetaDetailsExpanded(displayOffset + renderedStart + idx)
          "
          class="ai-msg-meta-secondary"
        >
          <span v-if="msg.meta.visionInputCount" class="ai-msg-meta-pill">
            {{ t.responseMetaVision || 'Vision' }} {{ msg.meta.visionInputCount }}
          </span>
          <span v-if="msg.meta.visionRoute" class="ai-msg-meta-pill">
            {{ t.responseMetaVisionRoute || 'Vision route' }} {{ msg.meta.visionRoute }}
          </span>
          <span v-if="msg.meta.ttftMs != null" class="ai-msg-meta-pill">
            {{ t.responseMetaTtft || 'TTFT' }} {{ formatMs(msg.meta.ttftMs) }}
          </span>
          <span v-if="msg.meta.retried" class="ai-msg-meta-pill">
            {{ t.responseMetaRetried || 'Retried' }}
          </span>
          <span v-if="msg.meta.webSearchDurationMs != null" class="ai-msg-meta-pill">
            Search {{ formatMs(msg.meta.webSearchDurationMs) }}
          </span>
          <span v-if="msg.meta.webSearchStableDurationMs != null" class="ai-msg-meta-pill">
            Stable {{ formatMs(msg.meta.webSearchStableDurationMs) }}
          </span>
          <span v-if="msg.meta.webSearchFallbackDurationMs != null" class="ai-msg-meta-pill">
            Fallback {{ formatMs(msg.meta.webSearchFallbackDurationMs) }}
          </span>
          <a
            v-for="(url, sourceIdx) in webSearchSourceUrls(msg.meta)"
            :key="`${displayOffset + renderedStart + idx}-source-${sourceIdx}`"
            class="ai-msg-meta-pill ai-msg-meta-source-link"
            :href="url"
            target="_blank"
            rel="noopener noreferrer"
            @click.stop
          >
            {{ t.responseMetaWebSearchSource || 'Source' }} {{ sourceIdx + 1 }}
          </a>
        </div>
      </div>
    </div>
    <!-- K24: extended reactions row. Distinct from .ai-msg-actions above which
         holds the canonical thumbs-up/down (kept for backwards i18n + analytics
         compatibility). The bar below adds love/favorite/pin which the host
         can wire to a reaction-tracking backend via @set-reaction. -->
    <MessageReactionBar
      v-if="msg.role === 'assistant' && msg.content && !loading"
      :message-id="String(displayOffset + renderedStart + idx)"
      :selected="msg.reactions?.selected ?? ''"
      :counts="msg.reactions?.counts ?? {}"
      :reactions="[
        { emoji: '❤️', label: t.reactLove || '喜欢 / Love' },
        { emoji: '⭐', label: t.reactFavorite || '收藏 / Favorite' },
        { emoji: '📌', label: t.reactPin || '钉选 / Pin' },
      ]"
      @reaction="
        (p) => emit('set-reaction', displayOffset + renderedStart + idx, p.emoji, p.toggled)
      "
    />
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
import { computed, ref, watch, nextTick, onBeforeUnmount } from 'vue';
import type { Message } from '../types/message';
import type { I18nMessages } from '../utils/i18n/types';
import MessageReadingPreview from './MessageReadingPreview.vue';
import MessageWebSearchMeta from './MessageWebSearchMeta.vue';
/* K24: MessageReactionBar enables a 3-emoji extended reaction row (❤ ⭐ 📌)
 * under each assistant message. Lazy-imported so the chunk only loads when
 * a message is actually rendered. */
import { defineAsyncComponent } from 'vue';
const MessageReactionBar = defineAsyncComponent(() => import('./MessageReactionBar.vue'));

function formatMs(value: number) {
  if (!Number.isFinite(value) || value < 0) return '0.0s';
  return `${(value / 1000).toFixed(1)}s`;
}

function runtimeModelLabel(msg: Message) {
  const effective = msg.meta?.effectiveModel?.trim();
  if (!effective) return '';
  const selected = msg.meta?.model?.trim() || msg.meta?.requestedModel?.trim();
  return selected && selected === effective ? '' : effective;
}

function webSearchProviderLabel(meta: Message['meta']) {
  return meta?.webSearchProvider?.trim() || '';
}

function webSearchResultLabel(count: number) {
  const safeCount = Number.isFinite(count) && count >= 0 ? count : 0;
  const unit =
    safeCount === 1
      ? props.t.responseMetaWebSearchResult || 'result'
      : props.t.responseMetaWebSearchResults || 'results';
  return `${safeCount} ${unit}`;
}

function webSearchSourceUrls(meta: Message['meta']) {
  return (meta?.webSearchSourceUrls || []).filter((url) => typeof url === 'string' && url.trim());
}

function webSearchSourcePreviews(meta: Message['meta']) {
  return (meta?.webSearchSourcePreviews || []).filter(
    (source) => source && (source.title || source.url || source.snippet),
  );
}

function hasSecondaryMeta(meta: Message['meta']): boolean {
  if (!meta) return false;
  return (
    (typeof meta.visionInputCount === 'number' && meta.visionInputCount > 0) ||
    Boolean(meta.visionRoute) ||
    typeof meta.ttftMs === 'number' ||
    Boolean(meta.retried) ||
    typeof meta.webSearchDurationMs === 'number' ||
    typeof meta.webSearchStableDurationMs === 'number' ||
    typeof meta.webSearchFallbackDurationMs === 'number' ||
    webSearchSourcePreviews(meta).length > 0 ||
    webSearchSourceUrls(meta).length > 0
  );
}

const expandedMetaDetails = ref<Set<number>>(new Set());
const expandedReadingMessages = ref<Set<number>>(new Set());
const READING_PREVIEW_MIN_CHARS = 900;
const READING_PREVIEW_MIN_LINES = 10;

function isMetaDetailsExpanded(globalIdx: number): boolean {
  return expandedMetaDetails.value.has(globalIdx);
}

function toggleMetaDetails(globalIdx: number) {
  const next = new Set(expandedMetaDetails.value);
  if (next.has(globalIdx)) {
    next.delete(globalIdx);
  } else {
    next.add(globalIdx);
  }
  expandedMetaDetails.value = next;
}

function shouldShowReadingPreview(msg: Message, globalIdx: number): boolean {
  if (msg.role !== 'assistant') return false;
  if (props.isActiveStreaming(globalIdx, msg)) return false;
  const content = msg.content || '';
  if (content.length >= READING_PREVIEW_MIN_CHARS) return true;
  return content.split(/\r?\n/).filter((line) => line.trim()).length >= READING_PREVIEW_MIN_LINES;
}

function isReadingExpanded(globalIdx: number): boolean {
  return expandedReadingMessages.value.has(globalIdx);
}

function toggleReadingExpanded(globalIdx: number) {
  const next = new Set(expandedReadingMessages.value);
  if (next.has(globalIdx)) next.delete(globalIdx);
  else next.add(globalIdx);
  expandedReadingMessages.value = next;
}

function streamStageText(globalIdx: number, msg: Message) {
  if (!props.isActiveStreaming(globalIdx, msg)) return props.t.replying;
  if (msg.meta?.webSearchEnabled && !props.hasVisibleContent(msg.content)) {
    return props.t.streamStageSearchingWeb || 'Searching web…';
  }
  if (props.firstTokenAt != null || props.hasVisibleContent(msg.content)) {
    return props.t.streamStageGenerating || props.t.replying;
  }
  if (
    props.streamStartedAt != null &&
    props.streamingNowMs > 0 &&
    props.streamingNowMs - props.streamStartedAt >= 1200
  ) {
    return props.t.streamStageWaitingFirstToken || props.t.replying;
  }
  return props.t.streamStageConnecting || props.t.replying;
}

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
  streamStartedAt: {
    type: Number as PropType<number | null>,
    default: null,
  },
  firstTokenAt: {
    type: Number as PropType<number | null>,
    default: null,
  },
  streamingNowMs: {
    type: Number,
    default: 0,
  },
  /**
   * D1: 真实高度测量回调。当宿主启用虚拟滚动时传入，
   * MessageList 会给每条 v-for 渲染的消息挂 ResizeObserver，
   * 在 contentRect 变化时回调宿主的 `virtualScroll.updateMeasuredHeight`。
   * 注意这里传的是 displayedMessages 内部索引，不是全局消息索引，
   * 让 spacer 计算从 90px 估算转为真实像素，消除长会话滚动跳动。
   */
  onMeasureHeight: {
    type: Function as PropType<(globalIdx: number, height: number) => void>,
    default: undefined,
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
  (e: 'regenerate-with-citations', globalIdx: number): void;
  (e: 'set-feedback', globalIdx: number, kind: 'up' | 'down'): void;
  /**
   * K24: extended reaction system via MessageReactionBar. `toggled` is true
   * when the same emoji is clicked again (clearing the selection).
   */
  (e: 'set-reaction', globalIdx: number, emoji: string, toggled: boolean): void;
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

/* D1: ResizeObserver-based height measurement for virtual scroll precision.
 * 仅当宿主传入 onMeasureHeight (即启用虚拟滚动) 时才创建共享 observer。
 * v-for ref function 在 mount 时传 el、unmount 时传 null，方便清理。 */
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
