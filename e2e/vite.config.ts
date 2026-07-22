import { defineConfig } from 'vite'

const backendOrigin =
  process.env.AI_ASSISTANT_E2E_BACKEND_ORIGIN || 'http://127.0.0.1:8080'

export default defineConfig({
  server: {
    proxy: {
      '/ai-assistant': {
        target: backendOrigin,
        changeOrigin: true,
      },
    },
  },
})
