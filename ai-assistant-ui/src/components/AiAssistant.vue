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
      :class="{
        'ai-fab-dragging': fabDragging,
        'ai-fab-drop-active': fabDrop.dropActive.value,
      }"
      :style="fabLayoutStyle"
      :aria-label="t.fabOpen"
      @pointerdown="onFabPointerDown"
      @contextmenu.prevent="onFabContextMenu"
      @dragenter.prevent="fabDrop.onFabDragEnter"
      @dragover.prevent="fabDrop.onFabDragOver"
      @dragleave.prevent="fabDrop.onFabDragLeave"
      @drop.prevent="fabDrop.onFabDrop"
    >
      <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <!-- Sparkle / star with 4 rays — modern AI assistant icon -->
        <path
          d="M12 2.5l1.95 5.85a1 1 0 0 0 .7.7L20.5 11l-5.85 1.95a1 1 0 0 0-.7.7L12 19.5l-1.95-5.85a1 1 0 0 0-.7-.7L3.5 11l5.85-1.95a1 1 0 0 0 .7-.7L12 2.5z"
        />
      </svg>
      <span
        v-if="fabDrop.dropActive.value"
        class="ai-fab-drop-hint"
        role="status"
        aria-live="polite"
      >
        {{ t.kbDropFabHint || 'Drop to add to KB' }}
      </span>
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

        <div
          v-if="messages.length > 0"
          class="ai-chat-search"
          :class="{
            'ai-chat-search-active': !!debouncedSearchQuery.trim(),
            'ai-chat-search-empty': !!debouncedSearchQuery.trim() && totalMatches === 0,
          }"
        >
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
          <span
            v-if="searchCountLabel"
            class="ai-search-count"
            :class="{ 'ai-search-count-empty': totalMatches === 0 }"
          >
            {{ searchCountLabel }}
          </span>
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
          <div v-if="debouncedSearchQuery.trim()" class="ai-search-options">
            <button
              type="button"
              class="ai-search-options-toggle"
              :class="{ active: searchCaseSensitive || searchWholeWord || searchRegex }"
              :title="t.settingsLabel || 'Search options'"
              :aria-label="t.settingsLabel || 'Search options'"
              :aria-expanded="searchOptionsOpen ? 'true' : 'false'"
              @click="searchOptionsOpen = !searchOptionsOpen"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                aria-hidden="true"
              >
                <path d="M4 7h16" />
                <path d="M7 12h10" />
                <path d="M10 17h4" />
              </svg>
            </button>
            <div v-if="searchOptionsOpen" class="ai-search-options-menu" role="menu">
              <button
                type="button"
                role="menuitemcheckbox"
                class="ai-search-mode"
                :class="{ active: searchCaseSensitive }"
                :title="t.searchCaseSensitive || 'Case sensitive (Aa)'"
                :aria-checked="searchCaseSensitive ? 'true' : 'false'"
                @click="searchCaseSensitive = !searchCaseSensitive"
              >
                <span aria-hidden="true">Aa</span>
                <span>{{ t.searchCaseSensitive || 'Case sensitive' }}</span>
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                class="ai-search-mode"
                :class="{ active: searchWholeWord }"
                :title="t.searchWholeWord || 'Whole word (\\b)'"
                :aria-checked="searchWholeWord ? 'true' : 'false'"
                @click="searchWholeWord = !searchWholeWord"
              >
                <span aria-hidden="true">W</span>
                <span>{{ t.searchWholeWord || 'Whole word' }}</span>
              </button>
              <button
                type="button"
                role="menuitemcheckbox"
                class="ai-search-mode"
                :class="{ active: searchRegex }"
                :title="t.searchRegex || 'Regular expression (.*?)'"
                :aria-checked="searchRegex ? 'true' : 'false'"
                @click="searchRegex = !searchRegex"
              >
                <span aria-hidden="true">.*</span>
                <span>{{ t.searchRegex || 'Regular expression' }}</span>
              </button>
            </div>
          </div>
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
            <div v-if="mode === 'chat'" class="ai-empty-skills" :aria-label="t.skillStripLabel">
              <button
                v-for="skill in defaultSkills"
                :key="skill.label"
                type="button"
                class="ai-empty-skill"
                :data-skill-tone="skill.tone"
                @click="applyEmptySkill(skill)"
              >
                <span class="ai-empty-skill-icon" aria-hidden="true">{{ skill.icon }}</span>
                <span>{{ skill.label }}</span>
              </button>
            </div>
            <div class="ai-empty-starters">
              <button
                v-for="starter in emptyStarterCards"
                :key="starter.title"
                type="button"
                class="ai-empty-starter"
                :data-starter-tone="starter.tone"
                @click="applyEmptyStarter(starter)"
              >
                <span class="ai-empty-starter-icon" aria-hidden="true">{{ starter.icon }}</span>
                <span class="ai-empty-starter-body">
                  <span class="ai-empty-starter-text">{{ starter.title }}</span>
                  <span class="ai-empty-starter-desc">{{ starter.desc }}</span>
                </span>
              </button>
            </div>
            <div class="ai-empty-capabilities" aria-label="Assistant capabilities">
              <span
                v-for="hint in emptyCapabilityHints"
                :key="hint.label"
                class="ai-empty-capability"
              >
                <span class="ai-empty-capability-icon" aria-hidden="true">{{ hint.icon }}</span>
                <span>{{ hint.label }}</span>
              </span>
            </div>
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
            :aria-label="'↓'"
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
      :compare-set-full="compareSet.length >= MAX_COMPARE_SIDES"
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

    <!-- K43: KB target picker. Teleported, fixed bottom-right, auto-dismiss
         after 12s. K48: 1-9 picks the n-th KB, 0/N creates new, Esc closes. -->
    <Teleport to="body">
      <Transition name="ai-modal">
        <div
          v-if="kbPickerVisible"
          class="ai-kb-picker-shell"
          :class="{ 'ai-dark': isDark }"
          role="dialog"
          aria-modal="false"
          tabindex="-1"
          :aria-label="t.kbPickerTitle || 'Pick destination knowledge base'"
          @keydown="onKbPickerKeydown"
        >
          <div class="ai-kb-picker-card" role="menu">
            <div class="ai-kb-picker-head">
              <span class="ai-kb-picker-title">
                {{ t.kbPickerTitle || 'Ingest into…' }}
              </span>
              <span class="ai-kb-picker-meta">
                {{
                  (t.kbPickerSubtitle || '{count} file(s)').replace(
                    '{count}',
                    String(kbPickerFiles.length),
                  )
                }}
              </span>
              <button
                type="button"
                class="ai-kb-picker-close"
                :aria-label="t.closePanel"
                @click="closeKbPicker"
              >
                &times;
              </button>
            </div>
            <ul class="ai-kb-picker-list">
              <li v-for="(kb, idx) in knowledgeBase.bases.value" :key="kb.id">
                <button
                  type="button"
                  class="ai-kb-picker-item"
                  role="menuitem"
                  @click="onKbPickerPick(kb.id)"
                >
                  <span v-if="idx < 9" class="ai-kb-picker-item-shortcut">
                    {{ idx + 1 }}
                  </span>
                  <span class="ai-kb-picker-item-name">{{ kb.name }}</span>
                  <span class="ai-kb-picker-item-meta">
                    {{ kb.docs.length }}
                    {{ t.kbPickerDocsUnit || 'docs' }}
                  </span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  class="ai-kb-picker-item ai-kb-picker-item-create"
                  role="menuitem"
                  @click="onKbPickerCreateNew"
                >
                  <span class="ai-kb-picker-item-shortcut">N</span>
                  <span class="ai-kb-picker-item-name">
                    + {{ t.kbPickerNewKb || 'New knowledge base' }}
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </div>
      </Transition>
    </Teleport>

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

    <!-- L1: Post-fill toast with Undo. Teleports to body so it sits above the
         page even when the assistant panel is closed. Auto-dismisses after 5s
         inside the composable. -->
    <Teleport v-if="formAutoFillEnabled" to="body">
      <Transition name="ai-modal">
        <div
          v-if="formAutoFill.toastVisible.value && formAutoFill.toastSummary.value"
          class="ai-form-fill-toast"
          :class="{ 'ai-dark': isDark }"
          role="status"
          aria-live="polite"
        >
          <span class="ai-form-fill-toast-text">{{ formAutoFillToastText }}</span>
          <button
            v-if="formAutoFill.lastFillRecords.value.length > 0"
            type="button"
            class="ai-form-fill-toast-btn"
            @click="onFormAutoFillUndo"
          >
            {{ t.formFillToastUndo || 'Undo' }}
          </button>
          <button
            type="button"
            class="ai-form-fill-toast-close"
            :aria-label="t.closePanel"
            @click="onFormAutoFillToastDismiss"
          >
            &times;
          </button>
        </div>
      </Transition>
    </Teleport>

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
  onBeforeUnmount,
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
import {
  useAssistantDiagnostics,
  writeClipboardText,
} from '../composables/useAssistantDiagnostics';
import { useAssistantKeyboard } from '../composables/useAssistantKeyboard';
import { usePromptTemplateLibrary } from '../composables/usePromptTemplateLibrary';
import { useMermaidRenderer } from '../composables/useMermaidRenderer';
import { useMessageVirtualScroll } from '../composables/useMessageVirtualScroll';
import { useCommandPalette } from '../composables/useCommandPalette';
import type { CommandItem } from '../types/command-palette';
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
import { uploadFile, fetchUrlPreview, fetchPromptTemplates } from '../utils/api';
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
import { useFormAutoFill } from '../composables/useFormAutoFill';
const FormAutoFillDialog = defineAsyncComponent(() => import('./FormAutoFillDialog.vue'));
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
 * Doubao-style quick toggles state. Pure UI-state by default; host can
 * react to `onToggleDeepThink` / `onToggleWebSearch` options to wire to a
 * backend flag (model param, tool plugin, etc.). Persisted across panel
 * opens within the same session — but intentionally NOT to localStorage,
 * because semantics depend on the host's wiring.
 */
const deepThinkEnabled = ref(false);
const webSearchEnabled = ref(false);

/**
 * Doubao-style skill chip strip data. Lives above the starter cards in the
 * empty state and offers single-tap shortcuts into common AI capabilities.
 * Each chip carries a tone token consumed by `99-enterprise-overhaul.css`
 * to vary background/foreground colour without per-chip overrides in the
 * template.
 *
 * Click contract: fills the input box with `prompt` (no auto-send), then
 * focuses the textarea so the user can finish the sentence.
 */
interface EmptySkillChip {
  icon: string;
  label: string;
  prompt: string;
  tone: 'violet' | 'cyan' | 'amber' | 'emerald' | 'rose' | 'sky';
}
const defaultSkills = computed<EmptySkillChip[]>(() => {
  const loc = options.locale ?? 'en';
  const lib: Record<string, EmptySkillChip[]> = {
    zh: [
      { icon: '✏️', label: '写作', tone: 'violet', prompt: '帮我写一段关于 ' },
      { icon: '🌐', label: '翻译', tone: 'cyan', prompt: '把这段翻译成中文：' },
      { icon: '📊', label: '分析', tone: 'sky', prompt: '帮我分析这份数据：' },
      { icon: '💡', label: '灵感', tone: 'amber', prompt: '给我一些关于 ' },
      { icon: '💻', label: '编程', tone: 'emerald', prompt: '帮我写一段实现 ' },
      { icon: '📝', label: '总结', tone: 'rose', prompt: '帮我总结一下：' },
    ],
    en: [
      { icon: '✏️', label: 'Write', tone: 'violet', prompt: 'Help me write a draft about ' },
      { icon: '🌐', label: 'Translate', tone: 'cyan', prompt: 'Translate this into English: ' },
      { icon: '📊', label: 'Analyze', tone: 'sky', prompt: 'Help me analyze this data: ' },
      { icon: '💡', label: 'Ideas', tone: 'amber', prompt: 'Give me some ideas about ' },
      { icon: '💻', label: 'Code', tone: 'emerald', prompt: 'Write code to ' },
      { icon: '📝', label: 'Summary', tone: 'rose', prompt: 'Summarize this for me: ' },
    ],
    ja: [
      { icon: '✏️', label: '文章', tone: 'violet', prompt: '〜について書いてください：' },
      { icon: '🌐', label: '翻訳', tone: 'cyan', prompt: 'この文を翻訳してください：' },
      { icon: '📊', label: '分析', tone: 'sky', prompt: 'このデータを分析してください：' },
      { icon: '💡', label: 'アイデア', tone: 'amber', prompt: '〜に関するアイデアを：' },
      { icon: '💻', label: 'コード', tone: 'emerald', prompt: '〜を実装するコードを：' },
      { icon: '📝', label: '要約', tone: 'rose', prompt: '要約してください：' },
    ],
    ko: [
      { icon: '✏️', label: '글쓰기', tone: 'violet', prompt: '〜에 대해 써 주세요: ' },
      { icon: '🌐', label: '번역', tone: 'cyan', prompt: '이 문장을 번역해 주세요: ' },
      { icon: '📊', label: '분석', tone: 'sky', prompt: '이 데이터를 분석해 주세요: ' },
      { icon: '💡', label: '아이디어', tone: 'amber', prompt: '〜에 대한 아이디어: ' },
      { icon: '💻', label: '코드', tone: 'emerald', prompt: '〜를 구현하는 코드: ' },
      { icon: '📝', label: '요약', tone: 'rose', prompt: '요약해 주세요: ' },
    ],
  };
  return lib[loc] ?? lib.en;
});

/**
 * Rich starter cards (Doubao-style: icon + title + 1-line description).
 * Replaces the legacy `defaultStarters` string-with-emoji-prefix format.
 * `prompt` is what lands in the textarea on click; `desc` is purely UI.
 */
interface EmptyStarterCard {
  icon: string;
  title: string;
  desc: string;
  prompt: string;
  tone: 'violet' | 'cyan' | 'amber' | 'emerald' | 'rose' | 'sky';
}
const defaultStartersRich = computed<EmptyStarterCard[]>(() => {
  const loc = options.locale ?? 'en';
  const lib: Record<string, EmptyStarterCard[]> = {
    zh: [
      {
        icon: '💼',
        title: '写一封商务邮件',
        desc: '正式得体、要点清晰',
        prompt: '帮我写一封商务邮件，主题是：',
        tone: 'violet',
      },
      {
        icon: '🧠',
        title: '解释一个概念',
        desc: '通俗易懂、举例说明',
        prompt: '用通俗的话解释一下什么是 ',
        tone: 'cyan',
      },
      {
        icon: '🔤',
        title: '翻译成英文',
        desc: '保留语气，自然地道',
        prompt: '把这段中文翻译成自然的英文：',
        tone: 'amber',
      },
      {
        icon: '🎬',
        title: '推荐 3 本科幻小说',
        desc: '附简短理由和难度',
        prompt: '给我推荐 3 本好看的科幻小说，并简要说明每本的看点。',
        tone: 'emerald',
      },
    ],
    en: [
      {
        icon: '💼',
        title: 'Write a business email',
        desc: 'Polished tone, clear points',
        prompt: 'Help me draft a business email about ',
        tone: 'violet',
      },
      {
        icon: '🧠',
        title: 'Explain a concept',
        desc: 'Plain language, with examples',
        prompt: 'Explain in plain words what ',
        tone: 'cyan',
      },
      {
        icon: '🔤',
        title: 'Translate to Chinese',
        desc: 'Natural, tone-preserving',
        prompt: 'Translate the following into natural Chinese: ',
        tone: 'amber',
      },
      {
        icon: '🎬',
        title: 'Recommend 3 sci-fi novels',
        desc: 'With short reasons',
        prompt: 'Recommend 3 great sci-fi novels with a one-line reason for each.',
        tone: 'emerald',
      },
    ],
    ja: [
      {
        icon: '💼',
        title: 'ビジネスメール作成',
        desc: '丁寧で要点が明確',
        prompt: '以下の件についてビジネスメールを書いてください：',
        tone: 'violet',
      },
      {
        icon: '🧠',
        title: '概念を説明',
        desc: 'わかりやすく、例つき',
        prompt: '次の概念をわかりやすく説明してください：',
        tone: 'cyan',
      },
      {
        icon: '🔤',
        title: '英語に翻訳',
        desc: '自然でニュアンスを保持',
        prompt: 'この文章を自然な英語に翻訳してください：',
        tone: 'amber',
      },
      {
        icon: '🎬',
        title: 'SF小説を3冊',
        desc: '短い理由つき',
        prompt: 'おすすめのSF小説を3冊、短い理由とともに教えてください。',
        tone: 'emerald',
      },
    ],
    ko: [
      {
        icon: '💼',
        title: '비즈니스 이메일',
        desc: '정중하고 요점이 명확',
        prompt: '다음 주제로 비즈니스 이메일을 작성해 주세요: ',
        tone: 'violet',
      },
      {
        icon: '🧠',
        title: '개념 설명',
        desc: '쉽게, 예시와 함께',
        prompt: '다음 개념을 쉽게 설명해 주세요: ',
        tone: 'cyan',
      },
      {
        icon: '🔤',
        title: '영어로 번역',
        desc: '자연스럽고 어조 유지',
        prompt: '다음 문장을 자연스러운 영어로 번역해 주세요: ',
        tone: 'amber',
      },
      {
        icon: '🎬',
        title: 'SF 소설 3권',
        desc: '간단한 이유와 함께',
        prompt: '좋은 SF 소설 3권을 간단한 이유와 함께 추천해 주세요.',
        tone: 'emerald',
      },
    ],
  };
  return lib[loc] ?? lib.en;
});

const modeStarterCards = computed<EmptyStarterCard[]>(() => {
  const loc = options.locale ?? 'en';
  if (mode.value === 'translate') {
    return loc === 'zh'
      ? [
          {
            icon: '中',
            title: '翻译成中文',
            desc: '保留语气和格式',
            prompt: '把下面内容翻译成中文：',
            tone: 'cyan',
          },
          {
            icon: 'EN',
            title: '翻译成英文',
            desc: '自然地道表达',
            prompt: '把下面内容翻译成自然英文：',
            tone: 'violet',
          },
          {
            icon: '术',
            title: '术语对齐',
            desc: '适合技术/业务文本',
            prompt: '翻译下面内容，并保持专业术语一致：',
            tone: 'emerald',
          },
        ]
      : [
          {
            icon: 'EN',
            title: 'Translate to English',
            desc: 'Natural and concise',
            prompt: 'Translate this into natural English: ',
            tone: 'violet',
          },
          {
            icon: 'ZH',
            title: 'Translate to Chinese',
            desc: 'Keep tone and formatting',
            prompt: 'Translate this into Chinese: ',
            tone: 'cyan',
          },
          {
            icon: 'TM',
            title: 'Keep terminology',
            desc: 'For technical content',
            prompt: 'Translate this and keep terminology consistent: ',
            tone: 'emerald',
          },
        ];
  }
  if (mode.value === 'summarize') {
    return loc === 'zh'
      ? [
          {
            icon: '摘',
            title: '总结长文',
            desc: '提炼核心结论',
            prompt: '请总结下面内容的核心要点：',
            tone: 'rose',
          },
          {
            icon: '点',
            title: '提炼要点',
            desc: '输出清晰条目',
            prompt: '请把下面内容提炼成 5 条要点：',
            tone: 'sky',
          },
          {
            icon: '办',
            title: '整理待办',
            desc: '会议/记录转行动项',
            prompt: '请从下面内容中整理待办事项和负责人：',
            tone: 'amber',
          },
        ]
      : [
          {
            icon: 'SUM',
            title: 'Summarize long text',
            desc: 'Extract the core points',
            prompt: 'Summarize the key points of this content: ',
            tone: 'rose',
          },
          {
            icon: '5',
            title: 'Five bullets',
            desc: 'Make it skimmable',
            prompt: 'Extract this into 5 concise bullet points: ',
            tone: 'sky',
          },
          {
            icon: 'TODO',
            title: 'Action items',
            desc: 'Meeting notes to tasks',
            prompt: 'Extract action items, owners, and deadlines from this: ',
            tone: 'amber',
          },
        ];
  }
  return defaultStartersRich.value;
});

const emptyStarterCards = computed(() => modeStarterCards.value);

const emptyCapabilityHints = computed(() => {
  const loc = options.locale ?? 'en';
  const lib: Record<string, { icon: string; label: string }[]> = {
    zh: [
      { icon: '⌘', label: '页面上下文' },
      { icon: '📎', label: '文件摘要' },
      { icon: '🎙', label: '语音输入' },
    ],
    en: [
      { icon: '⌘', label: 'Page context' },
      { icon: '📎', label: 'File summaries' },
      { icon: '🎙', label: 'Voice input' },
    ],
    ja: [
      { icon: '⌘', label: 'ページ文脈' },
      { icon: '📎', label: 'ファイル要約' },
      { icon: '🎙', label: '音声入力' },
    ],
    ko: [
      { icon: '⌘', label: '페이지 컨텍스트' },
      { icon: '📎', label: '파일 요약' },
      { icon: '🎙', label: '음성 입력' },
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
  modelListMessage,
  diagnosticsModelEndpoint,
  diagnosticsTokenText,
  diagnosticsStatusMessage,
  modelStatusKind,
  modelStatusText,
  modelSourceText,
  modelHintText,
  diagnosticsRemedyKind,
  refreshChatModels,
  runModelDiagnostics,
  toggleDiagnostics,
  syncConnectionInputsFromOptions,
  useDefaultBaseUrlForDiagnostics,
  handleSendBlockedAction,
  testConnectionConfig,
  saveConnectionConfig,
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
const QUICK_INGEST_KB_NAME = 'Quick Ingest';
function findOrCreateQuickIngestKb() {
  const existing = knowledgeBase.bases.value.find((b) => b.name === QUICK_INGEST_KB_NAME);
  if (existing) return existing;
  return knowledgeBase.createBase(QUICK_INGEST_KB_NAME);
}
function ingestIntoKb(kbId: string, files: File[]) {
  const kb = knowledgeBase.bases.value.find((b) => b.id === kbId);
  if (!kb) return;
  for (const f of files) {
    knowledgeBase.addDoc(kb.id, f);
  }
  const label = t.value.kbDropIngested
    ? t.value.kbDropIngested.replace('{count}', String(files.length)).replace('{name}', kb.name)
    : `Added ${files.length} file(s) to ${kb.name}`;
  setExportToast(label, 3200);
}

/* K43: target picker state. When dropped while multiple KBs exist, show
 * a small floating panel near the FAB so the user picks the destination
 * instead of defaulting silently. */
const kbPickerVisible = ref(false);
const kbPickerFiles = ref<File[]>([]);
const KB_PICKER_AUTO_DISMISS_MS = 12000;
let kbPickerDismissTimer: ReturnType<typeof setTimeout> | null = null;
function openKbPicker(files: File[]) {
  kbPickerFiles.value = files;
  kbPickerVisible.value = true;
  if (kbPickerDismissTimer != null) clearTimeout(kbPickerDismissTimer);
  kbPickerDismissTimer = setTimeout(() => {
    kbPickerVisible.value = false;
    kbPickerFiles.value = [];
    kbPickerDismissTimer = null;
  }, KB_PICKER_AUTO_DISMISS_MS);
  /* K48: focus the shell so keydown shortcuts (1-9 / N / Esc) bind. */
  void nextTick(() => {
    const shell = document.querySelector('.ai-kb-picker-shell') as HTMLElement | null;
    shell?.focus();
  });
}
function closeKbPicker() {
  kbPickerVisible.value = false;
  kbPickerFiles.value = [];
  if (kbPickerDismissTimer != null) {
    clearTimeout(kbPickerDismissTimer);
    kbPickerDismissTimer = null;
  }
}
function onKbPickerPick(kbId: string) {
  const files = kbPickerFiles.value;
  closeKbPicker();
  if (files.length === 0) return;
  ingestIntoKb(kbId, files);
}
function onKbPickerCreateNew() {
  const files = kbPickerFiles.value;
  closeKbPicker();
  if (files.length === 0) return;
  const name = (t.value.kbDropNewKbName || 'New KB').toString();
  const kb = knowledgeBase.createBase(name);
  for (const f of files) knowledgeBase.addDoc(kb.id, f);
  const label = t.value.kbDropIngested
    ? t.value.kbDropIngested.replace('{count}', String(files.length)).replace('{name}', kb.name)
    : `Added ${files.length} file(s) to ${kb.name}`;
  setExportToast(label, 3200);
}
/**
 * K48: KB picker keyboard shortcuts.
 *   1-9 — pick the n-th KB row (0-indexed)
 *   N / n / 0 — trigger "+ New knowledge base"
 *   Escape — close without picking
 */
function onKbPickerKeydown(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    closeKbPicker();
    return;
  }
  if (e.key === 'n' || e.key === 'N' || e.key === '0') {
    e.preventDefault();
    onKbPickerCreateNew();
    return;
  }
  const n = Number(e.key);
  if (Number.isInteger(n) && n >= 1 && n <= 9) {
    const kb = knowledgeBase.bases.value[n - 1];
    if (kb) {
      e.preventDefault();
      onKbPickerPick(kb.id);
    }
  }
}
onBeforeUnmount(() => {
  if (kbPickerDismissTimer != null) {
    clearTimeout(kbPickerDismissTimer);
    kbPickerDismissTimer = null;
  }
});

function ingestFilesIntoKb(files: File[]) {
  if (!files.length) return;
  const bases = knowledgeBase.bases.value;
  /* 0 KBs or only Quick Ingest -> auto-ingest (K38 behaviour). */
  if (bases.length === 0 || (bases.length === 1 && bases[0]?.name === QUICK_INGEST_KB_NAME)) {
    const kb = findOrCreateQuickIngestKb();
    ingestIntoKb(kb.id, files);
    return;
  }
  /* 2+ KBs -> let the user choose (K43). */
  openKbPicker(files);
}
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
  if (open) tts.refreshVoices();
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
 * 演进自 K40 (left + right) → K42 单一 `compareSet: CompareSide[]` (1-4)：
 * - 1 条 = "Add to Compare set" 后槽位为 A，等待第二条
 * - 2 条 = K40 原 UX，pair tab 只有一个，差异 dialog 立即可用
 * - 3-4 条 = pair tab N(N-1)/2 个（3 sides=3 tab，4 sides=6 tab）
 *
 * 槽位顺序代表添加顺序（不是 msgIndex 顺序）— 让用户掌控 base 是哪条。
 * Swap 在 dialog 内部按 pair 局部 swap。
 */
interface CompareSide {
  msgIndex: number;
  content: string;
  label: string;
}
const MAX_COMPARE_SIDES = 4;
const compareSet = ref<CompareSide[]>([]);
const compareDialogOpen = ref(false);
function buildCompareLabel(
  idx: number,
  role: string,
  slotLetter: string,
  isSelection = false,
): string {
  const fmt = t.value.compareDialogMsgLabel || 'Msg #{idx} ({role})';
  const base = fmt.replace('{idx}', String(idx + 1)).replace('{role}', role);
  const selSuffix = isSelection ? ` · ${t.value.compareDialogSelectionTag || 'selection'}` : '';
  return `[${slotLetter}] ${base}${selSuffix}`;
}
function reLabelCompareSet() {
  compareSet.value = compareSet.value.map((side, slotIdx) => {
    const baseRegex = /^\[[A-Z]\]\s/;
    const stripped = side.label.replace(baseRegex, '');
    const letter = String.fromCharCode(65 + slotIdx);
    return { ...side, label: `[${letter}] ${stripped}` };
  });
}
function isInCompareSet(idx: number): boolean {
  return compareSet.value.some((s) => s.msgIndex === idx);
}
function compareSlotOf(idx: number): number {
  return compareSet.value.findIndex((s) => s.msgIndex === idx);
}
function onCompareMark() {
  const idx = msgCtxMenu.value.index;
  if (idx < 0) return;
  const selection = (msgCtxMenu.value.selectionText ?? '').trim();
  closeMsgCtxMenu();
  const m = messages.value[idx];
  if (!m) return;

  /* K45: selection mode — always pushes a NEW slot (no toggle), so the
   * user can mark multiple regions of the same message. Toggle/unmark
   * still works for whole-msg slots via the no-selection path. */
  if (selection) {
    if (compareSet.value.length >= MAX_COMPARE_SIDES) return;
    const letter = String.fromCharCode(65 + compareSet.value.length);
    compareSet.value.push({
      msgIndex: idx,
      content: selection,
      label: buildCompareLabel(idx, m.role, letter, true),
    });
    return;
  }

  const existingSlot = compareSlotOf(idx);
  if (existingSlot >= 0) {
    compareSet.value.splice(existingSlot, 1);
    reLabelCompareSet();
    return;
  }
  if (compareSet.value.length >= MAX_COMPARE_SIDES) {
    return;
  }
  const letter = String.fromCharCode(65 + compareSet.value.length);
  compareSet.value.push({
    msgIndex: idx,
    content: m.contentArchive ?? m.content ?? '',
    label: buildCompareLabel(idx, m.role, letter),
  });
}
function onCompareWith() {
  const idx = msgCtxMenu.value.index;
  const selection = (msgCtxMenu.value.selectionText ?? '').trim();
  closeMsgCtxMenu();
  if (idx < 0 || compareSet.value.length === 0) return;
  /* K45: with selection -> always add (allows same msg multiple regions);
   * without -> add whole msg only if not already in set. */
  const shouldAdd = selection ? true : !isInCompareSet(idx);
  if (shouldAdd && compareSet.value.length < MAX_COMPARE_SIDES) {
    const m = messages.value[idx];
    if (m) {
      const letter = String.fromCharCode(65 + compareSet.value.length);
      const content = selection ? selection : (m.contentArchive ?? m.content ?? '');
      compareSet.value.push({
        msgIndex: idx,
        content,
        label: buildCompareLabel(idx, m.role, letter, !!selection),
      });
    }
  }
  if (compareSet.value.length >= 2) {
    compareDialogOpen.value = true;
  }
}
function onCompareSwapPair(slotA: number, slotB: number) {
  const arr = compareSet.value;
  if (slotA < 0 || slotB < 0 || slotA >= arr.length || slotB >= arr.length) return;
  const tmp = arr[slotA];
  arr[slotA] = arr[slotB]!;
  arr[slotB] = tmp!;
  reLabelCompareSet();
}
function onCompareClearSet() {
  compareSet.value = [];
  compareDialogOpen.value = false;
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

function onVirtualMeasureHeight(index: number, height: number) {
  const delta = virtualScroll.updateMeasuredHeight(index, height);
  const slice = virtualScroll.window.value;
  const el = bodyRef.value;
  if (!delta || !slice.enabled || !el || index >= slice.startIndex) return;
  el.scrollTop += delta;
  virtualScrollTop.value = el.scrollTop;
}

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
    ...(formAutoFillEnabled.value
      ? [
          {
            name: '/fill',
            get description() {
              return t.value.slashCmdFillDesc || 'Auto-fill form fields from clipboard pairs';
            },
            icon: 'M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 12h8v2H8zm0 4h5v2H8z',
            action: () => {
              const buf = input.value.replace(/^\/fill\b\s*/i, '').trim();
              void formAutoFill.triggerFromText(buf);
              return true;
            },
          },
        ]
      : []),
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
    text = text.split(`{{${k}}}`).join(val);
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
  /* K46: code-block "Add to Compare" hover button. Match the button OR its
   * inner SVG/path (clicks on the icon fragment bubble up). closest finds
   * the actual <button>. */
  const cmpBtn = target.closest('.ai-code-cmp-btn') as HTMLElement | null;
  if (cmpBtn) {
    e.preventDefault();
    e.stopPropagation();
    const msgIdxRaw = cmpBtn.getAttribute('data-ai-cmp-msg');
    const msgIdx = msgIdxRaw != null ? parseInt(msgIdxRaw, 10) : -1;
    const pre = cmpBtn.closest('pre');
    const codeText = pre?.querySelector('code')?.textContent ?? '';
    const m = msgIdx >= 0 ? messages.value[msgIdx] : undefined;
    if (m && codeText.trim()) {
      if (compareSet.value.length >= MAX_COMPARE_SIDES) {
        setExportToast(t.value.msgCtxCompareSetFull || 'Compare set is full (max 4)', 2400);
        return;
      }
      const letter = String.fromCharCode(65 + compareSet.value.length);
      compareSet.value.push({
        msgIndex: msgIdx,
        content: codeText,
        label: buildCompareLabel(msgIdx, m.role, letter, true),
      });
      /* Flash the button to confirm the add. */
      cmpBtn.classList.add('ai-code-cmp-btn-added');
      setTimeout(() => cmpBtn.classList.remove('ai-code-cmp-btn-added'), 1000);
    }
    return;
  }
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
