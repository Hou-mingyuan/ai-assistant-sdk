export type Locale = 'en' | 'zh'

export interface I18nMessages {
  greeting: string
  translate: string
  summarize: string
  chat: string
  placeholder: Record<'translate' | 'summarize' | 'chat', string>
  newline: string
  uploadFile: string
  /** 输入区发送按钮 */
  send: string
  clear: string
  title: string
  /** 悬浮球右键：贴边 */
  fabDockLeft: string
  fabDockRight: string
  fabUndock: string
  /** 悬浮球右键：隐藏直至刷新页面 */
  fabHideUntilRefresh: string
  /** 代码块复制按钮 */
  copyCode: string
  codeCopied: string
  noResponse: string
  /** 错误前缀，后接技术信息 */
  errorPrefix: string
  /** 读屏：流式生成中 */
  replying: string
  /** 折叠早期消息：{n} 为数量 */
  showEarlierTemplate: string
  closePanel: string
  /** 标题栏：放大对话面板 */
  expandPanel: string
  /** 标题栏：恢复默认面板尺寸 */
  shrinkPanel: string
  /** 右下角：拖拽调整面板大小 */
  resizePanel: string
  /** 助手气泡：链接预览自动插图前的说明 */
  urlPreviewImagesNote: string
  /** 悬浮球 aria-label */
  fabOpen: string
  /** 导出会话 */
  export: string
  exportMarkdown: string
  exportCsv: string
  /** 打开打印对话框，另存为 PDF */
  exportPrintPdf: string
  exportRoleUser: string
  exportRoleAssistant: string
  exportAssistantOnlyMd: string
  exportCopyMarkdown: string
  exportJson: string
  searchMessages: string
  /** 对话模式：个性化（system prompt） */
  personalizeTitle: string
  personalizePlaceholder: string
  personalizeDone: string
  /** 字数统计，占位 {cur} {max} */
  personalizeCharCount: string
  systemPromptPlaceholder: string
  /** 对话模型下拉读屏 */
  modelLabel: string
  /** 模型列表未加载或为空时的占位 */
  modelsListEmpty: string
  openInIde: string
  exportServerXlsx: string
  exportServerDocx: string
  exportServerPdf: string
  /** 助手气泡右键 */
  msgCtxCopy: string
  msgCtxDelete: string
  msgCtxTranslate: string
  /** 需先选中气泡内文字 */
  msgCtxNeedSelection: string
  msgCtxExportDocx: string
  msgCtxExportPdf: string
  msgCtxExportXlsx: string
  /** 服务端导出：请求进行中 */
  exportPreparing: string
  /** 服务端导出：HTTP 已通，正在读 body */
  exportReceiving: string
  /** 服务端导出：即将触发浏览器下载 */
  exportStartingDownload: string
  /** 服务端导出：已开始下载（保存框即将出现） */
  exportDownloadStarted: string
}

const messages: Record<Locale, I18nMessages> = {
  en: {
    greeting: '👋 Hi! I can help you:',
    translate: '🌐 Translate',
    summarize: '📝 Summarize',
    chat: '💬 Chat',
    placeholder: {
      translate: 'Paste text to translate...',
      summarize: 'Paste text to summarize...',
      chat: 'Ask me anything...',
    },
    newline: 'Shift+Enter for newline',
    uploadFile: 'Upload file',
    send: 'Send',
    clear: 'Clear',
    title: 'AI Assistant',
    fabDockLeft: 'Dock to left edge',
    fabDockRight: 'Dock to right edge',
    fabUndock: 'Float (no dock)',
    fabHideUntilRefresh: 'Hide until page refresh',
    copyCode: 'Copy',
    codeCopied: '✓',
    noResponse: 'No response received',
    errorPrefix: 'Error',
    replying: 'Assistant is replying…',
    showEarlierTemplate: '{n} older messages hidden — tap to show all',
    closePanel: 'Close',
    expandPanel: 'Fullscreen',
    shrinkPanel: 'Exit fullscreen',
    resizePanel: 'Drag to resize',
    urlPreviewImagesNote:
      'The images below were automatically extracted from the linked page for visual reference only; they are not ranked or verified by the model.',
    fabOpen: 'Open AI Assistant',
    export: 'Export',
    exportMarkdown: 'Markdown (.md)',
    exportCsv: 'Table (.csv for Excel)',
    exportPrintPdf: 'Print / Save as PDF…',
    exportRoleUser: 'User',
    exportRoleAssistant: 'Assistant',
    exportAssistantOnlyMd: 'Assistant replies only (.md)',
    exportCopyMarkdown: 'Copy as Markdown',
    exportJson: 'Download JSON',
    searchMessages: 'Search in conversation…',
    personalizeTitle: 'Personalize',
    personalizePlaceholder: 'Describe how the assistant should behave (system prompt)…',
    personalizeDone: 'Done',
    personalizeCharCount: '{cur} / {max} characters',
    systemPromptPlaceholder: 'Optional. Applies to chat only; saved in this browser.',
    modelLabel: 'Model',
    modelsListEmpty: 'No models (check GET …/models)',
    openInIde: 'IDE',
    exportServerXlsx: 'Server: Excel (.xlsx)',
    exportServerDocx: 'Server: Word (.docx)',
    exportServerPdf: 'Server: PDF (.pdf)',
    msgCtxCopy: 'Copy selection',
    msgCtxDelete: 'Delete this reply',
    msgCtxTranslate: 'Translate selection',
    msgCtxNeedSelection: 'Select text in the reply first',
    msgCtxExportDocx: 'Export as Word…',
    msgCtxExportPdf: 'Export as PDF…',
    msgCtxExportXlsx: 'Export as Excel…',
    exportPreparing: 'Preparing export — please wait (do not click again)…',
    exportReceiving: 'Receiving file from server…',
    exportStartingDownload: 'Starting download — watch for the save dialog…',
    exportDownloadStarted: 'Download started — check your save dialog',
  },
  zh: {
    greeting: '👋 你好！我可以帮你：',
    translate: '🌐 翻译',
    summarize: '📝 摘要',
    chat: '💬 对话',
    placeholder: {
      translate: '粘贴要翻译的文字...',
      summarize: '粘贴要摘要的文字...',
      chat: '随便问我什么...',
    },
    newline: 'Shift+Enter 换行',
    uploadFile: '上传文件',
    send: '发送',
    clear: '清空',
    title: 'AI 助手',
    fabDockLeft: '贴靠左侧收起',
    fabDockRight: '贴靠右侧收起',
    fabUndock: '悬浮（不贴边）',
    fabHideUntilRefresh: '隐藏（刷新页面后恢复）',
    copyCode: '复制',
    codeCopied: '✓',
    noResponse: '未收到回复',
    errorPrefix: '错误',
    replying: '助手正在回复…',
    showEarlierTemplate: '已折叠更早的 {n} 条消息，点击查看全部',
    closePanel: '关闭',
    expandPanel: '全屏',
    shrinkPanel: '退出全屏',
    resizePanel: '拖动右下角调整大小',
    urlPreviewImagesNote:
      '以下图片来自链接页面的自动提取，仅作对照参考，未经模型排序或验证。',
    fabOpen: '打开 AI 助手',
    export: '导出',
    exportMarkdown: 'Markdown（.md）',
    exportCsv: '表格（.csv，可用 Excel 打开）',
    exportPrintPdf: '打印 / 另存为 PDF…',
    exportRoleUser: '用户',
    exportRoleAssistant: '助手',
    exportAssistantOnlyMd: '仅助手回复（.md）',
    exportCopyMarkdown: '复制为 Markdown',
    exportJson: '下载 JSON',
    searchMessages: '搜索会话…',
    personalizeTitle: '个性化',
    personalizePlaceholder: '描述助手角色与风格（system prompt）…',
    personalizeDone: '完成',
    personalizeCharCount: '已输入 {cur} / 最多 {max} 字',
    systemPromptPlaceholder: '可选，仅「对话」模式生效；保存在本浏览器。',
    modelLabel: '模型',
    modelsListEmpty: '无模型列表（请检查 GET …/models）',
    openInIde: 'IDE',
    exportServerXlsx: '服务端：Excel（.xlsx）',
    exportServerDocx: '服务端：Word（.docx）',
    exportServerPdf: '服务端：PDF（.pdf）',
    msgCtxCopy: '复制选中',
    msgCtxDelete: '删除该条',
    msgCtxTranslate: '翻译选中',
    msgCtxNeedSelection: '请先在助手回复里选中要用的文字',
    msgCtxExportDocx: '导出 Word…',
    msgCtxExportPdf: '导出 PDF…',
    msgCtxExportXlsx: '导出 Excel…',
    exportPreparing: '正在准备导出，请稍候（请勿重复点击）…',
    exportReceiving: '服务器已响应，正在接收文件…',
    exportStartingDownload: '准备开始下载，请留意保存提示…',
    exportDownloadStarted: '已开始下载，请关注浏览器保存提示',
  },
}

export function getMessages(locale: Locale): I18nMessages {
  return messages[locale] || messages.en
}
