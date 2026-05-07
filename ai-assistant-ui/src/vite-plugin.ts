import type { Plugin } from 'vite';
import type { AiAssistantOptions } from './index';

export interface AiAssistantPluginOptions extends AiAssistantOptions {
  disabled?: boolean;
}

/**
 * Vite plugin — auto-mounts the AI Assistant widget on every page.
 *
 * ```ts
 * // vite.config.ts
 * import { aiAssistantPlugin } from '@ai-assistant/vue/plugin'
 *
 * export default defineConfig({
 *   plugins: [
 *     vue(),
 *     aiAssistantPlugin({ baseUrl: '/ai-assistant', locale: 'zh' }),
 *   ],
 * })
 * ```
 */
export function aiAssistantPlugin(options: AiAssistantPluginOptions = {}): Plugin {
  const { disabled = false, ...assistantOpts } = options;

  const VIRTUAL_ID = '\0ai-assistant-auto-mount.js';

  return {
    name: 'vite-plugin-ai-assistant',
    enforce: 'post',

    resolveId(id) {
      if (id === 'virtual:ai-assistant-auto-mount') return VIRTUAL_ID;
    },

    load(id) {
      if (id !== VIRTUAL_ID) return;
      return `
import { createApp } from 'vue';
import { AiAssistant } from '@ai-assistant/vue';
const opts = ${JSON.stringify(assistantOpts)};
const el = document.createElement('div');
el.setAttribute('data-ai-assistant-plugin', '');
document.body.appendChild(el);
const app = createApp(AiAssistant);
app.provide('ai-assistant-options', opts);
app.mount(el);
`;
    },

    transformIndexHtml() {
      if (disabled) return [];
      return [
        {
          tag: 'script',
          attrs: { type: 'module' },
          children: `import 'virtual:ai-assistant-auto-mount';`,
          injectTo: 'body',
        },
      ];
    },
  };
}

export default aiAssistantPlugin;
