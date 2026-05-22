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
    <!-- Refactor (T1)：FAB 抽到 FabButton.vue，通过 ref 暴露原生按钮供 useFabDrag 解算坐标 -->
    <FabButton
      ref="fabButtonRef"
      :fab-hidden="fabHidden"
      :is-open="isOpen"
      :show-fab-during-panel-anim="showFabDuringPanelAnim"
      :fab-dragging="fabDragging"
      :fab-drop-active="fabDrop.dropActive.value"
      :fab-layout-style="fabLayoutStyle"
      v-bind="{ ariaLabel: t.fabOpen }"
      :drop-hint-text="t.kbDropFabHint || 'Drop to add to KB'"
      @pointerdown="onFabPointerDown"
      @contextmenu="onFabContextMenu"
      @drag-enter="fabDrop.onFabDragEnter"
      @drag-over="fabDrop.onFabDragOver"
      @drag-leave="fabDrop.onFabDragLeave"
      @drop="fabDrop.onFabDrop"
    />

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

        <!-- Refactor (T1)：搜索栏抽到 ChatSearchBar.vue -->
        <ChatSearchBar
          v-if="messages.length > 0"
          :input-value="chatSearchInput"
          :debounced-query="debouncedSearchQuery"
          :total-matches="totalMatches"
          :count-label="searchCountLabel"
          :options-open="searchOptionsOpen"
          :case-sensitive="searchCaseSensitive"
          :whole-word="searchWholeWord"
          :regex="searchRegex"
          :t="t"
          @update:input="chatSearchInput = $event"
          @update:options-open="searchOptionsOpen = $event"
          @update:case-sensitive="searchCaseSensitive = $event"
          @update:whole-word="searchWholeWord = $event"
          @update:regex="searchRegex = $event"
          @next="goNextMatch"
          @prev="goPrevMatch"
        />

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
          <!-- Refactor (T1)：空状态抽到 ChatEmptyState.vue + useEmptyStateContent composable -->
          <ChatEmptyState
            v-if="messages.length === 0"
            :mode="mode"
            :greeting="t.greeting"
            :skill-strip-label="t.skillStripLabel || 'Assistant skills'"
            :task-launcher-label="t.emptyTaskLauncher || 'Browse starter tasks'"
            :task-launcher-close-label="t.emptyTaskLauncherClose || 'Hide starter tasks'"
            :starter-section-label="t.emptyStarterSection || 'Recommended tasks'"
            :capability-section-label="t.emptyCapabilitySection || 'Capabilities'"
            :template-section-label="t.emptyTemplateSection || 'Templates'"
            :skills="defaultSkills"
            :starters="emptyStarterCards"
            :capability-hints="emptyCapabilityHints"
            :prompt-templates="promptTemplateList"
            @apply-skill="applyEmptySkill"
            @apply-starter="applyEmptyStarter"
            @apply-template="applyPromptTemplate"
          />
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
            :on-measure-height="virtualScrollOption ? onVirtualMeasureHeight : undefined"
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
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6 18 20H6L5 6" />
                <path d="M10 11v5" />
                <path d="M14 11v5" />
              </svg>
              <span>{{ t.msgCtxDelete }}</span>
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
            :aria-label="t.scrollToBottom"
            @click="scrollToBottomClick"
          >
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="m19 12-7 7-7-7" />
            </svg>
          </button>
        </Transition>

        <div v-if="mode === 'chat' && quickPrompts.length > 0" class="ai-quick-prompts">
          <button
            v-for="(qp, qi) in quickPrompts"
            :key="qi"
            type="button"
            class="ai-quick-prompt-btn"
            @click="applyQuickPrompt(qp)"
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
          :char-limit-warning-text="charLimitWarningText"
          :send-blocked-reason="sendBlockedReason"
          :send-blocked-action-label="sendBlockedActionLabel"
          :pending-image-thumbs="pendingImageThumbs"
          :accept-types="ACCEPT_TYPES"
          :has-base-url="!!options.baseUrl"
          :show-model-picker="showModelPickerResolved"
          :selected-model="selectedChatModel"
          :default-model="defaultChatModel"
          :model-choices="modelChoices"
          :model-capabilities="modelCapabilities"
          :model-list-message="modelListMessage"
          :model-status-text="modelStatusText"
          :model-status-kind="modelStatusKind"
          :target-lang="targetLang"
          :voice-supported="voiceSupported"
          :voice-recording="voiceRecording"
          :voice-conversation-active="voiceConversationActive"
          :t="t"
          :slash-visible="slashCmd.visible.value"
          :slash-commands="slashCmd.filteredCommands.value"
          :slash-selected-index="slashCmd.selectedIndex.value"
          :page-context-configured="pageContextConfigured"
          :page-context-enabled="!pageContextDisabledOverride"
          :page-context-block-count="options.pageContextBlocks?.length ?? 0"
          :deep-think-enabled="deepThinkEnabled"
          :web-search-enabled="webSearchEnabled"
          @send="send"
          @change-mode="onChangeMode"
          @toggle-page-context="togglePageContext"
          @toggle-deep-think="(v) => (deepThinkEnabled = v)"
          @toggle-web-search="(v) => (webSearchEnabled = v)"
          @send-blocked-action="handleSendBlockedAction"
          @clear-pending-image="clearPendingImage"
          @remove-pending-image="removePendingImage"
          @edit-pending-image="openAnnotationForPendingImage"
          @file-upload="processFileUpload"
          @paste-image="onPasteImage"
          @paste-text="onChatInputPasteText"
          @toggle-voice="voiceToggle()"
          @toggle-voice-conversation="toggleVoiceConversation"
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
      :compare-mark-active="compareSet.length > 0"
      :compare-mark-active-for-this="compareSlotOf(msgCtxMenu.index) >= 0"
      :compare-set-count="compareSet.length"
      :compare-set-full="compareSet.length >= maxCompareSides"
      :t="t"
      @copy="copyAssistantSelection"
      @translate="translateAssistantSelection"
      @delete="deleteAssistantAt(msgCtxMenu.index)"
      @export="(fmt) => exportAssistantMessageServer(msgCtxMenu.index, fmt)"
      @fork="forkFromHere(msgCtxMenu.index)"
      @tts="ttsToggleCurrent"
      @tts-pause-toggle="ttsPauseToggle"
      @compare-mark="onCompareMark"
      @compare-with="onCompareWith"
    />

    <CompareRegionsDialog
      v-if="compareDialogOpen"
      :open="compareDialogOpen"
      :is-dark="isDark"
      :t="t"
      :sides="compareSet"
      @close="compareDialogOpen = false"
      @swap-pair="onCompareSwapPair"
      @clear-set="onCompareClearSet"
    />

    <!-- Refactor (T1)：KB picker 抽到 KbPickerDialog.vue（Teleport 在子组件内部） -->
    <KbPickerDialog
      :visible="kbPickerVisible"
      :is-dark="isDark"
      :knowledge-bases="knowledgeBase.bases.value"
      :title="t.kbPickerTitle || 'Ingest into…'"
      :subtitle="
        (t.kbPickerSubtitle || '{count} file(s)').replace('{count}', String(kbPickerFiles.length))
      "
      v-bind="{ ariaLabel: t.kbPickerTitle || 'Pick destination knowledge base' }"
      :close-aria-label="t.closePanel"
      :docs-unit="t.kbPickerDocsUnit || 'docs'"
      :new-kb-label="t.kbPickerNewKb || 'New knowledge base'"
      @close="closeKbPicker"
      @pick="onKbPickerPick"
      @create-new="onKbPickerCreateNew"
      @keydown="onKbPickerKeydown"
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
      :provider-input="providerInput"
      :provider-base-url-input="providerBaseUrlInput"
      :provider-api-key-input="providerApiKeyInput"
      :provider-model-input="providerModelInput"
      :provider-allowed-models-input="providerAllowedModelsInput"
      @update:theme="(v) => (themePalette = v as ThemePresetId)"
      @update:audio="onAudioPrefsUpdate"
      @save-provider-config="saveProviderConfig"
      @discover-provider-models="discoverProviderModels"
      @update:provider-input="providerInput = $event"
      @update:provider-base-url-input="providerBaseUrlInput = $event"
      @update:provider-api-key-input="providerApiKeyInput = $event"
      @update:provider-model-input="providerModelInput = $event"
      @update:provider-allowed-models-input="providerAllowedModelsInput = $event"
      @close="personalizeOpen = false"
    />

    <!-- K21 Phase 1: 3 inline panels (memory / kb / plugins) extracted into
         AssistantInlineOverlays. Same `.ai-memory-overlay > .ai-memory-panel`
         visual template; the child owns memoryNewText / kbNewName /
         kbFileInputRef / kbUploadTargetId / addMemoryItem / createKb /
         triggerKbUpload / onKbFileSelect. -->
    <AssistantInlineOverlays
      v-if="inlineOverlaysActive"
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
      @pick-message="onPickCrossSessionMessage"
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
      :model-status-text="modelStatusText"
      :model-status-kind="modelStatusKind"
      :model-source-text="modelSourceText"
      :model-hint-text="modelHintText"
      :remedy-kind="diagnosticsRemedyKind"
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
      @use-default-base-url="useDefaultBaseUrlForDiagnostics"
      @update:base-url-input="connectionBaseUrlInput = $event"
      @update:token-input="connectionTokenInput = $event"
      @update:persist-enabled="connectionPersistEnabled = $event"
    />

    <!-- K34 (K21 Phase 2): 3 transient bottom-of-viewport popovers grouped
         into one wrapper. ExportToast / PageSelectionBar / InlineTranslate
         all share the "shows briefly then dismisses" pattern and have no
         coupling to chat state, so they're cheap to extract. -->
    <AssistantBottomTransients
      v-if="bottomTransientsActive"
      :export-toast-text="exportToastText"
      :color="color"
      :is-dark="isDark"
      :assistant-open="isOpen"
      :page-sel="pageSel"
      :inline-translate="inlineTranslatePopover"
      :t="t"
      @page-sel-action="onPageSelAction"
    />

    <ImageAnnotationDialog
      v-if="annotationOpen"
      :open="annotationOpen"
      :image-src="annotationImageSrc"
      :is-dark="isDark"
      :t="t"
      @close="closeAnnotationDialog"
      @save="onAnnotationSave"
    />

    <!-- L1: Form auto-fill dialog (lazy-loaded via async component). Only mounts
         when the feature is enabled and the composable opens the dialog. -->
    <FormAutoFillDialog
      v-if="formAutoFillEnabled && formAutoFill.dialogOpen.value"
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

    <!-- Refactor (T1)：FormFillToast 抽出 -->
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

    <!-- K23: Ctrl+K command palette. Teleports to body so z-index is hassle-free. -->
    <CommandPalette
      v-if="cmdPalette.open.value"
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
/* Refactor (T1)：从 AiAssistant.vue 抽出的 5 个子组件 */
import FabButton from './FabButton.vue';
import ChatSearchBar from './ChatSearchBar.vue';
import ChatEmptyState from './ChatEmptyState.vue';
import KbPickerDialog from './KbPickerDialog.vue';
import FormFillToast from './FormFillToast.vue';
import { useVoiceInput } from '../composables/useVoiceInput';
import {
  appendVoiceTranscript,
  shouldAutoSendVoiceTranscript,
} from '../composables/useVoiceConversation';
import { useSlashCommands } from '../composables/useSlashCommands';
import { useCrossSessionMemory } from '../composables/useCrossSessionMemory';
import { useKnowledgeBase } from '../composables/useKnowledgeBase';
import { useMultiModelChat } from '../composables/useMultiModelChat';
import { useTextToSpeech } from '../composables/useTextToSpeech';
import { useAudioPreferences } from '../composables/useAudioPreferences';
import { useAssistantDiagnostics } from '../composables/useAssistantDiagnostics';
import { writeClipboardText } from '../composables/useDiagnosticsClipboard';
import { useAssistantKeyboard } from '../composables/useAssistantKeyboard';
import { usePromptTemplateInteraction } from '../composables/usePromptTemplateInteraction';
import { usePromptTemplateLibrary } from '../composables/usePromptTemplateLibrary';
import { useQuickPromptOptions } from '../composables/useQuickPromptOptions';
import { useServerPromptTemplates } from '../composables/useServerPromptTemplates';
import { useAssistantPromptCommands } from '../composables/useAssistantPromptCommands';
import { useAssistantFeatureCommands } from '../composables/useAssistantFeatureCommands';
import { useAssistantCommandRegistry } from '../composables/useAssistantCommandRegistry';
import { useAssistantCommandFamilies } from '../composables/useAssistantCommandFamilies';
import { useAssistantWorkflowCommands } from '../composables/useAssistantWorkflowCommands';
import { useAssistantAppCommands } from '../composables/useAssistantAppCommands';
import { useMermaidRenderer } from '../composables/useMermaidRenderer';
/* Refactor (T1-Wave3)：滚动 + 虚拟滚动整合到一个 composable（不再直接 import useMessageVirtualScroll） */
import {
  useScrollAndVirtual,
  resolveVirtualScrollOption,
} from '../composables/useScrollAndVirtual';
import { useCommandPalette } from '../composables/useCommandPalette';
import { useCommandPaletteRegistration } from '../composables/useCommandPaletteRegistration';
const PersonalizeDialog = defineAsyncComponent(() => import('./PersonalizeDialog.vue'));
const CompareRegionsDialog = defineAsyncComponent(() => import('./CompareRegionsDialog.vue'));
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
const ImageAnnotationDialog = defineAsyncComponent(() => import('./ImageAnnotationDialog.vue'));
/* K21 Phase 1: extracted ~135 lines of repetitive memory/kb/plugins panel
 * template into AssistantInlineOverlays. Lazy-loaded so the initial chunk
 * stays slim (only paid for when a user opens one of those panels). */
const AssistantInlineOverlays = defineAsyncComponent(() => import('./AssistantInlineOverlays.vue'));
/* K23: CommandPalette (Ctrl+K / ⌘+K) — flagship VSCode-style command runner
 * built on top of the K16 CommandPalette.vue + useCommandPalette composable. */
const CommandPalette = defineAsyncComponent(() => import('./CommandPalette.vue'));
import type { AiAssistantOptions } from '../index';
import { uploadFile, fetchUrlPreview } from '../utils/api';
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
import { useMessageSelection } from '../composables/useMessageSelection';
import { useCompareRegions } from '../composables/useCompareRegions';
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
  captureScreenDataUrl,
  matchesScreenCaptureShortcut,
} from '../composables/useScreenCapture';
import {
  providePluginRegistry,
  usePluginRegistry,
  type PluginContext,
} from '../composables/usePluginRegistry';
import { usePageSelection } from '../composables/usePageSelection';
import { usePromptHistory } from '../composables/usePromptHistory';
import { useFabDropIngest } from '../composables/useFabDropIngest';
import { useKnowledgeDrop } from '../composables/useKnowledgeDrop';
import { useFormAutoFill } from '../composables/useFormAutoFill';
/* Refactor (T1)：从 AiAssistant.vue 抽出的 3 个 composable */
import { useEmptyStateContent } from '../composables/useEmptyStateContent';
import { useThemePreference } from '../composables/useThemePreference';
import { useImageLightbox } from '../composables/useImageLightbox';
const FormAutoFillDialog = defineAsyncComponent(() => import('./FormAutoFillDialog.vue'));
import {
  extractHttpUrls,
  isProbablyDirectImageUrl,
  firstNonImageHttpUrl,
  preferHttpsImageUrlWhenPageIsSecure,
} from '../utils/urlEmbed';
import {
  findCodeElementForCodeActionTarget,
  getCodeLanguage,
  updateCodeActionButtonLabel,
  updateCodeCopyFailureState,
  updateCodeFoldToggleState,
} from '../utils/codeBlockDom';

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
/* Refactor (T1)：systemDark / reducedMotion / pageVisible / userOverride / isDark / toggleManualTheme
 * 全部抽到 useThemePreference composable，参见 #27 用户主题覆盖契约。 */
const themePref = useThemePreference(computed(() => options.theme));
const reducedMotionRef = themePref.reducedMotion;
const pageVisibleRef = themePref.pageVisible;
const isDark = themePref.isDark;
const toggleManualTheme = themePref.toggleManualTheme;
const isOpen = ref(false);
/** 本会话内隐藏悬浮球，刷新页面后恢复（不用 localStorage） */
const fabHidden = ref(false);
const input = ref('');

/**
 * Doubao-style quick toggles state. Pure UI-state by default; host can
 * react to `onToggleDeepThink` / `onToggleWebSearch` options to wire to a
 * backend flag (model param, tool plugin, etc.). Persisted across panel
 * opens within the same session — but intentionally NOT to localStorage,
 * because semantics depend on the host's wiring.
 */
const deepThinkEnabled = ref(false);
const webSearchEnabled = ref(false);

/* Refactor (T1)：Doubao-style skill chip / starter card / capability hint
 * 全部抽到 useEmptyStateContent composable（4 语言 i18n 静态数据 ~330 行）。
 * 因为 `mode` 在文件后段才声明，这里先用一个早期 ref 提前持有 mode，
 * 后面再覆盖到同名 ref（避免循环依赖）。 */
const mode = ref<'translate' | 'summarize' | 'chat'>('chat');
type EmptySkillChip = import('../composables/useEmptyStateContent').EmptySkillChip;
type EmptyStarterCard = import('../composables/useEmptyStateContent').EmptyStarterCard;
const {
  defaultSkills,
  defaultStartersRich,
  modeStarterCards,
  emptyStarterCards,
  emptyCapabilityHints,
} = useEmptyStateContent({
  locale: computed(() => options.locale),
  mode,
});
void defaultStartersRich;
void modeStarterCards;
/* Refactor (T1)：原 ~310 行的 4 语言 skill/starter/mode/capability 数据 + 局部 interface
 *（_legacyDefaultSkills / defaultStartersRich / modeStarterCards / emptyStarterCards /
 *  emptyCapabilityHints / EmptyStarterCard interface）已迁移到
 *  composables/useEmptyStateContent.ts，请去那里维护文案与 i18n 增量。 */
/* ↑ 上面 5 个变量来自 useEmptyStateContent composable。原 ~258 行的 4 语言
 * skill/starter/mode/capability 数据已迁移到 composables/useEmptyStateContent.ts。 */

function focusInput() {
  void nextTick(() => {
    const el = document.querySelector(
      `.ai-assistant-wrapper .ai-footer-textarea`,
    ) as HTMLTextAreaElement | null;
    el?.focus();
  });
}

function applyEmptySkill(skill: EmptySkillChip) {
  input.value = skill.prompt;
  focusInput();
}

function applyEmptyStarter(starter: EmptyStarterCard) {
  input.value = starter.prompt;
  focusInput();
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
const charLimitWarningText = computed(() => {
  if (!maxUserChars.value || !input.value) return '';
  if (input.value.length > maxUserChars.value) {
    return t.value.inputOverLimitWarning.replace('{max}', String(maxUserChars.value));
  }
  if (input.value.length > maxUserChars.value * 0.85) {
    return t.value.inputNearLimitWarning.replace('{max}', String(maxUserChars.value));
  }
  return '';
});
const sendBlockedReason = computed(() => {
  if (!input.value.trim()) return '';
  if (!options.baseUrl) return t.value.sendUnavailableNoBackend;
  return '';
});
const sendBlockedActionLabel = computed(() => {
  if (!input.value.trim()) return '';
  if (!options.baseUrl) return t.value.diagnosticsUseDefaultBaseUrl;
  return '';
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

/* Refactor (T1)：`mode` 已前移至 useEmptyStateContent 之前声明，避免循环依赖。 */
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

const showModelPickerResolved = computed(() => options.showModelPicker !== false);
const selectedModelStorageKeyResolved = computed(
  () => options.selectedModelStorageKey?.trim() || 'ai-assistant-selected-model',
);
const pendingTimers: number[] = [];
const keyboardHelpOpen = ref(false);
const sessionsDrawerOpen = ref(false);
const assistantDiagnostics = useAssistantDiagnostics({
  options,
  t,
  showModelPicker: showModelPickerResolved,
  selectedModelStorageKey: selectedModelStorageKeyResolved,
  pendingTimers,
});
const {
  modelChoices,
  modelCapabilities,
  selectedChatModel,
  defaultChatModel,
  diagnosticsOpen,
  diagnosticsBusy,
  diagnosticsCopied,
  diagnosticsCopyMessage,
  diagnosticsLastChecked,
  modelListError,
  connectionBaseUrlInput,
  connectionTokenInput,
  connectionPersistEnabled,
  connectionConfigMessage,
  providerInput,
  providerBaseUrlInput,
  providerApiKeyInput,
  providerModelInput,
  providerAllowedModelsInput,
  modelListMessage,
  diagnosticsModelEndpoint,
  diagnosticsTokenText,
  diagnosticsStatusMessage,
  modelStatusKind,
  modelStatusText,
  modelSourceText,
  modelHintText,
  diagnosticsRemedyKind,
  refreshRuntimeModelConfig,
  refreshChatModels,
  runModelDiagnostics,
  toggleDiagnostics,
  syncConnectionInputsFromOptions,
  useDefaultBaseUrlForDiagnostics,
  handleSendBlockedAction,
  testConnectionConfig,
  saveConnectionConfig,
  saveProviderConfig,
  discoverProviderModels,
  copyDiagnostics,
  connectionBaseUrlStorageKey,
  connectionTokenStorageKey,
} = assistantDiagnostics;

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

/* Refactor (T1-Wave3)：showScrollToBottomBtn / scrollToBottomClick / 滚动 listener
 * 抽到 useScrollAndVirtual；与下面 C10 虚拟滚动接入合并。 */

const panelRef = ref<HTMLElement>();

/* Refactor (T1)：#18 图片点击放大 lightbox 逻辑抽到 useImageLightbox composable。
 * 行为契约不变：单一 overlay 复用，挂到 document.body，Esc / 点击 overlay 关闭。 */
useImageLightbox({
  panelRef,
  closeAriaLabel: () => t.value.imageLightboxClose || 'Close',
});
const codeWallCanvasRef = ref<HTMLCanvasElement>();
const fileUploading = ref(false);
const {
  selectMode,
  selectedMsgIndices,
  toggleSelectMode,
  toggleMsgSelection,
  deleteSelectedMessages,
} = useMessageSelection({
  messages,
  clearRenderCache,
});
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
  setPendingImageDataUrl,
  replacePendingImageDataUrl,
  clearPendingImage,
  removePendingImage,
} = useImagePasteAndDrop({
  loading,
  messages,
  errorPrefix: computed(() => t.value.errorPrefix),
  processFileUpload,
});

const annotationOpen = ref(false);
const annotationImageSrc = ref('');
const annotationReplaceIndex = ref<number | null>(null);

function openAnnotationDialog(src: string, replaceIndex: number | null) {
  if (!src) return;
  annotationImageSrc.value = src;
  annotationReplaceIndex.value = replaceIndex;
  annotationOpen.value = true;
}

function openAnnotationForPendingImage(index: number) {
  openAnnotationDialog(pendingImageDataList.value[index], index);
}

function closeAnnotationDialog() {
  annotationOpen.value = false;
  annotationImageSrc.value = '';
  annotationReplaceIndex.value = null;
}

async function onAnnotationSave(dataUrl: string) {
  const replaceIndex = annotationReplaceIndex.value;
  if (replaceIndex == null) await setPendingImageDataUrl(dataUrl);
  else await replacePendingImageDataUrl(replaceIndex, dataUrl);
  closeAnnotationDialog();
}

async function captureScreenIntoPendingImage() {
  try {
    const dataUrl = await captureScreenDataUrl();
    openAnnotationDialog(dataUrl, null);
  } catch (e) {
    const message =
      e instanceof Error && e.message === 'screen-capture-unsupported'
        ? t.value.screenCaptureUnsupported
        : t.value.screenCaptureFailed;
    setExportToast(message, 3200);
  }
}
const {
  disabled: codeWallDisabled,
  start: startCodeWall,
  stop: stopCodeWall,
} = useCodeWall(codeWallCanvasRef, panelRef, reducedMotionRef, pageVisibleRef);

const {
  recording: voiceRecording,
  supported: voiceSupported,
  toggle: toggleVoiceRecognition,
} = useVoiceInput((text) => {
  input.value = appendVoiceTranscript(input.value, text);
  if (
    shouldAutoSendVoiceTranscript({
      active: voiceConversationActive.value,
      mode: mode.value,
      hasBaseUrl: !!options.baseUrl,
      loading: loading.value,
      transcript: text,
    })
  ) {
    void nextTick(() => {
      if (input.value.trim() && !loading.value) void send();
    });
  }
});
const voiceConversationActive = ref(false);
function voiceToggle() {
  toggleVoiceRecognition({
    continuous: voiceConversationActive.value,
    interimResults: voiceConversationActive.value,
  });
}
function toggleVoiceConversation() {
  voiceConversationActive.value = !voiceConversationActive.value;
  if (!voiceConversationActive.value && voiceRecording.value) {
    toggleVoiceRecognition();
  }
}

const crossMemory = useCrossSessionMemory();
const memoryOpen = ref(false);

const pluginsPanelOpen = ref(false);

const knowledgeBase = useKnowledgeBase();
const kbPanelOpen = ref(false);

/**
 * K38 / K43: drag-and-drop a non-image file onto the FAB while the panel
 * is closed → ingest into a knowledge base.
 *
 * 设计选择：
 * - 只在 FAB 可见时启用（!isOpen.value）。面板打开后 body 的 drop 走旧 UX
 *   (translate / summarize 单文件)。
 * - 拒收 image/*：图片走 Vision pendingImage 流程，避免误入 KB。
 * - K38: 0 或 1 个 KB 时自动 ingest 到 "Quick Ingest" (auto-create)。
 * - K43: ≥ 2 个 KB 时弹出 picker popover 让用户选择目标 KB。
 * - 文件名带可视化 toast 反馈，用现有 setExportToast 通道（3.2s 自动消失）。
 */
const knowledgeDrop = useKnowledgeDrop({
  knowledgeBase,
  t,
  setToast: setExportToast,
  focusPicker: () => {
    const shell = document.querySelector('.ai-kb-picker-shell') as HTMLElement | null;
    shell?.focus();
  },
});
const {
  kbPickerVisible,
  kbPickerFiles,
  closeKbPicker,
  onKbPickerPick,
  onKbPickerCreateNew,
  onKbPickerKeydown,
  ingestFilesIntoKb,
} = knowledgeDrop;

/* K48: picker keyboard shortcuts and auto-dismiss timer are owned by useKnowledgeDrop. */
onUnmounted(() => knowledgeDrop.dispose());

const fabDrop = useFabDropIngest({
  enabled: computed(() => !isOpen.value),
  rejectMimePrefix: ['image/'],
  onFiles: ingestFilesIntoKb,
});

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
const audioPreferences = useAudioPreferences({
  voiceKey: AUDIO_PREFS_VOICE_KEY,
  rateKey: AUDIO_PREFS_RATE_KEY,
  autoReadKey: AUDIO_PREFS_AUTOREAD_KEY,
});

/** PersonalizeDialog 渲染所需的 view-model（轻量 voices 列表，避免传引用）。 */
const audioPrefs = computed(() => ({
  supported: tts.supported.value,
  voice: audioPreferences.voice.value,
  rate: audioPreferences.rate.value,
  autoRead: audioPreferences.autoRead.value,
  voices: tts.voices.value.map((v) => ({
    voiceURI: v.voiceURI,
    name: v.name,
    lang: v.lang,
  })),
}));
watch(personalizeOpen, (open) => {
  if (open) {
    tts.refreshVoices();
    void refreshRuntimeModelConfig();
  }
});
function onAudioPrefsUpdate(patch: Partial<{ voice: string; rate: number; autoRead: boolean }>) {
  audioPreferences.update(patch);
}

function ttsToggleCurrent() {
  const idx = msgCtxMenu.value.index;
  if (idx < 0) return;
  const m = messages.value[idx];
  if (!m) return;
  const text = m.contentArchive ?? m.content;
  closeMsgCtxMenu();
  tts.toggleMessage(text, idx, {
    voice: audioPreferences.voice.value || undefined,
    rate: audioPreferences.rate.value,
  });
}
function ttsPauseToggle() {
  closeMsgCtxMenu();
  if (tts.paused.value) tts.resume();
  else tts.pause();
}

/**
 * K40 / K42: CompareRegionsView N-way state.
 *
 * 演进自 K40 (left + right) → K42 单一 `compareSet` (1-4)：
 * - 1 条 = "Add to Compare set" 后槽位为 A，等待第二条
 * - 2 条 = K40 原 UX，pair tab 只有一个，差异 dialog 立即可用
 * - 3-4 条 = pair tab N(N-1)/2 个（3 sides=3 tab，4 sides=6 tab）
 *
 * 槽位顺序代表添加顺序（不是 msgIndex 顺序）— 让用户掌控 base 是哪条。
 * Swap 在 dialog 内部按 pair 局部 swap。
 */
const compareRegions = useCompareRegions({ messages, t });
const {
  compareSet,
  compareDialogOpen,
  compareSlotOf,
  swapPair: onCompareSwapPair,
  clearSet: onCompareClearSet,
} = compareRegions;
const maxCompareSides = compareRegions.maxSides;

function onCompareMark() {
  const idx = msgCtxMenu.value.index;
  const selection = (msgCtxMenu.value.selectionText ?? '').trim();
  closeMsgCtxMenu();
  compareRegions.mark(idx, selection);
}

function onCompareWith() {
  const idx = msgCtxMenu.value.index;
  const selection = (msgCtxMenu.value.selectionText ?? '').trim();
  closeMsgCtxMenu();
  compareRegions.compareWith(idx, selection);
}

/**
 * K37 auto-read: 当 loading 由 true → false 且最后一条是 assistant 内容非空时，
 * 自动朗读（受 audioAutoRead 偏好门控）。可手动 toggleMessage 取消。
 */
watch(loading, (now, prev) => {
  if (!audioPreferences.autoRead.value && !voiceConversationActive.value) return;
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
    voice: audioPreferences.voice.value || undefined,
    rate: audioPreferences.rate.value,
  });
});

/**
 * B7: Prompt 模板库。
 *
 * 把 `AiAssistantOptions.promptTemplates` 注入到 composable 作为只读「预置」段，
 * 与用户在 localStorage 里保存的模板合并展示。「使用」按钮把渲染后的文本写入
 * 主输入框，仍由用户决定何时发送，避免误触意外消耗 token。
 */
const { promptTemplateOpen, onPromptTemplateUse } = usePromptTemplateInteraction({ input });
const { presetPromptTemplates, refreshServerPromptTemplates } = useServerPromptTemplates(options);
const promptTemplateLib = usePromptTemplateLibrary({
  presetTemplates: presetPromptTemplates,
});
const { quickPrompts } = useQuickPromptOptions(options);

type PromptTemplate = NonNullable<AiAssistantOptions['promptTemplates']>[number];
const promptTemplateList = computed<PromptTemplate[]>(() => {
  const t = options.promptTemplates;
  if (!Array.isArray(t)) return [];
  return t.filter((x) => x && typeof x.label === 'string' && typeof x.template === 'string');
});

const promptCommands = useAssistantPromptCommands({
  input,
  setMode,
  quickPrompts,
  promptTemplates: promptTemplateList,
  templateDescription: computed(
    () => t.value.slashCmdTemplateDesc || t.value.tplDialogTitle || 'Templates',
  ),
  openPromptTemplateDialog: () => {
    void refreshServerPromptTemplates();
    promptTemplateOpen.value = true;
  },
});
const { applyQuickPrompt, applyPromptTemplate } = promptCommands;

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
/* Refactor (T1-Wave3)：C10 虚拟滚动 + 普通滚动 listener 统一到 useScrollAndVirtual。
 *
 * - virtualScrollOption 决定是否启用虚拟滚动；
 * - showScrollToBottomBtn 与 scrollToBottomClick 直接被模板使用；
 * - 父组件下面 win-resize 等场景仍可手动 sync viewport（通过 scrollAndVirtual.virtualScroll）。
 */
const virtualScrollOption = computed(() => resolveVirtualScrollOption(options.virtualScroll));
const scrollAndVirtual = useScrollAndVirtual({
  bodyRef,
  displayedMessageCount: computed(() => displayedMessages.value.length),
  virtualScrollOption,
});
const {
  showScrollToBottomBtn,
  scrollToBottomClick,
  virtualScrollTop,
  virtualViewportHeight,
  virtualSliceForList,
  onVirtualMeasureHeight,
  onBodyScrollForVirtual,
} = scrollAndVirtual;

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
 * AssistantInlineOverlays.vue. We keep memory toggle here because keyboard
 * shortcuts still reference it by name. */
function toggleMemoryPanel() {
  memoryOpen.value = !memoryOpen.value;
}

/**
 * L1: 表单自动填充 composable。`options.formAutoFill` 既可为 `boolean` 也可
 * 为对象，统一规范化成对象传给 composable。关闭时 composable 仍然存在但所
 * 有公开方法都会因为 autoDetectPaste/options 未设而早退。
 */
const formAutoFillOptions = computed(() => {
  const raw = options.formAutoFill;
  if (!raw) return null;
  if (raw === true) return {};
  return raw;
});
const formAutoFillEnabled = computed(() => formAutoFillOptions.value !== null);
const formAutoFill = useFormAutoFill({
  options: computed(() => formAutoFillOptions.value ?? {}),
});

function onChatInputPasteText(payload: { text: string; event: ClipboardEvent }) {
  if (!formAutoFillEnabled.value) return;
  formAutoFill.inspectPasteText(payload.text);
}

function onFormAutoFillToggle(idx: number) {
  formAutoFill.toggleSelection(idx);
}

function onFormAutoFillToggleAll(checked: boolean) {
  formAutoFill.setAllSelections(checked);
}

function onFormAutoFillOverride(payload: { pairIdx: number; fieldId: string | null }) {
  formAutoFill.overrideMatch(payload.pairIdx, payload.fieldId);
}

function onFormAutoFillConfirm() {
  formAutoFill.confirmFill();
}

function onFormAutoFillUndo() {
  formAutoFill.undoLastFill();
}

function onFormAutoFillToastDismiss() {
  formAutoFill.dismissToast();
}

const formAutoFillToastText = computed(() => {
  const s = formAutoFill.toastSummary.value;
  if (!s) return '';
  const tpl = t.value.formFillToastTemplate || 'Filled {filled} field(s) ({failed} failed)';
  return tpl.replace('{filled}', String(s.filled)).replace('{failed}', String(s.failed));
});

const featureCommands = useAssistantFeatureCommands({
  t,
  input,
  memoryOpen,
  kbPanelOpen,
  pluginsPanelOpen,
  formAutoFillEnabled,
  openMultiModelCompare,
  triggerFormAutoFill: (text) => {
    void formAutoFill.triggerFromText(text);
  },
});
const workflowCommands = useAssistantWorkflowCommands({
  t,
  diagnosticsOpen,
  sessionsDrawerOpen,
  openExportMenu: () => toggleBatchExportMenu(),
});
const appCommands = useAssistantAppCommands({
  t,
  isOpen,
  isDark,
  startNewSession,
  clearMessages,
  toggleManualTheme,
  openPersonalize,
  keyboardHelpOpen,
});
const commandRegistry = useAssistantCommandRegistry({
  families: useAssistantCommandFamilies({
    appCommands,
    promptCommands,
    featureCommands,
    workflowCommands,
  }),
});
const importMetaWithEnv = import.meta as ImportMeta & { env?: { DEV?: boolean } };
watch(
  commandRegistry.duplicatePaletteCommandIds,
  (ids) => {
    if (ids.length > 0 && importMetaWithEnv.env?.DEV) {
      console.warn('[AiAssistant] Duplicate command palette ids:', ids);
    }
  },
  { immediate: true },
);

const slashCmd = useSlashCommands({
  input,
  t: computed(() => t.value) as unknown as Ref<I18nMessages>,
  onClear: () => clearMessages(),
  onNewSession: () => startNewSession(),
  onExport: () => toggleBatchExportMenu(),
  onChangeMode: (m) => onChangeMode(m),
  extraCommands: commandRegistry.slashCommands,
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
const searchOptionsOpen = ref(false);

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
    /* K46: inject a "Add to Compare" hover button into every <pre> code block
     * (skip stream-plain which has no code semantics + skip if already injected
     * via re-render). Button click is dispatched via event delegation in
     * handleBodyClick below. The data-msg-idx attribute tells us which message
     * the code block belongs to for the compare slot. */
    html = injectCodeBlockCompareButton(html, globalIdx);
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

/**
 * K46: inject hover-only "Add to Compare" button into every <pre> that's NOT
 * the streaming-plain wrapper. We do this with a single regex pass + the
 * markdown renderer is already trusted (sanitized inside renderContent), so
 * splicing extra elements is safe.
 *
 * Marker `data-ai-cmp-msg="N"` lets the global click delegator find the
 * source message index. The label string is i18n'd via window.__AI_T (see
 * handleBodyClick).
 */
const CODE_COMPARE_BTN_LABEL_KEY = 'msgCtxCompareMarkSelection';
function injectCodeBlockCompareButton(html: string, globalIdx: number): string {
  const btnLabel = t.value[CODE_COMPARE_BTN_LABEL_KEY] || 'Add to Compare';
  return html.replace(/<pre(?![^>]*data-ai-stream-plain)([^>]*)>/g, (full, attrs: string) => {
    if (/data-ai-cmp-wrapped="1"/.test(attrs)) return full;
    const newAttrs = `${attrs} data-ai-cmp-wrapped="1" style="position:relative"`;
    const btn =
      `<button type="button" class="ai-code-cmp-btn" data-ai-cmp-msg="${globalIdx}"` +
      ` title="${escapeHtmlLite(btnLabel)}" aria-label="${escapeHtmlLite(btnLabel)}">` +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
      ' stroke-width="2.5" stroke-linecap="round" aria-hidden="true">' +
      '<path d="M5 12h14M12 5v14"/></svg></button>';
    return `<pre${newAttrs}>${btn}`;
  });
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
  if (totalMatches.value === 0) {
    const loc = options.locale ?? 'en';
    return loc === 'zh'
      ? '无结果'
      : loc === 'ja'
        ? '結果なし'
        : loc === 'ko'
          ? '결과 없음'
          : 'No results';
  }
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

/* Refactor (T1)：fabRef 现在通过 FabButton 子组件的 expose 拿到原生按钮 ref。
 * 保留同名 computed 以兼容下面 onFabContextMenu / useFabDrag 等所有调用点。 */
const fabButtonRef = ref<InstanceType<typeof FabButton> | null>(null);
const fabRef = computed<HTMLButtonElement | undefined>(() => fabButtonRef.value?.fabRef);
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
const bottomTransientsActive = computed(
  () =>
    !!exportToastText.value ||
    (pageSel.value.show && !isOpen.value) ||
    inlineTranslatePopover.value.show,
);
const inlineOverlaysActive = computed(
  () => memoryOpen.value || kbPanelOpen.value || pluginsPanelOpen.value,
);
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

/**
 * K39: 跨会话搜索的「跳到某条消息」入口。
 *
 * 步骤：
 *   1. 切换到目标会话（如果不是当前）；保留旧逻辑分支以避免不必要的 save。
 *   2. 因为切到新 session 后 renderAllMessages 重置为 false，确保目标 msgIndex
 *      在「最近 N 条」之外时强制全量渲染，否则 DOM 里找不到 element。
 *   3. nextTick 后用 SessionSearch 已经在用的 data-attr 找到 element 并
 *      scrollIntoView，触发用户视觉确认。
 */
function onPickCrossSessionMessage(sessionId: string, msgIndex: number) {
  switchToSession(sessionId);
  if (msgIndex < messages.value.length - MAX_RENDERED_MESSAGES) {
    renderAllMessages.value = true;
  }
  void nextTick(() => {
    const root = panelRef.value ?? document;
    const el = root.querySelector(`[data-ai-msg-global-idx="${msgIndex}"]`);
    if (el && typeof (el as HTMLElement).scrollIntoView === 'function') {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLElement).classList.add('ai-cross-search-flash');
      setTimeout(() => (el as HTMLElement).classList.remove('ai-cross-search-flash'), 1600);
    }
    if (!isOpen.value) {
      isOpen.value = true;
    }
  });
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
  /* K46: code-block "Add to Compare" hover button. Match the button OR its
   * inner SVG/path (clicks on the icon fragment bubble up). closest finds
   * the actual <button>. */
  const cmpBtn = target.closest('.ai-code-cmp-btn') as HTMLElement | null;
  if (cmpBtn) {
    e.preventDefault();
    e.stopPropagation();
    const msgIdxRaw = cmpBtn.getAttribute('data-ai-cmp-msg');
    const msgIdx = msgIdxRaw != null ? parseInt(msgIdxRaw, 10) : -1;
    const codeText = findCodeElementForCodeActionTarget(cmpBtn)?.textContent ?? '';
    const m = msgIdx >= 0 ? messages.value[msgIdx] : undefined;
    if (m && codeText.trim()) {
      if (compareSet.value.length >= maxCompareSides) {
        setExportToast(t.value.msgCtxCompareSetFull || 'Compare set is full (max 4)', 2400);
        return;
      }
      compareRegions.mark(msgIdx, codeText);
      /* Flash the button to confirm the add. */
      cmpBtn.classList.add('ai-code-cmp-btn-added');
      setTimeout(() => cmpBtn.classList.remove('ai-code-cmp-btn-added'), 1000);
    }
    return;
  }
  if (target.dataset.ide === 'true') {
    const codeEl = findCodeElementForCodeActionTarget(target);
    const code = codeEl?.textContent || '';
    options.openCodeInIde?.({ code, language: getCodeLanguage(codeEl) });
    return;
  }
  /* F4: fold toggle - 折叠 / 展开长代码块 */
  if (target.dataset.foldToggle === 'true') {
    const wrap = target.closest('.ai-code-wrap');
    if (wrap) {
      const isFolded = wrap.classList.toggle('ai-code-folded');
      updateCodeFoldToggleState(
        target,
        isFolded,
        t.value.codeFold || 'Fold',
        t.value.codeUnfold || 'Unfold',
      );
    }
    return;
  }
  if (target.dataset.copy === 'true') {
    const code = findCodeElementForCodeActionTarget(target)?.textContent || '';
    navigator.clipboard
      .writeText(code)
      .then(() => {
        updateCodeActionButtonLabel(target, t.value.codeCopied);
        pendingTimers.push(
          window.setTimeout(() => {
            updateCodeActionButtonLabel(target, t.value.copyCode);
          }, 1500),
        );
      })
      .catch(() => {
        updateCodeCopyFailureState(target, t.value.diagnosticsCopyFailed || 'Copy failed');
        pendingTimers.push(
          window.setTimeout(() => {
            updateCodeActionButtonLabel(target, t.value.copyCode);
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

useCommandPaletteRegistration({
  cmdPalette,
  commands: commandRegistry.commandPaletteExtraCommands,
});

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
      panelRef.value
        ?.querySelector<HTMLTextAreaElement>('textarea')
        ?.focus({ preventScroll: true });
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
  modelCapabilities,
  pendingImageDataList,
  pendingImageThumbs,
  options,
  t,
  streamWithFallback,
  fetchUrlPreview,
  extractHttpUrls,
  isProbablyDirectImageUrl,
  firstNonImageHttpUrl,
  preferHttpsImageUrlWhenPageIsSecure,
  clearPendingImage,
  notify: setExportToast,
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

const { trapFocus, onEscKeydown } = useAssistantKeyboard({
  options,
  panelRef,
  wrapperRef,
  isOpen,
  fabHidden,
  mode,
  keyboardHelpOpen,
  personalizeOpen,
  diagnosticsOpen,
  sessionsDrawerOpen,
  inlineTranslatePopover,
  msgCtxMenu,
  fabCtxMenu,
  matchesScreenCaptureShortcut,
  captureScreenIntoPendingImage,
  clearMessages,
  startNewSession,
  toggleBatchExportMenu,
  toggleMemoryPanel,
  closeInlineTranslatePopover,
  closeMsgCtxMenu,
  closeFabCtxMenu,
});

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
    const savedBaseUrl = localStorage.getItem(connectionBaseUrlStorageKey);
    const savedToken = localStorage.getItem(connectionTokenStorageKey);
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

<style src="./styles/00-fonts.css"></style>
<style src="./styles/00-enterprise-tokens.css"></style>
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
<style src="./styles/13-containment.css"></style>
<style src="./styles/99-enterprise-overhaul.css"></style>
