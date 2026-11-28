<template>
  <div
    ref="wrapperRef"
    class="ai-assistant-wrapper"
    :class="[
      effectivePositionClass,
      panelOpenFabAlignClass,
      themeClass,
      edgeDockClass,
      edgeDockStyleClass,
      {
        'dock-revealed': edgeDock !== 'none' && dockRevealed && !isOpen && !fabDragging,
        'panel-mounted': panelMountedForLayout,
        'panel-expanded': panelExpanded && isOpen,
        'fab-session-hidden': fabHidden && !panelMountedForLayout,
      },
    ]"
    :style="wrapperStyle"
  >
    <FabButton
      ref="fabButtonRef"
      :fab-hidden="fabHidden"
      :is-open="isOpen"
      :show-fab-during-panel-anim="showFabDuringPanelAnim"
      :fab-dragging="fabDragging"
      :fab-drop-active="false"
      :fab-layout-style="fabLayoutStyle"
      :loading="loading"
      :edge-dock="edgeDock"
      :dock-revealed="dockRevealed"
      :edge-dock-style="edgeDockStyle"
      v-bind="{ ariaLabel: t.fabOpen }"
      drop-hint-text=""
      @pointerdown="onFabPointerDown"
    />

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
        ref="panelRef"
        class="ai-panel"
        :style="panelStyle"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="uid + '-title'"
        @keydown="trapFocus"
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

        <AssistantHeader
          :uid="uid"
          :selected-model="selectedChatModel"
          :panel-dragging="panelDragging"
          :panel-expanded="panelExpanded"
          :has-messages="messages.length > 0"
          :loading="loading"
          :is-dark="isDark"
          :settings-open="edgeDockSettingsOpen"
          :t="t"
          @pointerdown-header="onPanelHeaderPointerDown"
          @open-sessions-drawer="
            edgeDockSettingsOpen = false;
            sessionsDrawerOpen = true;
          "
          @toggle-panel-expand="togglePanelExpand"
          @toggle-theme="toggleManualTheme"
          @toggle-dock-settings="
            sessionsDrawerOpen = false;
            edgeDockSettingsOpen = !edgeDockSettingsOpen;
          "
          @start-new-session="startNewSession"
          @clear-messages="clearMessages"
          @close-panel="isOpen = false"
        />

        <div class="ai-sr-only" aria-live="polite" aria-atomic="true">{{ a11yStatusText }}</div>
        <div class="ai-sr-only" aria-live="polite" aria-atomic="true">
          {{ a11yReplyAnnouncement }}
        </div>

        <SessionTabs
          :sessions="multiSessions.sessions.value"
          :active-id="multiSessions.activeSessionId.value"
          :new-label="t.newSession"
          :tab-list-label="t.chatSessions"
          :close-label="t.closeSession"
          @switch="switchToSession"
          @delete="deleteSessionTab"
        />

        <Transition name="ai-progress-fade">
          <div
            v-if="loading"
            class="ai-progress-bar"
            role="progressbar"
            aria-valuetext="AI generating"
          >
            <div class="ai-progress-bar-fill"></div>
          </div>
        </Transition>

        <div
          ref="bodyRef"
          class="ai-body"
          :aria-busy="loading"
          @click="handleBodyClick"
          @scroll.passive="onBodyScrollForVirtual"
          @dragover.prevent="onBodyDragOver"
          @dragenter.prevent="onBodyDragEnter"
          @dragleave.prevent="onBodyDragLeave"
          @drop.prevent="onBodyDrop"
        >
          <Transition name="ai-fade">
            <div v-if="dragActive" class="ai-drop-overlay">
              <div class="ai-drop-overlay-inner">
                <AssistantIcon name="upload" :size="36" />
                <span>{{ t.dropFileHere }}</span>
              </div>
            </div>
          </Transition>

          <ChatEmptyState
            v-if="messages.length === 0"
            :greeting="t.greeting"
            :subtitle="t.emptySubtitle || ''"
            :form-auto-fill-enabled="formAutoFillEnabled"
            :quick-prompts="quickPrompts"
            :is-zh="(options.locale || 'en') === 'zh'"
            @apply-prompt="applyStarterPrompt"
            @trigger-upload="openFilePicker"
            @trigger-form-fill="triggerClipboardFormFill"
          />

          <MessageList
            :messages="displayedMessages"
            :display-offset="displayOffset"
            :hidden-older-count="hiddenOlderCount"
            :render-all-messages="renderAllMessages"
            :loading="loading"
            :editing-idx="editingMsgIdx"
            :editing-text="editingText"
            :copied-index="copiedIndex"
            :show-earlier-label="showEarlierLabel"
            :t="t"
            :stream-started-at="streamStartedAt"
            :streaming-now-ms="streamingNowMs"
            :is-transient-abort="isTransientAbortAssistantMessage"
            :is-active-streaming="isActiveStreamingAssistant"
            :has-visible-content="hasVisibleAssistantContent"
            :format-relative-time="formatRelativeTime"
            :render-bubble="renderBubble"
            :is-error-message="isErrorMessage"
            :virtual-slice="virtualSliceForList"
            :on-measure-height="virtualScrollOption ? onVirtualMeasureHeight : undefined"
            :form-auto-fill-enabled="formAutoFillEnabled"
            @show-all-older-messages="showAllOlderMessages"
            @confirm-edit="confirmEditAndResend"
            @cancel-edit="cancelEdit"
            @update:editing-text="editingText = $event"
            @stop-generate="stopGenerate"
            @start-edit="startEdit"
            @copy-message="copyMessage"
            @form-fill="fillFormFromMessage"
            @regenerate-at="regenerateAt"
            @retry-last-error="retryLastError"
          />
        </div>

        <Transition name="ai-fade">
          <div v-if="statusToastText" class="ai-status-toast" role="status" aria-live="polite">
            {{ statusToastText }}
          </div>
        </Transition>

        <Transition name="ai-fade">
          <ScrollToBottomButton
            v-if="showScrollToBottomBtn && !loading"
            :label="t.scrollToBottom"
            @click="scrollToBottomClick"
          />
        </Transition>

        <ChatInputArea
          ref="chatInputRef"
          v-model="input"
          :loading="loading"
          :ctrl-enter-to-send="false"
          :color="color"
          :placeholder="t.placeholder.chat"
          :char-count-label="charCountLabel"
          :char-count-near-limit="charCountNearLimit"
          :char-limit-warning-text="charLimitWarningText"
          :pending-file="pendingFile"
          :pending-image-thumbs="pendingImageThumbs"
          :accept-types="ACCEPT_TYPES"
          :has-base-url="!!effectiveBaseUrl"
          :show-model-picker="showModelPickerResolved"
          :selected-model="selectedChatModel"
          :model-choices="modelChoices"
          :form-auto-fill-enabled="formAutoFillEnabled"
          :t="t"
          :slash-visible="slashCmd.visible.value"
          :slash-commands="slashCmd.filteredCommands.value"
          :slash-selected-index="slashCmd.selectedIndex.value"
          @send="send"
          @clear-pending-file="pendingFile = null"
          @clear-pending-image="clearPendingImage"
          @remove-pending-image="removePendingImage"
          @file-select="attachPendingFile"
          @paste-image="onPasteImage"
          @paste-text="onChatInputPasteText"
          @chat-image="readFileAsDataUrl"
          @trigger-form-fill="triggerClipboardFormFill"
          @slash-keydown="(e) => slashCmd.handleKeydown(e)"
          @slash-select="onSlashSelect"
          @slash-hover="(idx) => (slashCmd.selectedIndex.value = idx)"
          @history-older="onHistoryOlder"
          @history-newer="onHistoryNewer"
          @history-reset="onHistoryReset"
          @update:selected-model="selectedChatModel = $event"
        />

        <Transition name="ai-fade">
          <AssistantSettings
            v-if="edgeDockSettingsOpen"
            :model-value="edgeDockStyle"
            :edge-dock="edgeDock"
            :connection-config="connectionConfig"
            :host-base-url="options.baseUrl"
            :backend-models="backendModelChoices"
            :selected-backend-model="selectedBackendModel"
            :is-dark="isDark"
            :is-zh="(options.locale || 'en') === 'zh'"
            :t="t"
            @update:model-value="setEdgeDockStyle"
            @dock-now="applyDockActionFromSettings"
            @save-connection="handleSaveConnection"
            @reset-connection="handleResetConnection"
            @select-backend-model="handleSelectBackendModel"
            @refresh-backend-models="handleRefreshBackendModels"
            @close="edgeDockSettingsOpen = false"
          />
        </Transition>
      </div>
    </Transition>

    <SessionsDrawer
      v-if="sessionsDrawerOpen"
      :open="sessionsDrawerOpen"
      :is-dark="isDark"
      :t="t"
      :sessions="multiSessions.sessions.value"
      :active-id="multiSessions.activeSessionId.value"
      @close="sessionsDrawerOpen = false"
      @pick="switchToSession"
      @pick-message="onPickCrossSessionMessage"
      @delete="deleteSessionTab"
      @toggle-pin="multiSessions.togglePinSession"
      @rename="multiSessions.renameSession"
    />

    <FormAutoFillDialog
      v-if="formAutoFillEnabled"
      :open="formAutoFill.dialogOpen.value"
      :is-dark="isDark"
      :t="t"
      :matches="formAutoFill.matches.value"
      :selected-indices="formAutoFill.selectedIndices.value"
      :available-fields="formAutoFill.availableFields.value"
      :llm-fallback-hinted="formAutoFill.llmFallbackHinted.value"
      :table-info="formAutoFill.tableInfo.value"
      @close="formAutoFill.closeDialog()"
      @toggle="onFormAutoFillToggle"
      @toggle-all="onFormAutoFillToggleAll"
      @override="onFormAutoFillOverride"
      @confirm="onFormAutoFillConfirm"
    />

    <FormFillToast
      v-if="formAutoFillEnabled"
      :visible="formAutoFill.toastVisible.value && !!formAutoFill.toastSummary.value"
      :is-dark="isDark"
      :text="formAutoFillToastText"
      :undo-available="formAutoFill.lastFillRecords.value.length > 0"
      :undo-label="t.formFillToastUndo || 'Undo'"
      :close-aria-label="t.closePanel"
      @undo="onFormAutoFillUndo"
      @dismiss="onFormAutoFillToastDismiss"
    />
  </div>
</template>

<script setup lang="ts">
import {
  ref,
  computed,
  inject,
  reactive,
  nextTick,
  watch,
  onMounted,
  onUnmounted,
  defineAsyncComponent,
  type Ref,
} from 'vue';
import type { AiAssistantOptions } from '../index';
import type { Message } from '../types/message';
import { getMessages, type Locale, type I18nMessages } from '../utils/i18n';
import { fetchModels, fetchUrlPreview, uploadFile } from '../utils/api';
import {
  extractHttpUrls,
  firstNonImageHttpUrl,
  isProbablyDirectImageUrl,
  preferHttpsImageUrlWhenPageIsSecure,
} from '../utils/urlEmbed';
import { writeClipboardText } from '../composables/useMessageCopy';
import { useThemePalette } from '../composables/useThemePalette';
import { useThemePreference } from '../composables/useThemePreference';
import { useRelativeTime } from '../composables/useRelativeTime';
import { useAiMarkdownRenderer } from '../composables/useAiMarkdownRenderer';
import { useBubbleRenderer } from '../composables/useBubbleRenderer';
import { useCodeBlockActions } from '../composables/useCodeBlockActions';
import { useQuickPromptOptions } from '../composables/useQuickPromptOptions';
import { useInputConstraints } from '../composables/useInputConstraints';
import { useMultiSession } from '../composables/useMultiSession';
import { useSessionActions } from '../composables/useSessionActions';
import { useSessionSearch } from '../composables/useSessionSearch';
import {
  useScrollAndVirtual,
  resolveVirtualScrollOption,
} from '../composables/useScrollAndVirtual';
import {
  loadPersistedMessages,
  pruneTransientAssistantMessages,
  useChatHistoryPersistence,
} from '../composables/useChatHistoryPersistence';
import { useMessageMemoryCap } from '../composables/useMessageMemoryCap';
import { useMessageCopy } from '../composables/useMessageCopy';
import { useChatOrchestrator } from '../composables/useChatOrchestrator';
import { useStreamWithFallback } from '../composables/useStreamWithFallback';
import { useSendStream } from '../composables/useSendStream';
import { useImagePasteAndDrop } from '../composables/useImagePasteAndDrop';
import { useImageLightbox } from '../composables/useImageLightbox';
import { usePromptHistory } from '../composables/usePromptHistory';
import { useSlashCommands } from '../composables/useSlashCommands';
import { useFormAutoFillUi } from '../composables/useFormAutoFillUi';
import { useFabDrag } from '../composables/useFabDrag';
import { useEdgeDockStyle } from '../composables/useEdgeDockStyle';
import { usePanelGeometry } from '../composables/usePanelGeometry';
import { usePanelMemory } from '../composables/usePanelMemory';
import { usePanelTransitions } from '../composables/usePanelTransitions';
import { useWrapperStyles } from '../composables/useWrapperStyles';
import { useAssistantKeyboard } from '../composables/useAssistantKeyboard';
import {
  isEventInsideAssistantUi,
  shouldClosePanelOnOutsideMousedown,
} from '../composables/usePanelOutsideClose';

import FabButton from './FabButton.vue';
import AssistantHeader from './AssistantHeader.vue';
import SessionTabs from './SessionTabs.vue';
import ChatEmptyState from './ChatEmptyState.vue';
import MessageList from './MessageList.vue';
import ScrollToBottomButton from './ScrollToBottomButton.vue';
import ChatInputArea from './ChatInputArea.vue';
import AssistantIcon from './AssistantIcon.vue';
import FormFillToast from './FormFillToast.vue';
import AssistantSettings from './AssistantSettings.vue';
import { readTextFileForDirectQa, streamDirectProviderChat } from '../utils/directOpenAi';
import { useConnectionConfig, type ConnectionConfig } from '../composables/useConnectionConfig';

const SessionsDrawer = defineAsyncComponent(() => import('./SessionsDrawer.vue'));
const FormAutoFillDialog = defineAsyncComponent(() => import('./FormAutoFillDialog.vue'));

const ACCEPT_TYPES = '.txt,.md,.csv,.log,.json,.xml,.html,.yml,.yaml,.pdf,.docx,.doc,.xlsx,.xls';
const MAX_RENDERED_MESSAGES = 60;

const uid = 'ai-' + Math.random().toString(36).slice(2, 8);
const options = reactive(
  inject<AiAssistantOptions>('ai-assistant-options', {
    baseUrl: '/ai-assistant',
    primaryColor: '#181818',
    position: 'bottom-right',
    theme: 'light',
    persistHistory: false,
    locale: 'en',
    showModelPicker: true,
    selectedModelStorageKey: 'ai-assistant-selected-model',
  }),
);

const emit = defineEmits<{
  (e: 'send', payload: { action: string; text: string }): void;
  (e: 'response', content: string): void;
  (e: 'error', message: string): void;
  (e: 'feedback', payload: { index: number; value: 'up' | 'down' | null }): void;
}>();

const t = computed(() => getMessages((options.locale || 'en') as Locale));
const color = computed(() => options.primaryColor || '#111111');
const { themePaletteVars } = useThemePalette();
const themePref = useThemePreference(computed(() => options.theme));
const isDark = themePref.isDark;
const toggleManualTheme = themePref.toggleManualTheme;
const { formatRelativeTime } = useRelativeTime(t, () => options.locale || 'en');
const { renderContent, clearRenderCache } = useAiMarkdownRenderer(t, options);
const { quickPrompts } = useQuickPromptOptions(options);

const wrapperRef = ref<HTMLElement>();
const panelRef = ref<HTMLElement>();
const bodyRef = ref<HTMLElement>();
const fabButtonRef = ref<InstanceType<typeof FabButton> | null>(null);
const chatInputRef = ref<InstanceType<typeof ChatInputArea> | null>(null);

const isOpen = ref(false);
const fabHidden = ref(false);
const input = ref('');
const loading = ref(false);
const pendingFile = ref<File | null>(null);
const sessionsDrawerOpen = ref(false);
const edgeDockSettingsOpen = ref(false);
const sessionTitle = ref('');
const mode = ref<'translate' | 'summarize' | 'chat'>('chat');
const targetLang = ref('zh');
const chatSystemPrompt = ref('');
const pendingTimers: number[] = [];
let streamAbortController: AbortController | null = null;
let streamStoppedByUser = false;

const statusToastText = ref('');
let statusToastTimer: number | null = null;
function showStatusToast(msg: string, durationMs = 2600) {
  statusToastText.value = msg;
  if (statusToastTimer != null) clearTimeout(statusToastTimer);
  statusToastTimer = window.setTimeout(() => {
    statusToastText.value = '';
    statusToastTimer = null;
  }, durationMs);
}

function reportAssistantError(source: string, message: string) {
  options.onAssistantError?.({ source, message });
}

/* Connection & Models */
const hostBaseUrlRef = computed(() => options.baseUrl);
const hostAccessTokenRef = computed(() => options.accessToken);
const {
  connectionConfig,
  isDirectMode,
  activeProvider,
  activeProtocol,
  effectiveBaseUrl,
  effectiveToken,
  saveConnectionConfig,
  resetConnectionConfig,
} = useConnectionConfig(hostBaseUrlRef, hostAccessTokenRef);

const showModelPickerResolved = computed(() => options.showModelPicker !== false);
const selectedModelStorageKeyResolved = computed(
  () => options.selectedModelStorageKey?.trim() || 'ai-assistant-selected-model',
);
const modelChoices = ref<string[]>([]);
const backendModelChoices = ref<string[]>([]);
const modelCapabilities = ref<Record<string, string[]>>({});
const selectedChatModel = ref('');
const selectedBackendModel = ref('');
let modelsFetched = false;

function syncDirectModelState() {
  const prov = activeProvider.value;
  const activeM = prov.activeModel.trim() || prov.models[0]?.trim() || '';
  modelChoices.value = Array.from(new Set([activeM, ...prov.models].filter(Boolean)));
  modelCapabilities.value = {};
  selectedChatModel.value = activeM;
}

if (isDirectMode.value) {
  syncDirectModelState();
}

async function refreshChatModels(force = false) {
  if (isDirectMode.value) {
    syncDirectModelState();
    return;
  }
  const baseUrl = effectiveBaseUrl.value;
  if ((modelsFetched && !force) || !baseUrl) return;
  modelsFetched = true;
  try {
    const res = await fetchModels(baseUrl, effectiveToken.value || undefined);
    if (!res.success || !Array.isArray(res.models)) {
      if (force) {
        backendModelChoices.value = [];
        if (!isDirectMode.value) modelChoices.value = [];
      }
      return;
    }
    backendModelChoices.value = res.models;
    modelChoices.value = res.models;
    const caps: Record<string, string[]> = {};
    for (const detail of res.modelDetails ?? []) {
      if (detail.id && Array.isArray(detail.capabilities)) caps[detail.id] = detail.capabilities;
    }
    modelCapabilities.value = caps;
    let saved = '';
    try {
      saved = localStorage.getItem(selectedModelStorageKeyResolved.value) || '';
    } catch {
      /* ignore */
    }
    if (saved && res.models.includes(saved)) selectedChatModel.value = saved;
    else if (res.defaultModel && res.models.includes(res.defaultModel))
      selectedChatModel.value = res.defaultModel;
    else if (res.models.length > 0) selectedChatModel.value = res.models[0];
    selectedBackendModel.value = selectedChatModel.value;
  } catch {
    /* ignore */
  }
}

watch(selectedChatModel, (v) => {
  if (!v) return;
  try {
    localStorage.setItem(selectedModelStorageKeyResolved.value, v);
  } catch {
    /* ignore */
  }
});

/* Messages & Sessions */
const multiSessions = useMultiSession();
const messages = ref<Message[]>(
  pruneTransientAssistantMessages(loadPersistedMessages(!!options.persistHistory)),
);
const renderAllMessages = ref(false);
const { saveHistory, clearStoredHistory } = useChatHistoryPersistence(
  messages,
  () => !!options.persistHistory,
);
const { trimMessagesForMemoryCap } = useMessageMemoryCap(messages, options, clearRenderCache);

const { displayOffset, displayedMessages, hiddenOlderCount, resetSearch } = useSessionSearch(
  messages,
  loading,
  renderAllMessages,
  MAX_RENDERED_MESSAGES,
  panelRef,
);
const showEarlierLabel = computed(() =>
  t.value.showEarlierTemplate.replace(/\{n\}/g, String(hiddenOlderCount.value)),
);

const virtualScrollOption = computed(() => resolveVirtualScrollOption(options.virtualScroll));
const {
  showScrollToBottomBtn,
  scrollToBottomClick,
  virtualScrollTop,
  virtualViewportHeight,
  virtualSliceForList,
  onVirtualMeasureHeight,
  onBodyScrollForVirtual,
} = useScrollAndVirtual({
  bodyRef,
  displayedMessageCount: computed(() => displayedMessages.value.length),
  virtualScrollOption,
});

const SCROLL_STICKY_PX = 80;
let scrollCoalesceRaf = 0;
let scrollPendingForce = false;
let scrollPendingSoft = false;

function flushScrollToBottom() {
  scrollCoalesceRaf = 0;
  const el = bodyRef.value;
  const doForce = scrollPendingForce;
  const doSoft = scrollPendingSoft;
  scrollPendingForce = false;
  scrollPendingSoft = false;
  if (!el) return;
  if (doForce) {
    el.scrollTop = el.scrollHeight;
    return;
  }
  if (doSoft && el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_STICKY_PX) {
    el.scrollTop = el.scrollHeight;
  }
}

function scrollToBottom(force: boolean) {
  if (force) scrollPendingForce = true;
  else scrollPendingSoft = true;
  if (scrollCoalesceRaf) return;
  nextTick(() => {
    if (scrollCoalesceRaf) return;
    scrollCoalesceRaf = requestAnimationFrame(() => flushScrollToBottom());
  });
}

function removeTransientAssistantMessages() {
  const cleaned = pruneTransientAssistantMessages(messages.value);
  if (cleaned.length !== messages.value.length) {
    messages.value = cleaned;
    clearRenderCache();
  }
}

const a11yReplyAnnouncement = ref('');
const a11yStatusText = computed(() => (isOpen.value && loading.value ? t.value.replying : ''));

watch(loading, (now, prev) => {
  if (prev === true && now === false) {
    removeTransientAssistantMessages();
    const last = messages.value[messages.value.length - 1];
    if (last?.role === 'assistant' && last.content.trim()) {
      a11yReplyAnnouncement.value = '';
      void nextTick(() => {
        a11yReplyAnnouncement.value = last.content.slice(0, 1000);
      });
    }
  }
});

watch(
  () => messages.value.length,
  () => {
    removeTransientAssistantMessages();
    trimMessagesForMemoryCap();
    scrollToBottom(false);
    saveHistory();
  },
);

const {
  startNewSession,
  switchToSession,
  onPickCrossSessionMessage,
  deleteSessionTab,
  clearMessages,
  showAllOlderMessages,
} = useSessionActions({
  multiSessions,
  messages,
  renderAllMessages,
  sessionTitle,
  isOpen,
  panelRef,
  maxRenderedMessages: MAX_RENDERED_MESSAGES,
  resetSearch,
  clearRenderCache,
  clearStoredHistory,
  scrollToBottom,
});

/* Images, Lightbox & File Upload Q&A */
useImageLightbox({
  panelRef,
  closeAriaLabel: () => t.value.imageLightboxClose || 'Close',
});

function attachPendingFile(file: File) {
  pendingFile.value = file;
  showStatusToast(`已挂载文件：${file.name}（可直接输入问题或发送总结）`, 2600);
  void nextTick(() => chatInputRef.value?.focusInput());
}

const {
  dragActive,
  pendingImageDataList,
  pendingImageThumbs,
  onBodyDragOver,
  onBodyDragEnter,
  onBodyDragLeave,
  onBodyDrop,
  onPasteImage,
  readFileAsDataUrl,
  clearPendingImage,
  removePendingImage,
} = useImagePasteAndDrop({
  loading,
  messages,
  errorPrefix: computed(() => t.value.errorPrefix),
  processFileUpload: (file) => attachPendingFile(file),
});

function handleSaveConnection(next: ConnectionConfig) {
  const prev = connectionConfig.value;
  const backendConnChanged =
    prev.backendBaseUrl !== next.backendBaseUrl || prev.backendToken !== next.backendToken;
  saveConnectionConfig(next);
  if (next.mode === 'direct') {
    syncDirectModelState();
    return;
  }
  modelChoices.value = backendModelChoices.value;
  selectedChatModel.value = selectedBackendModel.value;
  if (backendConnChanged || !modelsFetched) {
    modelsFetched = false;
    void refreshChatModels(true);
  }
}

function handleRefreshBackendModels(next: ConnectionConfig) {
  saveConnectionConfig(next);
  modelsFetched = false;
  void refreshChatModels(true);
}

function handleResetConnection() {
  resetConnectionConfig();
  modelsFetched = false;
  backendModelChoices.value = [];
  modelChoices.value = [];
  selectedBackendModel.value = '';
  selectedChatModel.value = '';
  void refreshChatModels(true);
}

function handleSelectBackendModel(modelId: string) {
  selectedBackendModel.value = modelId;
  if (!isDirectMode.value) {
    selectedChatModel.value = modelId;
  } else {
    try {
      localStorage.setItem(selectedModelStorageKeyResolved.value, modelId);
    } catch {
      /* ignore */
    }
  }
}

watch(selectedChatModel, (v) => {
  if (isDirectMode.value) {
    const trimmed = v.trim();
    if (trimmed && trimmed !== activeProvider.value.activeModel.trim()) {
      const nextProviders = connectionConfig.value.providers.map((p) => {
        if (p.id !== activeProvider.value.id) return p;
        const models = p.models.includes(trimmed) ? p.models : [trimmed, ...p.models];
        return { ...p, activeModel: trimmed, models };
      });
      saveConnectionConfig({
        ...connectionConfig.value,
        providers: nextProviders,
        directModel: trimmed,
      });
    }
  } else if (v) {
    selectedBackendModel.value = v;
  }
});

async function runDirectFileQuestion(file: File, trimmedQ: string) {
  const parsed = await readTextFileForDirectQa(file, trimmedQ || undefined);
  if (!parsed.ok) {
    const content = `${t.value.errorPrefix}: ${parsed.error}`;
    messages.value.push({ role: 'assistant', content, timestamp: Date.now() });
    scrollToBottom(true);
    reportAssistantError('file-upload', parsed.error);
    emit('error', parsed.error);
    return;
  }

  messages.value.push({ role: 'assistant', content: '', timestamp: Date.now() });
  const msgIdx = messages.value.length - 1;
  const controller = new AbortController();
  streamAbortController = controller;
  try {
    for await (const chunk of streamDirectProviderChat(
      activeProtocol.value,
      effectiveBaseUrl.value,
      {
        action: 'chat',
        text: parsed.promptText,
        model: selectedChatModel.value.trim() || undefined,
      },
      effectiveToken.value || undefined,
      controller.signal,
    )) {
      messages.value[msgIdx].content += chunk;
      scrollToBottom(false);
    }
    if (messages.value[msgIdx].content) {
      emit('response', messages.value[msgIdx].content);
    }
  } finally {
    if (streamAbortController === controller) {
      streamAbortController = null;
    }
  }
}

async function submitPendingFileQuestion(file: File, questionText: string) {
  if (loading.value || !effectiveBaseUrl.value) return;
  const trimmedQ = questionText.trim();
  const sizeKb = (file.size / 1024).toFixed(1);
  const displayUserText = trimmedQ
    ? `📄 ${file.name} (${sizeKb}KB)\n${trimmedQ}`
    : `📄 ${file.name} (${sizeKb}KB)`;

  pendingFile.value = null;
  input.value = '';
  messages.value.push({ role: 'user', content: displayUserText, timestamp: Date.now() });
  if (!sessionTitle.value) sessionTitle.value = file.name.slice(0, 20);
  multiSessions.updateActiveTitle(sessionTitle.value);
  loading.value = true;
  scrollToBottom(true);
  emit('send', { action: 'summarize', text: displayUserText });

  try {
    if (isDirectMode.value) {
      await runDirectFileQuestion(file, trimmedQ);
      return;
    }
    const res = await uploadFile(
      effectiveBaseUrl.value,
      file,
      'summarize',
      targetLang.value,
      effectiveToken.value || undefined,
      options.tenantId,
      trimmedQ || undefined,
      selectedChatModel.value || undefined,
    );
    const content = res.success ? res.result! : `${t.value.errorPrefix}: ${res.error}`;
    messages.value.push({ role: 'assistant', content, timestamp: Date.now() });
    scrollToBottom(true);
    if (res.success) {
      emit('response', content);
    } else {
      reportAssistantError('file-upload', res.error || 'Unknown error');
      emit('error', res.error || 'Unknown error');
    }
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'AbortError') {
      const lastMsg = messages.value[messages.value.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
        messages.value.pop();
      }
      return;
    }
    const message = e instanceof Error ? e.message : String(e);
    const errText = `${t.value.errorPrefix}: ${message}`;
    const lastMsg = messages.value[messages.value.length - 1];
    if (lastMsg && lastMsg.role === 'assistant' && !lastMsg.content) {
      lastMsg.content = errText;
    } else {
      messages.value.push({
        role: 'assistant',
        content: errText,
        timestamp: Date.now(),
      });
    }
    scrollToBottom(true);
    reportAssistantError('file-upload', message);
    emit('error', message || 'Unknown error');
  } finally {
    loading.value = false;
    scrollToBottom(false);
  }
}

/* Stream send & Message orchestration */
const { streamWithFallback } = useStreamWithFallback({ enableWsFallback: false });
const activeStreamWithFallback: typeof streamWithFallback = (
  baseUrl,
  payload,
  token,
  signal,
  onMeta,
  tenantId,
) => {
  if (isDirectMode.value) {
    return streamDirectProviderChat(activeProtocol.value, baseUrl, payload, token, signal, onMeta);
  }
  return streamWithFallback(baseUrl, payload, token, signal, onMeta, tenantId);
};
const { charCountLabel, charCountNearLimit, charLimitWarningText } = useInputConstraints({
  input,
  options,
  t,
});

const streamingNowMs = ref(Date.now());
let streamingTickHandle: ReturnType<typeof setInterval> | null = null;
const {
  send: sendChatRaw,
  streamStartedAt,
  sanitizeAssistantContent,
  hasVisibleAssistantContent,
} = useSendStream({
  messages,
  input,
  loading,
  sessionTitle,
  activeSessionId: multiSessions.activeSessionId,
  mode,
  targetLang,
  chatSystemPrompt,
  selectedChatModel,
  modelChoices,
  modelCapabilities,
  pendingImageDataList,
  pendingImageThumbs,
  options,
  getEffectiveBaseUrl: () => effectiveBaseUrl.value,
  getEffectiveToken: () => effectiveToken.value || undefined,
  allowCustomModel: isDirectMode,
  disableUrlPreview: isDirectMode,
  t,
  streamWithFallback: activeStreamWithFallback,
  fetchUrlPreview,
  extractHttpUrls,
  isProbablyDirectImageUrl,
  firstNonImageHttpUrl,
  preferHttpsImageUrlWhenPageIsSecure,
  clearPendingImage,
  notify: showStatusToast,
  scrollToBottom,
  trimMessagesForMemoryCap,
  clearRenderCache,
  reportAssistantError,
  updateActiveSessionTitle: (title) => multiSessions.updateActiveTitle(title),
  emitSend: (payload) => emit('send', payload),
  emitResponse: (content) => emit('response', content),
  emitError: (message) => emit('error', message),
  getStreamAbortController: () => streamAbortController,
  setStreamAbortController: (c) => {
    streamAbortController = c;
  },
  getStreamStoppedByUser: () => streamStoppedByUser,
  setStreamStoppedByUser: (v) => {
    streamStoppedByUser = v;
  },
  pageContextEnabled: computed(() => true),
});

watch(streamStartedAt, (v) => {
  if (v != null && streamingTickHandle == null) {
    streamingNowMs.value = Date.now();
    streamingTickHandle = window.setInterval(() => {
      streamingNowMs.value = Date.now();
    }, 1000);
  } else if (v == null && streamingTickHandle != null) {
    clearInterval(streamingTickHandle);
    streamingTickHandle = null;
  }
});

const promptHistory = usePromptHistory({
  max: 50,
  storageKey: 'ai-assistant.prompt-history.v1',
});

function send() {
  const prompt = input.value;
  if (prompt.trim()) promptHistory.record(prompt);
  else promptHistory.reset();

  if (pendingFile.value) {
    return submitPendingFileQuestion(pendingFile.value, prompt);
  }
  return sendChatRaw();
}

function isActiveStreamingAssistant(globalIdx: number, msg: Message): boolean {
  return loading.value && msg.role === 'assistant' && globalIdx === messages.value.length - 1;
}

const { renderBubble, isTransientAbortAssistantMessage } = useBubbleRenderer({
  t,
  sanitizeAssistantContent,
  renderContent,
});
const { handleBodyClick } = useCodeBlockActions({
  messages,
  openCodeInIde: options.openCodeInIde,
  t,
  setToast: showStatusToast,
  pendingTimers,
});
const { copiedIndex, copyMessage } = useMessageCopy({
  writeText: writeClipboardText,
  reportError: reportAssistantError,
  pendingTimers,
});

const editingMsgIdx = ref<number | null>(null);
const editingText = ref('');
const {
  stopGenerate,
  isErrorMessage,
  regenerateAt,
  retryLastError,
  startEdit,
  cancelEdit,
  confirmEditAndResend,
} = useChatOrchestrator({
  messages,
  loading,
  input,
  editingMsgIdx,
  editingText,
  clearRenderCache,
  send: () => send(),
  getStreamAbortController: () => streamAbortController,
  setStreamAbortController: (c) => {
    streamAbortController = c;
  },
  setStreamStoppedByUser: (v) => {
    streamStoppedByUser = v;
  },
  emitFeedback: (payload) => emit('feedback', payload),
});

/* Form Auto-Fill */
const {
  formAutoFill,
  formAutoFillEnabled,
  onChatInputPasteText,
  onFormAutoFillToggle,
  onFormAutoFillToggleAll,
  onFormAutoFillOverride,
  onFormAutoFillConfirm,
  onFormAutoFillUndo,
  onFormAutoFillToastDismiss,
  formAutoFillToastText,
} = useFormAutoFillUi({ options, t });

function triggerClipboardFormFill() {
  if (!formAutoFillEnabled.value) return;
  void formAutoFill.triggerFromText(input.value);
}

function fillFormFromMessage(globalIdx: number) {
  if (!formAutoFillEnabled.value) return;
  const msg = messages.value[globalIdx];
  const text = msg?.contentArchive ?? msg?.content ?? '';
  void formAutoFill.triggerFromText(text);
}

/* Slash commands & Empty state helpers */
function openFilePicker() {
  chatInputRef.value?.openFilePicker();
}

const slashCmd = useSlashCommands({
  input,
  t: computed(() => t.value) as unknown as Ref<I18nMessages>,
  onClear: clearMessages,
  onNewSession: startNewSession,
  onUploadFile: openFilePicker,
  onFormFill: triggerClipboardFormFill,
  formAutoFillEnabled,
});
watch(input, () => slashCmd.onInputChange());

function onSlashSelect(idx: number) {
  slashCmd.selectedIndex.value = idx;
  slashCmd.executeSelected();
}

function applyStarterPrompt(text: string) {
  input.value = text;
  void nextTick(() => chatInputRef.value?.focusInput());
}

function onHistoryOlder() {
  const v = promptHistory.recallOlder();
  if (v != null) input.value = v;
}
function onHistoryNewer() {
  const v = promptHistory.recallNewer();
  input.value = v ?? '';
}
function onHistoryReset() {
  promptHistory.reset();
  input.value = '';
}

/* FAB Drag / Edge Dock / Panel Geometry & Outside Close */
const persistFabRef = computed(() => options.persistFabPosition !== false);
const { edgeDockStyle, setEdgeDockStyle, edgeDockStyleClass } = useEdgeDockStyle(
  options.edgeDockStyle,
);
const fab = useFabDrag(isOpen, fabHidden, persistFabRef, options.position || 'bottom-right');
const {
  fabLeft,
  fabTop,
  edgeDock,
  dockRevealed,
  fabDragging,
  fabPositionCustomized,
  edgeDockClass,
  clampFabPos,
  defaultFabCoords,
  loadFabPos,
  saveFabPos,
  dockFab,
  syncDockedFabToViewport,
  onFabPointerDown,
  FAB_SIZE,
} = fab;

const persistPanelRef = computed(() => options.persistPanelState !== false);
const panelMemory = usePanelMemory(
  persistPanelRef,
  computed(() => options.panelStateStorageKey),
);
const panelGeo = usePanelGeometry({
  fabLeft,
  fabTop,
  fabSize: FAB_SIZE,
  isOpen,
  saveFabPos,
  markFabPositionCustomized: fab.markFabPositionCustomized,
  defaultPosition: options.position || 'bottom-right',
  keepPanelStateOnClose: () => persistPanelRef.value,
});
const {
  panelExpanded,
  panelMountedForLayout,
  panelDragging,
  panelOpenFabAlignClass,
  panelTransformOrigin,
  wrapperOffsetFromFab,
  effectivePanelWidthPx,
  effectivePanelHeightPx,
  resizeZoneDefs,
  togglePanelExpand,
  restorePanelState,
  ensurePanelInViewport,
  onPanelResizePointerDown,
  onPanelHeaderPointerDown,
  onPanelOpen,
  onPanelClose,
  onWinResizePanel,
  cleanupGeometry,
  openPanelQuadrant,
} = panelGeo;

const {
  showFabDuringPanelAnim,
  onPanelBeforeEnter,
  onPanelAfterEnter,
  onPanelBeforeLeave,
  onPanelAfterLeave,
} = usePanelTransitions({ panelMountedForLayout });

const effectivePositionClass = computed(() =>
  fabLeft.value !== null ? '' : `pos-${options.position || 'bottom-right'}`,
);
const themeClass = computed(() => (isDark.value ? 'ai-dark' : ''));
const fabStyle = computed(() => ({ '--ai-fab-accent': color.value }));
const fabLayoutStyle = computed(() => {
  const base = fabStyle.value;
  if (fabLeft.value !== null) {
    if (panelMountedForLayout.value) {
      return { ...base, position: 'absolute' as const, zIndex: 2 };
    }
    if (!fabDragging.value && edgeDock.value === 'right') {
      return {
        ...base,
        position: 'absolute' as const,
        right: '0',
        left: 'auto',
        top: '0',
        zIndex: 2,
      };
    }
    return { ...base, position: 'absolute' as const, left: '0', top: '0', zIndex: 2 };
  }
  const p = options.position || 'bottom-right';
  const map: Record<string, Record<string, string>> = {
    'bottom-right': { position: 'absolute', right: '0', bottom: '0', zIndex: '2' },
    'bottom-left': { position: 'absolute', left: '0', bottom: '0', zIndex: '2' },
    'top-right': { position: 'absolute', right: '0', top: '0', zIndex: '2' },
    'top-left': { position: 'absolute', left: '0', top: '0', zIndex: '2' },
  };
  return { ...base, ...(map[p] || map['bottom-right']) };
});
const isMobileViewport = ref(
  typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 600px)').matches,
);
const { wrapperStyle, panelStyle } = useWrapperStyles({
  color,
  themePaletteVars,
  panelMountedForLayout,
  isMobileViewport,
  effectivePanelWidthPx,
  effectivePanelHeightPx,
  fabLeft,
  fabTop,
  wrapperOffsetFromFab,
  openPanelQuadrant,
  panelTransformOrigin,
});

const panelSnapshot = ref<{ edge: 'none' | 'left' | 'right' } | null>(null);
const fabFreePosBeforePanel = ref<{ left: number; top: number } | null>(null);

function applyDockActionFromSettings(edge: 'left' | 'right' | 'none') {
  edgeDockSettingsOpen.value = false;
  if (edge === 'left' || edge === 'right') {
    fabFreePosBeforePanel.value = null;
    panelSnapshot.value = { edge };
  } else {
    panelSnapshot.value = { edge: 'none' };
    dockFab('none');
    if (fabLeft.value !== null && fabTop.value !== null) {
      fabFreePosBeforePanel.value = { left: fabLeft.value, top: fabTop.value };
    }
  }
  isOpen.value = false;
}

watch(
  [isOpen, panelExpanded, panelGeo.panelUserSize],
  () => {
    panelMemory.save({
      open: isOpen.value,
      expanded: panelExpanded.value,
      w: panelGeo.panelUserSize.value?.w,
      h: panelGeo.panelUserSize.value?.h,
    });
  },
  { deep: true },
);

watch(isOpen, (open) => {
  dockRevealed.value = false;
  if (open) {
    void refreshChatModels();
    fabFreePosBeforePanel.value =
      fabLeft.value !== null && fabTop.value !== null
        ? { left: fabLeft.value, top: fabTop.value }
        : null;
    panelSnapshot.value = { edge: edgeDock.value };
    onPanelOpen(wrapperRef.value, edgeDock);
    nextTick(() => {
      if (fabLeft.value === null || fabTop.value === null) {
        const rect = wrapperRef.value?.getBoundingClientRect();
        if (rect && rect.width > 0) {
          const c = clampFabPos(rect.left, rect.top);
          fabLeft.value = c.left;
          fabTop.value = c.top;
        }
      }
      ensurePanelInViewport();
      saveFabPos(panelSnapshot.value?.edge);
      chatInputRef.value?.focusInput();
    });
  } else {
    edgeDockSettingsOpen.value = false;
    onPanelClose();
    if (panelSnapshot.value) {
      const s = panelSnapshot.value;
      panelSnapshot.value = null;
      if (s.edge === 'left' || s.edge === 'right') {
        fabFreePosBeforePanel.value = null;
        dockFab(s.edge);
      } else {
        edgeDock.value = 'none';
        if (fabFreePosBeforePanel.value && !panelGeo.panelHeaderDraggedWhileOpen) {
          const c = clampFabPos(fabFreePosBeforePanel.value.left, fabFreePosBeforePanel.value.top);
          fabLeft.value = c.left;
          fabTop.value = c.top;
        }
        fabFreePosBeforePanel.value = null;
        saveFabPos();
      }
    }
  }
});

function onDocPointerDown(e: MouseEvent) {
  if (
    dockRevealed.value &&
    !isOpen.value &&
    e.button === 0 &&
    !isEventInsideAssistantUi(e, panelRef.value, wrapperRef.value)
  ) {
    dockRevealed.value = false;
  }

  if (
    shouldClosePanelOnOutsideMousedown(e, {
      isOpen: isOpen.value,
      panelEl: panelRef.value,
      wrapperEl: wrapperRef.value,
      hasOpenModal: sessionsDrawerOpen.value || formAutoFill.dialogOpen.value,
    })
  ) {
    isOpen.value = false;
  }
}

let winResizeRaf = 0;
function onWinResize() {
  isMobileViewport.value =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 600px)').matches;
  if (winResizeRaf) cancelAnimationFrame(winResizeRaf);
  winResizeRaf = requestAnimationFrame(() => {
    winResizeRaf = 0;
    if (!fabPositionCustomized.value && edgeDock.value === 'none') {
      const nextDefault = defaultFabCoords();
      fabLeft.value = nextDefault.left;
      fabTop.value = nextDefault.top;
      if (fabFreePosBeforePanel.value) fabFreePosBeforePanel.value = nextDefault;
    }
    if (fabLeft.value === null || fabTop.value === null) return;
    syncDockedFabToViewport();
    saveFabPos();
    if (isOpen.value) onWinResizePanel();
  });
}

const { trapFocus, onEscKeydown } = useAssistantKeyboard({
  options,
  panelRef,
  isOpen,
  panelExpanded,
  fabHidden,
  sessionsDrawerOpen,
  edgeDockSettingsOpen,
  formAutoFillDialogOpen: formAutoFill.dialogOpen,
  onCloseFormAutoFillDialog: () => formAutoFill.closeDialog(),
  clearMessages,
  startNewSession,
});

onMounted(() => {
  loadFabPos();
  const panelMem = panelMemory.load();
  if (panelMem) {
    restorePanelState({ expanded: panelMem.expanded, w: panelMem.w, h: panelMem.h });
    if (panelMem.open) isOpen.value = true;
  }
  void nextTick(() => {
    const el = bodyRef.value;
    if (el) {
      virtualScrollTop.value = el.scrollTop;
      virtualViewportHeight.value = el.clientHeight;
    }
  });
  window.addEventListener('resize', onWinResize);
  window.addEventListener('keydown', onEscKeydown, true);
  document.addEventListener('mousedown', onDocPointerDown, true);
});

onUnmounted(() => {
  if (statusToastTimer != null) clearTimeout(statusToastTimer);
  if (streamingTickHandle != null) clearInterval(streamingTickHandle);
  if (winResizeRaf) cancelAnimationFrame(winResizeRaf);
  if (scrollCoalesceRaf) cancelAnimationFrame(scrollCoalesceRaf);
  pendingTimers.forEach(clearTimeout);
  pendingTimers.length = 0;
  streamAbortController?.abort();
  streamAbortController = null;
  cleanupGeometry();
  window.removeEventListener('resize', onWinResize);
  window.removeEventListener('keydown', onEscKeydown, true);
  document.removeEventListener('mousedown', onDocPointerDown, true);
});

defineExpose({ isOpen, messages, clearMessages });
</script>

<style src="./styles/00-enterprise-tokens.css"></style>
<style src="./styles/01-shell.css"></style>
<style src="./styles/02-header-messages.css"></style>
<style src="./styles/03-input-popups.css"></style>
<style src="./styles/04-features.css"></style>
<style src="./styles/05-overlays-resize.css"></style>
<style src="./styles/08-late-additions.css"></style>
<style src="./styles/09-modern-overhaul.css"></style>
<style src="./styles/11-refinement-and-performance.css"></style>
<style src="./styles/13-containment.css"></style>
<style src="./styles/99-enterprise-overhaul.css"></style>
