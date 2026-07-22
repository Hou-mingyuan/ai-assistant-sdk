import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

const isWC = process.env.BUILD_TARGET === 'wc';
const preserveDist = process.env.PRESERVE_DIST === 'true';
const libEntries = {
  'ai-assistant': resolve(__dirname, 'src/index.ts'),
  core: resolve(__dirname, 'src/entries/core.ts'),
  admin: resolve(__dirname, 'src/entries/admin.ts'),
  'form-fill': resolve(__dirname, 'src/entries/form-fill.ts'),
  mcp: resolve(__dirname, 'src/entries/mcp.ts'),
  plugin: resolve(__dirname, 'src/vite-plugin.ts'),
  screenshot: resolve(__dirname, 'src/entries/screenshot.ts'),
};

export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // The Web Component bundles Vue for direct use from a classic <script> tag.
  // Vue's bundler build intentionally leaves this expression for host bundlers;
  // a plain browser has no global `process`, so resolve it at build time.
  define:
    command === 'build'
      ? {
          'process.env.NODE_ENV': JSON.stringify('production'),
        }
      : {},
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
          cssFileName: 'style',
        },
        cssCodeSplit: false,
        emptyOutDir: !preserveDist,
        minify: 'terser',
        rollupOptions: {
          /* `mermaid` is an OPTIONAL peer (see lib build below): keep it out of
             the self-contained Web Component bundle as well. `ArtifactCanvas`
             loads it via dynamic `import('mermaid')` only when the host provides
             it; otherwise it falls back to showing the diagram source. Bundling
             it here previously inflated the WC artifact by ~850 KB gzip. */
          external: ['html2canvas', 'mermaid'],
          output: {
            exports: 'named',
            globals: { html2canvas: 'html2canvas', mermaid: 'mermaid' },
          },
        },
      }
    : {
        lib: {
          entry: libEntries,
          name: 'AiAssistant',
          formats: ['es', 'cjs'],
          fileName: (format, entryName) =>
            format === 'es' ? `${entryName}.mjs` : `${entryName}.umd.cjs`,
          /* Pin the lib-mode CSS output filename to `style.css`.
             Vite 6 lib mode defaults to `<package-name-last-segment>.css`
             (so `@ai-assistant/vue` would emit `vue.css`), but every
             downstream consumer in this repo - playground, e2e harness,
             README/docs examples, the ebs-lng-front integration patch
             and the bundle-size baseline - imports `dist/style.css`.
             Lock the name here so build output matches the published API. */
          cssFileName: 'style',
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
}));
