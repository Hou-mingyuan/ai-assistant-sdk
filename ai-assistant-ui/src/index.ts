import type { App } from 'vue';
import { createApp } from 'vue';
import AiAssistant from './components/AiAssistant.vue';

export interface AiAssistantOptions {
  baseUrl?: string;
  primaryColor?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  theme?: 'light' | 'dark' | 'auto';
  persistHistory?: boolean;
  /** 是否持久化悬浮球位置与贴边状态（localStorage），默认 true */
  persistFabPosition?: boolean;
  locale?: 'en' | 'zh' | 'ja' | 'ko';
  accessToken?: string;
  /** 与 @error 事件并行，便于接入监控/日志 */
  onAssistantError?: (payload: { source: string; message: string }) => void;
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
}

const defaultOptions: AiAssistantOptions = {
  baseUrl: '/ai-assistant',
  primaryColor: '#6366f1',
  position: 'bottom-right',
  theme: 'light',
  persistHistory: false,
  locale: 'en',
  accessToken: undefined,
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
export { useAiAssistant } from './composables/useAiAssistant';
export { useSessionSearch, highlightSearchInHtml } from './composables/useSessionSearch';
export { useAiMarkdownRenderer } from './composables/useAiMarkdownRenderer';
export { usePageSelection } from './composables/usePageSelection';
export type { PageSelectionState } from './composables/usePageSelection';
export type { StreamOptions } from './composables/useAiAssistant';
export type { ChatPayload, ChatResult, UrlPreviewResult, ExportFormat } from './utils/api';
export { uploadFile, fetchUrlPreview, fetchModels, postServerExport } from './utils/api';
export type { ModelsListResult } from './utils/api';
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
