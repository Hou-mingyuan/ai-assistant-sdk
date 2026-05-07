<template>
  <div
    :id="uid + '-diagnostics'"
    class="ai-diagnostics-panel"
    role="region"
    :aria-labelledby="uid + '-diagnostics-title'"
    :aria-busy="busy ? 'true' : 'false'"
  >
    <div class="ai-diagnostics-head">
      <strong :id="uid + '-diagnostics-title'">{{ t.diagnosticsTitle }}</strong>
      <div class="ai-diagnostics-actions">
        <button type="button" :disabled="busy" @click="$emit('refresh')">
          {{ t.diagnosticsRefresh }}
        </button>
        <button type="button" @click="$emit('copy')">
          {{ copied ? t.diagnosticsCopied : t.diagnosticsCopy }}
        </button>
        <span class="ai-sr-only" role="status" aria-live="polite" aria-atomic="true">
          {{ copyMessage }}
        </span>
        <button
          type="button"
          class="ai-diagnostics-close"
          :aria-label="t.diagnosticsClose"
          @click="$emit('close')"
        >
          ×
        </button>
      </div>
    </div>
    <dl class="ai-diagnostics-list">
      <div>
        <dt>{{ t.diagnosticsStatus }}</dt>
        <dd aria-live="polite">{{ statusMessage }}</dd>
      </div>
      <div>
        <dt>{{ t.diagnosticsLastError }}</dt>
        <dd>{{ lastError || t.diagnosticsNoError }}</dd>
      </div>
      <div>
        <dt>{{ t.diagnosticsBaseUrl }}</dt>
        <dd>{{ baseUrl || '—' }}</dd>
      </div>
      <div>
        <dt>{{ t.diagnosticsModelEndpoint }}</dt>
        <dd>{{ modelEndpoint }}</dd>
      </div>
      <div>
        <dt>{{ t.diagnosticsToken }}</dt>
        <dd>{{ tokenText }}</dd>
      </div>
      <div>
        <dt>{{ t.diagnosticsSelectedModel }}</dt>
        <dd>{{ selectedModel || t.diagnosticsNoSelectedModel }}</dd>
      </div>
      <div>
        <dt>{{ t.diagnosticsAvailableModels }}</dt>
        <dd>{{ modelCount }}</dd>
      </div>
      <div>
        <dt>{{ t.diagnosticsLastChecked }}</dt>
        <dd>{{ lastChecked || t.diagnosticsNeverChecked }}</dd>
      </div>
    </dl>
    <div class="ai-connection-config">
      <strong>{{ t.connectionConfigTitle }}</strong>
      <label>
        <span>{{ t.diagnosticsBaseUrl }}</span>
        <input
          :value="baseUrlInput"
          type="text"
          :placeholder="t.connectionConfigBaseUrlPlaceholder"
          autocomplete="off"
          @input="$emit('update:baseUrlInput', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label>
        <span>{{ t.diagnosticsToken }}</span>
        <input
          :value="tokenInput"
          type="password"
          :placeholder="t.connectionConfigTokenPlaceholder"
          autocomplete="off"
          @input="$emit('update:tokenInput', ($event.target as HTMLInputElement).value)"
        />
      </label>
      <label class="ai-connection-config-check">
        <input
          :checked="persistEnabled"
          type="checkbox"
          @change="$emit('update:persistEnabled', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ t.connectionConfigPersist }}</span>
      </label>
      <div class="ai-connection-config-actions">
        <button type="button" :disabled="busy" @click="$emit('testConfig')">
          {{ t.connectionConfigTest }}
        </button>
        <button type="button" :disabled="busy" @click="$emit('saveConfig')">
          {{ t.connectionConfigSave }}
        </button>
      </div>
      <p
        v-if="configMessage"
        class="ai-connection-config-message"
        role="status"
        aria-live="polite"
      >
        {{ configMessage }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { I18nMessages } from '../utils/i18n';

defineProps<{
  uid: string;
  busy: boolean;
  copied: boolean;
  copyMessage: string;
  statusMessage: string;
  lastError: string;
  baseUrl: string | undefined;
  modelEndpoint: string;
  tokenText: string;
  selectedModel: string;
  modelCount: number;
  lastChecked: string;
  baseUrlInput: string;
  tokenInput: string;
  persistEnabled: boolean;
  configMessage: string;
  t: I18nMessages;
}>();

defineEmits<{
  refresh: [];
  copy: [];
  close: [];
  testConfig: [];
  saveConfig: [];
  'update:baseUrlInput': [value: string];
  'update:tokenInput': [value: string];
  'update:persistEnabled': [value: boolean];
}>();
</script>
