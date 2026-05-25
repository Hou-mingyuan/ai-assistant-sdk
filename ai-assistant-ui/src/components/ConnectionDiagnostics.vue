<template>
  <Teleport to="body">
    <div
      class="ai-personalize-overlay"
      :class="{ 'ai-dark': isDark }"
      role="presentation"
      @click.self="$emit('close')"
    >
      <div
        :id="uid + '-diagnostics'"
        class="ai-diagnostics-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="uid + '-diagnostics-title'"
        :aria-busy="busy ? 'true' : 'false'"
        @click.stop
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
        <div class="ai-diagnostics-model-card" :data-status="modelStatusKind">
          <span class="ai-diagnostics-model-dot" aria-hidden="true"></span>
          <div>
            <span class="ai-diagnostics-model-kicker">{{ t.modelLabel }}</span>
            <strong>{{ selectedModel || t.diagnosticsNoSelectedModel }}</strong>
            <p>{{ modelHintText }}</p>
          </div>
        </div>
        <div v-if="remedyKind !== 'ready'" class="ai-diagnostics-remedy" :data-kind="remedyKind">
          <strong>{{ remedyTitle }}</strong>
          <p>{{ remedyText }}</p>
          <div class="ai-diagnostics-remedy-actions">
            <button
              type="button"
              class="ai-diagnostics-remedy-primary"
              :disabled="busy"
              @click="runPrimaryRemedy"
            >
              {{ primaryRemedyLabel }}
            </button>
            <button
              v-if="secondaryRemedyLabel"
              type="button"
              class="ai-diagnostics-remedy-secondary"
              :disabled="busy"
              @click="runSecondaryRemedy"
            >
              {{ secondaryRemedyLabel }}
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
            <dt>{{ t.diagnosticsModelSource }}</dt>
            <dd>{{ modelSourceText }}</dd>
          </div>
          <div>
            <dt>{{ t.modelLabel }}</dt>
            <dd>{{ modelStatusText }}</dd>
          </div>
          <div>
            <dt>{{ t.webSearchLabel }}</dt>
            <dd>{{ webSearchDiagnosticsText }}</dd>
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
              ref="tokenInputRef"
              :value="tokenInput"
              type="password"
              class="ai-token-input"
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
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';

type RemedyKind =
  | 'ready'
  | 'noBaseUrl'
  | 'unauthorized'
  | 'rateLimited'
  | 'serverError'
  | 'network'
  | 'failed'
  | 'empty';

const props = defineProps<{
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
  modelStatusText: string;
  modelStatusKind: 'ready' | 'checking' | 'warning' | 'offline';
  webSearchDiagnosticsText: string;
  modelSourceText: string;
  modelHintText: string;
  remedyKind: RemedyKind;
  modelCount: number;
  lastChecked: string;
  baseUrlInput: string;
  tokenInput: string;
  persistEnabled: boolean;
  configMessage: string;
  isDark: boolean;
  t: I18nMessages;
}>();

const emit = defineEmits<{
  refresh: [];
  copy: [];
  close: [];
  testConfig: [];
  saveConfig: [];
  useDefaultBaseUrl: [];
  'update:baseUrlInput': [value: string];
  'update:tokenInput': [value: string];
  'update:persistEnabled': [value: boolean];
}>();

const tokenInputRef = ref<HTMLInputElement>();

const remedyTitle = computed(() => {
  switch (props.remedyKind) {
    case 'noBaseUrl':
      return props.t.diagnosticsRemedyNoBaseUrlTitle;
    case 'unauthorized':
      return props.t.diagnosticsRemedyUnauthorizedTitle;
    case 'rateLimited':
      return props.t.diagnosticsRemedyRateLimitedTitle;
    case 'serverError':
      return props.t.diagnosticsRemedyServerTitle;
    case 'network':
      return props.t.diagnosticsRemedyNetworkTitle;
    default:
      return props.t.diagnosticsRemedyGenericTitle;
  }
});

const remedyText = computed(() => {
  switch (props.remedyKind) {
    case 'noBaseUrl':
      return props.t.diagnosticsRemedyNoBaseUrlText;
    case 'unauthorized':
      return props.t.diagnosticsRemedyUnauthorizedText;
    case 'rateLimited':
      return props.t.diagnosticsRemedyRateLimitedText;
    case 'serverError':
      return props.t.diagnosticsRemedyServerText;
    case 'network':
      return props.t.diagnosticsRemedyNetworkText;
    default:
      return props.t.diagnosticsRemedyGenericText;
  }
});

const primaryRemedyLabel = computed(() => {
  if (props.remedyKind === 'noBaseUrl' || props.remedyKind === 'network') {
    return props.t.diagnosticsUseDefaultBaseUrl;
  }
  if (props.remedyKind === 'unauthorized') return props.t.diagnosticsFocusToken;
  return props.t.diagnosticsRefresh;
});

const secondaryRemedyLabel = computed(() => {
  if (props.remedyKind === 'unauthorized') return props.t.diagnosticsClearToken;
  if (props.remedyKind === 'noBaseUrl') return '';
  return props.t.diagnosticsRefresh;
});

function runPrimaryRemedy() {
  if (props.remedyKind === 'noBaseUrl' || props.remedyKind === 'network') {
    emit('useDefaultBaseUrl');
    return;
  }
  if (props.remedyKind === 'unauthorized') {
    tokenInputRef.value?.focus();
    return;
  }
  emit('refresh');
}

function runSecondaryRemedy() {
  if (props.remedyKind === 'unauthorized') {
    emit('update:tokenInput', '');
    tokenInputRef.value?.focus();
    return;
  }
  emit('refresh');
}
</script>
