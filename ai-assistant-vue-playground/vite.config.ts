import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.VITE_AI_ASSISTANT_PROXY_TARGET || 'http://localhost:8080'

  return {
    plugins: [vue()],
    optimizeDeps: {
      include: ['html2canvas'],
    },
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
  }
})
