import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    /** 若运行时发现端口变成 5174、5175…，说明本机仍有未结束的旧 `npm run dev`，请在对应终端 Ctrl+C 关掉后再启动。 */
    port: 5173,
    strictPort: false,
    proxy: {
      // 改为你的后端地址（任意已集成 Starter 的服务 origin）
      '/ai-assistant': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
