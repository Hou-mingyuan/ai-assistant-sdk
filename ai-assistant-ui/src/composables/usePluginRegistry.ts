import { ref, type Ref } from 'vue'

export interface AiPlugin {
  id: string
  label: string
  icon?: string
  /** 'header' = header action button, 'footer' = input area button, 'context' = right-click menu */
  position: 'header' | 'footer' | 'context'
  /** Called when the plugin button is clicked; receives current input text and messages */
  action: (ctx: PluginContext) => void | Promise<void>
}

export interface PluginContext {
  input: string
  messages: { role: string; content: string }[]
  setInput: (text: string) => void
  addMessage: (role: 'user' | 'assistant', content: string) => void
}

const plugins: Ref<AiPlugin[]> = ref([])

export function usePluginRegistry() {
  function registerPlugin(plugin: AiPlugin) {
    if (plugins.value.some(p => p.id === plugin.id)) {
      plugins.value = plugins.value.map(p => p.id === plugin.id ? plugin : p)
    } else {
      plugins.value.push(plugin)
    }
  }

  function unregisterPlugin(id: string) {
    plugins.value = plugins.value.filter(p => p.id !== id)
  }

  function getPlugins(position: AiPlugin['position']): AiPlugin[] {
    return plugins.value.filter(p => p.position === position)
  }

  return { plugins, registerPlugin, unregisterPlugin, getPlugins }
}
