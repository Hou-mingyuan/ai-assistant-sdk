import { createApp, h } from 'vue'
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

const e2eAdminToken = (
  window as typeof window & { __AI_ASSISTANT_E2E_ADMIN_TOKEN__?: string }
).__AI_ASSISTANT_E2E_ADMIN_TOKEN__

createApp({
  setup() {
    return () =>
      h('main', { class: 'e2e-playground' }, [
        h('article', [
          h('h1', 'AI Assistant E2E Playground'),
          h(
            'p',
            'This tracked playground mounts the assistant widget for Playwright smoke tests.',
          ),
        ]),
      ])
  },
})
  .use(AiAssistant, {
    autoMountToBody: true,
    baseUrl: '/ai-assistant',
    adminToken: e2eAdminToken,
    persistHistory: false,
    showModelPicker: true,
    theme: 'light',
  })
  .mount('#app')
