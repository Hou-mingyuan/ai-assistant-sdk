import type { App } from 'vue';
import { createApp } from 'vue';
import AiAssistant from './components/AiAssistant.vue';
import type { PageContextBlock } from './utils/pageContextDom';
import type { FormAutoFillOptions } from './composables/useFormAutoFill';

export interface AiAssistantOptions {
  baseUrl?: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'light' | 'dark' | 'auto';
  /** 阅读主题：限宽正文 + 衬线标题 + 暖白表面 + 升字号（默认关闭）。 */
  readingMode?: boolean;
  /** Artifacts/Canvas：把成品（代码/文档/HTML/图）放到侧边画布展示。默认开启，设 false 关闭。 */
  artifactsEnabled?: boolean;
  persistHistory?: boolean;
  /** 是否持久化悬浮球位置与贴边状态（localStorage），默认 true */
  persistFabPosition?: boolean;
  locale?: 'en' | 'zh' | 'ja' | 'ko';
  accessToken?: string;
  /** Optional tenant partition sent as the validated `X-Tenant-Id` header. */
  tenantId?: string;
  /** Admin-only token for runtime provider configuration; falls back to accessToken when omitted. */
  adminToken?: string;
  /** 与 @error 事件并行，便于接入监控/日志 */
  onAssistantError?: (payload: { source: string; message: string }) => void;
  /**
   * K24: invoked when the user clicks an emoji on the MessageReactionBar
   * under an assistant message. `toggled` is true when the same emoji is
   * clicked again (clearing the selection).
   */
  onReaction?: (payload: { messageIndex: number; emoji: string; toggled: boolean }) => void;
  /** 对话模式下可选：快捷短语（点击填入输入框，不自动发送） */
  quickPrompts?: { label: string; text: string }[];
  /**
   * Prompt 模板：支持 `{{var}}` 占位符，点击后渲染小表单填充变量再发送。
   * 无占位符的模板行为等同 quickPrompts。
   */
  promptTemplates?: {
    label: string;
    template: string;
    variables?: { name: string; label: string; default?: string }[];
  }[];
  /**
   * 若提供，代码块旁显示「IDE」按钮，由宿主实现（如 vscode://、cursor:// 或自定义协议）。
   */
  openCodeInIde?: (payload: { code: string; language?: string }) => void;
  /**
   * 全局键盘快捷键，按下后切换面板开关。默认 'Ctrl+/' (Windows/Linux) 或 'Meta+/' (Mac)。
   * 设为 false 可禁用。
   */
  toggleShortcut?: string | false;
  /**
   * 为 true 时，`app.use` 后在 `document.body` 末尾自动再挂载一棵 Vue 应用实例（仅含助手）。
   * 无需在根组件模板里写 `<AiAssistant />`；若已手动放置组件，请勿开启，以免重复。
   */
  autoMountToBody?: boolean;
  /**
   * @deprecated 已无效果。单条导出请使用助手气泡右键菜单；保留本字段仅为兼容旧配置。
   */
  enableSessionExport?: boolean;
  /**
   * 会话在内存中最多保留的消息条数（含 user/assistant），超出则丢弃最前面的消息，降低长页面 OOM 风险。
   * 默认 200；设为 0 表示不截断（长会话慎用）。
   */
  maxMessagesInMemory?: number;
  /**
   * 所有消息 content 累计字符上限（仅从头部丢弃整句），与条数上限同时生效。
   * 默认 4_000_000；0 表示不限制。
   */
  maxTotalCharsInMemory?: number;
  /**
   * 用户单次发送的正文最大字符（超出截断并追加省略标记）。默认 120000；0 不限制。
   */
  maxUserMessageChars?: number;
  /**
   * 对话模式是否在面板内展示「自定义 system prompt」编辑区（localStorage 持久化）。
   * 关闭后仍可用服务端 `ai-assistant.system-prompt`；默认 true。
   */
  showSystemPromptEditor?: boolean;
  /** 自定义角色说明存本地的 key，默认 `ai-assistant-chat-system-prompt` */
  systemPromptStorageKey?: string;
  /**
   * 「个性化」输入框最大字符（`maxlength`），默认 4000，与多数后端 `client-system-prompt-max-chars` 对齐；最大夹紧 16000。
   */
  systemPromptMaxInputChars?: number;
  /** 为 false 时隐藏对话模式下的模型下拉 */
  showModelPicker?: boolean;
  /** 记住所选模型的 localStorage key，默认 `ai-assistant-selected-model` */
  selectedModelStorageKey?: string;
  /**
   * Host-provided model name patterns that should be treated as vision-capable
   * when the user sends image attachments. Built-in patterns cover common
   * OpenAI / Claude / Gemini / Qwen-VL style names; this extends them.
   */
  visionCapableModels?: RegExp[];
  /**
   * DOM 选择器列表，每个条目匹配页面上的一个区块，发送时自动采集其文本作为上下文
   * 注入 LLM 系统提示，让助手"看到"当前页面内容。
   */
  pageContextBlocks?: PageContextBlock[];
  /**
   * 为 true 时，除了 block 文本还附带 URL 和 document.title。默认 false。
   */
  smartPageContext?: boolean;
  /**
   * 用户输入少于此字符数时跳过页面上下文采集（避免简短闲聊也携带大段上下文）。默认 0（始终采集）。
   */
  pageContextMinUserChars?: number;
  /** 每个 block 最大采集字符，默认 3000 */
  pageContextMaxCharsPerBlock?: number;
  /** 所有 block 合计最大字符，默认 6000 */
  pageContextMaxTotalChars?: number;
  /**
   * 长会话虚拟滚动（实验性，opt-in）。
   *
   * - `false` / `undefined` (默认)：保持现有 `MAX_RENDERED_MESSAGES = 60` 折叠
   *   机制，**不启用**虚拟窗口；
   * - `true`：启用，threshold 默认 60、estimatedItemHeight 默认 90px；
   * - 对象：可定制 `threshold`（启用阈值条数）与 `estimatedItemHeight`
   *   （未真实测量时的每条消息高度估算）。
   *
   * 启用后只渲染当前 viewport 附近 ±overscan 条消息，其余通过 spacer div
   * 撑开高度；与 `useSessionSearch` 的折叠机制兼容（`messageCount` 走
   * displayedMessages.length）。
   */
  virtualScroll?: boolean | { threshold?: number; estimatedItemHeight?: number };
  /**
   * L1 Phase 1: 表单自动填充。把剪贴板里的「键:值」对（A: 234 / B: 1234）
   * 解析后自动填入页面表单字段。
   *
   * - `false` / `undefined`（默认）：关闭，不挂载相关 UI 与监听
   * - `true`：开启，全部用默认值（autoDetectPaste=true、扫整个 body、
   *   不开 LLM 兜底）
   * - 对象：精细配置
   *
   * 用法：
   * - 用户在助手输入框 Ctrl+V 粘贴「key: value\nkey: value」时自动弹出预览
   * - 或者在助手输入框输入 `/fill` 选中后从当前输入框或剪贴板手动触发
   */
  formAutoFill?: boolean | FormAutoFillOptions;
}

const defaultOptions: AiAssistantOptions = {
  baseUrl: '/ai-assistant',
  primaryColor: '#181818',
  position: 'bottom-right',
  theme: 'light',
  persistHistory: false,
  locale: 'en',
  accessToken: undefined,
  adminToken: undefined,
  enableSessionExport: false,
  maxMessagesInMemory: 200,
  maxTotalCharsInMemory: 4_000_000,
  maxUserMessageChars: 120_000,
  showSystemPromptEditor: true,
  systemPromptStorageKey: 'ai-assistant-chat-system-prompt',
  systemPromptMaxInputChars: 4000,
  showModelPicker: true,
  selectedModelStorageKey: 'ai-assistant-selected-model',
};

type AutoMountState = {
  app: App<Element>;
  shell: HTMLDivElement;
};

type AppWithAiAssistantAutoMount = App<Element> & {
  _aiAssistantAutoMount?: AutoMountState;
};

export default {
  install(app: App, options: AiAssistantOptions = {}) {
    const assistantApp = app as AppWithAiAssistantAutoMount;
    const merged = { ...defaultOptions, ...options };
    app.provide('ai-assistant-options', merged);
    app.component('AiAssistant', AiAssistant);
    const prevHandler = app.config.errorHandler;
    app.config.errorHandler = (err, instance, info) => {
      const isAssistant = instance?.$el?.closest?.('.ai-assistant-wrapper');
      if (isAssistant) {
        console.error('[AI Assistant] Uncaught error:', err, info);
        merged.onAssistantError?.({ source: 'vue-error-boundary', message: String(err) });
        return;
      }
      if (prevHandler) prevHandler(err, instance, info);
      else throw err;
    };
    if (merged.autoMountToBody && typeof document !== 'undefined') {
      queueMicrotask(() => {
        const shell = document.createElement('div');
        shell.setAttribute('data-ai-assistant-auto-mount', '');
        document.body.appendChild(shell);
        const child = createApp(AiAssistant);
        child.provide('ai-assistant-options', merged);
        child.mount(shell);
        assistantApp._aiAssistantAutoMount = { app: child, shell };
      });
    }
    const origUnmount = app.unmount.bind(app);
    app.unmount = () => {
      const mount = assistantApp._aiAssistantAutoMount;
      if (mount) {
        mount.app.unmount();
        mount.shell.remove();
        delete assistantApp._aiAssistantAutoMount;
      }
      origUnmount();
    };
  },
};

export { AiAssistant };
/* Public API surface policy:
 * - Core integration exports (AiAssistant, useAiAssistant, API helpers, WC entry)
 *   are the stable surface used by most host apps.
 * - Admin/MCP/plugin/composable utilities below are intentionally exported for
 *   advanced hosts, but new internal refactors should NOT be re-exported by
 *   default. Promote a helper here only when a host can use it independently
 *   without depending on AiAssistant.vue internals.
 * - Prefer secondary entries (`./admin`, `./mcp`, `./form-fill`, `./screenshot`)
 *   for new advanced helpers so the main entry can remain focused on the core
 *   Vue plugin and stable integration API. */
export { useAiAssistant } from './composables/useAiAssistant';
export { useSessionSearch, highlightSearchInHtml } from './composables/useSessionSearch';
export { useAiMarkdownRenderer } from './composables/useAiMarkdownRenderer';
export { usePageSelection } from './composables/usePageSelection';
export type { PageSelectionState } from './composables/usePageSelection';
export type { StreamOptions } from './composables/useAiAssistant';
export type { ChatPayload, ChatResult, UrlPreviewResult, ExportFormat } from './utils/api';
export {
  AiAssistantApiError,
  postChat,
  streamChat,
  uploadFile,
  fetchUrlPreview,
  fetchModels,
  discoverRuntimeProviderModels,
  fetchRuntimeModelConfig,
  fetchPromptTemplates,
  postServerExport,
  saveRuntimeModelConfig,
} from './utils/api';
export type {
  ChatRuntimeMeta,
  ModelsListResult,
  PromptTemplateEntry,
  PromptTemplatesListResult,
} from './utils/api';
export type { RuntimeModelConfigPayload, RuntimeModelConfigResult } from './utils/api';
export { collectPageContextText, collectSmartPageContext } from './utils/pageContextDom';
export type { PageContextBlock, PageContextOptions } from './utils/pageContextDom';
/** @deprecated Import Admin SDK helpers from `@ai-assistant/vue/admin` in v2-ready code. */
/* D3: Admin SDK — host-side admin dashboard helpers around /admin/* endpoints */
export {
  adminOverview,
  adminListTokens,
  adminSetTokenQuota,
  adminListPrompts,
  adminCreatePrompt,
  adminListTools,
  adminIngestRag,
  adminRagStats,
  adminConfigureAbTest,
  adminListAbTests,
  adminSetFallbackChain,
  adminGetFallbackChain,
  adminListPlugins,
  adminUnloadPlugin,
  adminSystemInfo,
} from './utils/adminApi';
export type {
  AdminResult,
  AdminCallOptions,
  AdminOverview,
  AdminPromptEntry,
  AdminToolEntry,
  AdminRagStats,
  AdminRagIngestResult,
  AdminAbTestConfig,
  AdminFallbackChain,
  AdminPluginsResult,
  AdminSystemInfo,
} from './utils/adminApi';
/** @deprecated Import screenshot helpers from `@ai-assistant/vue/screenshot` in v2-ready code. */
export { captureScreenshot } from './utils/pageScreenshot';
export { extractStructuredData } from './utils/pageStructuredData';
export {
  highlightElement,
  highlightByText,
  clearHighlights,
  injectHighlightStyles,
} from './utils/domHighlight';
export { wsStreamChat } from './utils/wsChat';
export { useStreamWithFallback } from './composables/useStreamWithFallback';
export { providePluginRegistry, usePluginRegistry } from './composables/usePluginRegistry';
export type { AiPlugin, PluginContext } from './composables/usePluginRegistry';
export { createStreamTracker } from './utils/perfMetrics';
export type { StreamMetrics } from './utils/perfMetrics';
export { useMultiSession } from './composables/useMultiSession';
export type { SessionEntry } from './composables/useMultiSession';
export { useMultiModelChat } from './composables/useMultiModelChat';
export type { MultiModelColumn, UseMultiModelChatOptions } from './composables/useMultiModelChat';
export { useTextToSpeech } from './composables/useTextToSpeech';
export type { TtsSpeakOptions } from './composables/useTextToSpeech';
export {
  usePromptTemplateLibrary,
  renderPromptTemplate,
} from './composables/usePromptTemplateLibrary';
export type {
  PromptTemplate,
  PromptTemplateVariable,
  UsePromptTemplateLibraryOptions,
} from './composables/usePromptTemplateLibrary';
export { useMermaidRenderer } from './composables/useMermaidRenderer';
export type { MermaidRenderOptions } from './composables/useMermaidRenderer';
export { useMessageVirtualScroll } from './composables/useMessageVirtualScroll';
export type {
  UseMessageVirtualScrollOptions,
  VirtualWindow,
} from './composables/useMessageVirtualScroll';
/** @deprecated Import MCP helpers from `@ai-assistant/vue/mcp` in v2-ready code. */
export { useMcpClient, McpRpcError } from './composables/useMcpClient';
export type {
  McpClientOptions,
  McpTool,
  McpInitializeResult,
  McpToolCallResult,
} from './composables/useMcpClient';
export { useMcpAutoPlugin } from './composables/useMcpAutoPlugin';
export type { UseMcpAutoPluginOptions } from './composables/useMcpAutoPlugin';
export { useMcpStream, McpStreamUnavailable } from './composables/useMcpStream';
export type {
  McpStreamOptions,
  McpStreamNotification,
  EventSourceLike,
} from './composables/useMcpStream';
export { useIdleScheduler, runInChunks } from './composables/useIdleScheduler';
export type { IdleTask, IdleScheduleOptions } from './composables/useIdleScheduler';
export { useRafBatch, createReadWriteBatch } from './composables/useRafBatch';
export type { RafBatch } from './composables/useRafBatch';
export { useCommandPalette } from './composables/useCommandPalette';
export type { UseCommandPaletteOptions } from './composables/useCommandPalette';
export type { CommandItem } from './types/command-palette';
export { useMarkdownWorker } from './composables/useMarkdownWorker';
export type { UseMarkdownWorkerOptions } from './composables/useMarkdownWorker';
/* K22: opt-in wrapper that bundles marked + marked-highlight + hljs (6 core
 * languages) into the worker for off-main-thread syntax highlighting. */
export { useHljsMarkdownWorker } from './composables/useHljsMarkdownWorker';
export type { UseHljsMarkdownWorkerOptions } from './composables/useHljsMarkdownWorker';
/* K35: terminal-style ↑/↓ prompt recall. Hosts can opt-in by recording
 * sent prompts and wiring keydown handlers on their input field. */
export { usePromptHistory } from './composables/usePromptHistory';
export type {
  UsePromptHistoryOptions,
  UsePromptHistoryReturn,
} from './composables/usePromptHistory';
/* K38: drag-and-drop file ingestion on FAB. Standalone composable so SDK
 * consumers can bolt it onto any draggable target (FAB / sidebar dock /
 * floating widget) with a custom onFiles callback (KB / S3 / etc.). */
export { useFabDropIngest } from './composables/useFabDropIngest';
export type {
  UseFabDropIngestOptions,
  UseFabDropIngestReturn,
} from './composables/useFabDropIngest';
/* K39: cross-session full-text search. Standalone composable; consumers
 * pass reactive sessions[] + query string and receive flat or grouped
 * matches with HTML-safe highlighted snippets. */
export {
  useCrossSessionSearch,
  buildSnippet,
  escapeHtml,
} from './composables/useCrossSessionSearch';
export type {
  CrossSessionMatch,
  CrossSessionSearchSessionView,
  CrossSessionSearchMessageView,
  UseCrossSessionSearchOptions,
  UseCrossSessionSearchReturn,
} from './composables/useCrossSessionSearch';
/* K40: pure-function line-level diff (LCS DP + side-by-side row layout).
 * Standalone so consumers can build their own diff dialog or feed any
 * source/target pair (file revisions / API responses / etc.). */
export { diffLines, opsToRows, summariseRows } from './composables/useLineDiff';
export type { DiffOp, DiffOpEntry, SideBySideRow, DiffSummary } from './composables/useLineDiff';
/** @deprecated Import form-fill helpers from `@ai-assistant/vue/form-fill` in v2-ready code. */
/* L1: form auto-fill (Phase 1) — clipboard "key:value" pairs auto-write into
 * host page form fields. Composable + pure-function utils are exported so
 * advanced hosts can build custom UI without `<AiAssistant>`. */
export { useFormAutoFill } from './composables/useFormAutoFill';
export type {
  FormAutoFillOptions,
  TableModeOptions,
  TableModeInfo,
  UseFormAutoFillReturn,
  UseFormAutoFillDeps,
} from './composables/useFormAutoFill';
export {
  parseFormData,
  parseFormDataAsTable,
  splitInlineSegments,
  unquote,
} from './utils/formAutoFill/parser';
export type {
  ParsedPair,
  ParseFormDataOptions,
  ParsedTable,
  ParseFormDataAsTableOptions,
} from './utils/formAutoFill/parser';
export { scanFormFields, scanFormRows } from './utils/formAutoFill/scanner';
export type {
  FormField,
  FormFieldOption,
  FormFieldType,
  ScanFormFieldsOptions,
  FormRow,
  ScanFormRowsOptions,
} from './utils/formAutoFill/scanner';
export {
  matchFields,
  normalize as normalizeFieldLabel,
  levenshteinDistance,
  levenshteinSimilarity,
  longestCommonSubstring,
} from './utils/formAutoFill/matcher';
export type { MatchResult, MatchStrategy, MatcherOptions } from './utils/formAutoFill/matcher';
export {
  fillField,
  undoFills,
  highlightFilledField,
  clearFillHighlights,
} from './utils/formAutoFill/filler';
export type { FillRecord } from './utils/formAutoFill/filler';
/* CommandPalette / MessageReactionBar / ColorThemeSwitcher components are
 * shipped as SFCs in dist/ but NOT re-exported from the main entry to keep
 * the lib bundle structure clean. Import them directly:
 *   import CommandPalette from '@ai-assistant/vue/components/CommandPalette.vue';
 * Or copy them into the host project for full styling control. */
