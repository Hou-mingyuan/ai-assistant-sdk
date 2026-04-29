import { createApp, h } from 'vue'
import AiAssistant from '@ai-assistant/vue'
import '@ai-assistant/vue/dist/style.css'

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
    persistHistory: false,
    showModelPicker: true,
    theme: 'light',
  })
  .mount('#app')
