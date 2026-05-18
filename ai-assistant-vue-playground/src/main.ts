import { createApp } from 'vue'
import App from './App.vue'
// Import from src so playground reflects SDK logic and component styles via Vite HMR.
import AiAssistant from '../../ai-assistant-ui/src/index'

const app = createApp(App)
app.use(AiAssistant, {
  baseUrl: import.meta.env.VITE_AI_ASSISTANT_BASE_URL || '/ai-assistant',
  accessToken: import.meta.env.VITE_AI_ASSISTANT_ACCESS_TOKEN || undefined,
  primaryColor: '#4f46e5',
  position: 'bottom-right',
  locale: 'zh',
  theme: 'light',
  autoMountToBody: true,
  /** 只采集说明正文，不含同级的悬浮球 DOM；与 collectPageContextText 内去助手克隆逻辑叠加 */
  pageContextBlocks: [{ selector: '.demo-assistant-page-context', label: '当前演示页' }],
  smartPageContext: true,
  pageContextMinUserChars: 6,
  /* L1: form auto-fill — 粘贴键值对到助手输入框，自动填入页面表单 */
  formAutoFill: {
    autoDetectPaste: true,
    autoDetectMinPairs: 2,
    // 演示页里有「客户/客户姓名」之类，加几条业务别名让匹配更容易命中
    synonyms: {
      proj: ['项目', '项目名', 'project'],
      contract: ['合同', '合同号', '合同编号'],
    },
    // Phase 2: 启用表格批量填入。页面用 `data-ai-fillable-row` 标记每行
    tableMode: true,
  },
  /* K32: re-dispatch K24 onReaction events as a global window event so the
   * App.vue reactionLog visualiser can pick them up without needing a
   * direct ref to the auto-mounted AiAssistant instance. */
  onReaction: (payload: { messageIndex: number; emoji: string; toggled: boolean }) => {
    window.dispatchEvent(new CustomEvent('ai-assistant-reaction', { detail: payload }))
  },
})
app.mount('#app')
