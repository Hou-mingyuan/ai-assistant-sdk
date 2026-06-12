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
  persistHistory?: boolean;
  persistFabPosition?: boolean;
  locale?: 'en' | 'zh' | 'ja' | 'ko';
  accessToken?: string;
  adminToken?: string;
  onAssistantError?: (payload: { source: string; message: string }) => void;
  onReaction?: (payload: { messageIndex: number; emoji: string; toggled: boolean }) => void;
  quickPrompts?: { label: string; text: string }[];
  promptTemplates?: {
    label: string;
    template: string;
    variables?: { name: string; label: string; default?: string }[];
  }[];
  openCodeInIde?: (payload: { code: string; language?: string }) => void;
  toggleShortcut?: string | false;
  autoMountToBody?: boolean;
  enableSessionExport?: boolean;
  maxMessagesInMemory?: number;
  maxTotalCharsInMemory?: number;
  maxUserMessageChars?: number;
  showSystemPromptEditor?: boolean;
  systemPromptStorageKey?: string;
  systemPromptMaxInputChars?: number;
  showModelPicker?: boolean;
  selectedModelStorageKey?: string;
  visionCapableModels?: RegExp[];
  pageContextBlocks?: PageContextBlock[];
  smartPageContext?: boolean;
  pageContextMinUserChars?: number;
  pageContextMaxCharsPerBlock?: number;
  pageContextMaxTotalChars?: number;
  virtualScroll?: boolean | { threshold?: number; estimatedItemHeight?: number };
  formAutoFill?: boolean | FormAutoFillOptions;
}

const defaultOptions: AiAssistantOptions = {
  baseUrl: '/ai-assistant',
  primaryColor: '#6366f1',
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

export const AiAssistantPlugin = {
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
export default AiAssistantPlugin;
