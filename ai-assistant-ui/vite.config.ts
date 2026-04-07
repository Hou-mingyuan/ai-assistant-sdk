/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'AiAssistant',
      fileName: 'ai-assistant',
    },
    cssCodeSplit: false,
    minify: 'terser',
    rollupOptions: {
      external: ['vue', 'html2canvas'],
      output: {
        globals: { vue: 'Vue', html2canvas: 'html2canvas' },
      },
    },
  },
})
