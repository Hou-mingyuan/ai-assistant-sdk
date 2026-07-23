export type Locale = 'en' | 'zh' | 'ja' | 'ko';

export interface I18nMessages {
  greeting: string;
  translate: string;
  summarize: string;
  chat: string;
  placeholder: Record<'translate' | 'summarize' | 'chat', string>;
  newline: string;
  uploadFile: string;
  /** 输入区发送按钮 */
  send: string;
  clear: string;
  title: string;
  /** 悬浮球右键：贴边 */
  fabDockLeft: string;
  fabDockRight: string;
  fabUndock: string;
  /** 悬浮球右键：隐藏直至刷新页面 */
  fabHideUntilRefresh: string;
  /** 代码块复制按钮 */
  copyCode: string;
  codeCopied: string;
  noResponse: string;
  /** 错误前缀，后接技术信息 */
  errorPrefix: string;
  serviceBusyError: string;
  serviceUnavailableError: string;
  serviceGenericError: string;
  /** 读屏：流式生成中 */
  replying: string;
  /** 消息气泡旁相对时间：刚刚 */
  justNow: string;
  /** 折叠早期消息：{n} 为数量 */
  showEarlierTemplate: string;
  closePanel: string;
  /** 标题栏：放大对话面板 */
  expandPanel: string;
  /** 标题栏：恢复默认面板尺寸 */
  shrinkPanel: string;
  /** 右下角：拖拽调整面板大小 */
  resizePanel: string;
  /** 消息区：滚动到底部按钮 */
  scrollToBottom: string;
  /** 助手气泡：链接预览自动插图前的说明 */
  urlPreviewImagesNote: string;
  /** 悬浮球 aria-label */
  fabOpen: string;
  /** 导出会话 */
  export: string;
  exportMarkdown: string;
  exportCsv: string;
  /** 打开打印对话框，另存为 PDF */
  exportPrintPdf: string;
  exportRoleUser: string;
  exportRoleAssistant: string;
  exportAssistantOnlyMd: string;
  exportCopyMarkdown: string;
  exportJson: string;
  searchMessages: string;
  /** 对话模式：个性化（system prompt） */
  personalizeTitle: string;
  personalizePlaceholder: string;
  personalizeDone: string;
  /** 字数统计，占位 {cur} {max} */
  personalizeCharCount: string;
  systemPromptPlaceholder: string;
  /** 对话模型下拉读屏 */
  modelLabel: string;
  /** 模型列表未加载或为空时的占位 */
  modelsListEmpty: string;
  modelsLoadFailed: string;
  modelsNetworkError: string;
  modelsUnauthorized: string;
  modelsRateLimited: string;
  modelsServerError: string;
  modelStatusChecking: string;
  modelStatusUnavailable: string;
  modelStatusUnconfigured: string;
  modelSearchPlaceholder: string;
  modelDefaultBadge: string;
  modelNoMatches: string;
  modelGroupOther: string;
  modelCapabilityText: string;
  modelCapabilityVision: string;
  modelCapabilityTools: string;
  modelCapabilityLongContext: string;
  modelCapabilityReasoning: string;
  modelCapabilityAudio: string;
  modelCapabilityVideo: string;
  modelCapabilitySpeech: string;
  modelCapabilityImageGeneration: string;
  modelCapabilityEmbedding: string;
  modelCapabilityRerank: string;
  modelImageRiskWarning: string;
  modelSwitchToVision: string;
  inputNearLimitWarning: string;
  inputOverLimitWarning: string;
  sendUnavailableNoBackend: string;
  diagnosticsTitle: string;
  diagnosticsRefresh: string;
  diagnosticsCopy: string;
  diagnosticsCopied: string;
  diagnosticsCopyFailed: string;
  diagnosticsClose: string;
  diagnosticsBaseUrl: string;
  diagnosticsModelEndpoint: string;
  diagnosticsToken: string;
  diagnosticsTokenConfigured: string;
  diagnosticsTokenMissing: string;
  diagnosticsSelectedModel: string;
  diagnosticsNoSelectedModel: string;
  diagnosticsModelSource: string;
  diagnosticsModelSourceSelected: string;
  diagnosticsModelSourceDefault: string;
  diagnosticsModelSourceUnavailable: string;
  diagnosticsModelHintReady: string;
  diagnosticsModelHintCheck: string;
  diagnosticsModelHintNoBaseUrl: string;
  diagnosticsRemedyNoBaseUrlTitle: string;
  diagnosticsRemedyNoBaseUrlText: string;
  diagnosticsRemedyUnauthorizedTitle: string;
  diagnosticsRemedyUnauthorizedText: string;
  diagnosticsRemedyRateLimitedTitle: string;
  diagnosticsRemedyRateLimitedText: string;
  diagnosticsRemedyServerTitle: string;
  diagnosticsRemedyServerText: string;
  diagnosticsRemedyNetworkTitle: string;
  diagnosticsRemedyNetworkText: string;
  diagnosticsRemedyGenericTitle: string;
  diagnosticsRemedyGenericText: string;
  diagnosticsUseDefaultBaseUrl: string;
  diagnosticsFocusToken: string;
  diagnosticsClearToken: string;
  diagnosticsAvailableModels: string;
  diagnosticsLastChecked: string;
  diagnosticsNeverChecked: string;
  diagnosticsStatus: string;
  diagnosticsStatusReady: string;
  diagnosticsStatusChecking: string;
  diagnosticsStatusNoBaseUrl: string;
  diagnosticsLastError: string;
  diagnosticsNoError: string;
  connectionConfigTitle: string;
  connectionConfigBaseUrlPlaceholder: string;
  connectionConfigTokenPlaceholder: string;
  connectionConfigPersist: string;
  connectionConfigTest: string;
  connectionConfigSave: string;
  connectionConfigSaved: string;
  connectionConfigTested: string;
  connectionConfigFailed: string;
  connectionConfigDefaultApplied: string;
  openInIde: string;
  exportServerXlsx: string;
  exportServerDocx: string;
  exportServerPdf: string;
  selectModeToggle: string;
  translateTo: string;
  /** 助手气泡右键 */
  msgCtxCopy: string;
  msgCtxDelete: string;
  msgCtxTranslate: string;
  /** 需先选中气泡内文字 */
  msgCtxNeedSelection: string;
  msgCtxExportDocx: string;
  msgCtxExportPdf: string;
  msgCtxExportXlsx: string;
  /** 服务端导出：请求进行中 */
  exportPreparing: string;
  /** 服务端导出：HTTP 已通，正在读 body */
  exportReceiving: string;
  /** 服务端导出：即将触发浏览器下载 */
  exportStartingDownload: string;
  /** 服务端导出：已开始下载（保存框即将出现） */
  exportDownloadStarted: string;
  /** 页面选中文本浮层：发起对话 */
  pageSelAsk: string;
  dropFileHere: string;
  ttsPlay: string;
  ttsStop: string;
  thumbsUp: string;
  thumbsDown: string;
  /** K24: MessageReactionBar emoji labels (optional, fallback to default Chinese text). */
  reactLove?: string;
  reactFavorite?: string;
  reactPin?: string;
  /** K25: label shown next to the ColorThemeSwitcher in PersonalizeDialog. */
  personalizeThemeLabel?: string;
  /** K37: AudioOutput section in PersonalizeDialog. */
  personalizeAudioLabel?: string;
  personalizeAudioVoice?: string;
  personalizeAudioVoiceAuto?: string;
  personalizeAudioRate?: string;
  personalizeAudioAutoRead?: string;
  providerConfigTitle?: string;
  providerConfigPermissionRequired?: string;
  providerConfigPresetMinimax?: string;
  providerConfigPresetOpenai?: string;
  providerConfigPresetDeepseek?: string;
  providerConfigDetectModels?: string;
  providerConfigProvider?: string;
  providerConfigProviderPlaceholder?: string;
  providerConfigBaseUrl?: string;
  providerConfigBaseUrlPlaceholder?: string;
  providerConfigApiKey?: string;
  providerConfigApiKeyPlaceholder?: string;
  providerConfigDefaultModel?: string;
  providerConfigDefaultModelPlaceholder?: string;
  providerConfigAllowedModels?: string;
  providerConfigAllowedModelsPlaceholder?: string;
  providerConfigWarmup?: string;
  providerConfigSaveAndRefresh?: string;
  /** K38: drag-and-drop file onto FAB to ingest into KB. */
  kbDropFabHint?: string;
  /** {count} = file count, {name} = KB name */
  kbDropIngested?: string;
  /** K43: KB picker popover when multiple KBs exist. */
  kbPickerTitle?: string;
  /** {count} = file count */
  kbPickerSubtitle?: string;
  kbPickerNewKb?: string;
  kbPickerDocsUnit?: string;
  kbDropNewKbName?: string;
  /** K39: cross-session message search results badge inside SessionsDrawer. */
  sessionsDrawerMatchesCount?: string;
  /** K40: CompareRegionsDialog labels + MessageContextMenu compare actions. */
  msgCtxCompareMark?: string;
  msgCtxCompareUnmark?: string;
  msgCtxCompareWith?: string;
  compareDialogTitle?: string;
  compareDialogEmpty?: string;
  compareDialogHideEqual?: string;
  compareDialogSwap?: string;
  compareDialogLeftDefault?: string;
  compareDialogRightDefault?: string;
  /** Placeholders: {idx} = 1-based, {role} = 'user'|'assistant' */
  compareDialogMsgLabel?: string;
  /** K42: N-way comparison additions. */
  msgCtxCompareOpenSet?: string;
  msgCtxCompareSetFull?: string;
  compareDialogPairTabsAria?: string;
  compareDialogClearSet?: string;
  /** Placeholders: {a} = letter A/B/.., {b} = letter */
  compareDialogSwapPair?: string;
  /** K45: selection-based comparison actions. */
  msgCtxCompareMarkSelection?: string;
  msgCtxCompareWithSelection?: string;
  /** K45: small tag suffix shown in slot label when content came from a text selection. */
  compareDialogSelectionTag?: string;
  /** K47: N-column all-columns view in CompareRegionsDialog. */
  compareDialogAllColumns?: string;
  compareDialogAllColumnsHint?: string;
  micStart: string;
  micStop: string;
  voiceLoopOn: string;
  voiceLoopOff: string;
  newSession: string;
  msgCtxFork: string;
  msgCtxEdit: string;
  batchExport: string;
  stopGenerate: string;
  regenerate: string;
  searchPrev: string;
  searchNext: string;
  pendingImage: string;
  removeImage: string;
  editImage: string;
  annotateImage: string;
  annotationRect: string;
  annotationArrow: string;
  annotationText: string;
  annotationUndo: string;
  annotationClear: string;
  annotationDone: string;
  annotationCancel: string;
  annotationTextPrompt: string;
  visionModelWarning: string;
  screenCapture: string;
  screenCaptureUnsupported: string;
  screenCaptureFailed: string;
  chatSessions: string;
  closeSession: string;
  retryError: string;
  soundOn: string;
  soundOff: string;
  ctrlEnterMode: string;
  enterMode: string;
  thinkingLabel: string;
  thinkingLive: string;
  memoryLabel: string;
  memoryAddPlaceholder: string;
  memoryEmpty: string;
  memoryClearAll: string;
  toolResult: string;
  kbLabel: string;
  kbAddPlaceholder: string;
  kbEmpty: string;
  kbUploadDoc: string;
  pluginsLabel: string;
  pluginsEmpty: string;
  /** 多模型并行对比 */
  compareTitle: string;
  compareSelectModels: string;
  compareModelsHint: string;
  compareEmpty: string;
  compareHint: string;
  startCompare: string;
  stopAll: string;
  /** 斜杠命令面板里的描述 */
  slashCmdCompareDesc: string;
  /** Prompt 模板库 */
  tplDialogTitle: string;
  tplCreate: string;
  tplEmpty: string;
  tplLabel: string;
  tplBody: string;
  tplBodyHint: string;
  tplVariables: string;
  tplVarLabelPlaceholder: string;
  tplVarDefaultPlaceholder: string;
  tplFillVars: string;
  tplPreview: string;
  tplSave: string;
  tplDelete: string;
  tplUse: string;
  tplSelectHint: string;
  tplPresetBadge: string;
  tplUserBadge: string;
  tplNewDefaultLabel: string;
  tplNewDefaultBody: string;
  slashCmdTemplateDesc: string;
  /** TTS 暂停/继续 */
  ttsPause: string;
  ttsResume: string;
  /** 暗色/亮色一键切换按钮 tooltip */
  themeToggleToDark: string;
  themeToggleToLight: string;
  /** 图片 lightbox 关闭按钮 */
  imageLightboxClose: string;
  /** D4: 页面上下文徽章 - 已开启时显示的简短文案，例如 "上下文" / "Context" */
  pageContextOn: string;
  /** D4: 页面上下文徽章 - 已关闭时显示的文案，例如 "上下文已关" / "Context off" */
  pageContextOff: string;
  /** D4: 页面上下文徽章 - 已开启时的 hover tooltip */
  pageContextOnTooltip: string;
  /** D4: 页面上下文徽章 - 已关闭时的 hover tooltip */
  pageContextOffTooltip: string;
  /** D5: 流式生成进度的字数单位，例如 "字" / "chars" */
  streamProgressChars: string;
  /** E2: TTFT (Time To First Token) 缩写标签，例如 "首字" / "TTFT" */
  streamTtftLabel: string;
  streamStageConnecting?: string;
  streamStageWaitingFirstToken?: string;
  streamStageGenerating?: string;
  streamStageSearchingWeb?: string;
  /** Assistant response metadata labels. */
  responseMetaEffectiveModel?: string;
  responseMetaVision?: string;
  responseMetaVisionRoute?: string;
  responseMetaFallback?: string;
  visionEmptyResponse?: string;
  responseMetaElapsed?: string;
  responseMetaTtft?: string;
  responseMetaRetried?: string;
  responseMetaWebSearch?: string;
  responseMetaWebSearchFallback?: string;
  responseMetaWebSearchResult?: string;
  responseMetaWebSearchResults?: string;
  responseMetaWebSearchSource?: string;
  responseMetaWebSearchReferences?: string;
  /** Source citation card actions (Perplexity-style hover icon row). */
  citationCopy?: string;
  citationPin?: string;
  citationUnpin?: string;
  citationHide?: string;
  /** Labels for the collapsible "more details" toggle that hides secondary meta pills by default. */
  responseMetaMoreLabel?: string;
  responseMetaHideLabel?: string;
  /** D2: 设置齿轮按钮 tooltip，例如 "设置" / "Settings" */
  settingsLabel: string;
  /** Header settings menu common actions group label. */
  headerSectionCommon: string;
  /** Header settings menu management actions group label. */
  headerSectionManage: string;
  /** E1: Keyboard shortcuts dialog title */
  kbdTitle: string;
  /** E1: Group headings */
  kbdGroupGlobal: string;
  kbdGroupInput: string;
  kbdGroupSlash: string;
  /** E1: Each shortcut description (all optional with fallback in template) */
  kbdOpenHelp: string;
  kbdClearMessages: string;
  kbdNewSession: string;
  kbdFocusSearch: string;
  kbdToggleExport: string;
  kbdScreenCapture: string;
  kbdToggleMemory: string;
  kbdCloseOverlay: string;
  kbdSendEnter: string;
  kbdSendCtrlEnter: string;
  kbdBold: string;
  kbdItalic: string;
  kbdCode: string;
  kbdLink: string;
  kbdOpenSlash: string;
  kbdNavigateSlash: string;
  kbdSelectSlash: string;
  kbdCancelSlash: string;
  /** E1: 底部提示 */
  kbdFootTip: string;
  /** F4: 代码块折叠按钮文案（折叠态显示 "Unfold"，展开态显示 "Fold"） */
  codeFold: string;
  codeUnfold: string;
  /** G1: 历史会话抽屉 */
  sessionsDrawerTitle: string;
  sessionsDrawerSearch: string;
  sessionsDrawerEmpty: string;
  sessionsDrawerMsgUnit: string;
  sessionsDrawerToday: string;
  sessionsDrawerYesterday: string;
  sessionsDrawerThisWeek: string;
  sessionsDrawerOlder: string;
  /** H5: pinned 会话分组标题 */
  sessionsDrawerPinned: string;
  /** H5: pin / rename 按钮 aria 文案 */
  sessionsDrawerPin: string;
  sessionsDrawerRename: string;
  /** H6: 搜索 三模式 toggle tooltip */
  searchCaseSensitive: string;
  searchWholeWord: string;
  searchRegex: string;
  /**
   * L1 (Form Auto-Fill, Phase 1)
   * 从剪贴板把 "A: 234 B: 1234" 等键值对自动填入页面表单。全部 optional 以
   * 兼容旧的 i18n 文件；组件内有英文兜底。
   */
  /** Dialog title for the auto-fill preview */
  formFillDialogTitle?: string;
  /** "{matched} of {total} pairs matched" — both placeholders are required */
  formFillSummaryTemplate?: string;
  /** Inline hint when LLM fallback is enabled and some pairs are still unmatched */
  formFillLlmHint?: string;
  /** Master checkbox label in the dialog toolbar */
  formFillSelectAll?: string;
  /** Row checkbox aria-label in the auto-fill preview — `{n}` = 1-based row number */
  formFillSelectRowTemplate?: string;
  /** Table column headers */
  formFillColField?: string;
  formFillColCurrent?: string;
  formFillColNew?: string;
  formFillColConfidence?: string;
  /** Placeholder when a target field has no current value */
  formFillEmpty?: string;
  /** Manual-pick dropdown's "no field" option */
  formFillFieldNone?: string;
  /** Empty-state row when input had no parseable pairs */
  formFillNoPairs?: string;
  /** Cancel button */
  formFillCancel?: string;
  /** Confirm button — `{n}` = selected count */
  formFillConfirmTemplate?: string;
  /** Slash command description for `/fill` */
  slashCmdFillDesc?: string;
  /** Post-fill toast template — `{filled}` and `{failed}` required */
  formFillToastTemplate?: string;
  /** Undo button on the toast */
  formFillToastUndo?: string;
  /** Banner shown on paste-detect — `{n}` = parsed pair count */
  formFillPasteBannerTemplate?: string;
  formFillPasteBannerFill?: string;
  formFillPasteBannerDismiss?: string;
  /** Phase 2 table mode summary chip — `{dataRows}` `{cols}` `{formRows}` */
  formFillTableSummary?: string;
  /** Phase 2 truncation warning — `{n}` = skipped data rows */
  formFillTableTruncated?: string;
  /**
   * Doubao-style empty-state quick-skill strip aria label. Optional with
   * inline fallback in template ("快捷技能" / "Quick skills").
   */
  skillStripLabel?: string;
  /** Markdown toolbar action labels. */
  markdownBold?: string;
  markdownItalic?: string;
  markdownCode?: string;
  markdownCodeBlock?: string;
  markdownLink?: string;
  markdownList?: string;
  /** Empty-state collapsed starter task launcher labels. */
  emptyTaskLauncher?: string;
  emptyTaskLauncherClose?: string;
  emptyStarterSection?: string;
  emptyCapabilitySection?: string;
  emptyTemplateSection?: string;
  /**
   * Doubao-style quick-toggle row above input. The host can opt into
   * deep-think / web-search by listening to `toggleDeepThink` and
   * `toggleWebSearch` and applying the desired side effects (model param,
   * tool plugin, etc). All optional with inline fallback in template.
   */
  deepThinkLabel?: string;
  deepThinkOn?: string;
  deepThinkOff?: string;
  webSearchLabel?: string;
  webSearchOn?: string;
  webSearchOff?: string;
  fastReplyLabel?: string;
  fastReplyOn?: string;
  fastReplyOff?: string;
}
