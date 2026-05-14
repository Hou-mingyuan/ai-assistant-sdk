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
      :aria-label="t.fabOpen"
      @pointerdown="onFabPointerDown"
      @contextmenu.prevent="onFabContextMenu"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <!-- Sparkle / star with 4 rays — modern AI assistant icon -->
        <path
          d="M12 2.5l1.95 5.85a1 1 0 0 0 .7.7L20.5 11l-5.85 1.95a1 1 0 0 0-.7.7L12 19.5l-1.95-5.85a1 1 0 0 0-.7-.7L3.5 11l5.85-1.95a1 1 0 0 0 .7-.7L12 2.5z"
        />
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
        <canvas ref="codeWallCanvasRef" class="ai-code-wall-canvas" aria-hidden="true"></canvas>
        <!-- Header：中间 ai-header-spacer 穿透命中顶边缩放手柄 -->
        <AssistantHeader
          :uid="uid"
          :session-title="sessionTitle"
          :panel-dragging="panelDragging"
          :mode="mode"
          :show-system-prompt-ui="showSystemPromptUi"
          :diagnostics-open="diagnosticsOpen"
          :panel-expanded="panelExpanded"
          :select-mode="selectMode"
          :batch-export-menu-open="batchExportMenuOpen"
          :has-messages="messages.length > 0"
          :loading="loading"
          :has-base-url="!!options.baseUrl"
          :header-plugins="getPlugins('header')"
          :is-dark="isDark"
          :t="t"
          @pointerdown-header="onPanelHeaderPointerDown"
          @open-personalize="openPersonalize"
          @toggle-diagnostics="toggleDiagnostics"
          @open-sessions-drawer="sessionsDrawerOpen = true"
          @toggle-panel-expand="togglePanelExpand"
          @toggle-theme="toggleManualTheme"
          @run-plugin="runPlugin"
          @start-new-session="startNewSession"
          @toggle-batch-export-menu="toggleBatchExportMenu"
          @batch-export-all-json="batchExportAllJson"
          @batch-export-all-markdown="batchExportAllMarkdown"
          @batch-export-all-server="batchExportAllServer"
          @toggle-select-mode="toggleSelectMode"
          @clear-messages="clearMessages"
          @close-panel="isOpen = false"
        />

        <div class="ai-sr-only" aria-live="polite" aria-atomic="true">{{ a11yStatusText }}</div>

        <SessionTabs
          :sessions="multiSessions.sessions.value"
          :active-id="multiSessions.activeSessionId.value"
          :new-label="t.newSession"
          :tab-list-label="t.chatSessions"
          :close-label="t.closeSession"
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
          />
          <span v-if="searchCountLabel" class="ai-search-count">{{ searchCountLabel }}</span>
          <button
            v-if="debouncedSearchQuery.trim()"
            type="button"
            class="ai-search-nav"
            :disabled="totalMatches === 0"
            :aria-label="t.searchPrev"
            @click="goPrevMatch"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
            </svg>
          </button>
          <button
            v-if="debouncedSearchQuery.trim()"
            type="button"
            class="ai-search-nav"
            :disabled="totalMatches === 0"
            :aria-label="t.searchNext"
            @click="goNextMatch"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </button>
          <!-- H6: 三模式 toggle -->
          <button
            type="button"
            class="ai-search-mode"
            :class="{ active: searchCaseSensitive }"
            :title="t.searchCaseSensitive || 'Case sensitive (Aa)'"
            :aria-pressed="searchCaseSensitive ? 'true' : 'false'"
            @click="searchCaseSensitive = !searchCaseSensitive"
          >
            Aa
          </button>
          <button
            type="button"
            class="ai-search-mode"
            :class="{ active: searchWholeWord }"
            :title="t.searchWholeWord || 'Whole word (\\b)'"
            :aria-pressed="searchWholeWord ? 'true' : 'false'"
            @click="searchWholeWord = !searchWholeWord"
          >
            W
          </button>
          <button
            type="button"
            class="ai-search-mode"
            :class="{ active: searchRegex }"
            :title="t.searchRegex || 'Regular expression (.*?)'"
            :aria-pressed="searchRegex ? 'true' : 'false'"
            @click="searchRegex = !searchRegex"
          >
            .*
          </button>
        </div>

        <!-- AI streaming progress bar -->
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
        <!-- Messages -->
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
                <svg
                  width="48"
                  height="48"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zm-6-6v4h-2v-4H8l4-4 4 4h-2z"
                  />
                </svg>
                <span>{{ t.dropFileHere }}</span>
              </div>
            </div>
          </Transition>
          <div
            v-if="fileUploading"
            class="ai-upload-progress"
            role="progressbar"
            aria-label="Uploading"
          >
            <div class="ai-upload-progress-bar"></div>
          </div>
          <div v-if="messages.length === 0" class="ai-empty">
            <p>{{ t.greeting }}</p>
            <div v-if="promptTemplateList.length > 0" class="ai-prompt-templates">
              <button
                v-for="(tpl, ti) in promptTemplateList"
                :key="ti"
                type="button"
                class="ai-prompt-tpl-btn"
                @click="applyPromptTemplate(tpl)"
              >
                {{ tpl.label }}
              </button>
            </div>
            <!-- 默认 starter 示例：仅当宿主未配置 promptTemplates 时显示，引导新用户上手 -->
            <div
              v-if="promptTemplateList.length === 0 && mode === 'chat'"
              class="ai-empty-starters"
            >
              <button
                v-for="(starter, si) in defaultStarters"
                :key="si"
                type="button"
                class="ai-empty-starter"
                @click="
                  input = starter.split(' ').slice(1).join(' ');
                  focusInput();
                "
              >
                <span class="ai-empty-starter-icon">{{ starter.split(' ')[0] }}</span>
                <span class="ai-empty-starter-text">{{
                  starter.split(' ').slice(1).join(' ')
                }}</span>
              </button>
            </div>
          </div>
          <MessageList
            :messages="displayedMessages"
            :display-offset="displayOffset"
            :hidden-older-count="hiddenOlderCount"
            :render-all-messages="renderAllMessages"
            :select-mode="selectMode"
            :selected-indices="selectedMsgIndices"
            :loading="loading"
            :editing-idx="editingMsgIdx"
            :editing-text="editingText"
            :copied-index="copiedIndex"
            :show-earlier-label="showEarlierLabel"
            :t="t"
            :stream-started-at="streamStartedAt"
            :first-token-at="firstTokenAt"
            :streaming-now-ms="streamingNowMs"
            :is-transient-abort="isTransientAbortAssistantMessage"
            :is-active-streaming="isActiveStreamingAssistant"
            :has-visible-content="hasVisibleAssistantContent"
            :format-relative-time="formatRelativeTime"
            :render-bubble="renderBubble"
            :on-bubble-context-menu="onBubbleContextMenu"
            :is-error-message="isErrorMessage"
            :virtual-slice="virtualSliceForList"
            :on-measure-height="
              virtualScrollOption ? virtualScroll.updateMeasuredHeight : undefined
            "
            @show-all-older-messages="showAllOlderMessages"
            @toggle-selection="toggleMsgSelection"
            @confirm-edit="confirmEditAndResend"
            @cancel-edit="cancelEdit"
            @update:editing-text="editingText = $event"
            @stop-generate="stopGenerate"
            @start-edit="startEdit"
            @copy-message="copyMessage"
            @regenerate-at="regenerateAt"
            @set-feedback="setFeedback"
            @set-reaction="setReaction"
            @retry-last-error="retryLastError"
          />
        </div>
        <Transition name="ai-fade">
          <div v-if="selectMode && selectedMsgIndices.size > 0" class="ai-batch-delete-bar">
            <span class="ai-batch-delete-count">{{ selectedMsgIndices.size }}</span>
            <button type="button" class="ai-batch-delete-btn" @click="deleteSelectedMessages">
              🗑️ {{ t.msgCtxDelete }}
            </button>
            <button type="button" class="ai-batch-cancel-btn" @click="toggleSelectMode">
              {{ t.closePanel }}
            </button>
          </div>
        </Transition>
        <Transition name="ai-fade">
          <button
            v-if="showScrollToBottomBtn && !loading"
            type="button"
            class="ai-scroll-bottom-btn"
            :aria-label="'↓'"
            @click="scrollToBottomClick"
          >
            ↓
          </button>
        </Transition>

        <div v-if="mode === 'chat' && quickPrompts.length > 0" class="ai-quick-prompts">
          <button
            v-for="(qp, qi) in quickPrompts"
            :key="qi"
            type="button"
            class="ai-quick-prompt-btn"
            @click="input = qp.text"
          >
            {{ qp.label }}
          </button>
        </div>

        <!-- Input -->
        <ChatInputArea
          v-model="input"
          :mode="mode"
          :loading="loading"
          :ctrl-enter-to-send="ctrlEnterToSend"
          :sound-enabled="soundEnabled"
          :color="color"
          :placeholder="placeholder"
          :char-count-label="charCountLabel"
          :char-count-near-limit="charCountNearLimit"
          :pending-image-thumb="pendingImageThumb"
          :accept-types="ACCEPT_TYPES"
          :has-base-url="!!options.baseUrl"
          :show-model-picker="showModelPickerResolved"
          :selected-model="selectedChatModel"
          :model-choices="modelChoices"
          :model-list-message="modelListMessage"
          :target-lang="targetLang"
          :voice-supported="voiceSupported"
          :voice-recording="voiceRecording"
          :t="t"
          :slash-visible="slashCmd.visible.value"
          :slash-commands="slashCmd.filteredCommands.value"
          :slash-selected-index="slashCmd.selectedIndex.value"
          :page-context-configured="pageContextConfigured"
          :page-context-enabled="!pageContextDisabledOverride"
          :page-context-block-count="options.pageContextBlocks?.length ?? 0"
          @send="send"
          @change-mode="onChangeMode"
          @toggle-page-context="togglePageContext"
          @clear-pending-image="clearPendingImage"
          @file-upload="processFileUpload"
          @paste-image="onPasteImage"
          @toggle-voice="voiceToggle()"
          @chat-image="readFileAsDataUrl"
          @slash-keydown="onSlashKeydown"
          @slash-select="onSlashSelect"
          @slash-hover="onSlashHover"
          @history-older="onHistoryOlder"
          @history-newer="onHistoryNewer"
          @history-reset="onHistoryReset"
          @update:ctrl-enter-to-send="ctrlEnterToSend = $event"
          @update:sound-enabled="soundEnabled = $event"
          @update:selected-model="selectedChatModel = $event"
          @update:target-lang="targetLang = $event"
        >
          <template #footer-plugins>
            <button
              v-for="pl in getPlugins('footer')"
              :key="pl.id"
              type="button"
              class="ai-plugin-btn"
              :title="pl.label"
              :aria-label="pl.label"
              :disabled="loading"
              @click="runPlugin(pl)"
            >
              {{ pl.icon || pl.label.charAt(0) }}
            </button>
          </template>
          <template #model-row-actions>
            <button
              type="button"
              class="ai-code-wall-toggle"
              :class="{ active: !codeWallDisabled }"
              title="Code Wall"
              @click="onToggleCodeWall"
            >
              ✦
            </button>
            <button
              type="button"
              class="ai-code-wall-toggle"
              :class="{ active: soundEnabled }"
              :title="soundEnabled ? t.soundOn : t.soundOff"
              @click="soundEnabled = !soundEnabled"
            >
              {{ soundEnabled ? '🔔' : '🔕' }}
            </button>
          </template>
        </ChatInputArea>
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
      @dock="
        (edge) => {
          dockFab(edge);
          closeFabCtxMenu();
        }
      "
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
      :tts-supported="tts.supported.value"
      :tts-active="tts.speaking.value && tts.currentMessageIndex.value === msgCtxMenu.index"
      :tts-paused="tts.paused.value"
      :t="t"
      @copy="copyAssistantSelection"
      @translate="translateAssistantSelection"
      @delete="deleteAssistantAt(msgCtxMenu.index)"
      @export="(fmt) => exportAssistantMessageServer(msgCtxMenu.index, fmt)"
      @fork="forkFromHere(msgCtxMenu.index)"
      @tts="ttsToggleCurrent"
      @tts-pause-toggle="ttsPauseToggle"
    />

    <PersonalizeDialog
      v-model="chatSystemPrompt"
      :open="personalizeOpen"
      :is-dark="isDark"
      :disabled="loading"
      :max-chars="systemPromptMaxInputCharsResolved"
      :t="t"
      :theme="themePalette"
      :audio="audioPrefs"
      @update:theme="(v) => (themePalette = v as ThemePresetId)"
      @update:audio="onAudioPrefsUpdate"
      @close="personalizeOpen = false"
    />

    <!-- K21 Phase 1: 3 inline panels (memory / kb / plugins) extracted into
         AssistantInlineOverlays. Same `.ai-memory-overlay > .ai-memory-panel`
         visual template; the child owns memoryNewText / kbNewName /
         kbFileInputRef / kbUploadTargetId / addMemoryItem / createKb /
         triggerKbUpload / onKbFileSelect. -->
    <AssistantInlineOverlays
      v-model:memory-open="memoryOpen"
      v-model:kb-open="kbPanelOpen"
      v-model:plugins-open="pluginsPanelOpen"
      :cross-memory="crossMemory"
      :knowledge-base="knowledgeBase"
      :plugins="plugins"
      :t="t"
      @unregister-plugin="unregisterPlugin"
    />

    <!-- A1: Multi-model parallel compare overlay -->
    <Transition name="ai-panel">
      <MultiModelCompare
        v-if="multiModelOpen"
        :available-models="modelChoices"
        :selected-models="multiModelChat.selectedModels.value"
        :columns="multiModelChat.columns.value"
        :is-running="multiModelChat.isRunning.value"
        :max-columns="4"
        :initial-prompt="input"
        :t="t"
        @close="closeMultiModelCompare"
        @toggle-model="(m: string) => multiModelChat.toggleModel(m)"
        @start="(p: string) => multiModelChat.start(p)"
        @stop-one="(m: string) => multiModelChat.stopOne(m)"
        @stop-all="multiModelChat.stopAll"
      />
    </Transition>

    <!-- B7: Prompt template library overlay -->
    <Transition name="ai-panel">
      <PromptTemplateDialog
        v-if="promptTemplateOpen"
        :templates="promptTemplateLib.mergedTemplates.value"
        :t="t"
        @close="promptTemplateOpen = false"
        @create-user="(tpl) => promptTemplateLib.addTemplate(tpl)"
        @update-user="(id, patch) => promptTemplateLib.updateTemplate(id, patch)"
        @delete-user="(id) => promptTemplateLib.deleteTemplate(id)"
        @use="(rendered) => onPromptTemplateUse(rendered)"
      />
    </Transition>

    <KeyboardShortcutsDialog
      v-if="keyboardHelpOpen"
      :open="keyboardHelpOpen"
      :is-dark="isDark"
      :t="t"
      @close="keyboardHelpOpen = false"
    />

    <SessionsDrawer
      v-if="sessionsDrawerOpen"
      :open="sessionsDrawerOpen"
      :is-dark="isDark"
      :t="t"
      :sessions="multiSessions.sessions.value"
      :active-id="multiSessions.activeSessionId.value"
      @close="sessionsDrawerOpen = false"
      @pick="switchToSession"
      @delete="deleteSessionTab"
      @toggle-pin="multiSessions.togglePinSession"
      @rename="multiSessions.renameSession"
    />

    <ConnectionDiagnostics
      v-if="diagnosticsOpen"
      :uid="uid"
      :busy="diagnosticsBusy"
      :copied="diagnosticsCopied"
      :copy-message="diagnosticsCopyMessage"
      :status-message="diagnosticsStatusMessage"
      :last-error="modelListError"
      :base-url="options.baseUrl"
      :model-endpoint="diagnosticsModelEndpoint"
      :token-text="diagnosticsTokenText"
      :selected-model="selectedChatModel"
      :model-count="modelChoices.length"
      :last-checked="diagnosticsLastChecked"
      :base-url-input="connectionBaseUrlInput"
      :token-input="connectionTokenInput"
      :persist-enabled="connectionPersistEnabled"
      :config-message="connectionConfigMessage"
      :is-dark="isDark"
      :t="t"
      @refresh="runModelDiagnostics"
      @copy="copyDiagnostics"
      @close="diagnosticsOpen = false"
      @test-config="testConnectionConfig"
      @save-config="saveConnectionConfig"
      @update:base-url-input="connectionBaseUrlInput = $event"
      @update:token-input="connectionTokenInput = $event"
      @update:persist-enabled="connectionPersistEnabled = $event"
    />

    <!-- K34 (K21 Phase 2): 3 transient bottom-of-viewport popovers grouped
         into one wrapper. ExportToast / PageSelectionBar / InlineTranslate
         all share the "shows briefly then dismisses" pattern and have no
         coupling to chat state, so they're cheap to extract. -->
    <AssistantBottomTransients
      :export-toast-text="exportToastText"
      :color="color"
      :is-dark="isDark"
      :assistant-open="isOpen"
      :page-sel="pageSel"
      :inline-translate="inlineTranslatePopover"
      :t="t"
      @page-sel-action="onPageSelAction"
    />

    <!-- K23: Ctrl+K command palette. Teleports to body so z-index is hassle-free. -->
    <CommandPalette
      :open="cmdPalette.open.value"
      :commands="cmdPalette.commands.value"
      @update:open="(v) => (cmdPalette.open.value = v)"
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
import FabContextMenu from './FabContextMenu.vue';
import MessageContextMenu from './MessageContextMenu.vue';
import MessageList from './MessageList.vue';
import AssistantHeader from './AssistantHeader.vue';
import ChatInputArea from './ChatInputArea.vue';
import SessionTabs from './SessionTabs.vue';
import { useVoiceInput } from '../composables/useVoiceInput';
import { useSlashCommands } from '../composables/useSlashCommands';
import { useCrossSessionMemory } from '../composables/useCrossSessionMemory';
import { useKnowledgeBase } from '../composables/useKnowledgeBase';
import { useMultiModelChat } from '../composables/useMultiModelChat';
import { useTextToSpeech } from '../composables/useTextToSpeech';
import { usePromptTemplateLibrary } from '../composables/usePromptTemplateLibrary';
import { useMermaidRenderer } from '../composables/useMermaidRenderer';
import { useMessageVirtualScroll } from '../composables/useMessageVirtualScroll';
import { useCommandPalette } from '../composables/useCommandPalette';
import type { CommandItem } from '../types/command-palette';
const PersonalizeDialog = defineAsyncComponent(() => import('./PersonalizeDialog.vue'));
const MultiModelCompare = defineAsyncComponent(() => import('./MultiModelCompare.vue'));
const PromptTemplateDialog = defineAsyncComponent(() => import('./PromptTemplateDialog.vue'));
/* K34: ExportToast / PageSelectionBar / InlineTranslatePopover moved into
 * the AssistantBottomTransients wrapper below. Their async imports live
 * in that file now so the chunks still split lazily. */
const AssistantBottomTransients = defineAsyncComponent(
  () => import('./AssistantBottomTransients.vue'),
);
const ConnectionDiagnostics = defineAsyncComponent(() => import('./ConnectionDiagnostics.vue'));
const KeyboardShortcutsDialog = defineAsyncComponent(() => import('./KeyboardShortcutsDialog.vue'));
const SessionsDrawer = defineAsyncComponent(() => import('./SessionsDrawer.vue'));
/* K21 Phase 1: extracted ~135 lines of repetitive memory/kb/plugins panel
 * template into AssistantInlineOverlays. Lazy-loaded so the initial chunk
 * stays slim (only paid for when a user opens one of those panels). */
const AssistantInlineOverlays = defineAsyncComponent(() => import('./AssistantInlineOverlays.vue'));
/* K23: CommandPalette (Ctrl+K / ⌘+K) — flagship VSCode-style command runner
 * built on top of the K16 CommandPalette.vue + useCommandPalette composable. */
const CommandPalette = defineAsyncComponent(() => import('./CommandPalette.vue'));
import type { AiAssistantOptions } from '../index';
import { uploadFile, fetchUrlPreview, fetchModels, fetchPromptTemplates } from '../utils/api';
import { useStreamWithFallback } from '../composables/useStreamWithFallback';
import { useExportActions } from '../composables/useExportActions';
import { useFabDrag } from '../composables/useFabDrag';
import { useCodeWall } from '../composables/useCodeWall';
import { usePanelGeometry } from '../composables/usePanelGeometry';
import { useMsgContextMenu } from '../composables/useMsgContextMenu';
import { getMessages } from '../utils/i18n';
import type { Locale, I18nMessages } from '../utils/i18n';
import { useSessionSearch, highlightSearchInHtml } from '../composables/useSessionSearch';
import { useMessageMemoryCap } from '../composables/useMessageMemoryCap';
import { useChatOrchestrator } from '../composables/useChatOrchestrator';
import { useSendStream } from '../composables/useSendStream';
import {
  isAbortCancellationMessage,
  loadPersistedMessages,
  pruneTransientAssistantMessages,
  useChatHistoryPersistence,
} from '../composables/useChatHistoryPersistence';
import { useExportUi } from '../composables/useExportUi';
import { useAiMarkdownRenderer } from '../composables/useAiMarkdownRenderer';
import { useMultiSession } from '../composables/useMultiSession';
import { useImagePasteAndDrop } from '../composables/useImagePasteAndDrop';
import {
  providePluginRegistry,
  usePluginRegistry,
  type PluginContext,
} from '../composables/usePluginRegistry';
import { usePageSelection } from '../composables/usePageSelection';
import { usePromptHistory } from '../composables/usePromptHistory';
import {
  extractHttpUrls,
  isProbablyDirectImageUrl,
  firstNonImageHttpUrl,
  preferHttpsImageUrlWhenPageIsSecure,
} from '../utils/urlEmbed';

import { extractThinking, type Message } from '../types/message';

const sessionTitle = ref('');
const multiSessions = useMultiSession();
providePluginRegistry();
const { plugins, getPlugins, unregisterPlugin } = usePluginRegistry();
const { streamWithFallback } = useStreamWithFallback();

function makePluginContext(): PluginContext {
  return {
    input: input.value,
    messages: messages.value.map((m) => ({ role: m.role, content: m.contentArchive ?? m.content })),
    setInput: (text: string) => {
      input.value = text;
    },
    addMessage: (role: 'user' | 'assistant', content: string) => {
      messages.value.push({ role, content, timestamp: Date.now() });
      scrollToBottom(true);
    },
  };
}

async function runPlugin(plugin: { action: (ctx: PluginContext) => void | Promise<void> }) {
  try {
    await plugin.action(makePluginContext());
  } catch (e) {
    console.error('[AiAssistant] plugin action failed', e);
  }
}

const uid = 'ai-' + Math.random().toString(36).slice(2, 8);

const options = reactive(
  inject<AiAssistantOptions>('ai-assistant-options', {
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
  }),
);

function reportAssistantError(source: string, message: string) {
  options.onAssistantError?.({ source, message });
}

const t = computed(() => getMessages((options.locale || 'en') as Locale));

let _rtfCache: { locale: string; rtf: Intl.RelativeTimeFormat } | null = null;
function getRtf(locale: string) {
  if (!_rtfCache || _rtfCache.locale !== locale) {
    _rtfCache = {
      locale,
      rtf: new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' }),
    };
  }
  return _rtfCache.rtf;
}
function formatRelativeTime(ts?: number): string {
  if (!ts) return '';
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return t.value.justNow || 'just now';
  const locale = options.locale || 'en';
  const rtf = getRtf(locale);
  if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
  if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
  return new Date(ts).toLocaleDateString(locale);
}

const { renderContent, clearRenderCache } = useAiMarkdownRenderer(t, options);

const wrapperRef = ref<HTMLElement>();
const systemDarkRef = ref(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
const reducedMotionRef = ref(
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
);
const pageVisibleRef = ref(!document.hidden);
let darkMediaCleanup: (() => void) | null = null;
let reducedMotionCleanup: (() => void) | null = null;
let pageVisibilityCleanup: (() => void) | null = null;
onMounted(() => {
  const mql = window.matchMedia?.('(prefers-color-scheme: dark)');
  if (mql) {
    const handler = (e: MediaQueryListEvent) => {
      systemDarkRef.value = e.matches;
    };
    mql.addEventListener('change', handler);
    darkMediaCleanup = () => mql.removeEventListener('change', handler);
  }
  const reducedMql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (reducedMql) {
    const handler = (e: MediaQueryListEvent) => {
      reducedMotionRef.value = e.matches;
    };
    reducedMql.addEventListener('change', handler);
    reducedMotionCleanup = () => reducedMql.removeEventListener('change', handler);
  }
  const visibilityHandler = () => {
    pageVisibleRef.value = !document.hidden;
  };
  document.addEventListener('visibilitychange', visibilityHandler);
  pageVisibilityCleanup = () => document.removeEventListener('visibilitychange', visibilityHandler);
});
onUnmounted(() => {
  darkMediaCleanup?.();
  reducedMotionCleanup?.();
  pageVisibilityCleanup?.();
});
/**
 * #27 用户在面板内一键切换的主题覆盖
 * - null = 跟随 options.theme（默认）
 * - 'light' / 'dark' = 用户显式覆盖（持久化到 localStorage）
 */
const THEME_OVERRIDE_KEY = 'ai-assistant-user-theme-override';
const userThemeOverride = ref<'light' | 'dark' | null>(
  (() => {
    try {
      const v = localStorage.getItem(THEME_OVERRIDE_KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch {
      return null;
    }
  })(),
);
const isDark = computed(() => {
  if (userThemeOverride.value) return userThemeOverride.value === 'dark';
  if (options.theme === 'dark') return true;
  if (options.theme === 'auto') return systemDarkRef.value;
  return false;
});
function toggleManualTheme() {
  const next = isDark.value ? 'light' : 'dark';
  userThemeOverride.value = next;
  try {
    localStorage.setItem(THEME_OVERRIDE_KEY, next);
  } catch (e) {
    console.warn('[AiAssistant] persist theme override failed', e);
  }
}
const isOpen = ref(false);
/** 本会话内隐藏悬浮球，刷新页面后恢复（不用 localStorage） */
const fabHidden = ref(false);
const input = ref('');

/**
 * 默认 starter 示例：宿主没在 options.promptTemplates 配置时，空状态显示这些
 * 引导新用户上手。emoji 前缀也用作图标。每一项点击后直接填入输入框（不自动发送）。
 */
const defaultStarters = computed<string[]>(() => {
  const loc = options.locale ?? 'en';
  const lib: Record<string, string[]> = {
    zh: [
      '💡 帮我写一封商务邮件',
      '🔍 解释什么是 RAG 检索增强',
      '📝 把这段文字翻译成英文：',
      '✨ 给我推荐 3 本科幻小说',
    ],
    en: [
      '💡 Help me write a professional email',
      '🔍 Explain what RAG (retrieval augmented generation) is',
      '📝 Translate this text into Chinese: ',
      '✨ Recommend 3 sci-fi novels for me',
    ],
    ja: [
      '💡 ビジネスメールを書いてください',
      '🔍 RAGとは何か説明してください',
      '📝 この文章を英語に翻訳してください：',
      '✨ おすすめのSF小説を3冊教えてください',
    ],
    ko: [
      '💡 비즈니스 이메일 작성을 도와주세요',
      '🔍 RAG(검색 증강 생성)에 대해 설명해 주세요',
      '📝 이 텍스트를 영어로 번역해 주세요:',
      '✨ SF 소설 3권을 추천해 주세요',
    ],
  };
  return lib[loc] ?? lib.en;
});

function focusInput() {
  void nextTick(() => {
    const el = document.querySelector(
      `.ai-assistant-wrapper .ai-footer-textarea`,
    ) as HTMLTextAreaElement | null;
    el?.focus();
  });
}
const loading = ref(false);
const ctrlEnterToSend = ref(false);
const soundEnabled = ref(false);

function playNotificationSound() {
  if (!soundEnabled.value) return;
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1047, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
    osc.onended = () => ctx.close();
  } catch {
    /* AudioContext may not be available */
  }
}
const maxUserChars = computed(() => {
  const n = options.maxUserMessageChars;
  return n && n > 0 ? n : 0;
});
const charCountLabel = computed(() => {
  if (!maxUserChars.value) return '';
  return `${input.value.length}/${maxUserChars.value}`;
});
const charCountNearLimit = computed(() => {
  if (!maxUserChars.value) return false;
  return input.value.length > maxUserChars.value * 0.85;
});
let streamAbortController: AbortController | null = null;
let streamStoppedByUser = false;
const messages = ref<Message[]>(
  pruneTransientAssistantMessages(loadPersistedMessages(!!options.persistHistory)),
);
const { saveHistory, clearStoredHistory } = useChatHistoryPersistence(
  messages,
  () => !!options.persistHistory,
);
const { trimMessagesForMemoryCap } = useMessageMemoryCap(messages, options, clearRenderCache);
/** 超过条数时只挂载最近 N 条 DOM，减少长会话卡顿 */
const MAX_RENDERED_MESSAGES = 60;
const renderAllMessages = ref(false);
const { exportServerBusy, exportToastText, setExportToast, disposeExportToast } = useExportUi();

const exportActions = useExportActions({
  sessions: multiSessions.sessions,
  messages,
  wrapperRef,
  getBaseUrl: () => options.baseUrl,
  getAccessToken: () => options.accessToken,
  isDark,
  t,
  exportServerBusy,
  setExportToast,
  reportError: reportAssistantError,
});
const {
  batchExportMenuOpen,
  toggleBatchExportMenu,
  batchExportAllJson,
  batchExportAllMarkdown,
  batchExportAllServer,
  exportAssistantMessageServer,
} = exportActions;

const mode = ref<'translate' | 'summarize' | 'chat'>('chat');
const chatSystemPrompt = ref('');
const personalizeOpen = ref(false);
const showSystemPromptUi = computed(() => options.showSystemPromptEditor !== false);
const systemPromptMaxInputCharsResolved = computed(() => {
  const n = options.systemPromptMaxInputChars;
  if (n !== undefined && n > 0) {
    return Math.min(16_000, n);
  }
  return 4000;
});
const systemPromptStorageKeyResolved = computed(() => {
  const k = options.systemPromptStorageKey?.trim();
  return k || 'ai-assistant-chat-system-prompt';
});

const modelChoices = ref<string[]>([]);
const selectedChatModel = ref('');
const showModelPickerResolved = computed(() => options.showModelPicker !== false);
const selectedModelStorageKeyResolved = computed(
  () => options.selectedModelStorageKey?.trim() || 'ai-assistant-selected-model',
);
const diagnosticsOpen = ref(false);
const keyboardHelpOpen = ref(false);
const sessionsDrawerOpen = ref(false);
const diagnosticsBusy = ref(false);
const diagnosticsCopied = ref(false);
const diagnosticsCopyMessage = ref('');
const diagnosticsLastChecked = ref('');
const modelListError = ref('');
const connectionBaseUrlInput = ref(options.baseUrl || '');
const connectionTokenInput = ref(options.accessToken || '');
const connectionPersistEnabled = ref(true);
const connectionConfigMessage = ref('');
const CONNECTION_BASE_URL_STORAGE_KEY = 'ai-assistant-connection-base-url';
const CONNECTION_TOKEN_STORAGE_KEY = 'ai-assistant-connection-token';
type ModelListStatus =
  | ''
  | 'empty'
  | 'network'
  | 'unauthorized'
  | 'rateLimited'
  | 'serverError'
  | 'failed';
const modelListStatus = ref<ModelListStatus>('');
const modelListMessage = computed(() => {
  switch (modelListStatus.value) {
    case 'empty':
      return t.value.modelsListEmpty;
    case 'network':
      return t.value.modelsNetworkError;
    case 'unauthorized':
      return t.value.modelsUnauthorized;
    case 'rateLimited':
      return t.value.modelsRateLimited;
    case 'serverError':
      return t.value.modelsServerError;
    case 'failed':
      return t.value.modelsLoadFailed;
    default:
      return t.value.modelsListEmpty;
  }
});
const diagnosticsModelEndpoint = computed(() =>
  options.baseUrl ? `${options.baseUrl.replace(/\/+$/, '')}/models` : '—',
);
const diagnosticsTokenText = computed(() =>
  options.accessToken?.trim()
    ? t.value.diagnosticsTokenConfigured
    : t.value.diagnosticsTokenMissing,
);
const diagnosticsStatusMessage = computed(() => {
  if (!options.baseUrl) return t.value.diagnosticsStatusNoBaseUrl;
  if (diagnosticsBusy.value) return t.value.diagnosticsStatusChecking;
  if (modelChoices.value.length > 0) return t.value.diagnosticsStatusReady;
  return modelListMessage.value;
});

function modelListStatusFromError(error?: string): ModelListStatus {
  if (!error) return 'failed';
  if (/\b(401|403)\b/.test(error)) return 'unauthorized';
  if (/\b429\b/.test(error)) return 'rateLimited';
  if (/\b5\d\d\b/.test(error)) return 'serverError';
  if (/failed to fetch|networkerror|timeout|aborted/i.test(error)) return 'network';
  return 'failed';
}

async function refreshChatModels() {
  modelChoices.value = [];
  selectedChatModel.value = '';
  modelListStatus.value = '';
  modelListError.value = '';
  if (!options.baseUrl || !showModelPickerResolved.value) return;
  try {
    const r = await fetchModels(options.baseUrl, options.accessToken);
    if (!r.success) {
      modelListStatus.value = modelListStatusFromError(r.error);
      modelListError.value = r.error || t.value.modelsLoadFailed;
      return;
    }
    if (!r.models?.length) {
      modelListStatus.value = 'empty';
      return;
    }
    modelChoices.value = r.models;
    const def = r.defaultModel && r.models.includes(r.defaultModel) ? r.defaultModel : r.models[0];
    let pick = def;
    try {
      const saved = localStorage.getItem(selectedModelStorageKeyResolved.value);
      if (saved && r.models.includes(saved)) pick = saved;
    } catch {
      /* ignore */
    }
    selectedChatModel.value = pick;
  } catch (e: unknown) {
    modelListStatus.value = 'network';
    modelListError.value = e instanceof Error ? e.message : String(e || t.value.modelsNetworkError);
  }
}

async function runModelDiagnostics() {
  diagnosticsBusy.value = true;
  try {
    await refreshChatModels();
  } finally {
    diagnosticsLastChecked.value = new Date().toLocaleString();
    diagnosticsBusy.value = false;
  }
}

function toggleDiagnostics() {
  diagnosticsOpen.value = !diagnosticsOpen.value;
  if (diagnosticsOpen.value) {
    syncConnectionInputsFromOptions();
    void runModelDiagnostics();
  }
}

function syncConnectionInputsFromOptions() {
  connectionBaseUrlInput.value = options.baseUrl || '';
  connectionTokenInput.value = options.accessToken || '';
}

function applyConnectionConfigInputs() {
  const baseUrl = connectionBaseUrlInput.value.trim();
  const token = connectionTokenInput.value.trim();
  options.baseUrl = baseUrl || undefined;
  options.accessToken = token || undefined;
}

function persistConnectionConfigIfEnabled() {
  const baseUrl = connectionBaseUrlInput.value.trim();
  const token = connectionTokenInput.value.trim();
  try {
    if (!connectionPersistEnabled.value) {
      localStorage.removeItem(CONNECTION_BASE_URL_STORAGE_KEY);
      localStorage.removeItem(CONNECTION_TOKEN_STORAGE_KEY);
      return;
    }
    if (baseUrl) localStorage.setItem(CONNECTION_BASE_URL_STORAGE_KEY, baseUrl);
    else localStorage.removeItem(CONNECTION_BASE_URL_STORAGE_KEY);
    if (token) localStorage.setItem(CONNECTION_TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(CONNECTION_TOKEN_STORAGE_KEY);
  } catch {
    /* localStorage may be unavailable or full. */
  }
}

async function testConnectionConfig() {
  applyConnectionConfigInputs();
  await runModelDiagnostics();
  connectionConfigMessage.value =
    modelChoices.value.length > 0 ? t.value.connectionConfigTested : t.value.connectionConfigFailed;
}

async function saveConnectionConfig() {
  applyConnectionConfigInputs();
  persistConnectionConfigIfEnabled();
  await runModelDiagnostics();
  connectionConfigMessage.value = t.value.connectionConfigSaved;
}

async function copyDiagnostics() {
  const lines = [
    'AI Assistant Diagnostics',
    `Base URL: ${options.baseUrl || '(not configured)'}`,
    `Models endpoint: ${diagnosticsModelEndpoint.value}`,
    `Access token: ${options.accessToken?.trim() ? 'configured' : 'missing'}`,
    `Status: ${diagnosticsStatusMessage.value}`,
    `Last error: ${modelListError.value || '(none)'}`,
    `Selected model: ${selectedChatModel.value || '(not selected)'}`,
    `Available models: ${modelChoices.value.length}`,
    `Last checked: ${diagnosticsLastChecked.value || '(never)'}`,
  ];
  const text = lines.join('\n');
  try {
    await writeClipboardText(text);
    diagnosticsCopied.value = true;
    diagnosticsCopyMessage.value = t.value.diagnosticsCopied;
    pendingTimers.push(
      window.setTimeout(() => {
        diagnosticsCopied.value = false;
        diagnosticsCopyMessage.value = '';
      }, 1500),
    );
  } catch {
    diagnosticsCopied.value = false;
    diagnosticsCopyMessage.value = t.value.diagnosticsCopyFailed;
  }
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const copied = document.execCommand('copy');
    if (!copied) throw new Error('copy command failed');
  } finally {
    document.body.removeChild(textarea);
  }
}

function openPersonalize() {
  personalizeOpen.value = true;
}

const targetLang = ref('zh');

const msgCtxComposable = useMsgContextMenu({
  messages,
  loading,
  getBaseUrl: () => options.baseUrl,
  getAccessToken: () => options.accessToken,
  targetLang,
  t,
  reportError: reportAssistantError,
});
const {
  msgCtxMenu,
  inlineTranslatePopover,
  closeMsgCtxMenu,
  onBubbleContextMenu,
  copyAssistantSelection,
  translateAssistantSelection,
  closeInlineTranslatePopover,
  deleteAssistantAt,
  detachInlinePopLayoutListeners,
} = msgCtxComposable;

const bodyRef = ref<HTMLElement>();
const showScrollToBottomBtn = ref(false);

function onBodyScroll() {
  const el = bodyRef.value;
  if (!el) return;
  showScrollToBottomBtn.value = el.scrollHeight - el.scrollTop - el.clientHeight > 300;
}

function scrollToBottomClick() {
  const el = bodyRef.value;
  if (el) {
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }
}

watch(
  bodyRef,
  (el, oldEl) => {
    if (oldEl) oldEl.removeEventListener('scroll', onBodyScroll);
    if (el) el.addEventListener('scroll', onBodyScroll, { passive: true });
  },
  { immediate: true },
);

onUnmounted(() => {
  if (bodyRef.value) bodyRef.value.removeEventListener('scroll', onBodyScroll);
});

const panelRef = ref<HTMLElement>();

/**
 * #18 图片附件点击放大 - lightbox
 * 监听 panel 内任何 img 的点击，符合条件（消息正文 / 待发送图片）时弹全屏预览。
 * 单一 overlay 实例复用，DOM 直接挂 document.body 以摆脱 panel 的层级限制。
 */
let imageLightboxEl: HTMLDivElement | null = null;
function closeImageLightbox() {
  if (!imageLightboxEl) return;
  (imageLightboxEl as unknown as { _aiTeardown?: () => void })._aiTeardown?.();
  imageLightboxEl.remove();
  imageLightboxEl = null;
}
function openImageLightbox(src: string) {
  if (typeof document === 'undefined' || !src) return;
  closeImageLightbox();
  const overlay = document.createElement('div');
  overlay.className = 'ai-image-lightbox-overlay';
  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'ai-image-lightbox-close';
  closeBtn.setAttribute('aria-label', t.value.imageLightboxClose || 'Close');
  closeBtn.textContent = '×';
  overlay.appendChild(img);
  overlay.appendChild(closeBtn);
  const handleClick = (ev: Event) => {
    if (ev.target === overlay || ev.target === closeBtn) closeImageLightbox();
  };
  const handleKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') closeImageLightbox();
  };
  overlay.addEventListener('click', handleClick);
  document.addEventListener('keydown', handleKey);
  (overlay as unknown as { _aiTeardown?: () => void })._aiTeardown = () => {
    overlay.removeEventListener('click', handleClick);
    document.removeEventListener('keydown', handleKey);
  };
  document.body.appendChild(overlay);
  imageLightboxEl = overlay;
}
function onPanelImageClick(ev: MouseEvent) {
  const target = ev.target as HTMLElement;
  if (!target || target.tagName !== 'IMG') return;
  const img = target as HTMLImageElement;
  if (!img.src) return;
  if (img.closest('.ai-fab, .ai-assistant-avatar, .ai-image-lightbox-overlay')) return;
  ev.preventDefault();
  ev.stopPropagation();
  openImageLightbox(img.src);
}
watch(
  panelRef,
  (el, oldEl) => {
    if (oldEl) oldEl.removeEventListener('click', onPanelImageClick);
    if (el) el.addEventListener('click', onPanelImageClick);
  },
  { immediate: true },
);
onUnmounted(() => {
  if (panelRef.value) panelRef.value.removeEventListener('click', onPanelImageClick);
  closeImageLightbox();
});
const codeWallCanvasRef = ref<HTMLCanvasElement>();
const fileUploading = ref(false);
const selectMode = ref(false);
const selectedMsgIndices = ref<Set<number>>(new Set());
const pendingTimers: number[] = [];
const {
  dragActive,
  pendingImageData,
  pendingImageThumb,
  onBodyDragOver,
  onBodyDragEnter,
  onBodyDragLeave,
  onBodyDrop,
  onPasteImage,
  readFileAsDataUrl,
  clearPendingImage,
} = useImagePasteAndDrop({
  loading,
  messages,
  errorPrefix: computed(() => t.value.errorPrefix),
  processFileUpload,
});
const {
  disabled: codeWallDisabled,
  start: startCodeWall,
  stop: stopCodeWall,
} = useCodeWall(codeWallCanvasRef, panelRef, reducedMotionRef, pageVisibleRef);

const {
  recording: voiceRecording,
  supported: voiceSupported,
  toggle: voiceToggle,
} = useVoiceInput((text) => {
  input.value += text;
});

const crossMemory = useCrossSessionMemory();
const memoryOpen = ref(false);

const pluginsPanelOpen = ref(false);

const knowledgeBase = useKnowledgeBase();
const kbPanelOpen = ref(false);

/**
 * A1: 多模型并行对比面板状态。
 *
 * - `multiModelOpen` 由 `/compare` 斜杠命令或未来快捷键切换。
 * - `multiModelChat` 内部独立管理 N 列流式响应；为避免与主面板的 systemPrompt
 *   语义漂移，这里直接复用 `chatSystemPrompt` 和当前会话 history。
 * - `parseChunk` 重用 `extractThinking`，让 `<think>` 块也能在对比列中
 *   折叠展示，与主面板的渲染风格保持一致。
 */
const multiModelOpen = ref(false);
const multiModelBaseUrl = computed(() => options.baseUrl ?? '');
const multiModelToken = computed(() => options.accessToken);
const multiModelHistory = computed(() =>
  messages.value.map((m) => ({ role: m.role, content: m.contentArchive ?? m.content })),
);
const multiModelSystemPrompt = computed(() => chatSystemPrompt.value || undefined);
const multiModelChat = useMultiModelChat({
  baseUrl: multiModelBaseUrl,
  token: multiModelToken,
  history: multiModelHistory,
  systemPrompt: multiModelSystemPrompt,
  maxColumns: 4,
  parseChunk: (raw: string) => {
    const { content, thinking } = extractThinking(raw);
    return { content, thinking };
  },
});

function openMultiModelCompare() {
  if (modelChoices.value.length > 1 && multiModelChat.selectedModels.value.length === 0) {
    /* 默认选当前模型 + 第二个候选，方便用户立刻看到对比效果 */
    const first = selectedChatModel.value || modelChoices.value[0];
    const second = modelChoices.value.find((m) => m !== first);
    multiModelChat.setSelectedModels(second ? [first, second] : [first]);
  }
  multiModelOpen.value = true;
}
function closeMultiModelCompare() {
  multiModelOpen.value = false;
  multiModelChat.stopAll();
}

/**
 * A4: 文本转语音朗读。
 *
 * 同一条消息上重复点击会切换播放/停止；切换到其它消息则会自动停掉前一条。
 * 当浏览器不支持 SpeechSynthesis（如部分嵌入式 webview）`ttsSupported` 为
 * false，右键菜单中的「朗读」按钮会自动隐藏。
 */
const tts = useTextToSpeech();

/**
 * K37: 用户音频偏好（voice / rate / autoRead），持久化到 localStorage。
 *
 * - voice: voiceURI 字符串；''（默认）= 由 useTextToSpeech 按语种启发式自动挑
 * - rate: 0.5 - 2.0，默认 1.0
 * - autoRead: 默认 false；开启后 assistant 流式结束自动朗读
 *
 * 实际朗读时把这三个偏好一并传给 tts.speak() / tts.toggleMessage()。
 */
const AUDIO_PREFS_VOICE_KEY = 'ai-assistant.audio.voice.v1';
const AUDIO_PREFS_RATE_KEY = 'ai-assistant.audio.rate.v1';
const AUDIO_PREFS_AUTOREAD_KEY = 'ai-assistant.audio.autoRead.v1';
function loadAudioPref(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}
const audioVoice = ref(loadAudioPref(AUDIO_PREFS_VOICE_KEY, ''));
const audioRate = ref(parseFloat(loadAudioPref(AUDIO_PREFS_RATE_KEY, '1')) || 1);
const audioAutoRead = ref(loadAudioPref(AUDIO_PREFS_AUTOREAD_KEY, '0') === '1');
watch(audioVoice, (v) => {
  try {
    localStorage.setItem(AUDIO_PREFS_VOICE_KEY, v);
  } catch {
    /* ignore */
  }
});
watch(audioRate, (v) => {
  try {
    localStorage.setItem(AUDIO_PREFS_RATE_KEY, String(v));
  } catch {
    /* ignore */
  }
});
watch(audioAutoRead, (v) => {
  try {
    localStorage.setItem(AUDIO_PREFS_AUTOREAD_KEY, v ? '1' : '0');
  } catch {
    /* ignore */
  }
});

/** PersonalizeDialog 渲染所需的 view-model（轻量 voices 列表，避免传引用）。 */
const audioPrefs = computed(() => ({
  supported: tts.supported.value,
  voice: audioVoice.value,
  rate: audioRate.value,
  autoRead: audioAutoRead.value,
  voices: tts.voices.value.map((v) => ({
    voiceURI: v.voiceURI,
    name: v.name,
    lang: v.lang,
  })),
}));
function onAudioPrefsUpdate(patch: Partial<{ voice: string; rate: number; autoRead: boolean }>) {
  if (patch.voice !== undefined) audioVoice.value = patch.voice;
  if (patch.rate !== undefined) audioRate.value = patch.rate;
  if (patch.autoRead !== undefined) audioAutoRead.value = patch.autoRead;
}

function ttsToggleCurrent() {
  const idx = msgCtxMenu.value.index;
  if (idx < 0) return;
  const m = messages.value[idx];
  if (!m) return;
  const text = m.contentArchive ?? m.content;
  closeMsgCtxMenu();
  tts.toggleMessage(text, idx, {
    voice: audioVoice.value || undefined,
    rate: audioRate.value,
  });
}
function ttsPauseToggle() {
  closeMsgCtxMenu();
  if (tts.paused.value) tts.resume();
  else tts.pause();
}

/**
 * K37 auto-read: 当 loading 由 true → false 且最后一条是 assistant 内容非空时，
 * 自动朗读（受 audioAutoRead 偏好门控）。可手动 toggleMessage 取消。
 */
watch(loading, (now, prev) => {
  if (!audioAutoRead.value) return;
  if (prev !== true || now !== false) return;
  if (!tts.supported.value) return;
  const idx = messages.value.length - 1;
  if (idx < 0) return;
  const last = messages.value[idx];
  if (!last || last.role !== 'assistant') return;
  const text = (last.contentArchive ?? last.content ?? '').trim();
  if (!text) return;
  void tts.speak(text, {
    messageIndex: idx,
    voice: audioVoice.value || undefined,
    rate: audioRate.value,
  });
});

/**
 * B7: Prompt 模板库。
 *
 * 把 `AiAssistantOptions.promptTemplates` 注入到 composable 作为只读「预置」段，
 * 与用户在 localStorage 里保存的模板合并展示。「使用」按钮把渲染后的文本写入
 * 主输入框，仍由用户决定何时发送，避免误触意外消耗 token。
 */
const promptTemplateOpen = ref(false);
/**
 * 服务端 `/templates` 端点暴露的官方模板。失败 / 端点不存在时安静地为空，
 * 不影响 options 预置模板和用户自建模板的展示。
 */
const serverPromptTemplates = ref<{ id: string; label: string; template: string }[]>([]);
const presetPromptTemplates = computed(() => {
  const opt = (options.promptTemplates ?? []).map((p, idx) => ({
    id: `preset_${idx}`,
    label: p.label,
    template: p.template,
    variables: p.variables,
  }));
  return [...serverPromptTemplates.value, ...opt];
});
const promptTemplateLib = usePromptTemplateLibrary({
  presetTemplates: presetPromptTemplates,
});

/**
 * C10: 真接入虚拟滚动（opt-in via options.virtualScroll）。
 *
 * - 默认 false：保持原有 `MAX_RENDERED_MESSAGES = 60` 折叠机制不变；
 * - 设为 true 或对象时启用：监听 bodyRef 滚动，每帧节流地更新 scrollTop
 *   和 viewportHeight，传给 `useMessageVirtualScroll` 算出可视窗口；
 *   超过阈值（默认 60）才真的切片，否则即便启用也走全量渲染（与
 *   composable 内部的 minActivationCount 联动）。
 *
 * 与 `displayedMessages` 的关系：
 * - `useSessionSearch` 在「折叠早期消息」时已先做了一次切片，传入的
 *   `messageCount` 是 displayedMessages.length（不是 messages.length），
 *   保证虚拟窗口与折叠 banner 一致。
 */
const virtualScrollOption = computed(() => {
  const v = options.virtualScroll;
  if (v === true) return { threshold: 60, estimatedItemHeight: 90 };
  if (v && typeof v === 'object')
    return { threshold: v.threshold ?? 60, estimatedItemHeight: v.estimatedItemHeight ?? 90 };
  return null;
});
const virtualScrollTop = ref(0);
const virtualViewportHeight = ref(0);
const virtualMessageCount = computed(() => displayedMessages.value.length);
const virtualScroll = useMessageVirtualScroll({
  messageCount: virtualMessageCount,
  scrollTop: virtualScrollTop,
  viewportHeight: virtualViewportHeight,
  estimatedItemHeight: virtualScrollOption.value?.estimatedItemHeight ?? 90,
  minActivationCount: virtualScrollOption.value?.threshold ?? 60,
});
const virtualSliceForList = computed(() =>
  virtualScrollOption.value ? virtualScroll.window.value : null,
);

let virtualScrollRaf = 0;
function onBodyScrollForVirtual() {
  if (!virtualScrollOption.value) return;
  if (virtualScrollRaf) return;
  virtualScrollRaf = requestAnimationFrame(() => {
    virtualScrollRaf = 0;
    const el = bodyRef.value;
    if (!el) return;
    virtualScrollTop.value = el.scrollTop;
    virtualViewportHeight.value = el.clientHeight;
  });
}

async function refreshServerPromptTemplates() {
  if (!options.baseUrl) return;
  try {
    const r = await fetchPromptTemplates(options.baseUrl, options.accessToken);
    if (r.success && r.templates) {
      serverPromptTemplates.value = r.templates.map((t) => ({
        id: `server:${t.name}`,
        label: t.name,
        template: t.template,
      }));
    }
  } catch {
    /* ignore: server templates are optional */
  }
}
function onPromptTemplateUse(rendered: string) {
  input.value = rendered;
  promptTemplateOpen.value = false;
}

/**
 * B8: Mermaid 渲染调度。
 *
 * `useAiMarkdownRenderer` 把 ```mermaid 围栏替换成 `.ai-mermaid-placeholder`
 * 占位符，本 watch 在消息变更并完成 DOM 写入后扫描 bodyRef，调用
 * `useMermaidRenderer.renderInside` 把它们替换为 SVG。
 *
 * - `loading` 期间不触发：流式中 mermaid 源码尚未闭合，提前渲染只会拿到语法错误
 * - 失败/未安装 mermaid 时 placeholder 内容已 fallback 为可读源码，所以即便
 *   这里完全不被调用页面也不会出现「空白方框」
 */
const mermaidRenderer = useMermaidRenderer();
let mermaidRenderRaf = 0;
function scheduleMermaidRender() {
  if (mermaidRenderRaf) return;
  mermaidRenderRaf = requestAnimationFrame(() => {
    mermaidRenderRaf = 0;
    void nextTick(() => {
      void mermaidRenderer.renderInside(bodyRef.value);
    });
  });
}
watch(
  () => [messages.value.length, loading.value],
  ([, isLoading]) => {
    if (isLoading) return;
    scheduleMermaidRender();
  },
);
/* K21 Phase 1: kbNewName / kbFileInputRef / kbUploadTargetId / addMemoryItem /
 * createKb / onKbFileSelect / triggerKbUpload all moved into
 * AssistantInlineOverlays.vue. We keep the *toggle* functions here because the
 * Settings popover menu actions still reference them by name. */
function toggleKbPanel() {
  kbPanelOpen.value = !kbPanelOpen.value;
}
function toggleMemoryPanel() {
  memoryOpen.value = !memoryOpen.value;
}

const slashCmd = useSlashCommands({
  input,
  t: computed(() => t.value) as unknown as Ref<I18nMessages>,
  onClear: () => clearMessages(),
  onNewSession: () => startNewSession(),
  onExport: () => toggleBatchExportMenu(),
  onChangeMode: (m) => onChangeMode(m),
  extraCommands: [
    {
      name: '/memory',
      get description() {
        return t.value.memoryLabel || '记忆管理';
      },
      icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z',
      action: () => {
        toggleMemoryPanel();
        return true;
      },
    },
    {
      name: '/kb',
      get description() {
        return t.value.kbLabel || '知识库';
      },
      icon: 'M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z',
      action: () => {
        toggleKbPanel();
        return true;
      },
    },
    {
      name: '/plugins',
      get description() {
        return t.value.pluginsLabel || '插件管理';
      },
      icon: 'M13 13v8h8v-8h-8zM3 21h8v-8H3v8zM3 3v8h8V3H3zm13.66-1.31L11 7.34 16.66 13l5.66-5.66-5.66-5.65z',
      action: () => {
        pluginsPanelOpen.value = !pluginsPanelOpen.value;
        return true;
      },
    },
    {
      name: '/compare',
      get description() {
        return t.value.slashCmdCompareDesc || t.value.compareTitle || 'Compare models';
      },
      icon: 'M3 5h7v14H3V5zm11 0h7v6h-7V5zm0 8h7v6h-7v-6z',
      action: () => {
        openMultiModelCompare();
        return true;
      },
    },
    {
      name: '/template',
      get description() {
        return t.value.slashCmdTemplateDesc || t.value.tplDialogTitle || 'Templates';
      },
      icon: 'M14 3v4a1 1 0 0 0 1 1h4l-5-5zM5 3h7v5a2 2 0 0 0 2 2h5v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm2 9h10v2H7v-2zm0 4h7v2H7v-2z',
      action: () => {
        void refreshServerPromptTemplates();
        promptTemplateOpen.value = true;
        return true;
      },
    },
  ],
});

function onSlashKeydown(e: KeyboardEvent) {
  slashCmd.handleKeydown(e);
}
function onSlashSelect(idx: number) {
  slashCmd.selectedIndex.value = idx;
  slashCmd.executeSelected();
}
function onSlashHover(idx: number) {
  slashCmd.selectedIndex.value = idx;
}
watch(input, () => slashCmd.onInputChange());

function onToggleCodeWall() {
  codeWallDisabled.value = !codeWallDisabled.value;
  if (codeWallDisabled.value) {
    stopCodeWall();
  } else {
    startCodeWall();
  }
}

const ACCEPT_TYPES = '.txt,.md,.csv,.log,.json,.xml,.html,.yml,.yaml,.pdf,.docx,.doc,.xlsx,.xls';

const placeholder = computed(() => t.value.placeholder[mode.value] || t.value.placeholder.chat);

/**
 * D4: 用户对自动页面上下文的临时开关。默认 false（即上下文自动附带）。
 * 配置在 options.pageContextBlocks 之外，只影响本次会话的 send，不持久化。
 * 当宿主未配置 pageContextBlocks 时该开关无意义（UI 也不会显示）。
 */
const pageContextDisabledOverride = ref(false);
const pageContextConfigured = computed(() => (options.pageContextBlocks?.length ?? 0) > 0);
function togglePageContext() {
  pageContextDisabledOverride.value = !pageContextDisabledOverride.value;
}

const quickPrompts = computed(() => {
  const q = options.quickPrompts;
  if (!Array.isArray(q)) return [];
  return q.filter(
    (x) => x && typeof x.label === 'string' && typeof x.text === 'string' && x.label && x.text,
  );
});

type PromptTemplate = NonNullable<AiAssistantOptions['promptTemplates']>[number];
const promptTemplateList = computed<PromptTemplate[]>(() => {
  const t = options.promptTemplates;
  if (!Array.isArray(t)) return [];
  return t.filter((x) => x && typeof x.label === 'string' && typeof x.template === 'string');
});

function applyPromptTemplate(tpl: PromptTemplate) {
  const vars = tpl.variables;
  if (!vars || vars.length === 0) {
    input.value = tpl.template;
    setMode('chat');
    return;
  }
  const values: Record<string, string> = {};
  for (const v of vars) {
    const answer = prompt(v.label, v.default ?? '');
    if (answer === null) return;
    values[v.name] = answer;
  }
  let text = tpl.template;
  for (const [k, val] of Object.entries(values)) {
    text = text.replaceAll(`{{${k}}}`, val);
  }
  input.value = text;
  setMode('chat');
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
  searchCaseSensitive,
  searchWholeWord,
  searchRegex,
  goNextMatch,
  goPrevMatch,
  resetSearch,
  disposeSearch,
} = useSessionSearch(messages, loading, renderAllMessages, MAX_RENDERED_MESSAGES, panelRef);

const showEarlierLabel = computed(() =>
  t.value.showEarlierTemplate.replace(/\{n\}/g, String(hiddenOlderCount.value)),
);

function escapeHtmlLite(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderBubble(content: string, globalIdx: number, isStreamingLast: boolean): string {
  const sanitized = sanitizeAssistantContent(content);
  let html: string;
  if (isStreamingLast && sanitized.length > 200) {
    html =
      '<pre class="ai-stream-plain" style="white-space:pre-wrap;font-family:inherit;margin:0">' +
      escapeHtmlLite(sanitized) +
      '</pre>';
  } else {
    html = renderContent(sanitized, t.value.copyCode, isStreamingLast);
  }
  const q = debouncedSearchQuery.value.trim();
  if (q) {
    html = highlightSearchInHtml(html, q, globalIdx === activeMatchGlobalIdx.value, {
      caseSensitive: searchCaseSensitive.value,
      wholeWord: searchWholeWord.value,
      regex: searchRegex.value,
    });
  }
  return html;
}

function isTransientAbortAssistantMessage(msg: Message): boolean {
  return msg.role === 'assistant' && isAbortCancellationMessage(msg.content);
}

function removeTransientAssistantMessages() {
  const cleaned = pruneTransientAssistantMessages(messages.value);
  if (cleaned.length === messages.value.length) return;
  messages.value = cleaned;
  clearRenderCache();
}

const searchCountLabel = computed(() => {
  const q = debouncedSearchQuery.value.trim();
  if (!q) return '';
  if (totalMatches.value === 0) return '0';
  return `${currentMatchIdx.value + 1}/${totalMatches.value}`;
});
const a11yStatusText = computed(() => {
  if (!isOpen.value) return '';
  if (exportServerBusy.value) return t.value.exportPreparing;
  if (loading.value) return t.value.replying;
  return '';
});

const color = computed(() => options.primaryColor || '#6366f1');

/* K25: ColorThemeSwitcher state ------------------------------------------------
 * `themePalette` chooses one of 5 preset gradients. The choice is persisted in
 * localStorage under THEME_STORAGE_KEY (so the same user keeps their palette
 * across page reloads). Three CSS custom properties are then injected on the
 * wrapper (--ai-theme-from / --ai-theme-via / --ai-theme-to), which the styles/
 * suite already reads for the v2 sky-tech-blue accents and gradient ring.
 *
 * Default 'sky' = current sky tech blue palette (unchanged from K3 era so
 * existing visual style is preserved if user never opens the switcher).
 */
const THEME_STORAGE_KEY = 'ai-assistant.theme.palette.v1';
type ThemePresetId = 'sky' | 'sunset' | 'forest' | 'plum' | 'graphite';
const THEME_PRESETS: Record<ThemePresetId, { from: string; via: string; to: string }> = {
  sky: { from: '#0ea5e9', via: '#06b6d4', to: '#3b82f6' },
  sunset: { from: '#f59e0b', via: '#f43f5e', to: '#a855f7' },
  forest: { from: '#10b981', via: '#14b8a6', to: '#06b6d4' },
  plum: { from: '#a855f7', via: '#ec4899', to: '#f43f5e' },
  graphite: { from: '#64748b', via: '#475569', to: '#334155' },
};
const themePalette = ref<ThemePresetId>(
  (() => {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY) as ThemePresetId | null;
      if (v && v in THEME_PRESETS) return v;
    } catch {
      /* SSR / disabled localStorage — fall through to default */
    }
    return 'sky';
  })(),
);
watch(themePalette, (v) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, v);
  } catch {
    /* ignore */
  }
});
const themePaletteVars = computed<Record<string, string>>(() => {
  const p = THEME_PRESETS[themePalette.value];
  return {
    '--ai-theme-from': p.from,
    '--ai-theme-via': p.via,
    '--ai-theme-to': p.to,
  };
});
const positionClass = computed(() => `pos-${options.position || 'bottom-right'}`);

const themeClass = computed(() => (isDark.value ? 'ai-dark' : ''));

const DRAG_CLICK_PX = 8;
const DOCK_BREAK_PX = 10;
let winResizeRaf = 0;

const fabRef = ref<HTMLButtonElement>();
const { selection: pageSel, dismissSelection: dismissPageSel } = usePageSelection(wrapperRef);
const persistFabRef = computed(() => options.persistFabPosition !== false);
const fab = useFabDrag(isOpen, fabHidden, persistFabRef, options.position || 'bottom-right');
const {
  fabLeft,
  fabTop,
  edgeDock,
  fabDragging,
  edgeDockClass: fabEdgeDockClass,
  clampFabPos,
  defaultFabCoords,
  loadFabPos,
  saveFabPos,
  FAB_SIZE,
} = fab;
const panelGeo = usePanelGeometry({
  fabLeft,
  fabTop,
  fabSize: FAB_SIZE,
  isOpen,
  saveFabPos,
  defaultPosition: options.position || 'bottom-right',
});
const {
  panelExpanded,
  panelMountedForLayout,
  panelDragging,
  panelOpenFabAlignClass,
  panelTransformOrigin,
  resizeZoneDefs,
  effectivePanelWidthPx,
  effectivePanelHeightPx,
  togglePanelExpand,
  wrapperOffsetFromFab,
  ensurePanelInViewport,
  syncFabPixelFromWrapperDom,
  onPanelResizePointerDown,
  onPanelHeaderPointerDown,
  onPanelOpen,
  onPanelClose,
  onWinResizePanel,
  cleanupGeometry,
  openPanelQuadrant,
} = panelGeo;
const fabDrag = ref<{
  pointerId: number;
  startX: number;
  startY: number;
  originLeft: number;
  originTop: number;
} | null>(null);

/** 打开前面板的贴边状态；关闭时只恢复贴边，球位保留拖动结果 */
const panelSnapshot = ref<{ edge: 'none' | 'left' | 'right' } | null>(null);
/** 打开面板瞬间的球位；关面板且本会话未拖过标题栏时还原到此（避免仅放大/夹紧视口导致球跑偏） */
const fabFreePosBeforePanel = ref<{ left: number; top: number } | null>(null);
const fabCtxMenu = ref({ show: false, x: 0, y: 0 });
/* K34: inlineTransPopRef removed — it was declared but never read by any
 * code path in this file. InlineTranslatePopover now lives inside
 * AssistantBottomTransients, where parent-side ref access is no longer
 * needed. If a future iteration needs programmatic show/hide, expose a
 * method via defineExpose on AssistantBottomTransients. */

/** 面板进出场时短暂保留悬浮球，使缩放原点与球心一致 */
const showFabDuringPanelAnim = ref(true);

function onPanelBeforeEnter() {
  showFabDuringPanelAnim.value = true;
}
function onPanelAfterEnter() {
  showFabDuringPanelAnim.value = false;
}
function onPanelBeforeLeave() {
  showFabDuringPanelAnim.value = true;
}
function onPanelAfterLeave() {
  panelMountedForLayout.value = false;
}

const effectivePositionClass = computed(() => (fabLeft.value !== null ? '' : positionClass.value));

const edgeDockClass = fabEdgeDockClass;

const wrapperStyle = computed(() => {
  const st: Record<string, string> = { '--primary': color.value, ...themePaletteVars.value };
  if (panelMountedForLayout.value) {
    st.width = `${effectivePanelWidthPx()}px`;
    st.height = `${effectivePanelHeightPx()}px`;
  }
  if (fabLeft.value !== null && fabTop.value !== null) {
    let L = fabLeft.value;
    let T = fabTop.value;
    if (panelMountedForLayout.value) {
      const { dx, dy } = wrapperOffsetFromFab(openPanelQuadrant.value);
      L += dx;
      T += dy;
    }
    st.left = `${L}px`;
    st.top = `${T}px`;
    st.right = 'auto';
    st.bottom = 'auto';
  }
  return st;
});

/** 菜单预估宽度（与样式同步，用于视口夹紧） */
const FAB_CTX_MENU_W = 236;

function estimateFabCtxMenuHeight(): number {
  let n = 0;
  if (edgeDock.value !== 'left') n++;
  if (edgeDock.value !== 'right') n++;
  if (edgeDock.value !== 'none') n++;
  n++; // 隐藏至刷新
  const header = 48;
  const row = 52;
  const listPad = 14;
  return header + n * row + listPad;
}

function onFabContextMenu(e: MouseEvent) {
  e.preventDefault();
  if (isOpen.value || fabHidden.value) return;
  const fab = fabRef.value;
  if (!fab) return;
  const fr = fab.getBoundingClientRect();
  const pad = 10;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const menuH = estimateFabCtxMenuHeight();
  let x = fr.left;
  let y = fr.bottom + 6;
  if (x + FAB_CTX_MENU_W > vw - pad) x = vw - FAB_CTX_MENU_W - pad;
  if (x < pad) x = pad;
  if (y + menuH > vh - pad) y = fr.top - menuH - 6;
  if (y < pad) y = pad;
  fabCtxMenu.value = { show: true, x, y };
}

function closeFabCtxMenu() {
  fabCtxMenu.value.show = false;
}

function hideFabUntilPageReload() {
  closeFabCtxMenu();
  fabHidden.value = true;
  isOpen.value = false;
}

function dockFab(edge: 'none' | 'left' | 'right') {
  fab.dockFab(edge);
  closeFabCtxMenu();
}

function onDocPointerDownCloseFabMenu(e: MouseEvent) {
  const el = e.target;
  if (el instanceof Element && el.closest('.ai-fab-ctx-menu')) return;
  if (el instanceof Element && el.closest('.ai-msg-ctx-menu')) return;
  if (el instanceof Element && el.closest('.ai-inline-trans-pop')) return;
  if (inlineTranslatePopover.value.show) closeInlineTranslatePopover();
  if (fabCtxMenu.value.show) closeFabCtxMenu();
  if (msgCtxMenu.value.show) closeMsgCtxMenu();
}

function onFabPointerDown(e: PointerEvent) {
  if (isOpen.value || fabHidden.value || e.button !== 0) return;
  e.preventDefault();
  const el = wrapperRef.value;
  if (!el) return;

  if (fabLeft.value === null || fabTop.value === null) {
    const d = defaultFabCoords();
    fabLeft.value = d.left;
    fabTop.value = d.top;
  }

  let L = fabLeft.value;
  let T = fabTop.value;
  if (edgeDock.value === 'left') {
    L = 0;
  } else if (edgeDock.value === 'right') {
    L = window.innerWidth - FAB_SIZE;
  }
  fabLeft.value = L;
  fabTop.value = T;
  /* 不在此清除 edgeDock：纯点击打开时仍为贴边，供 watch 记录 dockRestore */

  fabDrag.value = {
    pointerId: e.pointerId,
    startX: e.clientX,
    startY: e.clientY,
    originLeft: L,
    originTop: T,
  };
  fabDragging.value = true;
  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

  window.addEventListener('pointermove', onFabPointerMove);
  window.addEventListener('pointerup', onFabPointerUp);
  window.addEventListener('pointercancel', onFabPointerUp);
}

function onFabPointerMove(e: PointerEvent) {
  if (!fabDrag.value || e.pointerId !== fabDrag.value.pointerId) return;
  const d = fabDrag.value;
  const dx = e.clientX - d.startX;
  const dy = e.clientY - d.startY;
  const movedFromStart = Math.hypot(dx, dy);
  if (movedFromStart > DOCK_BREAK_PX) {
    edgeDock.value = 'none';
  }
  /* 仍在贴边且位移未超过阈值：不移动球，避免误触拖动 */
  if (edgeDock.value !== 'none') {
    return;
  }
  const nl = d.originLeft + dx;
  const nt = d.originTop + dy;
  const c = clampFabPos(nl, nt);
  fabLeft.value = c.left;
  fabTop.value = c.top;
}

function onFabPointerUp(e: PointerEvent) {
  window.removeEventListener('pointermove', onFabPointerMove);
  window.removeEventListener('pointerup', onFabPointerUp);
  window.removeEventListener('pointercancel', onFabPointerUp);

  if (!fabDrag.value || e.pointerId !== fabDrag.value.pointerId) return;

  const d = fabDrag.value;
  fabDrag.value = null;
  fabDragging.value = false;

  if (!d) return;

  const dx = e.clientX - d.startX;
  const dy = e.clientY - d.startY;
  const moved = Math.hypot(dx, dy);

  if (moved < DRAG_CLICK_PX) {
    isOpen.value = true;
    saveFabPos();
    return;
  }

  saveFabPos();
}

const fabStyle = computed(() => ({ backgroundColor: color.value }));
const fabLayoutStyle = computed(() => {
  const base = fabStyle.value;
  if (fabLeft.value !== null) {
    if (panelMountedForLayout.value) {
      return { ...base, position: 'absolute' as const, zIndex: 2 };
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
const panelStyle = computed(
  () =>
    ({
      '--primary': color.value,
      transformOrigin: panelTransformOrigin.value,
    }) as Record<string, string>,
);

const emit = defineEmits<{
  (e: 'send', payload: { action: string; text: string }): void;
  (e: 'response', content: string): void;
  (e: 'error', message: string): void;
  (e: 'feedback', payload: { index: number; value: 'up' | 'down' | null }): void;
  /** K24: emitted when the user clicks an emoji on MessageReactionBar. */
  (e: 'reaction', payload: { messageIndex: number; emoji: string; toggled: boolean }): void;
}>();

function setMode(m: 'translate' | 'summarize' | 'chat') {
  mode.value = m;
}

function onChangeMode(m: 'translate' | 'summarize' | 'chat') {
  if (m === mode.value) return;
  if (messages.value.length > 0) {
    startNewSession();
  }
  setMode(m);
}

function startNewSession() {
  saveCurrentSessionToMulti();
  multiSessions.createSession();
  messages.value = [];
  renderAllMessages.value = false;
  resetSearch();
  clearRenderCache();
  sessionTitle.value = '';
}

function switchToSession(id: string) {
  if (id === multiSessions.activeSessionId.value) return;
  saveCurrentSessionToMulti();
  multiSessions.switchSession(id);
  const s = multiSessions.getActiveSession();
  messages.value = s?.messages ?? [];
  sessionTitle.value = s?.title ?? '';
  renderAllMessages.value = false;
  resetSearch();
  clearRenderCache();
}

function deleteSessionTab(id: string) {
  multiSessions.deleteSession(id);
  const s = multiSessions.getActiveSession();
  messages.value = s?.messages ?? [];
  sessionTitle.value = s?.title ?? '';
  clearRenderCache();
}

function forkFromHere(index: number) {
  saveCurrentSessionToMulti();
  const forked = multiSessions.forkFromMessage(multiSessions.activeSessionId.value, index);
  if (forked) {
    messages.value = forked.messages as Message[];
    sessionTitle.value = forked.title;
    clearRenderCache();
  }
}

function saveCurrentSessionToMulti() {
  multiSessions.updateActiveMessages(JSON.parse(JSON.stringify(messages.value)));
  if (sessionTitle.value) multiSessions.updateActiveTitle(sessionTitle.value);
}

function toggleSelectMode() {
  selectMode.value = !selectMode.value;
  if (!selectMode.value) selectedMsgIndices.value.clear();
}

function toggleMsgSelection(globalIdx: number) {
  const s = new Set(selectedMsgIndices.value);
  if (s.has(globalIdx)) s.delete(globalIdx);
  else s.add(globalIdx);
  selectedMsgIndices.value = s;
}

function deleteSelectedMessages() {
  if (selectedMsgIndices.value.size === 0) return;
  const sorted = [...selectedMsgIndices.value].sort((a, b) => b - a);
  for (const idx of sorted) {
    if (idx >= 0 && idx < messages.value.length) {
      messages.value.splice(idx, 1);
    }
  }
  selectedMsgIndices.value.clear();
  selectMode.value = false;
  clearRenderCache();
}

function clearMessages() {
  messages.value = [];
  renderAllMessages.value = false;
  resetSearch();
  clearRenderCache();
  clearStoredHistory();
  sessionTitle.value = '';
  multiSessions.updateActiveMessages([]);
}

function showAllOlderMessages() {
  renderAllMessages.value = true;
  nextTick(() => scrollToBottom(true));
}

const copiedIndex = ref(-1);

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
  setFeedback,
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

/**
 * K24: extended reaction handler for the new MessageReactionBar.
 *
 * Distinct from setFeedback (which is the canonical thumbs-up/down +
 * `feedback` emit for analytics back-ends that already exist). setReaction
 * stores a single selected emoji + a per-emoji counter on the message itself
 * (`msg.reactions`), with toggle semantics — clicking the active emoji
 * clears it. Host can subscribe via `options.onReaction` and the parent's
 * top-level `reaction` emit.
 */
function setReaction(globalIdx: number, emoji: string, toggled: boolean) {
  const msg = messages.value[globalIdx];
  if (!msg) return;
  const prev = msg.reactions ?? {};
  const counts: Record<string, number> = { ...(prev.counts ?? {}) };
  if (toggled) {
    counts[emoji] = Math.max(0, (counts[emoji] ?? 0) - 1);
    msg.reactions = { selected: '', counts };
  } else {
    if (prev.selected && prev.selected !== emoji) {
      counts[prev.selected] = Math.max(0, (counts[prev.selected] ?? 0) - 1);
    }
    counts[emoji] = (counts[emoji] ?? 0) + 1;
    msg.reactions = { selected: emoji, counts };
  }
  try {
    options.onReaction?.({ messageIndex: globalIdx, emoji, toggled });
  } catch (e) {
    /* Swallow host callback errors silently; never let analytics-side
     * exceptions break the reaction UI. */
    void e;
  }
  emit('reaction', { messageIndex: globalIdx, emoji, toggled });
}

function handleBodyClick(e: MouseEvent) {
  const target = e.target as HTMLElement;
  if (target.dataset.ide === 'true') {
    const pre = target.closest('pre');
    const codeEl = pre?.querySelector('code');
    const code = codeEl?.textContent || '';
    const cls = codeEl?.className || '';
    const lm = cls.match(/language-(\w+)/);
    options.openCodeInIde?.({ code, language: lm ? lm[1] : undefined });
    return;
  }
  /* F4: fold toggle - 折叠 / 展开长代码块 */
  if (target.dataset.foldToggle === 'true') {
    const wrap = target.closest('.ai-code-wrap');
    if (wrap) {
      const isFolded = wrap.classList.toggle('ai-code-folded');
      target.setAttribute('aria-expanded', isFolded ? 'false' : 'true');
      target.textContent = isFolded ? t.value.codeUnfold || 'Unfold' : t.value.codeFold || 'Fold';
    }
    return;
  }
  if (target.dataset.copy === 'true') {
    const pre = target.closest('pre');
    const code = pre?.querySelector('code')?.textContent || '';
    navigator.clipboard
      .writeText(code)
      .then(() => {
        target.textContent = t.value.codeCopied;
        pendingTimers.push(
          window.setTimeout(() => {
            target.textContent = t.value.copyCode;
          }, 1500),
        );
      })
      .catch(() => {
        target.textContent = '⚠';
        pendingTimers.push(
          window.setTimeout(() => {
            target.textContent = t.value.copyCode;
          }, 1500),
        );
      });
  }
}

// Image paste / drop / pending thumbnail logic moved to useImagePasteAndDrop.

async function copyMessage(text: string, globalIdx: number) {
  try {
    await writeClipboardText(text);
    copiedIndex.value = globalIdx;
    pendingTimers.push(
      window.setTimeout(() => {
        copiedIndex.value = -1;
      }, 1500),
    );
  } catch {
    reportAssistantError('clipboard', 'Copy failed');
  }
}

function onPageSelAction(action: 'ask' | 'translate' | 'summarize') {
  const text = pageSel.value.text;
  dismissPageSel();
  if (!text) return;
  if (action === 'ask') {
    mode.value = 'chat';
  } else if (action === 'translate') {
    mode.value = 'translate';
  } else {
    mode.value = 'summarize';
  }
  input.value = text;
  isOpen.value = true;
  nextTick(() => {
    if (action !== 'ask') {
      send();
    }
  });
}

/* K23: CommandPalette wiring
 * --------------------------
 * Registers Ctrl+K / ⌘+K as a global shortcut that opens a VSCode-style
 * command palette. Each command is a thin wrapper around an existing action
 * (clearMessages / startNewSession / toggleManualTheme / ...) so we don't
 * duplicate behaviour — Ctrl+K is purely a discoverability surface.
 *
 * Why register lazily inside a watch on isOpen instead of upfront:
 *   most commands are no-ops or wrong-context when the panel is closed
 *   (e.g. "Clear chat" with no panel visible). Keeping them gated by the
 *   panel state avoids surprise execution.
 */
const cmdPalette = useCommandPalette();

const builtInCommands = computed<CommandItem[]>(() => [
  {
    id: 'ai.toggle-panel',
    label: isOpen.value ? t.value.closePanel || '关闭面板' : t.value.fabOpen || '打开 AI 助手',
    group: '面板',
    icon: isOpen.value ? '✕' : '✨',
    shortcut: 'Esc / Ctrl+/',
    action: () => {
      isOpen.value = !isOpen.value;
    },
  },
  {
    id: 'ai.new-session',
    label: '新建会话 / New session',
    group: '会话',
    icon: '➕',
    keywords: ['new', 'session', '新建', '会话', '清空'],
    action: () => {
      startNewSession();
    },
  },
  {
    id: 'ai.clear',
    label: '清空当前会话 / Clear current chat',
    group: '会话',
    icon: '🗑',
    keywords: ['clear', '清空', 'reset'],
    action: () => {
      clearMessages();
    },
  },
  {
    id: 'ai.toggle-theme',
    label: isDark.value ? '切换到浅色 / Light mode' : '切换到深色 / Dark mode',
    group: '外观',
    icon: isDark.value ? '☀️' : '🌙',
    keywords: ['theme', 'dark', 'light', '主题', '暗黑', '浅色'],
    action: () => {
      toggleManualTheme();
    },
  },
  {
    id: 'ai.open-personalize',
    label: '个性化 / Personalize',
    group: '设置',
    icon: '⚙️',
    keywords: ['personalize', 'settings', '个性化', '系统提示词'],
    action: () => {
      openPersonalize();
    },
  },
  {
    id: 'ai.open-diagnostics',
    label: '连接诊断 / Connection diagnostics',
    group: '设置',
    icon: '🔍',
    keywords: ['diagnostics', 'health', '连接', '诊断'],
    action: () => {
      diagnosticsOpen.value = true;
    },
  },
  {
    id: 'ai.open-sessions',
    label: '所有会话 / All sessions',
    group: '会话',
    icon: '📚',
    keywords: ['sessions', '会话', '抽屉'],
    action: () => {
      sessionsDrawerOpen.value = true;
    },
  },
  {
    id: 'ai.open-memory',
    label: t.value.memoryLabel || '记忆管理 / Memory',
    group: '知识',
    icon: '🧠',
    keywords: ['memory', '记忆', '事实'],
    action: () => {
      memoryOpen.value = true;
    },
  },
  {
    id: 'ai.open-kb',
    label: t.value.kbLabel || '知识库管理 / Knowledge base',
    group: '知识',
    icon: '📖',
    keywords: ['kb', 'knowledge', '知识库', 'rag'],
    action: () => {
      kbPanelOpen.value = true;
    },
  },
  {
    id: 'ai.open-keyboard-help',
    label: '键盘快捷键 / Keyboard shortcuts',
    group: '帮助',
    icon: '⌨️',
    shortcut: 'Shift+?',
    keywords: ['keyboard', 'shortcut', 'help', '快捷键', '帮助'],
    action: () => {
      keyboardHelpOpen.value = true;
    },
  },
]);

watch(
  builtInCommands,
  (cmds) => {
    cmdPalette.clear();
    cmdPalette.register(cmds);
  },
  { immediate: true },
);

defineExpose({ isOpen, messages, mode, targetLang, clearMessages, cmdPalette });

watch(panelExpanded, () => {
  if (isOpen.value) {
    nextTick(() => ensurePanelInViewport());
  }
});

watch(isOpen, (open) => {
  if (open) {
    void refreshChatModels();
    if (fabLeft.value !== null && fabTop.value !== null) {
      fabFreePosBeforePanel.value = { left: fabLeft.value, top: fabTop.value };
    } else {
      fabFreePosBeforePanel.value = null;
    }
    panelSnapshot.value = { edge: edgeDock.value };
    onPanelOpen(wrapperRef.value, edgeDock);
    nextTick(() => {
      if (fabLeft.value === null || fabTop.value === null) {
        syncFabPixelFromWrapperDom(wrapperRef.value);
      }
      ensurePanelInViewport();
      saveFabPos(panelSnapshot.value?.edge);
      startCodeWall();
      panelRef.value?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    });
  } else {
    stopCodeWall();
    onPanelClose();
    if (panelSnapshot.value) {
      const s = panelSnapshot.value;
      panelSnapshot.value = null;
      if (s.edge === 'left' || s.edge === 'right') {
        fabFreePosBeforePanel.value = null;
        dockFab(s.edge);
      } else {
        edgeDock.value = 'none';
        if (fabFreePosBeforePanel.value) {
          if (!panelGeo.panelHeaderDraggedWhileOpen) {
            const p = fabFreePosBeforePanel.value;
            const c = clampFabPos(p.left, p.top);
            fabLeft.value = c.left;
            fabTop.value = c.top;
          }
          fabFreePosBeforePanel.value = null;
        }
        saveFabPos();
      }
    }
  }
});

function onWinResize() {
  if (winResizeRaf) cancelAnimationFrame(winResizeRaf);
  winResizeRaf = requestAnimationFrame(() => {
    winResizeRaf = 0;
    if (fabLeft.value === null || fabTop.value === null) return;
    const c = clampFabPos(fabLeft.value, fabTop.value);
    fabLeft.value = c.left;
    fabTop.value = c.top;
    if (edgeDock.value === 'right') fabLeft.value = window.innerWidth - FAB_SIZE;
    saveFabPos();
    if (isOpen.value) onWinResizePanel();
  });
}

function isActiveStreamingAssistant(globalIdx: number, msg: Message): boolean {
  return loading.value && msg.role === 'assistant' && globalIdx === messages.value.length - 1;
}

/**
 * D5: 流式生成进度的 1Hz tick。
 * 仅在 streamStartedAt 非 null 时（即正在流式生成）启用，避免 idle 状态下白白消耗主线程；
 * 用 `Date.now()` 而不是 `performance.now()`，与 useSendStream 的起始时间戳保持同一时钟。
 */
const streamingNowMs = ref<number>(Date.now());
let streamingTickHandle: ReturnType<typeof setInterval> | null = null;
function startStreamingTick() {
  if (streamingTickHandle != null) return;
  streamingNowMs.value = Date.now();
  streamingTickHandle = setInterval(() => {
    streamingNowMs.value = Date.now();
  }, 1000);
}
function stopStreamingTick() {
  if (streamingTickHandle != null) {
    clearInterval(streamingTickHandle);
    streamingTickHandle = null;
  }
}
onUnmounted(() => stopStreamingTick());

const {
  send: sendRaw,
  streamStartedAt,
  firstTokenAt,
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
  pendingImageData,
  pendingImageThumb,
  options,
  t,
  streamWithFallback,
  fetchUrlPreview,
  extractHttpUrls,
  isProbablyDirectImageUrl,
  firstNonImageHttpUrl,
  preferHttpsImageUrlWhenPageIsSecure,
  clearPendingImage,
  scrollToBottom,
  playNotificationSound,
  trimMessagesForMemoryCap,
  clearRenderCache,
  reportAssistantError,
  updateActiveSessionTitle: (title) => multiSessions.updateActiveTitle(title),
  emitSend: (payload) =>
    emit('send', payload as { action: 'translate' | 'summarize' | 'chat'; text: string }),
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
  memoryPromptFragment: computed(() => {
    const mem = crossMemory.memoryPromptFragment.value;
    const rag = knowledgeBase.ragPromptFragment.value;
    return [mem, rag].filter(Boolean).join('\n');
  }),
  pageContextEnabled: computed(() => !pageContextDisabledOverride.value),
});

watch(streamStartedAt, (v) => {
  if (v != null) startStreamingTick();
  else stopStreamingTick();
});

/**
 * K36: terminal 风格 ↑/↓ prompt 历史回放。
 *
 * - send() 之前 record 当前输入；空 / whitespace-only 不入栈，连续同 prompt 自动去重。
 * - 在 ChatInputArea textarea 内按 ↑（空输入框或处在回放状态）调用 recallOlder()；
 *   ↓ 走更新；Esc 退出回放并清空。
 * - 持久化到 localStorage，跨页面 / 跨标签共享同一历史。
 */
const promptHistory = usePromptHistory({
  max: 50,
  storageKey: 'ai-assistant.prompt-history.v1',
});
function send() {
  const prompt = input.value;
  if (prompt && prompt.trim()) {
    promptHistory.record(prompt);
  } else {
    promptHistory.reset();
  }
  return sendRaw();
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

async function processFileUpload(file: File) {
  if (!file || loading.value || !options.baseUrl) return;

  const action = mode.value === 'translate' ? ('translate' as const) : ('summarize' as const);
  const label = `📎 ${file.name} (${(file.size / 1024).toFixed(1)}KB)`;
  messages.value.push({ role: 'user', content: label, timestamp: Date.now() });
  loading.value = true;
  fileUploading.value = true;
  scrollToBottom(true);

  emit('send', { action, text: label });
  try {
    const res = await uploadFile(
      options.baseUrl,
      file,
      action,
      targetLang.value,
      options.accessToken,
    );
    const content = res.success ? res.result! : `${t.value.errorPrefix}: ${res.error}`;
    messages.value.push({ role: 'assistant', content, timestamp: Date.now() });
    scrollToBottom(true);
    if (res.success) emit('response', content);
    else {
      reportAssistantError('file-upload', res.error || 'Unknown error');
      emit('error', res.error || 'Unknown error');
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    messages.value.push({
      role: 'assistant',
      content: `${t.value.errorPrefix}: ${message}`,
      timestamp: Date.now(),
    });
    scrollToBottom(true);
    reportAssistantError('file-upload', message);
    emit('error', message || 'Unknown error');
  } finally {
    loading.value = false;
    fileUploading.value = false;
    playNotificationSound();
    scrollToBottom(false);
  }
}

/** 距底部小于此值则视为「在跟随」，流式更新时才自动滚 */
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
  if (doSoft) {
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_STICKY_PX;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }
}

function scrollToBottom(force: boolean) {
  if (force) scrollPendingForce = true;
  else scrollPendingSoft = true;
  if (scrollCoalesceRaf) return;
  nextTick(() => {
    if (scrollCoalesceRaf) return;
    scrollCoalesceRaf = requestAnimationFrame(() => {
      flushScrollToBottom();
    });
  });
}

watch(
  () => messages.value.length,
  () => {
    removeTransientAssistantMessages();
    trimMessagesForMemoryCap();
    scrollToBottom(false);
    saveHistory();
  },
);

watch(loading, (now, prev) => {
  if (!now && prev) removeTransientAssistantMessages();
});

function trapFocus(e: KeyboardEvent) {
  if (e.key !== 'Tab' || !panelRef.value) return;
  const focusable = panelRef.value.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  );
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey) {
    if (document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

function matchesToggleShortcut(e: KeyboardEvent): boolean {
  const shortcut = options.toggleShortcut;
  if (shortcut === false) return false;
  const raw = shortcut || '/';
  const parts = raw.split('+');
  const mainKey = parts[parts.length - 1];
  if (e.key !== mainKey && e.key.toLowerCase() !== mainKey.toLowerCase()) return false;
  const modifiers = parts.slice(0, -1).map((m) => m.toLowerCase());
  const isMac = navigator.platform?.startsWith('Mac') || navigator.userAgent?.includes('Mac');
  const needCtrl = modifiers.includes('ctrl') || (!modifiers.some((m) => m === 'meta') && !isMac);
  const needMeta = modifiers.includes('meta') || (!modifiers.some((m) => m === 'ctrl') && isMac);
  const needShift = modifiers.includes('shift');
  const needAlt = modifiers.includes('alt');
  return (
    (needCtrl ? e.ctrlKey : !e.ctrlKey || isMac) &&
    (needMeta ? e.metaKey : !e.metaKey || !isMac) &&
    needShift === e.shiftKey &&
    needAlt === e.altKey
  );
}

function onEscKeydown(e: KeyboardEvent) {
  if (matchesToggleShortcut(e)) {
    e.preventDefault();
    if (fabHidden.value) return;
    isOpen.value = !isOpen.value;
    return;
  }

  const ctrl = e.ctrlKey || e.metaKey;
  if (ctrl && e.shiftKey && !e.altKey && isOpen.value) {
    switch (e.key.toLowerCase()) {
      case 'l':
        e.preventDefault();
        clearMessages();
        return;
      case 'n':
        e.preventDefault();
        startNewSession();
        return;
      case 'f': {
        e.preventDefault();
        const searchEl = wrapperRef.value?.querySelector<HTMLInputElement>('.ai-chat-search-input');
        if (searchEl) searchEl.focus();
        return;
      }
      case 's':
        e.preventDefault();
        toggleBatchExportMenu();
        return;
      case 'm':
        e.preventDefault();
        toggleMemoryPanel();
        return;
    }
  }

  /* E1: Ctrl+/ (or Cmd+/) toggles keyboard shortcuts cheat sheet */
  if (ctrl && !e.shiftKey && !e.altKey && e.key === '/' && isOpen.value) {
    e.preventDefault();
    keyboardHelpOpen.value = !keyboardHelpOpen.value;
    return;
  }

  if (e.key !== 'Escape') return;
  if (inlineTranslatePopover.value.show) {
    e.preventDefault();
    closeInlineTranslatePopover();
    return;
  }
  if (msgCtxMenu.value.show) {
    e.preventDefault();
    closeMsgCtxMenu();
    return;
  }
  if (fabCtxMenu.value.show) {
    e.preventDefault();
    closeFabCtxMenu();
    return;
  }
  if (personalizeOpen.value) {
    e.preventDefault();
    personalizeOpen.value = false;
    return;
  }
  if (diagnosticsOpen.value) {
    e.preventDefault();
    diagnosticsOpen.value = false;
    return;
  }
  if (keyboardHelpOpen.value) {
    e.preventDefault();
    keyboardHelpOpen.value = false;
    return;
  }
  if (sessionsDrawerOpen.value) {
    e.preventDefault();
    sessionsDrawerOpen.value = false;
    return;
  }
  if (isOpen.value) {
    e.preventDefault();
    isOpen.value = false;
  }
}

function onVisualViewportChange() {
  onWinResize();
}

watch(chatSystemPrompt, (v) => {
  try {
    localStorage.setItem(systemPromptStorageKeyResolved.value, v);
  } catch {
    /* localStorage 不可用或配额满 */
  }
});

watch(selectedChatModel, (v) => {
  if (!v) return;
  try {
    localStorage.setItem(selectedModelStorageKeyResolved.value, v);
  } catch {
    /* ignore */
  }
});

watch([reducedMotionRef, pageVisibleRef, codeWallDisabled], () => {
  if (isOpen.value) {
    nextTick(() => startCodeWall());
  }
});

onMounted(() => {
  try {
    const savedBaseUrl = localStorage.getItem(CONNECTION_BASE_URL_STORAGE_KEY);
    const savedToken = localStorage.getItem(CONNECTION_TOKEN_STORAGE_KEY);
    if (savedBaseUrl) options.baseUrl = savedBaseUrl;
    if (savedToken) options.accessToken = savedToken;
    syncConnectionInputsFromOptions();
  } catch {
    /* ignore */
  }
  try {
    const s = localStorage.getItem(systemPromptStorageKeyResolved.value);
    if (s) {
      const cap = systemPromptMaxInputCharsResolved.value;
      chatSystemPrompt.value = s.length > cap ? s.slice(0, cap) : s;
    }
  } catch {
    /* ignore */
  }
  loadFabPos();
  void refreshServerPromptTemplates();
  /* 初始化虚拟滚动 viewport，避免首屏 window=0 时算出错误的可视区 */
  void nextTick(() => {
    const el = bodyRef.value;
    if (el) {
      virtualScrollTop.value = el.scrollTop;
      virtualViewportHeight.value = el.clientHeight;
    }
  });
  window.addEventListener('resize', onWinResize);
  window.visualViewport?.addEventListener('resize', onVisualViewportChange);
  window.visualViewport?.addEventListener('scroll', onVisualViewportChange);
  window.addEventListener('keydown', onEscKeydown, true);
  document.addEventListener('mousedown', onDocPointerDownCloseFabMenu, true);
  if (isOpen.value) {
    nextTick(() => startCodeWall());
  }
});

onUnmounted(() => {
  pendingTimers.forEach(clearTimeout);
  pendingTimers.length = 0;
  streamAbortController?.abort();
  streamAbortController = null;
  detachInlinePopLayoutListeners();
  disposeSearch();
  disposeExportToast();
  cleanupGeometry();
  stopCodeWall();
  if (winResizeRaf) cancelAnimationFrame(winResizeRaf);
  if (scrollCoalesceRaf) cancelAnimationFrame(scrollCoalesceRaf);
  window.removeEventListener('resize', onWinResize);
  window.visualViewport?.removeEventListener('resize', onVisualViewportChange);
  window.visualViewport?.removeEventListener('scroll', onVisualViewportChange);
  window.removeEventListener('keydown', onEscKeydown, true);
  document.removeEventListener('mousedown', onDocPointerDownCloseFabMenu, true);
  window.removeEventListener('pointermove', onFabPointerMove);
  window.removeEventListener('pointerup', onFabPointerUp);
  window.removeEventListener('pointercancel', onFabPointerUp);
});
</script>

<style src="./styles/01-shell.css"></style>
<style src="./styles/02-header-messages.css"></style>
<style src="./styles/03-input-popups.css"></style>
<style src="./styles/04-features.css"></style>
<style src="./styles/05-overlays-resize.css"></style>
<style src="./styles/06-page-feedback.css"></style>
<style src="./styles/07-voice-thinking.css"></style>
<style src="./styles/08-late-additions.css"></style>
<style src="./styles/09-modern-overhaul.css"></style>
<style src="./styles/10-polish-wave-6.css"></style>
<style src="./styles/11-refinement-and-performance.css"></style>
<style src="./styles/12-extreme-performance.css"></style>
