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
          <div v-if="modelHealthText">
            <dt>Model health</dt>
            <dd>{{ modelHealthText }}</dd>
          </div>
          <div>
            <dt>{{ t.webSearchLabel }}</dt>
            <dd>{{ webSearchDiagnosticsText }}</dd>
          </div>
          <div v-if="responseTimingSummary">
            <dt>Last response timing</dt>
            <dd>{{ responseTimingSummary }}</dd>
          </div>
          <div v-if="responseTimingHistory?.length">
            <dt>Recent response timings</dt>
            <dd>
              <ol class="ai-diagnostics-timing-history">
                <li v-for="item in responseTimingHistory" :key="item">{{ item }}</li>
              </ol>
            </dd>
          </div>
          <div v-if="responseTimingSamples?.length">
            <dt>Latency trend</dt>
            <dd>
              <div class="ai-diagnostics-latency-chart" aria-label="Recent response latency trend">
                <div
                  v-for="sample in responseTimingSamples"
                  :key="sample.label"
                  class="ai-diagnostics-latency-row"
                >
                  <span class="ai-diagnostics-latency-label">{{ sample.model || 'model' }}</span>
                  <span class="ai-diagnostics-latency-bar">
                    <span
                      class="ai-diagnostics-latency-total"
                      :style="{ width: timingPercent(sample.totalMs) }"
                    ></span>
                    <span
                      class="ai-diagnostics-latency-ttft"
                      :style="{ width: timingPercent(sample.ttftMs || 0) }"
                    ></span>
                  </span>
                  <span class="ai-diagnostics-latency-value">{{
                    formatTiming(sample.totalMs)
                  }}</span>
                </div>
              </div>
            </dd>
          </div>
          <div v-if="slowRequestHintText">
            <dt>Slow request guidance</dt>
            <dd>{{ slowRequestHintText }}</dd>
          </div>
          <div>
            <dt>Model benchmark</dt>
            <dd>
              <button
                type="button"
                class="ai-diagnostics-benchmark-button"
                :disabled="busy || benchmarkBusy"
                @click="$emit('runBenchmark')"
              >
                {{ benchmarkBusy ? 'Benchmarking…' : 'Run benchmark' }}
              </button>
              <span v-if="benchmarkSummary" class="ai-diagnostics-benchmark-summary">
                {{ benchmarkSummary }}
              </span>
              <ol v-if="benchmarkRows?.length" class="ai-diagnostics-timing-history">
                <li v-for="row in benchmarkRows" :key="`${row.model}-${row.promptLabel}`">
                  {{ row.model }} · {{ row.promptLabel }} ·
                  {{ row.success ? formatTiming(row.elapsedMs) : row.error || 'failed' }}
                </li>
              </ol>
            </dd>
          </div>
          <div v-if="webSearchStats && webSearchStats.attempts">
            <dt>Web search stats</dt>
            <dd>
              <div
                class="ai-diagnostics-mini-chart"
                aria-label="Web search success and fallback rates"
              >
                <span
                  class="ai-diagnostics-mini-chart-ok"
                  :style="{ width: statPercent(webSearchStats.successes, webSearchStats.attempts) }"
                ></span>
                <span
                  class="ai-diagnostics-mini-chart-fallback"
                  :style="{ width: statPercent(webSearchStats.fallbacks, webSearchStats.attempts) }"
                ></span>
              </div>
              <span>
                {{ webSearchStats.successes || 0 }}/{{ webSearchStats.attempts }} ok ·
                {{ webSearchStats.fallbacks || 0 }} fallback ·
                {{ webSearchStats.averageDurationMs || 0 }}ms avg
              </span>
            </dd>
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

interface ResponseTimingSample {
  label: string;
  model?: string;
  totalMs: number;
  ttftMs?: number;
}

interface BenchmarkRow {
  model: string;
  promptLabel: string;
  success: boolean;
  elapsedMs: number;
  error?: string;
}

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
  modelHealthText?: string;
  webSearchDiagnosticsText: string;
  webSearchStats?: Record<string, number> | null;
  responseTimingSummary?: string;
  responseTimingHistory?: string[];
  responseTimingSamples?: ResponseTimingSample[];
  slowRequestHintText?: string;
  benchmarkBusy?: boolean;
  benchmarkSummary?: string;
  benchmarkRows?: BenchmarkRow[];
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
  runBenchmark: [];
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

function statPercent(value: number | undefined, total: number | undefined) {
  if (!value || !total || total <= 0) return '0%';
  return `${Math.max(0, Math.min(100, Math.round((value / total) * 100)))}%`;
}

const maxTimingMs = computed(() =>
  Math.max(1, ...((props.responseTimingSamples ?? []).map((sample) => sample.totalMs) || [1])),
);

function timingPercent(value: number) {
  return `${Math.max(4, Math.min(100, Math.round((value / maxTimingMs.value) * 100)))}%`;
}

function formatTiming(value: number) {
  return value < 1000 ? `${Math.round(value)}ms` : `${(value / 1000).toFixed(1)}s`;
}
</script>

<style scoped>
.ai-diagnostics-mini-chart {
  display: flex;
  width: 120px;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.25);
  margin-bottom: 4px;
}

.ai-diagnostics-mini-chart-ok {
  background: #22c55e;
}

.ai-diagnostics-mini-chart-fallback {
  background: #f59e0b;
}

.ai-diagnostics-latency-chart {
  display: grid;
  gap: 6px;
  min-width: 160px;
}

.ai-diagnostics-latency-row {
  display: grid;
  grid-template-columns: minmax(70px, 1fr) 96px auto;
  align-items: center;
  gap: 6px;
}

.ai-diagnostics-latency-label,
.ai-diagnostics-latency-value {
  font-size: 11px;
  color: rgba(71, 85, 105, 0.9);
}

.ai-diagnostics-latency-bar {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.25);
}

.ai-diagnostics-latency-total,
.ai-diagnostics-latency-ttft {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  border-radius: inherit;
}

.ai-diagnostics-latency-total {
  background: rgba(99, 102, 241, 0.45);
}

.ai-diagnostics-latency-ttft {
  background: rgba(34, 197, 94, 0.75);
}

.ai-diagnostics-benchmark-button {
  margin-right: 8px;
  padding: 4px 8px;
  border: 1px solid rgba(148, 163, 184, 0.4);
  border-radius: 6px;
  background: white;
  color: #334155;
  cursor: pointer;
}

.ai-diagnostics-benchmark-button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.ai-diagnostics-benchmark-summary {
  color: rgba(71, 85, 105, 0.9);
}
</style>
