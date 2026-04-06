<template>
  <div
    ref="wrapperRef"
    class="ai-assistant-wrapper"
    :class="[
      effectivePositionClass,
      panelOpenFabAlignClass,
      themeClass,
      edgeDockClass,
      { 'panel-mounted': panelMountedForLayout },
    ]"
    :style="wrapperStyle"
  >
    <!-- Floating Button：打开/关闭过渡期间保留在 DOM 中，便于从球心缩放面板 -->
    <button
      v-show="!isOpen || showFabDuringPanelAnim"
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
        id="ai-assistant-panel"
        class="ai-panel"
        :style="panelStyle"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-assistant-title"
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
        >
          <span
            id="ai-assistant-title"
            class="ai-title"
            @pointerdown="onPanelHeaderPointerDown"
          >{{ t.title }}</span>
          <span class="ai-header-spacer" aria-hidden="true" />
          <div class="ai-header-actions">
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

        <div v-if="messages.length > 0" class="ai-chat-search">
          <input
            v-model="chatSearchInput"
            type="search"
            class="ai-chat-search-input"
            :placeholder="t.searchMessages"
            :aria-label="t.searchMessages"
            autocomplete="off"
          >
        </div>

        <!-- Messages -->
        <div
          ref="bodyRef"
          class="ai-body"
          :aria-busy="loading"
          @click="handleBodyClick"
          @dragover="onBodyDragOver"
          @drop="onBodyDrop"
        >
          <div v-if="messages.length === 0" class="ai-empty">
            <p>{{ t.greeting }}</p>
            <div class="ai-quick-actions">
              <button @click="setMode('translate')">{{ t.translate }}</button>
              <button @click="setMode('summarize')">{{ t.summarize }}</button>
              <button @click="setMode('chat')">{{ t.chat }}</button>
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
            <div
              class="ai-bubble"
              v-html="renderContent(msg.content, t.copyCode, loading && msg.role === 'assistant' && idx === displayedMessages.length - 1)"
              @contextmenu="onBubbleContextMenu($event, displayOffset + idx, msg.role)"
            ></div>
            <button
              v-if="msg.role === 'assistant' && msg.content && !loading"
              type="button"
              class="ai-msg-copy"
              :title="t.copyCode"
              :aria-label="t.copyCode"
              @click="copyMessage(msg.contentArchive ?? msg.content)"
            >
              {{ copiedIndex === displayOffset + idx ? t.codeCopied : '📋' }}
            </button>
          </div>
          <div v-if="loading" class="ai-msg assistant">
            <div class="ai-bubble ai-typing">
              <span></span><span></span><span></span>
            </div>
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
          <textarea
            v-model="input"
            :placeholder="`${placeholder} (${t.newline})`"
            rows="2"
            @keydown.enter.exact.prevent="send"
          />
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
          <button class="ai-send" :style="sendStyle" :disabled="!input.trim() || loading" @click="send">
            ➤
          </button>
        </div>
      </div>
    </Transition>

    <Teleport to="body">
      <Transition name="ai-fab-ctx">
        <div
          v-if="fabCtxMenu.show"
          class="ai-fab-ctx-menu"
          :class="{ 'ai-dark': isDark }"
          :style="{ left: fabCtxMenu.x + 'px', top: fabCtxMenu.y + 'px', '--fab-accent': color }"
          role="menu"
          @click.stop
        >
          <div class="ai-fab-ctx-head">
            <span class="ai-fab-ctx-head-dot" aria-hidden="true" />
            <span class="ai-fab-ctx-head-text">{{ t.title }}</span>
          </div>
          <div class="ai-fab-ctx-list">
            <button
              v-if="edgeDock !== 'left'"
              type="button"
              role="menuitem"
              class="ai-fab-ctx-item"
              @click="dockFab('left')"
            >
              <span class="ai-fab-ctx-icon-wrap" aria-hidden="true">
                <svg class="ai-fab-ctx-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3.5" y="5" width="17" height="14" rx="2.5" opacity="0.9" />
                  <line x1="9.25" y1="5" x2="9.25" y2="19" opacity="0.95" />
                </svg>
              </span>
              <span class="ai-fab-ctx-label">{{ t.fabDockLeft }}</span>
            </button>
            <button
              v-if="edgeDock !== 'right'"
              type="button"
              role="menuitem"
              class="ai-fab-ctx-item"
              @click="dockFab('right')"
            >
              <span class="ai-fab-ctx-icon-wrap" aria-hidden="true">
                <svg class="ai-fab-ctx-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3.5" y="5" width="17" height="14" rx="2.5" opacity="0.9" />
                  <line x1="14.75" y1="5" x2="14.75" y2="19" opacity="0.95" />
                </svg>
              </span>
              <span class="ai-fab-ctx-label">{{ t.fabDockRight }}</span>
            </button>
            <button
              v-if="edgeDock !== 'none'"
              type="button"
              role="menuitem"
              class="ai-fab-ctx-item"
              @click="dockFab('none')"
            >
              <span class="ai-fab-ctx-icon-wrap" aria-hidden="true">
                <svg class="ai-fab-ctx-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="3.2" />
                  <path d="M12 4.25v2.35M12 17.4v2.35M4.25 12h2.35M17.4 12h2.35" />
                </svg>
              </span>
              <span class="ai-fab-ctx-label">{{ t.fabUndock }}</span>
            </button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="ai-fab-ctx">
        <div
          v-if="msgCtxMenu.show"
          class="ai-fab-ctx-menu ai-msg-ctx-menu"
          role="menu"
          :style="{ left: msgCtxMenu.x + 'px', top: msgCtxMenu.y + 'px', '--fab-accent': color }"
          @contextmenu.prevent
        >
          <div class="ai-fab-ctx-list">
            <button
              type="button"
              role="menuitem"
              class="ai-fab-ctx-item"
              :disabled="!msgCtxMenu.selectionText"
              :title="!msgCtxMenu.selectionText ? t.msgCtxNeedSelection : undefined"
              @click="copyAssistantSelection"
            >
              <span class="ai-fab-ctx-label">{{ t.msgCtxCopy }}</span>
            </button>
            <button
              type="button"
              role="menuitem"
              class="ai-fab-ctx-item"
              :disabled="!msgCtxMenu.selectionText"
              :title="!msgCtxMenu.selectionText ? t.msgCtxNeedSelection : undefined"
              @click="translateAssistantSelection"
            >
              <span class="ai-fab-ctx-label">{{ t.msgCtxTranslate }}</span>
            </button>
            <button type="button" role="menuitem" class="ai-fab-ctx-item" @click="deleteAssistantAt(msgCtxMenu.index)">
              <span class="ai-fab-ctx-label">{{ t.msgCtxDelete }}</span>
            </button>
            <template v-if="options.baseUrl">
              <button
                type="button"
                role="menuitem"
                class="ai-fab-ctx-item"
                :disabled="exportServerBusy"
                :title="exportServerBusy ? t.exportPreparing : undefined"
                @click="exportAssistantMessageServer(msgCtxMenu.index, 'docx')"
              >
                <span class="ai-fab-ctx-label">{{ t.msgCtxExportDocx }}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                class="ai-fab-ctx-item"
                :disabled="exportServerBusy"
                :title="exportServerBusy ? t.exportPreparing : undefined"
                @click="exportAssistantMessageServer(msgCtxMenu.index, 'pdf')"
              >
                <span class="ai-fab-ctx-label">{{ t.msgCtxExportPdf }}</span>
              </button>
              <button
                type="button"
                role="menuitem"
                class="ai-fab-ctx-item"
                :disabled="exportServerBusy"
                :title="exportServerBusy ? t.exportPreparing : undefined"
                @click="exportAssistantMessageServer(msgCtxMenu.index, 'xlsx')"
              >
                <span class="ai-fab-ctx-label">{{ t.msgCtxExportXlsx }}</span>
              </button>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="ai-export-toast-t">
        <div
          v-if="exportToastText"
          class="ai-export-toast"
          :class="{ 'ai-dark': isDark }"
          :style="{ '--export-accent': color }"
          role="status"
          aria-live="polite"
        >
          {{ exportToastText }}
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <div
        v-if="inlineTranslatePopover.show"
        ref="inlineTransPopRef"
        class="ai-inline-trans-pop"
        :class="{ 'ai-dark': isDark }"
        role="dialog"
        aria-live="polite"
        :style="{
          left: inlineTranslatePopover.x + 'px',
          top: inlineTranslatePopover.y + 'px',
          '--primary': color,
        }"
      >
        <div v-if="inlineTranslatePopover.loading" class="ai-inline-trans-loading">{{ t.replying }}</div>
        <div v-else-if="inlineTranslatePopover.error" class="ai-inline-trans-error">
          {{ inlineTranslatePopover.error }}
        </div>
        <div v-else class="ai-inline-trans-body">{{ inlineTranslatePopover.text }}</div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject, nextTick, watch, onMounted, onUnmounted } from 'vue'
import type { AiAssistantOptions } from '../index'
import { uploadFile, streamChat, fetchUrlPreview, postServerExport } from '../utils/api'
import type { ExportFormat } from '../utils/api'
import { getMessages } from '../utils/i18n'
import type { Locale } from '../utils/i18n'
import { useSessionSearch } from '../composables/useSessionSearch'
import { useMessageMemoryCap } from '../composables/useMessageMemoryCap'
import { loadPersistedMessages, useChatHistoryPersistence } from '../composables/useChatHistoryPersistence'
import { useExportUi } from '../composables/useExportUi'
import { useAiMarkdownRenderer } from '../composables/useAiMarkdownRenderer'
import {
  collectPageContextText,
  augmentMessageWithPageContext,
  collectSmartPageContextText,
} from '../utils/pageContextDom'
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
}

const options = inject<AiAssistantOptions>('ai-assistant-options', {
  baseUrl: '/ai-assistant',
  primaryColor: '#6366f1',
  position: 'bottom-right',
  theme: 'light',
  persistHistory: false,
  locale: 'en',
})

function reportAssistantError(source: string, message: string) {
  options.onAssistantError?.({ source, message })
}

function textWithPageContextForModel(displayUserText: string): string {
  const max = options.pageContextMaxChars ?? 12_000
  const minUser = options.pageContextMinUserChars ?? 12
  const trimmedUser = displayUserText.trim()
  let ctx = collectPageContextText(options.pageContextBlocks, max)
  if (!ctx && options.smartPageContext !== false && trimmedUser.length >= minUser) {
    ctx = collectSmartPageContextText(max)
  }
  return augmentMessageWithPageContext(displayUserText, ctx)
}

const t = computed(() => getMessages((options.locale || 'en') as Locale))

const { renderContent, clearRenderCache } = useAiMarkdownRenderer(t, options)

const isOpen = ref(false)
const input = ref('')
const loading = ref(false)
const messages = ref<Message[]>(loadPersistedMessages(!!options.persistHistory))
const { saveHistory, clearStoredHistory } = useChatHistoryPersistence(messages, () => !!options.persistHistory)
const { trimMessagesForMemoryCap } = useMessageMemoryCap(messages, options, clearRenderCache)
/** 超过条数时只挂载最近 N 条 DOM，减少长会话卡顿 */
const MAX_RENDERED_MESSAGES = 60
const renderAllMessages = ref(false)
const { exportServerBusy, exportToastText, setExportToast, disposeExportToast } = useExportUi()

const mode = ref<'translate' | 'summarize' | 'chat'>('chat')
const targetLang = ref('zh')
const bodyRef = ref<HTMLElement>()
const fileInputRef = ref<HTMLInputElement>()

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

const {
  chatSearchInput,
  displayOffset,
  displayedMessages,
  hiddenOlderCount,
  resetSearch,
  disposeSearch,
} = useSessionSearch(messages, loading, renderAllMessages, MAX_RENDERED_MESSAGES)

const showEarlierLabel = computed(() =>
  t.value.showEarlierTemplate.replace(/\{n\}/g, String(hiddenOlderCount.value)),
)
const a11yStatusText = computed(() => {
  if (!isOpen.value) return ''
  if (exportServerBusy.value) return t.value.exportPreparing
  if (loading.value) return t.value.replying
  return ''
})

const color = computed(() => options.primaryColor || '#6366f1')
const positionClass = computed(() => `pos-${options.position || 'bottom-right'}`)

const isDark = computed(() => {
  if (options.theme === 'dark') return true
  if (options.theme === 'auto') return window.matchMedia?.('(prefers-color-scheme: dark)').matches
  return false
})
const themeClass = computed(() => isDark.value ? 'ai-dark' : '')

/** v4：贴边改由右键菜单控制，不再自动吸附 */
const FAB_POS_KEY = 'ai-assistant-fab-pos-v4'
const FAB_SIZE = 56
const PANEL_W = 380
const PANEL_H = 520

/** 缩放边：固定「对边/对角」，框随指针方向扩展（标准窗口感知） */
type PanelResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
/** 顶边仍用 nw/ne，避免与标题栏拖拽冲突 */
const RESIZE_ZONES: { edge: PanelResizeEdge; cls: string }[] = [
  { edge: 'n', cls: 'ai-rz-n' },
  { edge: 's', cls: 'ai-rz-s' },
  { edge: 'e', cls: 'ai-rz-e' },
  { edge: 'w', cls: 'ai-rz-w' },
  { edge: 'ne', cls: 'ai-rz-ne' },
  { edge: 'nw', cls: 'ai-rz-nw' },
  { edge: 'se', cls: 'ai-rz-se' },
  { edge: 'sw', cls: 'ai-rz-sw' },
]
const resizeZoneDefs = RESIZE_ZONES

/** wrapper（面板）左上角 + 尺寸，屏幕 CSS 像素 */
function getPanelScreenRect(): { wl: number; wt: number; w: number; h: number } | null {
  if (fabLeft.value === null || fabTop.value === null) return null
  const w = effectivePanelWidthPx()
  const h = effectivePanelHeightPx()
  const { dx, dy } = wrapperOffsetFromFab(openPanelQuadrant.value)
  return {
    wl: fabLeft.value + dx,
    wt: fabTop.value + dy,
    w,
    h,
  }
}

function syncFabToPanelRect(wl: number, wt: number, w: number, h: number) {
  const q = openPanelQuadrant.value
  if (q === 'br') {
    fabLeft.value = wl + w - FAB_SIZE
    fabTop.value = wt + h - FAB_SIZE
  } else if (q === 'tl') {
    fabLeft.value = wl
    fabTop.value = wt
  } else if (q === 'tr') {
    fabLeft.value = wl + w - FAB_SIZE
    fabTop.value = wt
  } else {
    fabLeft.value = wl
    fabTop.value = wt + h - FAB_SIZE
  }
}

function computeRectFromResizePointer(
  edge: PanelResizeEdge,
  r0: { wl: number; wt: number; w: number; h: number },
  ex: number,
  ey: number,
): { wl: number; wt: number; w: number; h: number } {
  const { wl: wl0, wt: wt0, w: w0, h: h0 } = r0
  let wl = wl0
  let wt = wt0
  let w = w0
  let h = h0
  switch (edge) {
    case 'se':
      w = ex - wl0
      h = ey - wt0
      break
    case 'sw':
      w = wl0 + w0 - ex
      h = ey - wt0
      wl = ex
      break
    case 'ne':
      w = ex - wl0
      h = wt0 + h0 - ey
      wt = ey
      break
    case 'nw':
      w = wl0 + w0 - ex
      h = wt0 + h0 - ey
      wl = ex
      wt = ey
      break
    case 'e':
      w = ex - wl0
      break
    case 'w':
      w = wl0 + w0 - ex
      wl = ex
      break
    case 's':
      h = ey - wt0
      break
    case 'n':
      h = wt0 + h0 - ey
      wt = ey
      break
  }
  const cl = clampPanelSize(w, h)
  w = cl.w
  h = cl.h
  switch (edge) {
    case 'se':
      wl = wl0
      wt = wt0
      break
    case 'sw':
      wl = wl0 + w0 - w
      wt = wt0
      break
    case 'ne':
      wl = wl0
      wt = wt0 + h0 - h
      break
    case 'nw':
      wl = wl0 + w0 - w
      wt = wt0 + h0 - h
      break
    case 'e':
      wl = wl0
      wt = wt0
      break
    case 'w':
      wl = wl0 + w0 - w
      wt = wt0
      break
    case 's':
      wl = wl0
      wt = wt0
      break
    case 'n':
      wl = wl0
      wt = wt0 + h0 - h
      break
  }
  return { wl, wt, w, h }
}

/**
 * 布局用视口尺寸：优先 Visual Viewport（移动端地址栏、缩放时比 inner 更贴近可见区）。
 * 缺失或异常时回退 innerWidth/innerHeight。
 */
function getViewportCssSize(): { w: number; h: number } {
  if (typeof window === 'undefined') return { w: 1024, h: 768 }
  const vv = window.visualViewport
  if (vv && vv.width >= 16 && vv.height >= 16) {
    return { w: Math.floor(vv.width), h: Math.floor(vv.height) }
  }
  return { w: window.innerWidth, h: window.innerHeight }
}

/** 标题栏切换：近似全屏；缩回为默认小窗（与拖动自定义尺寸互斥由 panelUserSize 处理） */
const panelExpanded = ref(false)
/** 用户拖动右下角后的自定义宽高，优先于预设 */
const panelUserSize = ref<{ w: number; h: number } | null>(null)
let panelResizeDrag: {
  pointerId: number
  edge: PanelResizeEdge
  /** pointerdown 时面板屏幕矩形，缩放全程固定「对角」参照用 */
  r0: { wl: number; wt: number; w: number; h: number }
} | null = null
let panelResizeClampRaf = 0
const EDGE_PEEK = 14
const DRAG_CLICK_PX = 8
/** 超过该位移才视为拖动并退出贴边（避免点击时的微抖动清掉贴边） */
const DOCK_BREAK_PX = 10

/** 窗口 resize 合并到每帧最多一次，减轻 clamp/saveFabPos 压力 */
let winResizeRaf = 0

const wrapperRef = ref<HTMLElement>()
const fabRef = ref<HTMLButtonElement>()
/** pixel position; null = use CSS position option */
const fabLeft = ref<number | null>(null)
const fabTop = ref<number | null>(null)
/** 'left' | 'right' = stick to browser side, mostly hidden */
const edgeDock = ref<'none' | 'left' | 'right'>('none')
const fabDragging = ref(false)
const fabDrag = ref<{
  pointerId: number
  startX: number
  startY: number
  originLeft: number
  originTop: number
} | null>(null)

/** 打开前面板的贴边状态；关闭时只恢复贴边，球位保留拖动结果 */
const panelSnapshot = ref<{ edge: 'none' | 'left' | 'right' } | null>(null)
/** 打开面板瞬间的球位（仅当本会话内拖过缩放手柄时，关闭后面板还原到此） */
const fabFreePosBeforePanel = ref<{ left: number; top: number } | null>(null)
let panelResizedThisSession = false

const panelDragging = ref(false)
const panelDrag = ref<{
  pointerId: number
  lastX: number
  lastY: number
} | null>(null)

const fabCtxMenu = ref({ show: false, x: 0, y: 0 })
/** 助手气泡右键 */
const msgCtxMenu = ref({
  show: false,
  x: 0,
  y: 0,
  index: -1,
  selectionText: '',
  /** 翻译气泡锚点（视口 px）；有选区时 prefer 选区右侧 */
  pointerX: 0,
  pointerY: 0,
  /** 选中区域上沿，用于弹层向上翻出 */
  anchorTop: 0,
  /** 选区包围盒（视口 px），全 0 表示无几何信息 */
  selLeft: 0,
  selRight: 0,
  selTop: 0,
  selBottom: 0,
})
const MSG_CTX_MENU_W = 228
const MSG_CTX_MENU_H = 280

/** 右键「翻译选中」：靠近点击处的浮层（可选中文本） */
const inlineTranslatePopover = ref({
  show: false,
  x: 0,
  y: 0,
  text: '',
  loading: false,
  error: '',
  pointerX: 0,
  pointerY: 0,
  anchorTop: 0,
  selLeft: 0,
  selRight: 0,
  selTop: 0,
  selBottom: 0,
})
let inlineTranslateAbort = false
const inlineTransPopRef = ref<HTMLElement | null>(null)
let inlinePopResizeHandler: (() => void) | null = null
let positionInlinePopRaf = 0

function detachInlinePopLayoutListeners() {
  if (inlinePopResizeHandler) {
    window.removeEventListener('resize', inlinePopResizeHandler)
    inlinePopResizeHandler = null
  }
}

function attachInlinePopLayoutListeners() {
  detachInlinePopLayoutListeners()
  inlinePopResizeHandler = () => schedulePositionInlineTranslatePopover()
  window.addEventListener('resize', inlinePopResizeHandler, { passive: true })
}

function schedulePositionInlineTranslatePopover() {
  if (!inlineTranslatePopover.value.show) return
  if (positionInlinePopRaf) return
  positionInlinePopRaf = requestAnimationFrame(() => {
    positionInlinePopRaf = 0
    positionInlineTranslatePopoverNearPointer()
  })
}

function positionInlineTranslatePopoverNearPointer() {
  const pop = inlineTranslatePopover.value
  if (!pop.show) return
  const pad = 8
  const gap = 10
  const vw = window.innerWidth
  const vh = window.innerHeight
  const pw = Math.min(360, vw - 2 * pad)
  const ph = Math.max(inlineTransPopRef.value?.offsetHeight ?? 120, 72)
  const sl = pop.selLeft
  const sr = pop.selRight
  const st = pop.selTop
  const sb = pop.selBottom
  const hasSel = sr > sl + 2 && sb >= st

  let left: number
  let top: number

  if (hasSel) {
    const placeRight = sr + gap
    const placeLeft = sl - pw - gap
    if (placeRight + pw <= vw - pad) {
      left = placeRight
    } else if (placeLeft >= pad) {
      left = placeLeft
    } else {
      left = Math.max(pad, Math.min(sl, vw - pw - pad))
    }
    top = st + (sb - st) / 2 - ph / 2
    top = Math.max(pad, Math.min(top, vh - ph - pad))
  } else {
    const cx = pop.pointerX
    const cy = pop.pointerY
    const selTop = pop.anchorTop
    left = cx
    top = cy
    if (left + pw > vw - pad) {
      left = Math.max(pad, vw - pw - pad)
    }
    if (left < pad) left = pad
    if (top + ph > vh - pad) {
      top = Math.max(pad, selTop - ph - 4)
    }
    if (top < pad) top = pad
  }

  pop.x = left
  pop.y = top
}

/** 面板进出场时短暂保留悬浮球，使缩放原点与球心一致 */
const showFabDuringPanelAnim = ref(true)
/** 面板在 DOM 中（含 leave 过渡）：wrapper 使用面板尺寸，避免布局从角上错位 */
const panelMountedForLayout = ref(false)

/** 打开面板时由悬浮球所在视口象限决定：锚角对齐球，动画朝对向展开 */
type FabScreenQuadrant = 'tl' | 'tr' | 'bl' | 'br'
const openPanelQuadrant = ref<FabScreenQuadrant>('br')

function clampPanelSize(w: number, h: number): { w: number; h: number } {
  const { w: vw, h: vh } = getViewportCssSize()
  const minW = 300
  const minH = 280
  const maxW = Math.max(minW, vw - 12)
  const maxH = Math.max(minH, vh - 16)
  return {
    w: Math.round(Math.max(minW, Math.min(maxW, w))),
    h: Math.round(Math.max(minH, Math.min(maxH, h))),
  }
}

function effectivePanelWidthPx(): number {
  if (panelUserSize.value) {
    return panelUserSize.value.w
  }
  const { w: vw } = getViewportCssSize()
  if (!panelExpanded.value) {
    return PANEL_W
  }
  const edge = 12
  return Math.max(PANEL_W, vw - edge)
}

function effectivePanelHeightPx(): number {
  if (panelUserSize.value) {
    return panelUserSize.value.h
  }
  const { h: vh } = getViewportCssSize()
  if (!panelExpanded.value) {
    return Math.min(PANEL_H, Math.max(200, vh - 80))
  }
  const edge = 16
  return Math.max(280, vh - edge)
}

function togglePanelExpand() {
  panelUserSize.value = null
  panelExpanded.value = !panelExpanded.value
}

function onPanelResizePointerDown(e: PointerEvent, edge: PanelResizeEdge) {
  if (e.button !== 0) return
  const r0 = getPanelScreenRect()
  if (!r0) return
  panelResizeDrag = {
    pointerId: e.pointerId,
    edge,
    r0,
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  window.addEventListener('pointermove', onPanelResizePointerMove)
  window.addEventListener('pointerup', onPanelResizePointerUp, true)
  window.addEventListener('pointercancel', onPanelResizePointerUp, true)
}

function onPanelResizePointerMove(e: PointerEvent) {
  if (!panelResizeDrag || e.pointerId !== panelResizeDrag.pointerId) return
  const d = panelResizeDrag
  const r = computeRectFromResizePointer(d.edge, d.r0, e.clientX, e.clientY)
  panelUserSize.value = { w: r.w, h: r.h }
  syncFabToPanelRect(r.wl, r.wt, r.w, r.h)
  if (!panelResizeClampRaf) {
    panelResizeClampRaf = requestAnimationFrame(() => {
      panelResizeClampRaf = 0
      ensurePanelInViewport()
    })
  }
}

function onPanelResizePointerUp(e: PointerEvent) {
  window.removeEventListener('pointermove', onPanelResizePointerMove)
  window.removeEventListener('pointerup', onPanelResizePointerUp, true)
  window.removeEventListener('pointercancel', onPanelResizePointerUp, true)
  if (!panelResizeDrag || e.pointerId !== panelResizeDrag.pointerId) return
  panelResizeDrag = null
  if (panelResizeClampRaf) {
    cancelAnimationFrame(panelResizeClampRaf)
    panelResizeClampRaf = 0
  }
  if (isOpen.value) {
    panelResizedThisSession = true
    ensurePanelInViewport()
    saveFabPos()
  }
}

function resolveFabScreenQuadrant(): FabScreenQuadrant {
  if (fabLeft.value === null || fabTop.value === null) {
    const p = options.position || 'bottom-right'
    if (p === 'top-left') return 'tl'
    if (p === 'top-right') return 'tr'
    if (p === 'bottom-left') return 'bl'
    return 'br'
  }
  const cx = fabLeft.value + FAB_SIZE / 2
  const cy = fabTop.value + FAB_SIZE / 2
  const midX = window.innerWidth / 2
  const midY = window.innerHeight / 2
  const right = cx >= midX
  const bottom = cy >= midY
  if (!right && !bottom) return 'tl'
  if (right && !bottom) return 'tr'
  if (!right && bottom) return 'bl'
  return 'br'
}

/** 面板展开时 wrapper 左上角相对「球左上角」屏幕坐标的偏移（球始终贴在面板一角对齐象限） */
function wrapperOffsetFromFab(quadrant: FabScreenQuadrant): { dx: number; dy: number } {
  const h = effectivePanelHeightPx()
  const w = effectivePanelWidthPx()
  switch (quadrant) {
    case 'tl':
      return { dx: 0, dy: 0 }
    case 'tr':
      return { dx: -(w - FAB_SIZE), dy: 0 }
    case 'bl':
      return { dx: 0, dy: -(h - FAB_SIZE) }
    case 'br':
    default:
      return { dx: -(w - FAB_SIZE), dy: -(h - FAB_SIZE) }
  }
}

/** 预设角（无像素坐标）打开后，用 wrapper 实际像素对齐球的锚角 */
function syncFabPixelFromWrapperDom() {
  const el = wrapperRef.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const q = openPanelQuadrant.value
  switch (q) {
    case 'tl':
      fabLeft.value = r.left
      fabTop.value = r.top
      break
    case 'tr':
      fabLeft.value = r.right - FAB_SIZE
      fabTop.value = r.top
      break
    case 'bl':
      fabLeft.value = r.left
      fabTop.value = r.bottom - FAB_SIZE
      break
    case 'br':
    default:
      fabLeft.value = r.right - FAB_SIZE
      fabTop.value = r.bottom - FAB_SIZE
      break
  }
}

function onPanelHeaderPointerDown(e: PointerEvent) {
  if (!isOpen.value || e.button !== 0) return
  const t = e.target as HTMLElement
  if (t.closest?.('.ai-header-actions')) return
  e.preventDefault()
  if (fabLeft.value === null || fabTop.value === null) {
    syncFabPixelFromWrapperDom()
  }
  if (fabLeft.value === null || fabTop.value === null) return
  panelDrag.value = {
    pointerId: e.pointerId,
    lastX: e.clientX,
    lastY: e.clientY,
  }
  panelDragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  window.addEventListener('pointermove', onPanelHeaderPointerMove)
  window.addEventListener('pointerup', onPanelHeaderPointerUp, true)
  window.addEventListener('pointercancel', onPanelHeaderPointerUp, true)
}

function onPanelHeaderPointerMove(e: PointerEvent) {
  if (!panelDrag.value || e.pointerId !== panelDrag.value.pointerId) return
  if (fabLeft.value === null || fabTop.value === null) return
  const d = panelDrag.value
  const dx = e.clientX - d.lastX
  const dy = e.clientY - d.lastY
  d.lastX = e.clientX
  d.lastY = e.clientY
  fabLeft.value += dx
  fabTop.value += dy
  ensurePanelInViewport()
}

function onPanelHeaderPointerUp(e: PointerEvent) {
  window.removeEventListener('pointermove', onPanelHeaderPointerMove)
  window.removeEventListener('pointerup', onPanelHeaderPointerUp, true)
  window.removeEventListener('pointercancel', onPanelHeaderPointerUp, true)
  if (!panelDrag.value || e.pointerId !== panelDrag.value.pointerId) return
  panelDrag.value = null
  panelDragging.value = false
  saveFabPos()
}

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

const persistFab = computed(() => options.persistFabPosition !== false)

const effectivePositionClass = computed(() =>
  fabLeft.value !== null ? '' : positionClass.value,
)

const edgeDockClass = computed(() => {
  if (isOpen.value || fabDragging.value) return ''
  if (edgeDock.value === 'left') return 'edge-dock-left'
  if (edgeDock.value === 'right') return 'edge-dock-right'
  return ''
})

const panelOpenFabAlignClass = computed(() => {
  if (!panelMountedForLayout.value || fabLeft.value === null) return ''
  return `fab-anchor-${openPanelQuadrant.value}`
})

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

function clampFabPos(left: number, top: number) {
  const m = 8
  const maxL = window.innerWidth - FAB_SIZE - m
  const maxT = window.innerHeight - FAB_SIZE - m
  return {
    left: Math.max(m, Math.min(left, maxL)),
    top: Math.max(m, Math.min(top, maxT)),
  }
}

function defaultFabCoords(): { left: number; top: number } {
  const m = 24
  const pos = options.position || 'bottom-right'
  const w = window.innerWidth
  const h = window.innerHeight
  switch (pos) {
    case 'bottom-left':
      return { left: m, top: h - FAB_SIZE - m }
    case 'top-right':
      return { left: w - FAB_SIZE - m, top: m }
    case 'top-left':
      return { left: m, top: m }
    case 'bottom-right':
    default:
      return { left: w - FAB_SIZE - m, top: h - FAB_SIZE - m }
  }
}

function loadFabPos() {
  if (!persistFab.value) return
  try {
    const raw = localStorage.getItem(FAB_POS_KEY)
    if (!raw) return
    const o = JSON.parse(raw) as { left: number; top: number; edgeDock?: string }
    if (typeof o.left === 'number' && typeof o.top === 'number') {
      const c = clampFabPos(o.left, o.top)
      fabLeft.value = c.left
      fabTop.value = c.top
      if (o.edgeDock === 'left' || o.edgeDock === 'right') edgeDock.value = o.edgeDock
    }
  } catch {}
}

function saveFabPos(edgeDockOverride?: 'none' | 'left' | 'right') {
  if (!persistFab.value || fabLeft.value === null || fabTop.value === null) return
  const dock = edgeDockOverride !== undefined ? edgeDockOverride : edgeDock.value
  try {
    localStorage.setItem(
      FAB_POS_KEY,
      JSON.stringify({
        left: fabLeft.value,
        top: fabTop.value,
        edgeDock: dock,
      }),
    )
  } catch {}
}

/** 打开面板时，避免贴边位置导致 380×520 面板溢出视口（按象限对齐球的锚角后整体夹紧） */
function ensurePanelInViewport() {
  if (fabLeft.value === null || fabTop.value === null) return
  const m = 16
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
  const header = 48
  const row = 52
  const listPad = 14
  return header + n * row + listPad
}

function onFabContextMenu(e: MouseEvent) {
  e.preventDefault()
  if (isOpen.value) return
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

function dockFab(edge: 'none' | 'left' | 'right') {
  if (fabLeft.value === null || fabTop.value === null) {
    const d = defaultFabCoords()
    fabLeft.value = d.left
    fabTop.value = d.top
  }
  edgeDock.value = edge
  if (edge === 'left') {
    fabLeft.value = 0
  } else if (edge === 'right') {
    fabLeft.value = window.innerWidth - FAB_SIZE
  } else {
    if (fabLeft.value <= 8) fabLeft.value = 24
    else if (fabLeft.value >= window.innerWidth - FAB_SIZE - 8) {
      fabLeft.value = window.innerWidth - FAB_SIZE - 24
    }
  }
  const c = clampFabPos(fabLeft.value, fabTop.value)
  fabLeft.value = c.left
  fabTop.value = c.top
  saveFabPos()
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
  if (isOpen.value || e.button !== 0) return
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
/** 缩放原点：与当前打开象限下球的锚角对齐，使面板朝视口对向胀开 */
const panelTransformOrigin = computed(() => {
  const origins: Record<FabScreenQuadrant, string> = {
    tl: `${FAB_R}px ${FAB_R}px`,
    tr: `calc(100% - ${FAB_R}px) ${FAB_R}px`,
    bl: `${FAB_R}px calc(100% - ${FAB_R}px)`,
    br: `calc(100% - ${FAB_R}px) calc(100% - ${FAB_R}px)`,
  }
  return origins[openPanelQuadrant.value]
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
}>()

function setMode(m: 'translate' | 'summarize' | 'chat') {
  mode.value = m
}

function clearMessages() {
  messages.value = []
  renderAllMessages.value = false
  resetSearch()
  clearRenderCache()
  clearStoredHistory()
}

function closeMsgCtxMenu() {
  msgCtxMenu.value.show = false
  msgCtxMenu.value.index = -1
  msgCtxMenu.value.selectionText = ''
  msgCtxMenu.value.pointerX = 0
  msgCtxMenu.value.pointerY = 0
  msgCtxMenu.value.anchorTop = 0
  msgCtxMenu.value.selLeft = 0
  msgCtxMenu.value.selRight = 0
  msgCtxMenu.value.selTop = 0
  msgCtxMenu.value.selBottom = 0
}

function getSelectionInsideElement(el: HTMLElement): string {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return ''
  const range = sel.getRangeAt(0)
  if (!el.contains(range.commonAncestorContainer)) return ''
  return sel.toString().trim()
}

/** 右键翻译选中：中文为主译英文，英文为主译中文；混杂按字数多的一侧决定输出语。 */
function inferInlineTranslateTargetLang(text: string, fallback: string): string {
  const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length
  const latin = (text.match(/[a-zA-Z]/g) || []).length
  if (cjk > 0 && latin === 0) return 'en'
  if (latin > 0 && cjk === 0) return 'zh'
  if (cjk > 0 && latin > 0) return cjk >= latin ? 'en' : 'zh'
  const f = (fallback || 'zh').toLowerCase()
  if (f === 'en' || f.startsWith('en')) return 'zh'
  return 'en'
}

function onBubbleContextMenu(e: MouseEvent, globalIndex: number, role: Message['role']) {
  if (role !== 'assistant' || loading.value) return
  const m = messages.value[globalIndex]
  if (!m || m.role !== 'assistant' || !m.content?.trim()) return
  e.preventDefault()
  e.stopPropagation()
  const bubble = e.currentTarget as HTMLElement
  const selectionText = getSelectionInsideElement(bubble)
  const pad = 8
  const selGap = 10
  const vw = window.innerWidth
  const vh = window.innerHeight
  let x = e.clientX
  let y = e.clientY
  if (x + MSG_CTX_MENU_W > vw - pad) x = vw - MSG_CTX_MENU_W - pad
  if (y + MSG_CTX_MENU_H > vh - pad) y = vh - MSG_CTX_MENU_H - pad
  if (x < pad) x = pad
  if (y < pad) y = pad
  let ptrX = e.clientX
  let ptrY = e.clientY
  let anchorTop = e.clientY
  let selLeft = 0
  let selRight = 0
  let selTop = 0
  let selBottom = 0
  if (selectionText) {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      const range = sel.getRangeAt(0)
      if (bubble.contains(range.commonAncestorContainer)) {
        const rr = range.getBoundingClientRect()
        if ((rr.width > 0 || rr.height > 0) && rr.bottom >= rr.top) {
          selLeft = rr.left
          selRight = rr.right
          selTop = rr.top
          selBottom = rr.bottom
          ptrX = rr.right + selGap
          ptrY = rr.top
          anchorTop = rr.top
        }
      }
    }
  }
  msgCtxMenu.value = {
    show: true,
    x,
    y,
    index: globalIndex,
    selectionText,
    pointerX: ptrX,
    pointerY: ptrY,
    anchorTop,
    selLeft,
    selRight,
    selTop,
    selBottom,
  }
}

async function copyAssistantSelection() {
  const text = msgCtxMenu.value.selectionText
  closeMsgCtxMenu()
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    reportAssistantError('copy', 'clipboard unavailable')
  }
}

function closeInlineTranslatePopover() {
  inlineTranslateAbort = true
  detachInlinePopLayoutListeners()
  if (positionInlinePopRaf) {
    cancelAnimationFrame(positionInlinePopRaf)
    positionInlinePopRaf = 0
  }
  inlineTranslatePopover.value = {
    show: false,
    x: 0,
    y: 0,
    text: '',
    loading: false,
    error: '',
    pointerX: 0,
    pointerY: 0,
    anchorTop: 0,
    selLeft: 0,
    selRight: 0,
    selTop: 0,
    selBottom: 0,
  }
}

async function translateAssistantSelection() {
  const text = msgCtxMenu.value.selectionText
  if (!text) return
  if (!options.baseUrl) {
    closeMsgCtxMenu()
    reportAssistantError('translate-inline', 'baseUrl required')
    return
  }
  const pointerX = msgCtxMenu.value.pointerX
  const pointerY = msgCtxMenu.value.pointerY
  const anchorTop = msgCtxMenu.value.anchorTop
  const selLeft = msgCtxMenu.value.selLeft
  const selRight = msgCtxMenu.value.selRight
  const selTop = msgCtxMenu.value.selTop
  const selBottom = msgCtxMenu.value.selBottom
  closeMsgCtxMenu()
  inlineTranslateAbort = false
  inlineTranslatePopover.value = {
    show: true,
    x: 0,
    y: 0,
    text: '',
    loading: true,
    error: '',
    pointerX,
    pointerY,
    anchorTop,
    selLeft,
    selRight,
    selTop,
    selBottom,
  }
  await nextTick()
  schedulePositionInlineTranslatePopover()
  attachInlinePopLayoutListeners()
  try {
    const payload = {
      action: 'translate' as const,
      text,
      targetLang: inferInlineTranslateTargetLang(text, targetLang.value),
    }
    let acc = ''
    let textFlushRaf = 0
    const stream = streamChat(options.baseUrl, payload, options.accessToken)
    try {
      for await (const chunk of stream) {
        if (inlineTranslateAbort) {
          inlineTranslatePopover.value.loading = false
          return
        }
        acc += chunk
        if (!textFlushRaf) {
          textFlushRaf = requestAnimationFrame(() => {
            textFlushRaf = 0
            if (!inlineTranslateAbort) {
              inlineTranslatePopover.value.text = acc
              schedulePositionInlineTranslatePopover()
            }
          })
        }
      }
    } finally {
      if (textFlushRaf) {
        cancelAnimationFrame(textFlushRaf)
        textFlushRaf = 0
      }
    }
    if (!inlineTranslateAbort) {
      inlineTranslatePopover.value.text = acc
      schedulePositionInlineTranslatePopover()
    }
    if (inlineTranslateAbort) {
      inlineTranslatePopover.value.loading = false
      return
    }
  } catch (e: any) {
    inlineTranslatePopover.value.error = `${t.value.errorPrefix}: ${e?.message ?? e}`
    reportAssistantError('translate-inline', String(e?.message ?? e))
  } finally {
    if (!inlineTranslateAbort) inlineTranslatePopover.value.loading = false
    if (!inlineTranslateAbort) {
      await nextTick()
      schedulePositionInlineTranslatePopover()
    }
  }
}

function deleteAssistantAt(globalIndex: number) {
  closeMsgCtxMenu()
  if (globalIndex < 0 || globalIndex >= messages.value.length) return
  messages.value.splice(globalIndex, 1)
  clearRenderCache()
}

/**
 * 导出正文以消息存储的 Markdown 为准（与渲染源一致），避免 innerText 丢标题/代码围栏/链接等。
 * 仅把气泡里多出来的 http(s) 图（如懒加载后才出现的 src）补成 ![](url)。
 */
function resolveExportImageUrl(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  const u = raw.trim()
  if (u.startsWith('data:') || u.startsWith('blob:')) return u
  try {
    return new URL(u, document.baseURI).href
  } catch {
    return u
  }
}

function markdownReferencesImageUrl(md: string, absUrl: string): boolean {
  if (!md || !absUrl) return false
  if (md.includes(absUrl)) return true
  try {
    const rel = new URL(absUrl, document.baseURI).pathname + new URL(absUrl, document.baseURI).search
    if (rel.length > 2 && md.includes(rel)) return true
  } catch {
    /* ignore */
  }
  return false
}

function buildExportContentFromAssistantBubble(globalIndex: number, fallback: string): string {
  const m = messages.value[globalIndex]
  const source = (m?.contentArchive ?? fallback ?? '').replace(/\r\n/g, '\n')
  let out = source.trim()
  const root = wrapperRef.value?.querySelector(`[data-ai-msg-global-idx="${globalIndex}"]`)
  const bubble = root?.querySelector('.ai-bubble') as HTMLElement | undefined
  if (!bubble) return out
  const urls: string[] = []
  bubble.querySelectorAll('img').forEach((img) => {
    const raw =
      (img as HTMLImageElement).currentSrc ||
      img.getAttribute('src') ||
      img.getAttribute('data-src') ||
      img.getAttribute('data-lazy-src')
    const abs = resolveExportImageUrl(raw)
    if (abs && !urls.includes(abs)) urls.push(abs)
  })
  for (const u of urls) {
    if (!markdownReferencesImageUrl(out, u)) {
      out += `${out ? '\n\n' : ''}![](${u})`
    }
  }
  return out.trim()
}

async function exportAssistantMessageServer(globalIndex: number, fmt: ExportFormat) {
  if (exportServerBusy.value) return
  closeMsgCtxMenu()
  if (!options.baseUrl) return
  const m = messages.value[globalIndex]
  if (!m || m.role !== 'assistant') return
  exportServerBusy.value = true
  setExportToast(t.value.exportPreparing, 0)
  try {
    const title = `${t.value.title}-${globalIndex + 1}`
    const content = buildExportContentFromAssistantBubble(globalIndex, m.contentArchive ?? m.content)
    const res = await postServerExport(
      options.baseUrl,
      fmt,
      title,
      [{ role: 'assistant', content }],
      options.accessToken,
      (phase) => {
        if (phase === 'response') setExportToast(t.value.exportReceiving, 0)
        if (phase === 'download') setExportToast(t.value.exportStartingDownload, 0)
      },
    )
    if (!res.ok) {
      setExportToast('', 0)
      reportAssistantError('export-server', res.error)
      emit('error', res.error)
    } else {
      setExportToast(t.value.exportDownloadStarted, 3200)
    }
  } catch (e: unknown) {
    setExportToast('', 0)
    const msg = String((e as Error)?.message ?? e)
    reportAssistantError('export-server', msg)
    emit('error', msg)
  } finally {
    exportServerBusy.value = false
  }
}

function showAllOlderMessages() {
  renderAllMessages.value = true
  nextTick(() => scrollToBottom(true))
}

const copiedIndex = ref(-1)

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
  if (mode.value === 'chat' || loading.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onBodyDrop(e: DragEvent) {
  if (mode.value === 'chat' || loading.value) return
  e.preventDefault()
  const file = e.dataTransfer?.files?.[0]
  if (file) void processFileUpload(file)
}

async function copyMessage(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    const idx = messages.value.findIndex(m => m.content === text && m.role === 'assistant')
    copiedIndex.value = idx
    setTimeout(() => { copiedIndex.value = -1 }, 1500)
  } catch {}
}

defineExpose({ isOpen, messages, mode, targetLang, clearMessages })

watch(panelExpanded, () => {
  if (isOpen.value) {
    nextTick(() => ensurePanelInViewport())
  }
})

watch(isOpen, (open) => {
  if (open) {
    panelResizedThisSession = false
    if (fabLeft.value !== null && fabTop.value !== null) {
      fabFreePosBeforePanel.value = { left: fabLeft.value, top: fabTop.value }
    } else {
      fabFreePosBeforePanel.value = null
    }
    openPanelQuadrant.value = resolveFabScreenQuadrant()
    panelMountedForLayout.value = true
    panelSnapshot.value = { edge: edgeDock.value }
    edgeDock.value = 'none'
    nextTick(() => {
      if (fabLeft.value === null || fabTop.value === null) {
        syncFabPixelFromWrapperDom()
      }
      ensurePanelInViewport()
      // 会话内 edgeDock 已为 none，持久化仍写打开前的贴边，避免 LS 被 none 覆盖
      saveFabPos(panelSnapshot.value?.edge)
    })
  } else {
    panelExpanded.value = false
    panelUserSize.value = null
    if (panelResizeDrag) {
      window.removeEventListener('pointermove', onPanelResizePointerMove)
      window.removeEventListener('pointerup', onPanelResizePointerUp, true)
      window.removeEventListener('pointercancel', onPanelResizePointerUp, true)
      panelResizeDrag = null
    }
    if (panelResizeClampRaf) {
      cancelAnimationFrame(panelResizeClampRaf)
      panelResizeClampRaf = 0
    }
    if (panelDrag.value) {
      window.removeEventListener('pointermove', onPanelHeaderPointerMove)
      window.removeEventListener('pointerup', onPanelHeaderPointerUp, true)
      window.removeEventListener('pointercancel', onPanelHeaderPointerUp, true)
      panelDrag.value = null
      panelDragging.value = false
    }
    if (panelSnapshot.value) {
      const s = panelSnapshot.value
      panelSnapshot.value = null
      if (s.edge === 'left' || s.edge === 'right') {
        fabFreePosBeforePanel.value = null
        dockFab(s.edge)
      } else {
        edgeDock.value = 'none'
        if (panelResizedThisSession && fabFreePosBeforePanel.value) {
          const p = fabFreePosBeforePanel.value
          fabFreePosBeforePanel.value = null
          panelResizedThisSession = false
          const c = clampFabPos(p.left, p.top)
          fabLeft.value = c.left
          fabTop.value = c.top
        } else {
          fabFreePosBeforePanel.value = null
          panelResizedThisSession = false
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
    if (isOpen.value) {
      if (panelUserSize.value) {
        panelUserSize.value = clampPanelSize(panelUserSize.value.w, panelUserSize.value.h)
      }
      ensurePanelInViewport()
    }
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

  const payload: any = {
    action: mode.value,
    text: textWithPageContextForModel(text),
    targetLang: targetLang.value,
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

  try {
    const fullContent = await applyStreamToAssistantMessage(
      msgIndex,
      streamChat(options.baseUrl!, payload, options.accessToken),
    )
    streamDone = true
    /* 流式正文为空时若先插图再被「无响应」覆盖，会丢掉预览图 */
    if (!fullContent && !urlPreviewImgs.length) {
      messages.value[msgIndex] = { role: 'assistant', content: t.value.noResponse }
    } else {
      appendUrlPreviewImagesToAssistant(msgIndex, urlPreviewImgs)
    }
    if (urlPreviewImgs.length) scrollToBottom(false)
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
    loading.value = false
    scrollToBottom(false)
  }
}

async function processFileUpload(file: File) {
  if (!file || loading.value || !options.baseUrl) return

  const action = mode.value === 'translate' ? 'translate' as const : 'summarize' as const
  messages.value.push({ role: 'user', content: `[File] ${file.name}` })
  loading.value = true
  scrollToBottom(true)

  emit('send', { action, text: `[File] ${file.name}` })
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

function onEscKeydown(e: KeyboardEvent) {
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
  if (isOpen.value) {
    e.preventDefault()
    isOpen.value = false
  }
}

function onVisualViewportChange() {
  onWinResize()
}

onMounted(() => {
  loadFabPos()
  window.addEventListener('resize', onWinResize)
  window.visualViewport?.addEventListener('resize', onVisualViewportChange)
  window.visualViewport?.addEventListener('scroll', onVisualViewportChange)
  window.addEventListener('keydown', onEscKeydown, true)
  document.addEventListener('mousedown', onDocPointerDownCloseFabMenu, true)
})

onUnmounted(() => {
  detachInlinePopLayoutListeners()
  disposeSearch()
  disposeExportToast()
  if (winResizeRaf) cancelAnimationFrame(winResizeRaf)
  if (scrollCoalesceRaf) cancelAnimationFrame(scrollCoalesceRaf)
  if (panelResizeClampRaf) cancelAnimationFrame(panelResizeClampRaf)
  window.removeEventListener('resize', onWinResize)
  window.visualViewport?.removeEventListener('resize', onVisualViewportChange)
  window.visualViewport?.removeEventListener('scroll', onVisualViewportChange)
  window.removeEventListener('keydown', onEscKeydown, true)
  document.removeEventListener('mousedown', onDocPointerDownCloseFabMenu, true)
  window.removeEventListener('pointermove', onPanelHeaderPointerMove)
  window.removeEventListener('pointerup', onPanelHeaderPointerUp, true)
  window.removeEventListener('pointercancel', onPanelHeaderPointerUp, true)
  window.removeEventListener('pointermove', onPanelResizePointerMove)
  window.removeEventListener('pointerup', onPanelResizePointerUp, true)
  window.removeEventListener('pointercancel', onPanelResizePointerUp, true)
})
</script>

<style scoped src="./AiAssistant.styles.css"></style>
