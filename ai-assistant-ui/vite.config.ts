/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

const isWC = process.env.BUILD_TARGET === 'wc'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts'],
  },
  build: isWC
    ? {
        lib: {
          entry: resolve(__dirname, 'src/web-component.ts'),
          name: 'AiAssistantWC',
          fileName: 'ai-assistant-wc',
        },
        cssCodeSplit: false,
        minify: 'terser',
        rollupOptions: {
          output: {
            globals: {},
          },
        },
      }
    : {
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
