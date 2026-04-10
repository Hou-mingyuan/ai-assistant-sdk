<template>
  <div
    ref="wrapperRef"
    class="ai-assistant-wrapper"
    :class="[
      effectivePositionClass,
      panelOpenFabAlignClass,
      themeClass,
      edgeDockClass,
      {
        'panel-mounted': panelMountedForLayout,
        'panel-expanded': panelExpanded && isOpen,
        'fab-session-hidden': fabHidden && !panelMountedForLayout,
      },
    ]"
    :style="wrapperStyle"
  >
    <!-- Floating Button：打开/关闭过渡期间保留在 DOM 中，便于从球心缩放面板 -->
    <button
      v-show="!fabHidden && (!isOpen || showFabDuringPanelAnim)"
      ref="fabRef"
      type="button"
      class="ai-fab"
      :class="{ 'ai-fab-dragging': fabDragging }"
      :style="fabLayoutStyle"
      @pointerdown="onFabPointerDown"
      @contextmenu.prevent="onFabContextMenu"
      :aria-label="t.fabOpen"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-3 12H7v-2h10v2zm0-3H7V9h10v2zm0-3H7V6h10v2z"/>
      </svg>
    </button>

    <!-- Chat Panel -->
    <Transition
      name="ai-panel"
      @before-enter="onPanelBeforeEnter"
      @after-enter="onPanelAfterEnter"
      @before-leave="onPanelBeforeLeave"
      @after-leave="onPanelAfterLeave"
    >
      <div
        v-if="isOpen"
        :id="uid + '-panel'"
        class="ai-panel"
        :style="panelStyle"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="uid + '-title'"
      >
        <div class="ai-panel-resize-overlay" aria-hidden="true">
          <div
            v-for="rz in resizeZoneDefs"
            :key="rz.edge"
            :class="['ai-panel-rz', rz.cls]"
            :title="t.resizePanel"
            :aria-hidden="true"
            @pointerdown.stop.prevent="(ev) => onPanelResizePointerDown(ev, rz.edge)"
          />
        </div>
        <!-- Header：中间 ai-header-spacer 穿透命中顶边缩放手柄 -->
        <div
          class="ai-header"
          :class="{ 'ai-header-dragging': panelDragging }"
          @pointerdown="onPanelHeaderPointerDown"
        >
          <span
            :id="uid + '-title'"
            class="ai-title"
            :title="sessionTitle || t.title"
          >{{ sessionTitle || t.title }}</span>
          <span class="ai-header-spacer" aria-hidden="true" />
          <div class="ai-header-actions">
            <button
              v-if="mode === 'chat' && showSystemPromptUi"
              type="button"
              class="ai-header-personalize"
              :title="t.personalizeTitle"
              :aria-label="t.personalizeTitle"
              @click.stop="openPersonalize"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.47a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span class="ai-header-personalize-text">{{ t.personalizeTitle }}</span>
            </button>
            <button
              type="button"
              class="ai-expand"
              :title="panelExpanded ? t.shrinkPanel : t.expandPanel"
              :aria-label="panelExpanded ? t.shrinkPanel : t.expandPanel"
              :aria-pressed="panelExpanded ? 'true' : 'false'"
              @click.stop="togglePanelExpand"
            >
              <!-- 与常见系统控件一致：单框=全屏，双框错位=退出全屏 -->
              <svg
                v-if="!panelExpanded"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="5" y="5" width="14" height="14" rx="2.5" />
              </svg>
              <svg
                v-else
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="4" y="9" width="11" height="11" rx="2.25" />
                <rect x="9" y="4" width="11" height="11" rx="2.25" />
              </svg>
            </button>
            <button
              v-for="pl in getPlugins('header')"
              :key="pl.id"
              type="button"
              class="ai-plugin-btn"
              :title="pl.label"
              @click.stop="runPlugin(pl)"
            >{{ pl.icon || pl.label.charAt(0) }}</button>
            <button
              type="button"
              class="ai-new-session"
              :title="t.newSession"
              :aria-label="t.newSession"
              @click="startNewSession"
            >+</button>
            <div v-if="messages.length > 0" class="ai-batch-export-wrap">
              <button
                type="button"
                class="ai-batch-export-btn"
                :title="t.batchExport"
                :aria-label="t.batchExport"
                @click.stop="toggleBatchExportMenu"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
              </button>
              <div v-if="batchExportMenuOpen" class="ai-batch-export-menu">
                <button type="button" @click="batchExportAllJson">{{ t.exportJson }}</button>
                <button type="button" @click="batchExportAllMarkdown">{{ t.exportMarkdown }}</button>
                <button v-if="options.baseUrl" type="button" @click="batchExportAllServer('xlsx')">{{ t.exportServerXlsx }}</button>
                <button v-if="options.baseUrl" type="button" @click="batchExportAllServer('docx')">{{ t.exportServerDocx }}</button>
                <button v-if="options.baseUrl" type="button" @click="batchExportAllServer('pdf')">{{ t.exportServerPdf }}</button>
              </div>
            </div>
            <button
              v-if="messages.length > 0"
              type="button"
              class="ai-clear"
              :title="t.clear"
              :aria-label="t.clear"
              @click="clearMessages"
            >&#x1f5d1;</button>
            <button
              type="button"
              class="ai-close"
              :aria-label="t.closePanel"
              @click="isOpen = false"
            >&times;</button>
          </div>
        </div>

        <div class="ai-sr-only" aria-live="polite" aria-atomic="true">{{ a11yStatusText }}</div>

        <SessionTabs
          :sessions="multiSessions.sessions.value"
          :active-id="multiSessions.activeSessionId.value"
          :new-label="t.newSession"
          @switch="switchToSession"
          @delete="deleteSessionTab"
        />

        <div v-if="messages.length > 0" class="ai-chat-search">
          <input
            v-model="chatSearchInput"
            type="search"
            class="ai-chat-search-input"
            :placeholder="t.searchMessages"
            :aria-label="t.searchMessages"
            autocomplete="off"
            @keydown.enter.exact.prevent="goNextMatch"
            @keydown.enter.shift.prevent="goPrevMatch"
          >
          <span v-if="searchCountLabel" class="ai-search-count">{{ searchCountLabel }}</span>
          <button
            v-if="debouncedSearchQuery.trim()"
            type="button"
            class="ai-search-nav"
            :disabled="totalMatches === 0"
            aria-label="Previous match"
            @click="goPrevMatch"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
          </button>
          <button
            v-if="debouncedSearchQuery.trim()"
            type="button"
            class="ai-search-nav"
            :disabled="totalMatches === 0"
            aria-label="Next match"
            @click="goNextMatch"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>
          </button>
        </div>

        <!-- Messages -->
        <div
          ref="bodyRef"
          class="ai-body"
          :aria-busy="loading"
          @click="handleBodyClick"
          @dragover.prevent="onBodyDragOver"
          @dragenter.prevent="onBodyDragEnter"
          @dragleave.prevent="onBodyDragLeave"
          @drop.prevent="onBodyDrop"
        >
          <Transition name="ai-fade">
            <div v-if="dragActive" class="ai-drop-overlay">
              <div class="ai-drop-overlay-inner">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-6-6v4h-2v-4H8l4-4 4 4h-2z"/>
                </svg>
                <span>{{ t.dropFileHere }}</span>
              </div>
            </div>
          </Transition>
          <div v-if="messages.length === 0" class="ai-empty">
            <p>{{ t.greeting }}</p>
            <div class="ai-quick-actions">
              <button @click="setMode('translate')">{{ t.translate }}</button>
              <button @click="setMode('summarize')">{{ t.summarize }}</button>
              <button @click="setMode('chat')">{{ t.chat }}</button>
            </div>
            <div v-if="promptTemplateList.length > 0" class="ai-prompt-templates">
              <button
                v-for="(tpl, ti) in promptTemplateList"
                :key="ti"
                type="button"
                class="ai-prompt-tpl-btn"
                @click="applyPromptTemplate(tpl)"
              >{{ tpl.label }}</button>
            </div>
          </div>
          <div
            v-if="hiddenOlderCount > 0 && !renderAllMessages"
            class="ai-older-msgs-banner"
          >
            <button type="button" class="ai-older-msgs-btn" @click="showAllOlderMessages">
              {{ showEarlierLabel }}
            </button>
          </div>
          <div
            v-for="(msg, idx) in displayedMessages"
            :key="`${displayOffset + idx}-${msg.role}`"
            :class="['ai-msg', msg.role]"
            :data-ai-msg-global-idx="displayOffset + idx"
          >
            <template v-if="editingMsgIdx === displayOffset + idx">
              <div class="ai-bubble ai-bubble-editing">
                <textarea
                  ref="editTextareaRef"
                  v-model="editingText"
                  class="ai-edit-textarea"
                  rows="3"
                  @keydown.enter.exact.prevent="confirmEditAndResend(displayOffset + idx)"
                  @keydown.escape="cancelEdit"
                ></textarea>
                <div class="ai-edit-actions">
                  <button type="button" class="ai-edit-cancel" @click="cancelEdit">{{ t.closePanel }}</button>
                  <button type="button" class="ai-edit-confirm" @click="confirmEditAndResend(displayOffset + idx)">{{ t.send }}</button>
                </div>
              </div>
            </template>
            <template v-else>
              <div
                class="ai-bubble"
                v-html="renderBubble(msg.content, displayOffset + idx, loading && msg.role === 'assistant' && idx === displayedMessages.length - 1)"
                @contextmenu="onBubbleContextMenu($event, displayOffset + idx, msg.role)"
              ></div>
            </template>
            <div v-if="msg.role === 'user' && !loading && editingMsgIdx !== displayOffset + idx" class="ai-msg-actions">
              <button
                type="button"
                class="ai-msg-edit"
                :title="t.msgCtxEdit"
                :aria-label="t.msgCtxEdit"
                @click="startEdit(displayOffset + idx)"
              >✏️</button>
            </div>
            <div v-if="msg.role === 'assistant' && msg.content && !loading" class="ai-msg-actions">
              <button
                type="button"
                class="ai-msg-copy"
                :title="t.copyCode"
                :aria-label="t.copyCode"
                @click="copyMessage(msg.contentArchive ?? msg.content, displayOffset + idx)"
              >{{ copiedIndex === displayOffset + idx ? t.codeCopied : '📋' }}</button>
              <button
                type="button"
                class="ai-msg-regenerate"
                :title="t.regenerate"
                :aria-label="t.regenerate"
                @click="regenerateAt(displayOffset + idx)"
              >🔄</button>
              <button
                type="button"
                class="ai-msg-feedback"
                :class="{ active: msg.feedback === 'up' }"
                :title="t.thumbsUp"
                @click="setFeedback(displayOffset + idx, 'up')"
              >👍</button>
              <button
                type="button"
                class="ai-msg-feedback"
                :class="{ active: msg.feedback === 'down' }"
                :title="t.thumbsDown"
                @click="setFeedback(displayOffset + idx, 'down')"
              >👎</button>
            </div>
          </div>
          <div v-if="loading" class="ai-msg assistant">
            <div class="ai-bubble">
              <div class="ai-skeleton">
                <div class="ai-skeleton-line"></div>
                <div class="ai-skeleton-line"></div>
                <div class="ai-skeleton-line"></div>
              </div>
            </div>
            <button
              type="button"
              class="ai-stop-generate"
              :title="t.stopGenerate"
              @click="stopGenerate"
            >{{ t.stopGenerate }}</button>
          </div>
        </div>

        <!-- Mode Bar -->
        <div class="ai-mode-bar">
          <button
            v-for="m in modes"
            :key="m.value"
            :class="{ active: mode === m.value }"
            @click="setMode(m.value)"
          >{{ m.label }}</button>
          <select v-if="mode === 'translate'" v-model="targetLang" class="ai-lang-select">
            <option value="zh">中文</option>
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>

        <div
          v-if="mode === 'chat' && quickPrompts.length > 0"
          class="ai-quick-prompts"
        >
          <button
            v-for="(qp, qi) in quickPrompts"
            :key="qi"
            type="button"
            class="ai-quick-prompt-btn"
            @click="input = qp.text"
          >{{ qp.label }}</button>
        </div>

        <!-- Input -->
        <div class="ai-footer">
          <div v-if="pendingImageThumb" class="ai-pending-image">
            <img :src="pendingImageThumb" alt="Pending image" class="ai-pending-image-thumb" />
            <button type="button" class="ai-pending-image-remove" @click="clearPendingImage" aria-label="Remove">&times;</button>
          </div>
          <div class="ai-footer-input-row">
            <textarea
              v-model="input"
              class="ai-footer-textarea"
              :placeholder="`${placeholder} (${t.newline})`"
              rows="2"
              @keydown.enter.exact.prevent="send"
              @paste="onPasteImage"
            />
            <div class="ai-footer-send-group">
              <input
                ref="fileInputRef"
                type="file"
                :accept="ACCEPT_TYPES"
                style="display:none"
                @change="handleFileUpload"
              />
              <button
                v-if="mode !== 'chat'"
                class="ai-upload"
                :disabled="loading"
                @click="fileInputRef?.click()"
                :title="t.uploadFile"
                :aria-label="t.uploadFile"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-6-6v4h-2v-4H8l4-4 4 4h-2z"/>
                </svg>
              </button>
              <button
                v-for="pl in getPlugins('footer')"
                :key="pl.id"
                type="button"
                class="ai-plugin-btn"
                :title="pl.label"
                :disabled="loading"
                @click="runPlugin(pl)"
              >{{ pl.icon || pl.label.charAt(0) }}</button>
              <button
                class="ai-send"
                type="button"
                :style="sendStyle"
                :disabled="!input.trim() || loading"
                :title="t.send"
                :aria-label="t.send"
                @click="send"
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
            v-if="mode === 'chat' && showModelPickerResolved && options.baseUrl"
            class="ai-footer-model-row"
          >
            <select
              v-model="selectedChatModel"
              class="ai-model-select"
              :disabled="loading || modelChoices.length === 0"
              :aria-label="t.modelLabel"
            >
              <template v-if="modelChoices.length === 0">
                <option value="" disabled>{{ t.modelsListEmpty }}</option>
              </template>
              <template v-else>
                <option v-for="m in modelChoices" :key="m" :value="m">{{ m }}</option>
              </template>
            </select>
          </div>
        </div>
      </div>
    </Transition>

    <FabContextMenu
      :show="fabCtxMenu.show"
      :x="fabCtxMenu.x"
      :y="fabCtxMenu.y"
      :color="color"
      :is-dark="isDark"
      :edge-dock="edgeDock"
      :t="t"
      @dock="(edge) => { dockFab(edge); closeFabCtxMenu() }"
      @hide="hideFabUntilPageReload"
    />

    <MessageContextMenu
      :show="msgCtxMenu.show"
      :x="msgCtxMenu.x"
      :y="msgCtxMenu.y"
      :color="color"
      :selection-text="msgCtxMenu.selectionText"
      :has-base-url="!!options.baseUrl"
      :export-busy="exportServerBusy"
      :t="t"
      @copy="copyAssistantSelection"
      @translate="translateAssistantSelection"
      @delete="deleteAssistantAt(msgCtxMenu.index)"
      @export="(fmt) => exportAssistantMessageServer(msgCtxMenu.index, fmt)"
      @fork="forkFromHere(msgCtxMenu.index)"
    />

    <PersonalizeDialog
      :open="personalizeOpen"
      v-model="chatSystemPrompt"
      :is-dark="isDark"
      :disabled="loading"
      :max-chars="systemPromptMaxInputCharsResolved"
      :t="t"
      @close="personalizeOpen = false"
    />

    <ExportToast
      :text="exportToastText"
      :color="color"
      :is-dark="isDark"
    />

    <PageSelectionBar
      :show="pageSel.show && !isOpen"
      :x="pageSel.x"
      :y="pageSel.y"
      :color="color"
      :is-dark="isDark"
      :t="t"
      @action="onPageSelAction"
    />

    <InlineTranslatePopover
      ref="inlineTransPopRef"
      :show="inlineTranslatePopover.show"
      :x="inlineTranslatePopover.x"
      :y="inlineTranslatePopover.y"
      :text="inlineTranslatePopover.text"
      :loading="inlineTranslatePopover.loading"
      :error="inlineTranslatePopover.error"
      :color="color"
      :is-dark="isDark"
      :t="t"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, nextTick, watch, onMounted, onUnmounted } from 'vue'
import FabContextMenu from './FabContextMenu.vue'
import MessageContextMenu from './MessageContextMenu.vue'
import PersonalizeDialog from './PersonalizeDialog.vue'
import InlineTranslatePopover from './InlineTranslatePopover.vue'
import ExportToast from './ExportToast.vue'
import PageSelectionBar from './PageSelectionBar.vue'
import SessionTabs from './SessionTabs.vue'
import type { AiAssistantOptions } from '../index'
import { uploadFile, streamChat, fetchUrlPreview, fetchModels, postServerExport } from '../utils/api'
import type { ExportFormat } from '../utils/api'
import { useStreamWithFallback } from '../composables/useStreamWithFallback'
import { useExportActions } from '../composables/useExportActions'
import { useFabDrag } from '../composables/useFabDrag'
import { usePanelGeometry, RESIZE_ZONES } from '../composables/usePanelGeometry'
import type { PanelResizeEdge } from '../composables/usePanelGeometry'
import { useMsgContextMenu } from '../composables/useMsgContextMenu'
import { getMessages } from '../utils/i18n'
import type { Locale } from '../utils/i18n'
import { useSessionSearch, highlightSearchInHtml } from '../composables/useSessionSearch'
import { useMessageMemoryCap } from '../composables/useMessageMemoryCap'
import { loadPersistedMessages, useChatHistoryPersistence } from '../composables/useChatHistoryPersistence'
import { useExportUi } from '../composables/useExportUi'
import { useAiMarkdownRenderer } from '../composables/useAiMarkdownRenderer'
import { useMultiSession } from '../composables/useMultiSession'
import { providePluginRegistry, usePluginRegistry, type PluginContext } from '../composables/usePluginRegistry'
import { usePageSelection } from '../composables/usePageSelection'
import {
  extractHttpUrls,
  isProbablyDirectImageUrl,
  firstNonImageHttpUrl,
  preferHttpsImageUrlWhenPageIsSecure,
} from '../utils/urlEmbed'

interface Message {
  role: 'user' | 'assistant'
  content: string
  /** 内存 cap 截断展示文案时保留的全文，导出/复制优先使用 */
  contentArchive?: string
  feedback?: 'up' | 'down'
}

const sessionTitle = ref('')
const multiSessions = useMultiSession()
providePluginRegistry()
const { getPlugins } = usePluginRegistry()
const { streamWithFallback } = useStreamWithFallback()

function makePluginContext(): PluginContext {
  return {
    input: input.value,
    messages: messages.value.map(m => ({ role: m.role, content: m.contentArchive ?? m.content })),
    setInput: (text: string) => { input.value = text },
    addMessage: (role: 'user' | 'assistant', content: string) => {
      messages.value.push({ role, content })
      scrollToBottom(true)
    },
  }
}

function runPlugin(plugin: { action: (ctx: PluginContext) => void | Promise<void> }) {
  plugin.action(makePluginContext())
}

const uid = 'ai-' + Math.random().toString(36).slice(2, 8)

const options = inject<AiAssistantOptions>('ai-assistant-options', {
  baseUrl: '/ai-assistant',
  primaryColor: '#6366f1',
  position: 'bottom-right',
  theme: 'light',
  persistHistory: false,
  locale: 'en',
  showSystemPromptEditor: true,
  systemPromptStorageKey: 'ai-assistant-chat-system-prompt',
  systemPromptMaxInputChars: 4000,
  showModelPicker: true,
  selectedModelStorageKey: 'ai-assistant-selected-model',
})

function reportAssistantError(source: string, message: string) {
  options.onAssistantError?.({ source, message })
}

const t = computed(() => getMessages((options.locale || 'en') as Locale))

const { renderContent, clearRenderCache } = useAiMarkdownRenderer(t, options)

const wrapperRef = ref<HTMLElement>()
const isDark = computed(() => {
  if (options.theme === 'dark') return true
  if (options.theme === 'auto') return window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return false
})
const isOpen = ref(false)
/** 本会话内隐藏悬浮球，刷新页面后恢复（不用 localStorage） */
const fabHidden = ref(false)
const input = ref('')
const loading = ref(false)
let streamAbortController: AbortController | null = null
const messages = ref<Message[]>(loadPersistedMessages(!!options.persistHistory))
const { saveHistory, saveHistoryImmediate, clearStoredHistory } = useChatHistoryPersistence(messages, () => !!options.persistHistory)
const { trimMessagesForMemoryCap } = useMessageMemoryCap(messages, options, clearRenderCache)
/** 超过条数时只挂载最近 N 条 DOM，减少长会话卡顿 */
const MAX_RENDERED_MESSAGES = 60
const renderAllMessages = ref(false)
const { exportServerBusy, exportToastText, setExportToast, disposeExportToast } = useExportUi()

const exportActions = useExportActions({
  sessions: multiSessions.sessions,
  messages,
  wrapperRef,
  baseUrl: options.baseUrl,
  accessToken: options.accessToken,
  isDark,
  t,
  exportServerBusy,
  setExportToast,
  reportError: reportAssistantError,
})
const {
  batchExportMenuOpen,
  toggleBatchExportMenu,
  batchExportAllJson,
  batchExportAllMarkdown,
  batchExportAllServer,
  exportAssistantMessageServer,
} = exportActions

const mode = ref<'translate' | 'summarize' | 'chat'>('chat')
const chatSystemPrompt = ref('')
const personalizeOpen = ref(false)
const showSystemPromptUi = computed(() => options.showSystemPromptEditor !== false)
const systemPromptMaxInputCharsResolved = computed(() => {
  const n = options.systemPromptMaxInputChars
  if (n !== undefined && n > 0) {
    return Math.min(16_000, n)
  }
  return 4000
})
const systemPromptStorageKeyResolved = computed(() => {
  const k = options.systemPromptStorageKey?.trim()
  return k || 'ai-assistant-chat-system-prompt'
})

const modelChoices = ref<string[]>([])
const selectedChatModel = ref('')
const showModelPickerResolved = computed(() => options.showModelPicker !== false)
const selectedModelStorageKeyResolved = computed(() =>
  options.selectedModelStorageKey?.trim() || 'ai-assistant-selected-model',
)

async function refreshChatModels() {
  if (!options.baseUrl || !showModelPickerResolved.value) return
  try {
    const r = await fetchModels(options.baseUrl, options.accessToken)
    if (!r.success || !r.models?.length) return
    modelChoices.value = r.models
    const def =
      r.defaultModel && r.models.includes(r.defaultModel) ? r.defaultModel : r.models[0]
    let pick = def
    try {
      const saved = localStorage.getItem(selectedModelStorageKeyResolved.value)
      if (saved && r.models.includes(saved)) pick = saved
    } catch {
      /* ignore */
    }
    selectedChatModel.value = pick
  } catch {
    /* 无 /models 或网络错误：不展示下拉 */
  }
}

function openPersonalize() {
  personalizeOpen.value = true
}

const targetLang = ref('zh')

const msgCtxComposable = useMsgContextMenu({
  messages, loading, baseUrl: options.baseUrl, accessToken: options.accessToken,
  targetLang, t, reportError: reportAssistantError,
})
const { msgCtxMenu, inlineTranslatePopover, closeMsgCtxMenu, onBubbleContextMenu,
  copyAssistantSelection, translateAssistantSelection, closeInlineTranslatePopover,
  deleteAssistantAt, MSG_CTX_MENU_W, MSG_CTX_MENU_H,
  schedulePositionInlineTranslatePopover, detachInlinePopLayoutListeners,
} = msgCtxComposable

const bodyRef = ref<HTMLElement>()
const fileInputRef = ref<HTMLInputElement>()
const dragActive = ref(false)
let dragCounter = 0
const pendingImageData = ref<string | null>(null)
const pendingImageThumb = ref<string | null>(null)

const ACCEPT_TYPES = '.txt,.md,.csv,.log,.json,.xml,.html,.yml,.yaml,.pdf,.docx,.doc,.xlsx,.xls'

const modes = computed(() => [
  { value: 'translate' as const, label: t.value.translate },
  { value: 'summarize' as const, label: t.value.summarize },
  { value: 'chat' as const, label: t.value.chat },
])

const placeholder = computed(() => t.value.placeholder[mode.value] || t.value.placeholder.chat)

const quickPrompts = computed(() => {
  const q = options.quickPrompts
  if (!Array.isArray(q)) return []
  return q.filter((x) => x && typeof x.label === 'string' && typeof x.text === 'string' && x.label && x.text)
})

type PromptTemplate = NonNullable<AiAssistantOptions['promptTemplates']>[number]
const promptTemplateList = computed<PromptTemplate[]>(() => {
  const t = options.promptTemplates
  if (!Array.isArray(t)) return []
  return t.filter((x) => x && typeof x.label === 'string' && typeof x.template === 'string')
})

function applyPromptTemplate(tpl: PromptTemplate) {
  const vars = tpl.variables
  if (!vars || vars.length === 0) {
    input.value = tpl.template
    setMode('chat')
    return
  }
  const values: Record<string, string> = {}
  for (const v of vars) {
    const answer = prompt(v.label, v.default ?? '')
    if (answer === null) return
    values[v.name] = answer
  }
  let text = tpl.template
  for (const [k, val] of Object.entries(values)) {
    text = text.replaceAll(`{{${k}}}`, val)
  }
  input.value = text
  setMode('chat')
}

const {
  chatSearchInput,
  debouncedSearchQuery,
  displayOffset,
  displayedMessages,
  hiddenOlderCount,
  totalMatches,
  currentMatchIdx,
  activeMatchGlobalIdx,
  goNextMatch,
  goPrevMatch,
  resetSearch,
  disposeSearch,
} = useSessionSearch(messages, loading, renderAllMessages, MAX_RENDERED_MESSAGES)

const showEarlierLabel = computed(() =>
  t.value.showEarlierTemplate.replace(/\{n\}/g, String(hiddenOlderCount.value)),
)

function renderBubble(content: string, globalIdx: number, isStreamingLast: boolean): string {
  let html = renderContent(content, t.value.copyCode, isStreamingLast)
  const q = debouncedSearchQuery.value.trim()
  if (q) {
    html = highlightSearchInHtml(html, q, globalIdx === activeMatchGlobalIdx.value)
  }
  return html
}

const searchCountLabel = computed(() => {
  const q = debouncedSearchQuery.value.trim()
  if (!q) return ''
  if (totalMatches.value === 0) return '0'
  return `${currentMatchIdx.value + 1}/${totalMatches.value}`
})
const a11yStatusText = computed(() => {
  if (!isOpen.value) return ''
  if (exportServerBusy.value) return t.value.exportPreparing
  if (loading.value) return t.value.replying
  return ''
})

const color = computed(() => options.primaryColor || '#6366f1')
const positionClass = computed(() => `pos-${options.position || 'bottom-right'}`)

const themeClass = computed(() => isDark.value ? 'ai-dark' : '')

const EDGE_PEEK = 14
const DRAG_CLICK_PX = 8
const DOCK_BREAK_PX = 10
let winResizeRaf = 0

const fabRef = ref<HTMLButtonElement>()
const { selection: pageSel, dismissSelection: dismissPageSel } = usePageSelection(wrapperRef)
const persistFabRef = computed(() => options.persistFabPosition !== false)
const fab = useFabDrag(isOpen, fabHidden, persistFabRef, options.position || 'bottom-right')
const { fabLeft, fabTop, edgeDock, fabDragging, edgeDockClass: fabEdgeDockClass,
  clampFabPos, defaultFabCoords, loadFabPos, saveFabPos, FAB_SIZE } = fab
const panelGeo = usePanelGeometry({
  fabLeft, fabTop, fabSize: FAB_SIZE, isOpen, saveFabPos, clampFabPos,
  defaultPosition: options.position || 'bottom-right',
})
const {
  panelExpanded, panelMountedForLayout, panelDragging, panelOpenFabAlignClass,
  panelTransformOrigin, resizeZoneDefs,
  effectivePanelWidthPx, effectivePanelHeightPx, togglePanelExpand,
  wrapperOffsetFromFab, ensurePanelInViewport, syncFabPixelFromWrapperDom,
  onPanelResizePointerDown, onPanelHeaderPointerDown,
  onPanelOpen, onPanelClose, onWinResizePanel, cleanupGeometry, clampPanelSize,
  panelUserSize, openPanelQuadrant, resolveFabScreenQuadrant,
} = panelGeo
const fabDrag = ref<{
  pointerId: number; startX: number; startY: number; originLeft: number; originTop: number
} | null>(null)

/** 打开前面板的贴边状态；关闭时只恢复贴边，球位保留拖动结果 */
const panelSnapshot = ref<{ edge: 'none' | 'left' | 'right' } | null>(null)
/** 打开面板瞬间的球位；关面板且本会话未拖过标题栏时还原到此（避免仅放大/夹紧视口导致球跑偏） */
const fabFreePosBeforePanel = ref<{ left: number; top: number } | null>(null)
const fabCtxMenu = ref({ show: false, x: 0, y: 0 })
const inlineTransPopRef = ref<InstanceType<typeof InlineTranslatePopover> | null>(null)

/** 面板进出场时短暂保留悬浮球，使缩放原点与球心一致 */
const showFabDuringPanelAnim = ref(true)

function onPanelBeforeEnter() {
  showFabDuringPanelAnim.value = true
}
function onPanelAfterEnter() {
  showFabDuringPanelAnim.value = false
}
function onPanelBeforeLeave() {
  showFabDuringPanelAnim.value = true
}
function onPanelAfterLeave() {
  panelMountedForLayout.value = false
}

const effectivePositionClass = computed(() =>
  fabLeft.value !== null ? '' : positionClass.value,
)

const edgeDockClass = fabEdgeDockClass

const wrapperStyle = computed(() => {
  const st: Record<string, string> = { '--primary': color.value }
  if (panelMountedForLayout.value) {
    st.width = `${effectivePanelWidthPx()}px`
    st.height = `${effectivePanelHeightPx()}px`
  }
  if (fabLeft.value !== null && fabTop.value !== null) {
    let L = fabLeft.value
    let T = fabTop.value
    if (panelMountedForLayout.value) {
      const { dx, dy } = wrapperOffsetFromFab(openPanelQuadrant.value)
      L += dx
      T += dy
    }
    st.left = `${L}px`
    st.top = `${T}px`
    st.right = 'auto'
    st.bottom = 'auto'
  }
  return st
})


/** 打开面板时，避免贴边位置导致 380×520 面板溢出视口（按象限对齐球的锚角后整体夹紧） */
function ensurePanelInViewport() {
  if (fabLeft.value === null || fabTop.value === null) return
  const m = PANEL_VIEWPORT_MARGIN
  const { w: vw, h: vh } = getViewportCssSize()
  const effW = effectivePanelWidthPx()
  const effH = effectivePanelHeightPx()
  const { dx, dy } = wrapperOffsetFromFab(openPanelQuadrant.value)
  let wl = fabLeft.value + dx
  let wt = fabTop.value + dy

  if (wl + effW > vw - m) wl = Math.max(m, vw - effW - m)
  if (wl < m) wl = m
  if (wt + effH > vh - m) wt = Math.max(m, vh - effH - m)
  if (wt < m) wt = m

  fabLeft.value = wl - dx
  fabTop.value = wt - dy
}

/** 菜单预估宽度（与样式同步，用于视口夹紧） */
const FAB_CTX_MENU_W = 236

function estimateFabCtxMenuHeight(): number {
  let n = 0
  if (edgeDock.value !== 'left') n++
  if (edgeDock.value !== 'right') n++
  if (edgeDock.value !== 'none') n++
  n++ // 隐藏至刷新
  const header = 48
  const row = 52
  const listPad = 14
  return header + n * row + listPad
}

function onFabContextMenu(e: MouseEvent) {
  e.preventDefault()
  if (isOpen.value || fabHidden.value) return
  const fab = fabRef.value
  if (!fab) return
  const fr = fab.getBoundingClientRect()
  const pad = 10
  const vw = window.innerWidth
  const vh = window.innerHeight
  const menuH = estimateFabCtxMenuHeight()
  let x = fr.left
  let y = fr.bottom + 6
  if (x + FAB_CTX_MENU_W > vw - pad) x = vw - FAB_CTX_MENU_W - pad
  if (x < pad) x = pad
  if (y + menuH > vh - pad) y = fr.top - menuH - 6
  if (y < pad) y = pad
  fabCtxMenu.value = { show: true, x, y }
}

function closeFabCtxMenu() {
  fabCtxMenu.value.show = false
}

function hideFabUntilPageReload() {
  closeFabCtxMenu()
  fabHidden.value = true
  isOpen.value = false
}

function dockFab(edge: 'none' | 'left' | 'right') {
  fab.dockFab(edge)
  closeFabCtxMenu()
}

function onDocPointerDownCloseFabMenu(e: MouseEvent) {
  const el = e.target
  if (el instanceof Element && el.closest('.ai-fab-ctx-menu')) return
  if (el instanceof Element && el.closest('.ai-msg-ctx-menu')) return
  if (el instanceof Element && el.closest('.ai-inline-trans-pop')) return
  if (inlineTranslatePopover.value.show) closeInlineTranslatePopover()
  if (fabCtxMenu.value.show) closeFabCtxMenu()
  if (msgCtxMenu.value.show) closeMsgCtxMenu()
}

function onFabPointerDown(e: PointerEvent) {
  if (isOpen.value || fabHidden.value || e.button !== 0) return
  e.preventDefault()
  const el = wrapperRef.value
  if (!el) return

  if (fabLeft.value === null || fabTop.value === null) {
    const d = defaultFabCoords()
    fabLeft.value = d.left
    fabTop.value = d.top
  }

  let L = fabLeft.value
  let T = fabTop.value
  if (edgeDock.value === 'left') {
    L = 0
  } else if (edgeDock.value === 'right') {
    L = window.innerWidth - FAB_SIZE
  }
  fabLeft.value = L
  fabTop.value = T
  /* 不在此清除 edgeDock：纯点击打开时仍为贴边，供 watch 记录 dockRestore */

  fabDrag.value = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    originLeft: L,
    originTop: T,
  }
  fabDragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)

  window.addEventListener('pointermove', onFabPointerMove)
  window.addEventListener('pointerup', onFabPointerUp)
  window.addEventListener('pointercancel', onFabPointerUp)
}

function onFabPointerMove(e: PointerEvent) {
  if (!fabDrag.value || e.pointerId !== fabDrag.value.pointerId) return
  const d = fabDrag.value
  const dx = e.clientX - d.startX
  const dy = e.clientY - d.startY
  const movedFromStart = Math.hypot(dx, dy)
  if (movedFromStart > DOCK_BREAK_PX) {
    edgeDock.value = 'none'
  }
  /* 仍在贴边且位移未超过阈值：不移动球，避免误触拖动 */
  if (edgeDock.value !== 'none') {
    return
  }
  const nl = d.originLeft + dx
  const nt = d.originTop + dy
  const c = clampFabPos(nl, nt)
  fabLeft.value = c.left
  fabTop.value = c.top
}

function onFabPointerUp(e: PointerEvent) {
  window.removeEventListener('pointermove', onFabPointerMove)
  window.removeEventListener('pointerup', onFabPointerUp)
  window.removeEventListener('pointercancel', onFabPointerUp)

  if (!fabDrag.value || e.pointerId !== fabDrag.value.pointerId) return

  const d = fabDrag.value
  fabDrag.value = null
  fabDragging.value = false

  if (!d) return

  const dx = e.clientX - d.startX
  const dy = e.clientY - d.startY
  const moved = Math.hypot(dx, dy)

  if (moved < DRAG_CLICK_PX) {
    isOpen.value = true
    saveFabPos()
    return
  }

  saveFabPos()
}

const fabStyle = computed(() => ({ backgroundColor: color.value }))
/** 球直径一半，与面板局部坐标中的球心偏移一致 */
const FAB_R = FAB_SIZE / 2
const fabLayoutStyle = computed(() => {
  const base = fabStyle.value
  if (fabLeft.value !== null) {
    if (panelMountedForLayout.value) {
      return { ...base, position: 'absolute' as const, zIndex: 2 }
    }
    return { ...base, position: 'absolute' as const, left: '0', top: '0', zIndex: 2 }
  }
  const p = options.position || 'bottom-right'
  const map: Record<string, Record<string, string>> = {
    'bottom-right': { position: 'absolute', right: '0', bottom: '0', zIndex: '2' },
    'bottom-left': { position: 'absolute', left: '0', bottom: '0', zIndex: '2' },
    'top-right': { position: 'absolute', right: '0', top: '0', zIndex: '2' },
    'top-left': { position: 'absolute', left: '0', top: '0', zIndex: '2' },
  }
  return { ...base, ...(map[p] || map['bottom-right']) }
})
const panelStyle = computed(
  () =>
    ({
      '--primary': color.value,
      transformOrigin: panelTransformOrigin.value,
    }) as Record<string, string>,
)
const sendStyle = computed(() => ({ backgroundColor: color.value }))

const emit = defineEmits<{
  (e: 'send', payload: { action: string; text: string }): void
  (e: 'response', content: string): void
  (e: 'error', message: string): void
  (e: 'feedback', payload: { index: number; value: 'up' | 'down' | null }): void
}>()

function setMode(m: 'translate' | 'summarize' | 'chat') {
  mode.value = m
}

function startNewSession() {
  saveCurrentSessionToMulti()
  multiSessions.createSession()
  messages.value = []
  renderAllMessages.value = false
  resetSearch()
  clearRenderCache()
  sessionTitle.value = ''
}

function switchToSession(id: string) {
  if (id === multiSessions.activeSessionId.value) return
  saveCurrentSessionToMulti()
  multiSessions.switchSession(id)
  const s = multiSessions.getActiveSession()
  messages.value = s?.messages ?? []
  sessionTitle.value = s?.title ?? ''
  renderAllMessages.value = false
  resetSearch()
  clearRenderCache()
}

function deleteSessionTab(id: string) {
  multiSessions.deleteSession(id)
  const s = multiSessions.getActiveSession()
  messages.value = s?.messages ?? []
  sessionTitle.value = s?.title ?? ''
  clearRenderCache()
}

function forkFromHere(index: number) {
  saveCurrentSessionToMulti()
  const forked = multiSessions.forkFromMessage(multiSessions.activeSessionId.value, index)
  if (forked) {
    messages.value = forked.messages as Message[]
    sessionTitle.value = forked.title
    clearRenderCache()
  }
}

function saveCurrentSessionToMulti() {
  multiSessions.updateActiveMessages(JSON.parse(JSON.stringify(messages.value)))
  if (sessionTitle.value) multiSessions.updateActiveTitle(sessionTitle.value)
}

function clearMessages() {
  messages.value = []
  renderAllMessages.value = false
  resetSearch()
  clearRenderCache()
  clearStoredHistory()
  sessionTitle.value = ''
  multiSessions.updateActiveMessages([])
}



function showAllOlderMessages() {
  renderAllMessages.value = true
  nextTick(() => scrollToBottom(true))
}


const copiedIndex = ref(-1)

function stopGenerate() {
  if (streamAbortController) {
    streamAbortController.abort()
    streamAbortController = null
  }
}

function regenerateAt(globalIdx: number) {
  if (loading.value) return
  const assistantMsg = messages.value[globalIdx]
  if (!assistantMsg || assistantMsg.role !== 'assistant') return
  let userIdx = globalIdx - 1
  while (userIdx >= 0 && messages.value[userIdx].role !== 'user') userIdx--
  if (userIdx < 0) return
  const userText = messages.value[userIdx].contentArchive ?? messages.value[userIdx].content
  const cleanText = userText.replace(/^🖼️\s*/, '')
  messages.value.splice(globalIdx, 1)
  clearRenderCache()
  input.value = cleanText
  nextTick(() => send())
}

const editingMsgIdx = ref<number | null>(null)
const editingText = ref('')
const editTextareaRef = ref<HTMLTextAreaElement[]>()

function startEdit(globalIdx: number) {
  if (loading.value) return
  const msg = messages.value[globalIdx]
  if (!msg || msg.role !== 'user') return
  const raw = (msg.contentArchive ?? msg.content).replace(/^🖼️\s*/, '')
  editingMsgIdx.value = globalIdx
  editingText.value = raw
  nextTick(() => {
    const ta = editTextareaRef.value?.[0]
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length) }
  })
}

function cancelEdit() {
  editingMsgIdx.value = null
  editingText.value = ''
}

function confirmEditAndResend(globalIdx: number) {
  const newText = editingText.value.trim()
  if (!newText || loading.value) return
  messages.value.splice(globalIdx)
  clearRenderCache()
  editingMsgIdx.value = null
  editingText.value = ''
  input.value = newText
  nextTick(() => send())
}

function setFeedback(globalIdx: number, value: 'up' | 'down') {
  const msg = messages.value[globalIdx]
  if (!msg || msg.role !== 'assistant') return
  msg.feedback = msg.feedback === value ? undefined : value
  emit('feedback', { index: globalIdx, value: msg.feedback ?? null })
}

function handleBodyClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (target.dataset.ide === 'true') {
    const pre = target.closest('pre')
    const codeEl = pre?.querySelector('code')
    const code = codeEl?.textContent || ''
    const cls = codeEl?.className || ''
    const lm = cls.match(/language-(\w+)/)
    options.openCodeInIde?.({ code, language: lm ? lm[1] : undefined })
    return
  }
  if (target.dataset.copy === 'true') {
    const pre = target.closest('pre')
    const code = pre?.querySelector('code')?.textContent || ''
    navigator.clipboard.writeText(code).then(() => {
      target.textContent = t.value.codeCopied
      setTimeout(() => { target.textContent = t.value.copyCode }, 1500)
    })
  }
}

function onBodyDragOver(e: DragEvent) {
  if (loading.value) return
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onBodyDragEnter(_e: DragEvent) {
  if (loading.value) return
  dragCounter++
  dragActive.value = true
}

function onBodyDragLeave(_e: DragEvent) {
  dragCounter--
  if (dragCounter <= 0) {
    dragCounter = 0
    dragActive.value = false
  }
}

function onBodyDrop(e: DragEvent) {
  dragCounter = 0
  dragActive.value = false
  if (loading.value) return
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  if (file.type.startsWith('image/')) {
    readFileAsDataUrl(file)
  } else {
    void processFileUpload(file)
  }
}

function onPasteImage(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) readFileAsDataUrl(file)
      return
    }
  }
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

function readFileAsDataUrl(file: File) {
  if (file.size > MAX_IMAGE_BYTES) {
    messages.value.push({ role: 'assistant', content: `${t.value.errorPrefix}: Image exceeds 5MB limit` })
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const dataUrl = reader.result as string
    pendingImageData.value = dataUrl
    const canvas = document.createElement('canvas')
    const img = new Image()
    img.onload = () => {
      const maxDim = 80
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) {
        const scale = maxDim / Math.max(w, h)
        w = Math.round(w * scale)
        h = Math.round(h * scale)
      }
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      pendingImageThumb.value = canvas.toDataURL('image/png', 0.7)
    }
    img.src = dataUrl
  }
  reader.readAsDataURL(file)
}

function clearPendingImage() {
  pendingImageData.value = null
  pendingImageThumb.value = null
}

async function copyMessage(text: string, globalIdx: number) {
  try {
    await navigator.clipboard.writeText(text)
    copiedIndex.value = globalIdx
    setTimeout(() => { copiedIndex.value = -1 }, 1500)
  } catch {}
}

function onPageSelAction(action: 'ask' | 'translate' | 'summarize') {
  const text = pageSel.value.text
  dismissPageSel()
  if (!text) return
  if (action === 'ask') {
    mode.value = 'chat'
  } else if (action === 'translate') {
    mode.value = 'translate'
  } else {
    mode.value = 'summarize'
  }
  input.value = text
  isOpen.value = true
  nextTick(() => {
    if (action !== 'ask') {
      send()
    }
  })
}

defineExpose({ isOpen, messages, mode, targetLang, clearMessages })

watch(panelExpanded, () => {
  if (isOpen.value) {
    nextTick(() => ensurePanelInViewport())
  }
})

watch(isOpen, (open) => {
  if (open) {
    void refreshChatModels()
    if (fabLeft.value !== null && fabTop.value !== null) {
      fabFreePosBeforePanel.value = { left: fabLeft.value, top: fabTop.value }
    } else {
      fabFreePosBeforePanel.value = null
    }
    panelSnapshot.value = { edge: edgeDock.value }
    onPanelOpen(wrapperRef.value, edgeDock)
    nextTick(() => {
      if (fabLeft.value === null || fabTop.value === null) {
        syncFabPixelFromWrapperDom(wrapperRef.value)
      }
      ensurePanelInViewport()
      saveFabPos(panelSnapshot.value?.edge)
    })
  } else {
    onPanelClose()
    if (panelSnapshot.value) {
      const s = panelSnapshot.value
      panelSnapshot.value = null
      if (s.edge === 'left' || s.edge === 'right') {
        fabFreePosBeforePanel.value = null
        dockFab(s.edge)
      } else {
        edgeDock.value = 'none'
        if (fabFreePosBeforePanel.value) {
          if (!panelGeo.panelHeaderDraggedWhileOpen) {
            const p = fabFreePosBeforePanel.value
            const c = clampFabPos(p.left, p.top)
            fabLeft.value = c.left
            fabTop.value = c.top
          }
          fabFreePosBeforePanel.value = null
        }
        saveFabPos()
      }
    }
  }
})

function onWinResize() {
  if (winResizeRaf) cancelAnimationFrame(winResizeRaf)
  winResizeRaf = requestAnimationFrame(() => {
    winResizeRaf = 0
    if (fabLeft.value === null || fabTop.value === null) return
    const c = clampFabPos(fabLeft.value, fabTop.value)
    fabLeft.value = c.left
    fabTop.value = c.top
    if (edgeDock.value === 'right') fabLeft.value = window.innerWidth - FAB_SIZE
    saveFabPos()
    if (isOpen.value) onWinResizePanel()
  })
}

/** 流式 chunk 合并到每帧最多刷新一次，减轻 marked/DOMPurify 压力 */
async function applyStreamToAssistantMessage(msgIndex: number, stream: AsyncIterable<string>): Promise<string> {
  let pending = ''
  let raf = 0
  function flush() {
    raf = 0
    messages.value[msgIndex] = { role: 'assistant', content: pending }
    scrollToBottom(false)
  }
  try {
    for await (const chunk of stream) {
      pending += chunk
      if (!raf) raf = requestAnimationFrame(flush)
    }
  } finally {
    if (raf) cancelAnimationFrame(raf)
    messages.value[msgIndex] = { role: 'assistant', content: pending }
    scrollToBottom(false)
    trimMessagesForMemoryCap()
  }
  return pending
}

/** 将 url-preview 配图挂到助手气泡末尾（用户常只看助手方向），去重避免流式结束与回调各追加一次 */
function appendUrlPreviewImagesToAssistant(aiIdx: number, imgs: string[]) {
  if (!imgs.length) return
  const m = messages.value[aiIdx]
  if (m?.role !== 'assistant') return
  const lines = imgs
    .filter(Boolean)
    .map((u) => `![](${preferHttpsImageUrlWhenPageIsSecure(u)})`)
  /* 正文中若仅出现裸链，不要用 includes(url) 误当成「已有图」而跳过 */
  if (lines.length && lines.every((line) => m.content.includes(line))) return
  const note = t.value.urlPreviewImagesNote
  const md = [`> ${note}`, '', ...lines].join('\n\n')
  const base = (m.contentArchive ?? m.content).trim()
  messages.value[aiIdx] = { role: 'assistant', content: `${base}\n\n${md}` }
  clearRenderCache()
  trimMessagesForMemoryCap()
}

async function send() {
  let text = input.value.trim()
  if (!text || loading.value) return
  const ucap = options.maxUserMessageChars
  if (ucap !== undefined && ucap > 0 && text.length > ucap) {
    text = `${text.slice(0, ucap)}\n…`
  }

  const userEntry: Message = { role: 'user', content: text }
  messages.value.push(userEntry)
  const userMsgIdx = messages.value.length - 1

  /* 翻译/摘要/对话均支持：气泡内嵌直连图、网页链接触发 url-preview（与模式无关） */
  {
    let d = text
    for (const u of extractHttpUrls(text)) {
      if (isProbablyDirectImageUrl(u) && !d.includes(`![](${u})`)) {
        const disp = preferHttpsImageUrlWhenPageIsSecure(u)
        d += `\n\n![](${disp})`
      }
    }
    userEntry.content = d
  }

  input.value = ''
  loading.value = true
  scrollToBottom(true)

  const imageForPayload = pendingImageData.value
  if (pendingImageThumb.value && pendingImageData.value) {
    userEntry.content = `🖼️ ${userEntry.content}`
  }
  clearPendingImage()

  const payload: any = {
    action: mode.value,
    text,
    targetLang: targetLang.value,
  }
  if (imageForPayload) payload.imageData = imageForPayload
  if (mode.value === 'chat') {
    const sp = chatSystemPrompt.value.trim()
    if (sp) payload.systemPrompt = sp
    const mid = selectedChatModel.value.trim()
    if (mid && modelChoices.value.includes(mid)) payload.model = mid
  }
  if (mode.value === 'chat' && messages.value.length > 1) {
    payload.history = messages.value.slice(0, -1).map(m => ({
      role: m.role,
      content: m.contentArchive ?? m.content,
    }))
  }

  emit('send', { action: mode.value, text })

  const assistantMsg: Message = { role: 'assistant', content: '' }
  messages.value.push(assistantMsg)
  const msgIndex = messages.value.length - 1
  scrollToBottom(true)

  let urlPreviewImgs: string[] = []
  let streamDone = false

  if (options.baseUrl) {
    const pageUrl = firstNonImageHttpUrl(extractHttpUrls(text))
    if (pageUrl) {
      fetchUrlPreview(options.baseUrl, pageUrl, options.accessToken)
        .then((r) => {
          /* 勿与 userEntry 做引用相等：Vue 会把消息项包成 Proxy，恒不等于原始对象，会导致整段预览永远不执行 */
          const userSlot = messages.value[userMsgIdx]
          if (!userSlot || userSlot.role !== 'user') return
          if (r.success === false) return
          const imgs =
            r.imageUrls && r.imageUrls.length > 0 ? r.imageUrls : r.imageUrl ? [r.imageUrl] : []
          if (!imgs.length) return
          urlPreviewImgs = imgs
          /* 用户气泡保持用户原文（仅链接等）；预览图只挂助手回复，避免标题/摘要把用户消息撑成整页 */
          if (streamDone) {
            appendUrlPreviewImagesToAssistant(msgIndex, urlPreviewImgs)
            scrollToBottom(false)
          }
        })
        .catch(() => {})
    }
  }

  streamAbortController = new AbortController()
  try {
    const fullContent = await applyStreamToAssistantMessage(
      msgIndex,
      streamWithFallback(options.baseUrl!, payload, options.accessToken, streamAbortController.signal),
    )
    streamDone = true
    /* 流式正文为空时若先插图再被「无响应」覆盖，会丢掉预览图 */
    if (!fullContent && !urlPreviewImgs.length) {
      messages.value[msgIndex] = { role: 'assistant', content: t.value.noResponse }
    } else {
      appendUrlPreviewImagesToAssistant(msgIndex, urlPreviewImgs)
    }
    if (urlPreviewImgs.length) scrollToBottom(false)
    if (!sessionTitle.value && text.trim()) {
      const raw = text.replace(/\n+/g, ' ').trim()
      sessionTitle.value = raw.length > 20 ? raw.slice(0, 20) + '…' : raw
      multiSessions.updateActiveTitle(sessionTitle.value)
    }
    emit('response', fullContent)
  } catch (e: any) {
    const currentContent = messages.value[msgIndex]?.content || ''
    if (!currentContent) {
      messages.value[msgIndex] = { role: 'assistant', content: `${t.value.errorPrefix}: ${e.message}` }
    }
    reportAssistantError('send', String(e?.message ?? e))
    emit('error', e.message)
    scrollToBottom(false)
  } finally {
    streamAbortController = null
    loading.value = false
    scrollToBottom(false)
  }
}

async function processFileUpload(file: File) {
  if (!file || loading.value || !options.baseUrl) return

  const action = mode.value === 'translate' ? 'translate' as const : 'summarize' as const
  const label = `📎 ${file.name} (${(file.size / 1024).toFixed(1)}KB)`
  messages.value.push({ role: 'user', content: label })
  loading.value = true
  scrollToBottom(true)

  emit('send', { action, text: label })
  try {
    const res = await uploadFile(options.baseUrl, file, action, targetLang.value, options.accessToken)
    const content = res.success ? res.result! : `${t.value.errorPrefix}: ${res.error}`
    messages.value.push({ role: 'assistant', content })
    scrollToBottom(true)
    if (res.success) emit('response', content)
    else {
      reportAssistantError('file-upload', res.error || 'Unknown error')
      emit('error', res.error || 'Unknown error')
    }
  } catch (e: any) {
    messages.value.push({ role: 'assistant', content: `${t.value.errorPrefix}: ${e.message}` })
    scrollToBottom(true)
    reportAssistantError('file-upload', String(e?.message ?? e))
    emit('error', e.message)
  } finally {
    loading.value = false
    scrollToBottom(false)
  }
}

async function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  target.value = ''
  if (!file) return
  await processFileUpload(file)
}

/** 距底部小于此值则视为「在跟随」，流式更新时才自动滚 */
const SCROLL_STICKY_PX = 80

let scrollCoalesceRaf = 0
let scrollPendingForce = false
let scrollPendingSoft = false

function flushScrollToBottom() {
  scrollCoalesceRaf = 0
  const el = bodyRef.value
  const doForce = scrollPendingForce
  const doSoft = scrollPendingSoft
  scrollPendingForce = false
  scrollPendingSoft = false
  if (!el) return
  if (doForce) {
    el.scrollTop = el.scrollHeight
    return
  }
  if (doSoft) {
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_STICKY_PX
    if (nearBottom) el.scrollTop = el.scrollHeight
  }
}

function scrollToBottom(force: boolean) {
  if (force) scrollPendingForce = true
  else scrollPendingSoft = true
  if (scrollCoalesceRaf) return
  nextTick(() => {
    if (scrollCoalesceRaf) return
    scrollCoalesceRaf = requestAnimationFrame(() => {
      flushScrollToBottom()
    })
  })
}

watch(() => messages.value.length, () => {
  trimMessagesForMemoryCap()
  scrollToBottom(false)
  saveHistory()
})

function matchesToggleShortcut(e: KeyboardEvent): boolean {
  const shortcut = options.toggleShortcut
  if (shortcut === false) return false
  const key = shortcut || '/'
  if (e.key !== key.replace(/^(Ctrl|Meta|Alt|Shift)\+/i, '')) return false
  const isMac = navigator.platform?.startsWith('Mac') || navigator.userAgent?.includes('Mac')
  const needCtrl = !isMac
  const needMeta = isMac
  return (needCtrl ? e.ctrlKey : e.metaKey) && !e.shiftKey && !e.altKey
}

function onEscKeydown(e: KeyboardEvent) {
  if (matchesToggleShortcut(e)) {
    e.preventDefault()
    if (fabHidden.value) return
    isOpen.value = !isOpen.value
    return
  }
  if (e.key !== 'Escape') return
  if (inlineTranslatePopover.value.show) {
    e.preventDefault()
    closeInlineTranslatePopover()
    return
  }
  if (msgCtxMenu.value.show) {
    e.preventDefault()
    closeMsgCtxMenu()
    return
  }
  if (fabCtxMenu.value.show) {
    e.preventDefault()
    closeFabCtxMenu()
    return
  }
  if (personalizeOpen.value) {
    e.preventDefault()
    personalizeOpen.value = false
    return
  }
  if (isOpen.value) {
    e.preventDefault()
    isOpen.value = false
  }
}

function onVisualViewportChange() {
  onWinResize()
}

watch(chatSystemPrompt, (v) => {
  try {
    localStorage.setItem(systemPromptStorageKeyResolved.value, v)
  } catch {
    /* localStorage 不可用或配额满 */
  }
})

watch(selectedChatModel, (v) => {
  if (!v) return
  try {
    localStorage.setItem(selectedModelStorageKeyResolved.value, v)
  } catch {
    /* ignore */
  }
})

onMounted(() => {
  try {
    const s = localStorage.getItem(systemPromptStorageKeyResolved.value)
    if (s) {
      const cap = systemPromptMaxInputCharsResolved.value
      chatSystemPrompt.value = s.length > cap ? s.slice(0, cap) : s
    }
  } catch {
    /* ignore */
  }
  loadFabPos()
  window.addEventListener('resize', onWinResize)
  window.visualViewport?.addEventListener('resize', onVisualViewportChange)
  window.visualViewport?.addEventListener('scroll', onVisualViewportChange)
  window.addEventListener('keydown', onEscKeydown, true)
  document.addEventListener('mousedown', onDocPointerDownCloseFabMenu, true)
})

onUnmounted(() => {
  streamAbortController?.abort()
  streamAbortController = null
  detachInlinePopLayoutListeners()
  disposeSearch()
  disposeExportToast()
  cleanupGeometry()
  if (winResizeRaf) cancelAnimationFrame(winResizeRaf)
  if (scrollCoalesceRaf) cancelAnimationFrame(scrollCoalesceRaf)
  window.removeEventListener('resize', onWinResize)
  window.visualViewport?.removeEventListener('resize', onVisualViewportChange)
  window.visualViewport?.removeEventListener('scroll', onVisualViewportChange)
  window.removeEventListener('keydown', onEscKeydown, true)
  document.removeEventListener('mousedown', onDocPointerDownCloseFabMenu, true)
  window.removeEventListener('pointermove', onFabPointerMove)
  window.removeEventListener('pointerup', onFabPointerUp)
  window.removeEventListener('pointercancel', onFabPointerUp)
})
</script>

<style src="./AiAssistant.styles.css"></style>
