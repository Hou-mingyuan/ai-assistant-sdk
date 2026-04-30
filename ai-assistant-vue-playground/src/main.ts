import { createApp } from 'vue'
import App from './App.vue'
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

const app = createApp(App)
app.use(AiAssistant, {
  baseUrl: import.meta.env.VITE_AI_ASSISTANT_BASE_URL || '/ai-assistant',
  accessToken: import.meta.env.VITE_AI_ASSISTANT_ACCESS_TOKEN || undefined,
  primaryColor: '#6366f1',
  position: 'bottom-right',
  locale: 'zh',
  theme: 'light',
  /** 只采集说明正文，不含同级的悬浮球 DOM；与 collectPageContextText 内去助手克隆逻辑叠加 */
  pageContextBlocks: [{ selector: '.demo-assistant-page-context', label: '当前演示页' }],
  smartPageContext: true,
  pageContextMinUserChars: 6,
})
app.mount('#app')
