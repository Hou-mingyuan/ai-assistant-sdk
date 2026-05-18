import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_AI_ASSISTANT_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [vue()],
    server: {
      /** 若运行时发现端口变成 5174、5175…，说明本机仍有未结束的旧 `npm run dev`，请在对应终端 Ctrl+C 关掉后再启动。 */
      port: 5173,
      strictPort: false,
      proxy: {
        '/ai-assistant': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/vue')) return 'vendor-vue'
            if (id.includes('node_modules/marked') || id.includes('node_modules/dompurify')) {
              return 'markdown-rendering'
            }
            if (id.includes('node_modules/highlight.js')) return 'syntax-highlight'
            if (id.includes('AdminDemoPanel.vue') || id.includes('/src/entries/admin')) {
              return 'admin-demo'
            }
            if (id.includes('/src/composables/useFormAutoFill') || id.includes('/src/utils/formAutoFill')) {
              return 'form-fill'
            }
            if (id.includes('/src/composables/useScreenCapture') || id.includes('/src/utils/pageScreenshot')) {
              return 'screenshot'
            }
          },
        },
      },
    },
  }
})
