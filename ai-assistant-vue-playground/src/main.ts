import { createApp } from 'vue'
import App from './App.vue'
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

const app = createApp(App)
app.use(AiAssistant, {
  baseUrl: import.meta.env.VITE_AI_ASSISTANT_BASE_URL || '/ai-assistant',
  accessToken: import.meta.env.VITE_AI_ASSISTANT_ACCESS_TOKEN || undefined,
  primaryColor: '#0ea5e9',
  position: 'bottom-right',
  locale: 'zh',
  theme: 'dark',
  /** 只采集说明正文，不含同级的悬浮球 DOM；与 collectPageContextText 内去助手克隆逻辑叠加 */
  pageContextBlocks: [{ selector: '.demo-assistant-page-context', label: '当前演示页' }],
  smartPageContext: true,
  pageContextMinUserChars: 6,
  /* K32: re-dispatch K24 onReaction events as a global window event so the
   * App.vue reactionLog visualiser can pick them up without needing a
   * direct ref to the auto-mounted AiAssistant instance. */
  onReaction: (payload: { messageIndex: number; emoji: string; toggled: boolean }) => {
    window.dispatchEvent(new CustomEvent('ai-assistant-reaction', { detail: payload }))
  },
})
app.mount('#app')
