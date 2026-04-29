/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

const isWC = process.env.BUILD_TARGET === 'wc'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'src/composables/useAiMarkdownRenderer.ts',
        'src/composables/useMultiSession.ts',
        'src/composables/usePluginRegistry.ts',
        'src/composables/useSessionSearch.ts',
        'src/composables/useStreamWithFallback.ts',
        'src/utils/api.ts',
        'src/utils/hljsRegistered.ts',
        'src/utils/urlEmbed.ts',
      ],
      exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts', 'src/web-component.ts'],
      thresholds: {
        lines: 94,
        branches: 88,
        functions: 98,
        statements: 94,
      },
    },
  },
  build: isWC
    ? {
        lib: {
          entry: resolve(__dirname, 'src/web-component.ts'),
          name: 'AiAssistantWC',
          fileName: (format) =>
            format === 'es' ? 'ai-assistant-wc.mjs' : 'ai-assistant-wc.umd.cjs',
        },
        cssCodeSplit: false,
        minify: 'terser',
        rollupOptions: {
          output: {
            exports: 'named',
            globals: {},
          },
        },
      }
    : {
        lib: {
          entry: resolve(__dirname, 'src/index.ts'),
          name: 'AiAssistant',
          fileName: (format) => (format === 'es' ? 'ai-assistant.mjs' : 'ai-assistant.umd.cjs'),
        },
        cssCodeSplit: false,
        minify: 'terser',
        rollupOptions: {
          external: ['vue', 'html2canvas'],
          output: {
            exports: 'named',
            globals: { vue: 'Vue', html2canvas: 'html2canvas' },
          },
        },
      },
})
