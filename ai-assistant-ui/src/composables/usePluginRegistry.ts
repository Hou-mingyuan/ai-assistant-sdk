import { ref, inject, provide, computed, type Ref, type InjectionKey } from 'vue';

export interface AiPlugin {
  id: string;
  label: string;
  icon?: string;
  /** 'header' = header action button, 'footer' = input area button, 'context' = right-click menu */
  position: 'header' | 'footer' | 'context';
  /** Called when the plugin button is clicked; receives current input text and messages */
  action: (ctx: PluginContext) => void | Promise<void>;
}

export interface PluginContext {
  input: string;
  messages: { role: string; content: string }[];
  setInput: (text: string) => void;
  addMessage: (role: 'user' | 'assistant', content: string) => void;
}

const PLUGIN_KEY: InjectionKey<Ref<AiPlugin[]>> = Symbol('ai-plugins');

export function providePluginRegistry() {
  const plugins = ref<AiPlugin[]>([]);
  provide(PLUGIN_KEY, plugins);
  return plugins;
}

export function usePluginRegistry() {
  const plugins = inject(PLUGIN_KEY, () => ref<AiPlugin[]>([]), true);

  function registerPlugin(plugin: AiPlugin) {
    if (typeof plugin.action !== 'function') {
      throw new TypeError(`Plugin "${plugin.id}" must have an action function`);
    }
    if (plugins.value.some((p) => p.id === plugin.id)) {
      plugins.value = plugins.value.map((p) => (p.id === plugin.id ? plugin : p));
    } else {
      plugins.value = [...plugins.value, plugin];
    }
  }

  function unregisterPlugin(id: string) {
    plugins.value = plugins.value.filter((p) => p.id !== id);
  }

  const headerPlugins = computed(() => plugins.value.filter((p) => p.position === 'header'));
  const footerPlugins = computed(() => plugins.value.filter((p) => p.position === 'footer'));
  const contextPlugins = computed(() => plugins.value.filter((p) => p.position === 'context'));

  function getPlugins(position: AiPlugin['position']): AiPlugin[] {
    switch (position) {
      case 'header':
        return headerPlugins.value;
      case 'footer':
        return footerPlugins.value;
      case 'context':
        return contextPlugins.value;
    }
  }

  return { plugins, registerPlugin, unregisterPlugin, getPlugins };
}
