<template>
  <section class="admin-app" :class="{ 'admin-app--collapsed': !expanded }">
    <header class="admin-app-head">
      <div class="admin-app-title">
        <span class="admin-app-icon" aria-hidden="true">🛠</span>
        <h2>Admin Console</h2>
        <span v-if="lastCall" class="admin-app-badge" :class="lastCall.success ? 'ok' : 'err'">
          {{ lastCall.success ? '✓' : '✗' }} last
        </span>
      </div>
      <div class="admin-app-actions">
        <span class="admin-app-hint">
          调用 <code>/ai-assistant/admin/*</code> · 需要 <code>X-Admin-Token</code>
        </span>
        <button
          type="button"
          class="admin-app-toggle"
          :aria-expanded="expanded"
          @click="expanded = !expanded"
        >
          {{ expanded ? '收起' : '展开' }}
        </button>
      </div>
    </header>

    <div v-if="expanded" class="admin-app-body">
      <!-- Connection / token bar -->
      <div class="admin-app-conn">
        <label class="admin-app-field admin-app-field--grow">
          <span>Base URL</span>
          <input v-model="baseUrl" type="text" placeholder="/ai-assistant" />
        </label>
        <label class="admin-app-field admin-app-field--grow">
          <span>Admin Token</span>
          <input
            v-model="adminToken"
            type="password"
            autocomplete="off"
            placeholder="X-Admin-Token (from server config)"
          />
        </label>
      </div>

      <!-- Tab nav -->
      <nav class="admin-app-tabs" role="tablist">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          role="tab"
          :class="['admin-app-tab', { active: currentTab === tab.id }]"
          :aria-selected="currentTab === tab.id"
          @click="currentTab = tab.id"
        >
          <span class="admin-app-tab-emoji" aria-hidden="true">{{ tab.emoji }}</span>
          {{ tab.label }}
        </button>
      </nav>

      <!-- Panels -->
      <div class="admin-app-panel" role="tabpanel">
        <!-- Overview -->
        <div v-if="currentTab === 'overview'" class="admin-app-grid">
          <button type="button" class="admin-btn" :disabled="busy" @click="callOverview">
            GET /admin/overview
          </button>
          <button type="button" class="admin-btn" :disabled="busy" @click="callSystem">
            GET /admin/system
          </button>
          <button type="button" class="admin-btn" :disabled="busy" @click="callPlugins">
            GET /admin/plugins
          </button>
          <button type="button" class="admin-btn" :disabled="busy" @click="callTools">
            GET /admin/tools
          </button>
        </div>

        <!-- Tokens / Quotas -->
        <div v-else-if="currentTab === 'tokens'" class="admin-app-form">
          <div class="admin-app-row">
            <label class="admin-app-field admin-app-field--grow">
              <span>Tenant ID (optional)</span>
              <input v-model="tokensTenantId" type="text" placeholder="empty = all tenants" />
            </label>
            <button type="button" class="admin-btn" :disabled="busy" @click="callTokens">
              List tokens
            </button>
          </div>
          <div class="admin-app-row">
            <label class="admin-app-field admin-app-field--grow">
              <span>Set quota: Tenant</span>
              <input v-model="quotaTenantId" type="text" placeholder="required" />
            </label>
            <label class="admin-app-field">
              <span>Daily limit</span>
              <input v-model.number="quotaDailyLimit" type="number" min="0" placeholder="100000" />
            </label>
            <button
              type="button"
              class="admin-btn admin-btn--primary"
              :disabled="busy || !quotaTenantId"
              @click="callSetQuota"
            >
              POST quota
            </button>
          </div>
        </div>

        <!-- Prompts -->
        <div v-else-if="currentTab === 'prompts'" class="admin-app-form">
          <div class="admin-app-row">
            <button type="button" class="admin-btn" :disabled="busy" @click="callPrompts">
              List prompts
            </button>
          </div>
          <div class="admin-app-row admin-app-row--stack">
            <label class="admin-app-field admin-app-field--grow">
              <span>Name</span>
              <input v-model="promptName" type="text" placeholder="my-template" />
            </label>
            <label class="admin-app-field admin-app-field--grow">
              <span>Template (supports &#123;&#123;var&#125;&#125;)</span>
              <textarea v-model="promptTemplate" rows="3" placeholder="Hello &#123;&#123;name&#125;&#125;"></textarea>
            </label>
            <button
              type="button"
              class="admin-btn admin-btn--primary"
              :disabled="busy || !promptName || !promptTemplate"
              @click="callCreatePrompt"
            >
              POST prompt
            </button>
          </div>
        </div>

        <!-- RAG -->
        <div v-else-if="currentTab === 'rag'" class="admin-app-form">
          <div class="admin-app-row">
            <label class="admin-app-field admin-app-field--grow">
              <span>Namespace (optional)</span>
              <input v-model="ragNamespace" type="text" placeholder="default" />
            </label>
            <button type="button" class="admin-btn" :disabled="busy" @click="callRagStats">
              GET stats
            </button>
          </div>
          <div class="admin-app-row admin-app-row--stack">
            <label class="admin-app-field admin-app-field--grow">
              <span>Doc ID (optional)</span>
              <input v-model="ragDocId" type="text" placeholder="auto" />
            </label>
            <label class="admin-app-field admin-app-field--grow">
              <span>Content</span>
              <textarea
                v-model="ragContent"
                rows="4"
                placeholder="Paste document text here..."
              ></textarea>
            </label>
            <button
              type="button"
              class="admin-btn admin-btn--primary"
              :disabled="busy || !ragContent"
              @click="callIngestRag"
            >
              POST ingest
            </button>
          </div>
        </div>

        <!-- A/B Tests -->
        <div v-else-if="currentTab === 'ab'" class="admin-app-form">
          <div class="admin-app-row">
            <button type="button" class="admin-btn" :disabled="busy" @click="callListAb">
              List A/B tests
            </button>
          </div>
          <div class="admin-app-row admin-app-row--wrap">
            <label class="admin-app-field">
              <span>Name</span>
              <input v-model="abName" type="text" placeholder="exp-1" />
            </label>
            <label class="admin-app-field">
              <span>Model A</span>
              <input v-model="abModelA" type="text" placeholder="gpt-4o-mini" />
            </label>
            <label class="admin-app-field">
              <span>Model B</span>
              <input v-model="abModelB" type="text" placeholder="claude-3-haiku" />
            </label>
            <label class="admin-app-field admin-app-field--narrow">
              <span>% A</span>
              <input v-model.number="abPercentA" type="number" min="0" max="100" />
            </label>
            <button
              type="button"
              class="admin-btn admin-btn--primary"
              :disabled="busy || !abName || !abModelA || !abModelB"
              @click="callConfigAb"
            >
              POST config
            </button>
          </div>
        </div>

        <!-- Fallback chain -->
        <div v-else-if="currentTab === 'fallback'" class="admin-app-form">
          <div class="admin-app-row">
            <button type="button" class="admin-btn" :disabled="busy" @click="callFallback">
              GET chain
            </button>
          </div>
          <div class="admin-app-row admin-app-row--stack">
            <label class="admin-app-field admin-app-field--grow">
              <span>New chain (comma-separated)</span>
              <input
                v-model="fallbackChain"
                type="text"
                placeholder="gpt-4o-mini,claude-3-haiku,gemini-flash"
              />
            </label>
            <button
              type="button"
              class="admin-btn admin-btn--primary"
              :disabled="busy || !fallbackChain"
              @click="callSetFallback"
            >
              POST chain
            </button>
          </div>
        </div>

        <!-- Plugins -->
        <div v-else-if="currentTab === 'plugins'" class="admin-app-form">
          <div class="admin-app-row">
            <button type="button" class="admin-btn" :disabled="busy" @click="callPlugins">
              List plugins
            </button>
          </div>
          <div class="admin-app-row">
            <label class="admin-app-field admin-app-field--grow">
              <span>Plugin ID</span>
              <input v-model="pluginId" type="text" placeholder="plugin id to unload" />
            </label>
            <button
              type="button"
              class="admin-btn admin-btn--danger"
              :disabled="busy || !pluginId"
              @click="callUnloadPlugin"
            >
              POST unload
            </button>
          </div>
        </div>
      </div>

      <!-- Last call result -->
      <div v-if="lastCall" class="admin-app-result">
        <div class="admin-app-meta">
          <span class="admin-app-meta-endpoint">
            <span :class="['admin-app-status', lastCall.success ? 'ok' : 'err']">
              {{ lastCall.success ? '✓ OK' : '✗ FAIL' }}
            </span>
            <code>{{ lastCall.endpoint }}</code>
            <span v-if="lastCall.status" class="admin-app-http">HTTP {{ lastCall.status }}</span>
          </span>
          <span class="admin-app-elapsed">{{ lastCall.elapsedMs }} ms</span>
        </div>
        <pre class="admin-app-json">{{ pretty(lastCall.payload) }}</pre>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  adminOverview,
  adminListTokens,
  adminSetTokenQuota,
  adminListPrompts,
  adminCreatePrompt,
  adminListTools,
  adminIngestRag,
  adminRagStats,
  adminConfigureAbTest,
  adminListAbTests,
  adminSetFallbackChain,
  adminGetFallbackChain,
  adminListPlugins,
  adminUnloadPlugin,
  adminSystemInfo,
  type AdminResult,
} from '@ai-assistant/vue';

interface TabDef {
  id: 'overview' | 'tokens' | 'prompts' | 'rag' | 'ab' | 'fallback' | 'plugins';
  label: string;
  emoji: string;
}

const tabs: TabDef[] = [
  { id: 'overview', label: 'Overview', emoji: '📊' },
  { id: 'tokens', label: 'Tokens & Quota', emoji: '🔑' },
  { id: 'prompts', label: 'Prompts', emoji: '📝' },
  { id: 'rag', label: 'RAG', emoji: '🧠' },
  { id: 'ab', label: 'A/B Tests', emoji: '⚖️' },
  { id: 'fallback', label: 'Fallback', emoji: '🪂' },
  { id: 'plugins', label: 'Plugins', emoji: '🧩' },
];

const expanded = ref(true);
const currentTab = ref<TabDef['id']>('overview');
const baseUrl = ref(import.meta.env.VITE_AI_ASSISTANT_BASE_URL || '/ai-assistant');
const adminToken = ref('');
const busy = ref(false);

const tokensTenantId = ref('');
const quotaTenantId = ref('');
const quotaDailyLimit = ref<number>(100000);

const promptName = ref('');
const promptTemplate = ref('');

const ragNamespace = ref('');
const ragDocId = ref('');
const ragContent = ref('');

const abName = ref('');
const abModelA = ref('');
const abModelB = ref('');
const abPercentA = ref<number>(50);

const fallbackChain = ref('');

const pluginId = ref('');

interface CallRecord {
  endpoint: string;
  success: boolean;
  status?: number;
  elapsedMs: number;
  payload: unknown;
}
const lastCall = ref<CallRecord | null>(null);

async function run(endpoint: string, fn: () => Promise<AdminResult<unknown>>) {
  if (busy.value) return;
  if (!adminToken.value.trim()) {
    lastCall.value = {
      endpoint,
      success: false,
      elapsedMs: 0,
      payload: { error: '请先在顶部填写 Admin Token' },
    };
    return;
  }
  busy.value = true;
  const start = performance.now();
  try {
    const r = await fn();
    lastCall.value = {
      endpoint,
      success: r.success,
      status: r.status,
      elapsedMs: Math.round(performance.now() - start),
      payload: r.success ? r.data : { error: r.error },
    };
  } catch (err) {
    lastCall.value = {
      endpoint,
      success: false,
      elapsedMs: Math.round(performance.now() - start),
      payload: { error: err instanceof Error ? err.message : String(err) },
    };
  } finally {
    busy.value = false;
  }
}

const callOverview = () =>
  run('GET /admin/overview', () => adminOverview(baseUrl.value, adminToken.value));
const callSystem = () =>
  run('GET /admin/system', () => adminSystemInfo(baseUrl.value, adminToken.value));
const callTools = () =>
  run('GET /admin/tools', () => adminListTools(baseUrl.value, adminToken.value));
const callTokens = () =>
  run('GET /admin/tokens', () =>
    adminListTokens(baseUrl.value, adminToken.value, tokensTenantId.value.trim() || undefined),
  );
const callSetQuota = () =>
  run('POST /admin/tokens/quota', () =>
    adminSetTokenQuota(
      baseUrl.value,
      adminToken.value,
      quotaTenantId.value.trim(),
      Math.max(0, Number(quotaDailyLimit.value) || 0),
    ),
  );
const callPrompts = () =>
  run('GET /admin/prompts', () => adminListPrompts(baseUrl.value, adminToken.value));
const callCreatePrompt = () =>
  run('POST /admin/prompts', () =>
    adminCreatePrompt(baseUrl.value, adminToken.value, promptName.value, promptTemplate.value),
  );
const callRagStats = () =>
  run('GET /admin/rag/stats', () =>
    adminRagStats(baseUrl.value, adminToken.value, ragNamespace.value.trim() || undefined),
  );
const callIngestRag = () =>
  run('POST /admin/rag/ingest', () =>
    adminIngestRag(baseUrl.value, adminToken.value, ragContent.value, {
      namespace: ragNamespace.value.trim() || undefined,
      docId: ragDocId.value.trim() || undefined,
    }),
  );
const callListAb = () =>
  run('GET /admin/ab-test', () => adminListAbTests(baseUrl.value, adminToken.value));
const callConfigAb = () =>
  run('POST /admin/ab-test', () =>
    adminConfigureAbTest(
      baseUrl.value,
      adminToken.value,
      abName.value,
      abModelA.value,
      abModelB.value,
      { percentA: Math.max(0, Math.min(100, Number(abPercentA.value) || 50)) },
    ),
  );
const callFallback = () =>
  run('GET /admin/fallback-chain', () =>
    adminGetFallbackChain(baseUrl.value, adminToken.value),
  );
const callSetFallback = () => {
  const chain = fallbackChain.value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return run('POST /admin/fallback-chain', () =>
    adminSetFallbackChain(baseUrl.value, adminToken.value, chain),
  );
};
const callPlugins = () =>
  run('GET /admin/plugins', () => adminListPlugins(baseUrl.value, adminToken.value));
const callUnloadPlugin = () =>
  run('POST /admin/plugins/{id}/unload', () =>
    adminUnloadPlugin(baseUrl.value, adminToken.value, pluginId.value.trim()),
  );

function pretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
</script>

<style scoped>
.admin-app {
  margin: 2rem 0 0;
  padding: 1.25rem 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.06), rgba(6, 182, 212, 0.03));
  box-shadow: 0 4px 16px -8px rgba(14, 165, 233, 0.18);
  font-family: system-ui, sans-serif;
}
.admin-app--collapsed {
  padding: 0.75rem 1rem;
}
.admin-app-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.admin-app-title {
  display: flex;
  align-items: center;
  gap: 10px;
}
.admin-app-title h2 {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
.admin-app-icon {
  font-size: 1.3rem;
}
.admin-app-badge {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 999px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  font-weight: 600;
}
.admin-app-badge.ok {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}
.admin-app-badge.err {
  background: rgba(220, 38, 38, 0.12);
  color: #b91c1c;
}
.admin-app-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.admin-app-hint {
  font-size: 0.78rem;
  color: #64748b;
}
.admin-app-hint code {
  background: rgba(15, 23, 42, 0.06);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 0.74rem;
}
.admin-app-toggle {
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  border: 1px solid #94a3b8;
  background: #fff;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
}
.admin-app-toggle:hover {
  border-color: #0ea5e9;
  color: #0ea5e9;
}
.admin-app-body {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.admin-app-conn {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.admin-app-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 0.82rem;
  min-width: 160px;
}
.admin-app-field--grow {
  flex: 1;
}
.admin-app-field--narrow {
  min-width: 70px;
}
.admin-app-field span {
  color: #475569;
  font-weight: 500;
  font-size: 0.74rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.admin-app-field input,
.admin-app-field textarea {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 0.85rem;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  transition: border-color 0.15s ease;
}
.admin-app-field textarea {
  resize: vertical;
  min-height: 64px;
}
.admin-app-field input:focus,
.admin-app-field textarea:focus {
  outline: 2px solid rgba(14, 165, 233, 0.3);
  outline-offset: 1px;
  border-color: #0ea5e9;
}
.admin-app-tabs {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
}
.admin-app-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 0.82rem;
  font-weight: 500;
  border-radius: 8px 8px 0 0;
  border: 1px solid transparent;
  border-bottom: none;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  transition: all 0.15s ease;
}
.admin-app-tab:hover {
  background: rgba(14, 165, 233, 0.06);
  color: #0ea5e9;
}
.admin-app-tab.active {
  background: #fff;
  border-color: #e2e8f0;
  color: #0ea5e9;
  box-shadow: 0 -2px 0 0 #0ea5e9 inset;
}
.admin-app-tab-emoji {
  font-size: 1rem;
}
.admin-app-panel {
  background: #fff;
  border-radius: 10px;
  padding: 14px;
  border: 1px solid #e2e8f0;
}
.admin-app-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}
.admin-app-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.admin-app-row {
  display: flex;
  gap: 10px;
  align-items: flex-end;
}
.admin-app-row--stack {
  flex-direction: column;
  align-items: stretch;
}
.admin-app-row--wrap {
  flex-wrap: wrap;
}
.admin-btn {
  padding: 7px 14px;
  font-size: 0.82rem;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid #0ea5e9;
  background: #fff;
  color: #0ea5e9;
  cursor: pointer;
  transition: all 0.18s ease;
  white-space: nowrap;
}
.admin-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  color: #fff;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px -4px rgba(14, 165, 233, 0.5);
}
.admin-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.admin-btn--primary {
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  color: #fff;
  border-color: transparent;
}
.admin-btn--primary:hover:not(:disabled) {
  filter: brightness(1.08);
}
.admin-btn--danger {
  border-color: #ef4444;
  color: #ef4444;
}
.admin-btn--danger:hover:not(:disabled) {
  background: #ef4444;
  color: #fff;
}
.admin-app-result {
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 10px;
  padding: 12px 14px;
  border: 1px solid #1e293b;
}
.admin-app-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-size: 0.78rem;
  flex-wrap: wrap;
  gap: 8px;
}
.admin-app-meta-endpoint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.admin-app-status.ok {
  color: #4ade80;
  font-weight: 600;
}
.admin-app-status.err {
  color: #f87171;
  font-weight: 600;
}
.admin-app-meta-endpoint code {
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.78rem;
  color: #93c5fd;
}
.admin-app-http {
  padding: 2px 6px;
  background: rgba(248, 113, 113, 0.12);
  color: #fca5a5;
  border-radius: 4px;
  font-variant-numeric: tabular-nums;
  font-size: 0.74rem;
}
.admin-app-elapsed {
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
  font-size: 0.78rem;
}
.admin-app-json {
  margin: 0;
  font-size: 0.78rem;
  line-height: 1.5;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  max-height: 360px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
