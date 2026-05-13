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
  micStart: string;
  micStop: string;
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
  /** D2: 设置齿轮按钮 tooltip，例如 "设置" / "Settings" */
  settingsLabel: string;
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
}
