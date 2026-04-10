export type Locale = 'en' | 'zh' | 'ja' | 'ko'

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
  /** 页面选中文本浮层：发起对话 */
  pageSelAsk: string
  dropFileHere: string
  ttsPlay: string
  ttsStop: string
  thumbsUp: string
  thumbsDown: string
  micStart: string
  micStop: string
  newSession: string
  msgCtxFork: string
  msgCtxEdit: string
  batchExport: string
  stopGenerate: string
  regenerate: string
}

const messages: Record<string, I18nMessages> = {
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
    pageSelAsk: 'Ask AI',
    dropFileHere: 'Drop file here',
    ttsPlay: 'Read aloud',
    ttsStop: 'Stop reading',
    thumbsUp: 'Helpful',
    thumbsDown: 'Not helpful',
    micStart: 'Voice input',
    micStop: 'Stop recording',
    newSession: 'New chat',
    msgCtxFork: 'Fork from here',
    msgCtxEdit: 'Edit & resend',
    batchExport: 'Export all sessions',
    stopGenerate: 'Stop',
    regenerate: 'Regenerate',
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
    pageSelAsk: '问 AI',
    dropFileHere: '拖放文件到此处',
    ttsPlay: '朗读',
    ttsStop: '停止朗读',
    thumbsUp: '有帮助',
    thumbsDown: '没帮助',
    micStart: '语音输入',
    micStop: '停止录音',
    newSession: '新对话',
    msgCtxFork: '从此处分叉',
    msgCtxEdit: '编辑并重发',
    batchExport: '导出全部会话',
    stopGenerate: '停止生成',
    regenerate: '重新生成',
  },
}

const ja = {
  ...messages.en,
  greeting: '👋 こんにちは！お手伝いします：',
  translate: '🌐 翻訳',
  summarize: '📝 要約',
  chat: '💬 チャット',
  placeholder: { translate: '翻訳するテキストを貼り付け...', summarize: '要約するテキストを貼り付け...', chat: '何でも聞いてください...' },
  newline: 'Shift+Enterで改行',
  uploadFile: 'ファイルをアップロード',
  send: '送信',
  clear: 'クリア',
  title: 'AIアシスタント',
  fabDockLeft: '左端に固定',
  fabDockRight: '右端に固定',
  fabUndock: 'フロート（固定解除）',
  fabHideUntilRefresh: '非表示（ページ更新で復帰）',
  copyCode: 'コピー',
  codeCopied: '✓',
  noResponse: '応答がありません',
  errorPrefix: 'エラー',
  replying: 'アシスタントが返信中…',
  showEarlierTemplate: '{n}件の古いメッセージを非表示 — タップで全表示',
  closePanel: '閉じる',
  expandPanel: '全画面',
  shrinkPanel: '全画面解除',
  resizePanel: 'ドラッグしてリサイズ',
  urlPreviewImagesNote: '以下の画像はリンクページから自動抽出されたもので、参考用です。モデルによる検証はされていません。',
  fabOpen: 'AIアシスタントを開く',
  export: 'エクスポート',
  exportMarkdown: 'Markdown（.md）',
  exportCsv: 'テーブル（.csv）',
  exportPrintPdf: '印刷 / PDFとして保存…',
  exportRoleUser: 'ユーザー',
  exportRoleAssistant: 'アシスタント',
  exportAssistantOnlyMd: 'アシスタント回答のみ（.md）',
  exportCopyMarkdown: 'Markdownとしてコピー',
  exportJson: 'JSONをダウンロード',
  searchMessages: '会話を検索…',
  personalizeTitle: 'カスタマイズ',
  personalizePlaceholder: 'アシスタントの振る舞いを記述（システムプロンプト）…',
  personalizeDone: '完了',
  personalizeCharCount: '{cur} / {max} 文字',
  systemPromptPlaceholder: '任意。チャットモードのみ有効、このブラウザに保存。',
  modelLabel: 'モデル',
  modelsListEmpty: 'モデルなし（GET …/models を確認）',
  openInIde: 'IDE',
  exportServerXlsx: 'サーバー: Excel（.xlsx）',
  exportServerDocx: 'サーバー: Word（.docx）',
  exportServerPdf: 'サーバー: PDF（.pdf）',
  msgCtxCopy: '選択をコピー',
  msgCtxDelete: 'この返信を削除',
  msgCtxTranslate: '選択を翻訳',
  msgCtxNeedSelection: '先に返信内のテキストを選択してください',
  msgCtxExportDocx: 'Wordとしてエクスポート…',
  msgCtxExportPdf: 'PDFとしてエクスポート…',
  msgCtxExportXlsx: 'Excelとしてエクスポート…',
  exportPreparing: 'エクスポート準備中…（再クリック不要）',
  exportReceiving: 'サーバーからファイルを受信中…',
  exportStartingDownload: 'ダウンロード開始中…',
  exportDownloadStarted: 'ダウンロードが開始されました',
  pageSelAsk: 'AIに聞く',
  dropFileHere: 'ここにファイルをドロップ',
  ttsPlay: '読み上げ',
  ttsStop: '停止',
  thumbsUp: '役に立った',
  thumbsDown: '役に立たなかった',
  micStart: '音声入力',
  micStop: '録音停止',
  newSession: '新しいチャット',
  msgCtxFork: 'ここから分岐',
  msgCtxEdit: '編集して再送信',
  batchExport: '全セッションをエクスポート',
  stopGenerate: '停止',
  regenerate: '再生成',
}

const ko = {
  ...messages.en,
  greeting: '👋 안녕하세요! 도와드리겠습니다:',
  translate: '🌐 번역',
  summarize: '📝 요약',
  chat: '💬 채팅',
  placeholder: { translate: '번역할 텍스트를 붙여넣기...', summarize: '요약할 텍스트를 붙여넣기...', chat: '무엇이든 물어보세요...' },
  newline: 'Shift+Enter로 줄바꿈',
  uploadFile: '파일 업로드',
  send: '전송',
  clear: '지우기',
  title: 'AI 어시스턴트',
  fabDockLeft: '왼쪽에 고정',
  fabDockRight: '오른쪽에 고정',
  fabUndock: '플로팅 (고정 해제)',
  fabHideUntilRefresh: '숨기기 (새로고침 시 복원)',
  copyCode: '복사',
  codeCopied: '✓',
  noResponse: '응답을 받지 못했습니다',
  errorPrefix: '오류',
  replying: '어시스턴트가 응답 중…',
  showEarlierTemplate: '{n}개의 이전 메시지 숨김 — 탭하여 모두 표시',
  closePanel: '닫기',
  expandPanel: '전체화면',
  shrinkPanel: '전체화면 해제',
  resizePanel: '드래그하여 크기 조절',
  urlPreviewImagesNote: '아래 이미지는 링크된 페이지에서 자동 추출된 것으로 참고용입니다. 모델의 검증을 거치지 않았습니다.',
  fabOpen: 'AI 어시스턴트 열기',
  export: '내보내기',
  exportMarkdown: 'Markdown (.md)',
  exportCsv: '표 (.csv)',
  exportPrintPdf: '인쇄 / PDF로 저장…',
  exportRoleUser: '사용자',
  exportRoleAssistant: '어시스턴트',
  exportAssistantOnlyMd: '어시스턴트 답변만 (.md)',
  exportCopyMarkdown: 'Markdown으로 복사',
  exportJson: 'JSON 다운로드',
  searchMessages: '대화 검색…',
  personalizeTitle: '맞춤 설정',
  personalizePlaceholder: '어시스턴트의 역할과 스타일을 설명 (시스템 프롬프트)…',
  personalizeDone: '완료',
  personalizeCharCount: '{cur} / {max} 자',
  systemPromptPlaceholder: '선택 사항. 채팅 모드에만 적용, 이 브라우저에 저장됩니다.',
  modelLabel: '모델',
  modelsListEmpty: '모델 없음 (GET …/models 확인)',
  openInIde: 'IDE',
  exportServerXlsx: '서버: Excel (.xlsx)',
  exportServerDocx: '서버: Word (.docx)',
  exportServerPdf: '서버: PDF (.pdf)',
  msgCtxCopy: '선택 복사',
  msgCtxDelete: '이 답변 삭제',
  msgCtxTranslate: '선택 번역',
  msgCtxNeedSelection: '먼저 답변 내 텍스트를 선택하세요',
  msgCtxExportDocx: 'Word로 내보내기…',
  msgCtxExportPdf: 'PDF로 내보내기…',
  msgCtxExportXlsx: 'Excel로 내보내기…',
  exportPreparing: '내보내기 준비 중… (다시 클릭하지 마세요)',
  exportReceiving: '서버에서 파일 수신 중…',
  exportStartingDownload: '다운로드 시작 중…',
  exportDownloadStarted: '다운로드가 시작되었습니다',
  pageSelAsk: 'AI에게 질문',
  dropFileHere: '여기에 파일을 놓으세요',
  ttsPlay: '읽어주기',
  ttsStop: '중지',
  thumbsUp: '도움이 됐어요',
  thumbsDown: '도움이 안 됐어요',
  micStart: '음성 입력',
  micStop: '녹음 중지',
  newSession: '새 채팅',
  msgCtxFork: '여기서 분기',
  msgCtxEdit: '편집 후 재전송',
  batchExport: '전체 세션 내보내기',
  stopGenerate: '중지',
  regenerate: '재생성',
}

messages.ja = ja satisfies I18nMessages
messages.ko = ko satisfies I18nMessages

export function getMessages(locale: Locale): I18nMessages {
  return (messages as Record<string, I18nMessages>)[locale] || messages.en
}
