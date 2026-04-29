/**
 * Framework-agnostic Web Component wrapper for the AI Assistant.
 *
 * Usage in any HTML page:
 *   <script src="ai-assistant-wc.umd.js"></script>
 *   <ai-assistant endpoint="/ai-assistant" token="xxx"></ai-assistant>
 *
 * Works in Vue 2, React, Angular, vanilla HTML — no framework dependency at runtime.
 */
import type { App } from 'vue';
import type { AiAssistantOptions } from './index';

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
};

const BOOLEAN_ATTRS = new Set(['persist-history', 'show-model-picker', 'show-system-prompt']);

const INT_ATTRS = new Set(['max-messages']);

const DEFAULT_OPTIONS: AiAssistantOptions = {
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
};

class AiAssistantElement extends HTMLElement {
  private _app: App | null = null;
  private _mountEl: HTMLDivElement | null = null;
  private _options: AiAssistantOptions | null = null;

  static get observedAttributes() {
    return Object.keys(ATTR_MAP);
  }

  connectedCallback() {
    this._mountLazy();
  }

  disconnectedCallback() {
    this._unmount();
  }

  attributeChangedCallback(_name: string, oldVal: string | null, newVal: string | null) {
    if (oldVal === newVal) return;
    if (this._options) {
      this._syncOptions();
    }
  }

  private async _mountLazy() {
    this._mountEl = document.createElement('div');
    this._mountEl.setAttribute('data-ai-assistant-wc', '');
    this.appendChild(this._mountEl);

    const [{ createApp, reactive }, { default: AiAssistant }] = await Promise.all([
      import('vue'),
      import('./components/AiAssistant.vue'),
    ]);

    if (!this.isConnected) return;

    this._options = reactive({ ...DEFAULT_OPTIONS }) as AiAssistantOptions;
    this._syncOptions();

    this._app = createApp(AiAssistant);
    this._app.provide('ai-assistant-options', this._options);
    this._app.provide('ai-assistant-events', {
      emit: (name: string, detail?: unknown) => this._dispatch(name, detail),
    });
    this._app.mount(this._mountEl);

    this._dispatch('ready');
  }

  private _dispatch(name: string, detail?: unknown) {
    this.dispatchEvent(
      new CustomEvent(`ai-assistant:${name}`, {
        bubbles: true,
        composed: true,
        detail,
      }),
    );
  }

  private _unmount() {
    if (this._app) {
      this._app.unmount();
      this._app = null;
    }
    if (this._mountEl) {
      this._mountEl.remove();
      this._mountEl = null;
    }
    this._options = null;
  }

  private _syncOptions() {
    if (!this._options) return;
    const target = this._options as Record<string, unknown>;

    for (const [attr, prop] of Object.entries(ATTR_MAP)) {
      const val = this.getAttribute(attr);
      if (val === null) continue;

      if (BOOLEAN_ATTRS.has(attr)) {
        target[prop] = val !== 'false' && val !== '0';
      } else if (INT_ATTRS.has(attr)) {
        const num = parseInt(val, 10);
        if (!isNaN(num)) target[prop] = num;
      } else {
        target[prop] = val;
      }
    }
  }
}

export function registerAiAssistant(tagName = 'ai-assistant') {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, AiAssistantElement);
  }
}

registerAiAssistant();

export { AiAssistantElement };
