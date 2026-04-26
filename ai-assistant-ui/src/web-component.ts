/**
 * Framework-agnostic Web Component wrapper for the AI Assistant.
 *
 * Usage in any HTML page:
 *   <script src="ai-assistant-wc.umd.js"></script>
 *   <ai-assistant endpoint="/ai-assistant" token="xxx"></ai-assistant>
 *
 * Works in Vue 2, React, Angular, vanilla HTML — no framework dependency at runtime.
 */
import { createApp, type App } from 'vue'
import AiAssistant from './components/AiAssistant.vue'
import type { AiAssistantOptions } from './index'

const ATTR_MAP: Record<string, keyof AiAssistantOptions> = {
  endpoint: 'baseUrl',
  'base-url': 'baseUrl',
  token: 'accessToken',
  'access-token': 'accessToken',
  'primary-color': 'primaryColor',
  position: 'position',
  theme: 'theme',
  locale: 'locale',
  'persist-history': 'persistHistory',
  'max-messages': 'maxMessagesInMemory',
  'toggle-shortcut': 'toggleShortcut',
  'show-model-picker': 'showModelPicker',
  'show-system-prompt': 'showSystemPromptEditor',
}

const BOOLEAN_ATTRS = new Set([
  'persist-history', 'show-model-picker', 'show-system-prompt',
])

const INT_ATTRS = new Set(['max-messages'])

class AiAssistantElement extends HTMLElement {
  private _app: App | null = null
  private _mountEl: HTMLDivElement | null = null

  static get observedAttributes() {
    return Object.keys(ATTR_MAP)
  }

  connectedCallback() {
    this._mount()
  }

  disconnectedCallback() {
    this._unmount()
  }

  attributeChangedCallback() {
    if (this._app) {
      this._unmount()
      this._mount()
    }
  }

  private _mount() {
    this._mountEl = document.createElement('div')
    this._mountEl.setAttribute('data-ai-assistant-wc', '')
    this.appendChild(this._mountEl)

    const options = this._resolveOptions()

    this._app = createApp(AiAssistant)
    this._app.provide('ai-assistant-options', options)
    this._app.mount(this._mountEl)
  }

  private _unmount() {
    if (this._app) {
      this._app.unmount()
      this._app = null
    }
    if (this._mountEl) {
      this._mountEl.remove()
      this._mountEl = null
    }
  }

  private _resolveOptions(): AiAssistantOptions {
    const opts: Record<string, unknown> = {
      baseUrl: '/ai-assistant',
      primaryColor: '#6366f1',
      position: 'bottom-right',
      theme: 'light',
      persistHistory: false,
      locale: 'en',
      maxMessagesInMemory: 200,
      showSystemPromptEditor: true,
      showModelPicker: true,
      autoMountToBody: false,
    }

    for (const [attr, prop] of Object.entries(ATTR_MAP)) {
      const val = this.getAttribute(attr)
      if (val === null) continue

      if (BOOLEAN_ATTRS.has(attr)) {
        opts[prop] = val !== 'false' && val !== '0'
      } else if (INT_ATTRS.has(attr)) {
        const num = parseInt(val, 10)
        if (!isNaN(num)) opts[prop] = num
      } else {
        opts[prop] = val
      }
    }

    return opts as AiAssistantOptions
  }
}

export function registerAiAssistant(tagName = 'ai-assistant') {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, AiAssistantElement)
  }
}

registerAiAssistant()

export { AiAssistantElement }
