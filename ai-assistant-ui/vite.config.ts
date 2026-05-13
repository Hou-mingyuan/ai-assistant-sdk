import { defineConfig } from 'vitest/config'
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
      /* Two-layer gate:
       *  1. `thresholds` here = absolute FLOOR (vitest --coverage exits 1).
       *     Set just below current actuals; serves as "do not slide below this."
       *  2. `scripts/coverage-check.mjs` = REGRESSION detector against
       *     `scripts/.coverage-baseline.json`. CI runs both; this one catches
       *     small drift (~1% drop) the floor can't see.
       *
       *  hljsRegistered.ts pulls functions down (14% of 13 lazy import arrows
       *  are not invoked in jsdom tests) — lazy loaders are intentional, so
       *  the floor here is realistic, not aspirational. */
      thresholds: {
        lines: 96,
        branches: 90,
        functions: 80,
        statements: 96,
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
          /* `mermaid` is an OPTIONAL peer: only loaded at runtime by
             `useMermaidRenderer` when the host project has it installed.
             Externalizing keeps the library bundle small and avoids the
             "cannot resolve mermaid" build error when the host opts out. */
          external: ['vue', 'html2canvas', 'mermaid'],
          output: {
            exports: 'named',
            globals: { vue: 'Vue', html2canvas: 'html2canvas', mermaid: 'mermaid' },
          },
        },
      },
})
