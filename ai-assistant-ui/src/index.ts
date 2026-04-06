import type { App } from 'vue'
import { createApp } from 'vue'
import AiAssistant from './components/AiAssistant.vue'

export interface AiAssistantOptions {
  baseUrl?: string
  primaryColor?: string
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  theme?: 'light' | 'dark' | 'auto'
  persistHistory?: boolean
  /** 是否持久化悬浮球位置与贴边状态（localStorage），默认 true */
  persistFabPosition?: boolean
  locale?: 'en' | 'zh'
  accessToken?: string
  /** 与 @error 事件并行，便于接入监控/日志 */
  onAssistantError?: (payload: { source: string; message: string }) => void
  /** 对话模式下可选：快捷短语（点击填入输入框，不自动发送） */
  quickPrompts?: { label: string; text: string }[]
  /**
   * 若提供，代码块旁显示「IDE」按钮，由宿主实现（如 vscode://、cursor:// 或自定义协议）。
   */
  openCodeInIde?: (payload: { code: string; language?: string }) => void
  /**
   * 每次发往服务端前，从当前文档中抓取与选择器匹配区块的 innerText，拼入用户消息之后。
   * 适合根布局挂载、多路由共用的场景（如 `#news-panel` 新闻区）。
   */
  pageContextBlocks?: { selector: string; label?: string }[]
  /** 页面上下文最大字符，默认 12000 */
  pageContextMaxChars?: number
  /**
   * 为 true 且未设置 pageContextBlocks 时，自动按 main → [role=main] → article → #app 采集页面正文；
   * #app 会先克隆并去掉助手 DOM，避免把对话内容拼进上下文。默认 true。
   */
  smartPageContext?: boolean
  /**
   * 用户消息短于该长度时**不**附加 smart 页面上下文，避免只说「你好」也把整页说明塞进模型导致话痨。
   * 不限制显式 `pageContextBlocks`。默认 12。
   */
  pageContextMinUserChars?: number
  /**
   * 为 true 时，`app.use` 后在 `document.body` 末尾自动再挂载一棵 Vue 应用实例（仅含助手）。
   * 无需在根组件模板里写 `<AiAssistant />`；若已手动放置组件，请勿开启，以免重复。
   */
  autoMountToBody?: boolean
  /**
   * @deprecated 已无效果。单条导出请使用助手气泡右键菜单；保留本字段仅为兼容旧配置。
   */
  enableSessionExport?: boolean
  /**
   * 会话在内存中最多保留的消息条数（含 user/assistant），超出则丢弃最前面的消息，降低长页面 OOM 风险。
   * 默认 200；设为 0 表示不截断（长会话慎用）。
   */
  maxMessagesInMemory?: number
  /**
   * 所有消息 content 累计字符上限（仅从头部丢弃整句），与条数上限同时生效。
   * 默认 4_000_000；0 表示不限制。
   */
  maxTotalCharsInMemory?: number
  /**
   * 用户单次发送的正文最大字符（超出截断并追加省略标记）。默认 120000；0 不限制。
   */
  maxUserMessageChars?: number
}

const defaultOptions: AiAssistantOptions = {
  baseUrl: '/ai-assistant',
  primaryColor: '#6366f1',
  position: 'bottom-right',
  theme: 'light',
  persistHistory: false,
  locale: 'en',
  accessToken: undefined,
  smartPageContext: true,
  pageContextMinUserChars: 12,
  enableSessionExport: false,
  maxMessagesInMemory: 200,
  maxTotalCharsInMemory: 4_000_000,
  maxUserMessageChars: 120_000,
}

export default {
  install(app: App, options: AiAssistantOptions = {}) {
    const merged = { ...defaultOptions, ...options }
    app.provide('ai-assistant-options', merged)
    app.component('AiAssistant', AiAssistant)
    if (merged.autoMountToBody && typeof document !== 'undefined') {
      queueMicrotask(() => {
        const shell = document.createElement('div')
        shell.setAttribute('data-ai-assistant-auto-mount', '')
        document.body.appendChild(shell)
        const child = createApp(AiAssistant)
        child.provide('ai-assistant-options', merged)
        child.mount(shell)
      })
    }
  },
}

export { AiAssistant }
export { useAiAssistant } from './composables/useAiAssistant'
export { useSessionSearch } from './composables/useSessionSearch'
export { useAiMarkdownRenderer } from './composables/useAiMarkdownRenderer'
export type { StreamOptions } from './composables/useAiAssistant'
export type { ChatPayload, ChatResult, UrlPreviewResult, ExportFormat } from './utils/api'
export { uploadFile, fetchUrlPreview, postServerExport } from './utils/api'
export {
  collectPageContextText,
  augmentMessageWithPageContext,
  collectSmartPageContextText,
} from './utils/pageContextDom'
export type { PageContextBlock } from './utils/pageContextDom'
