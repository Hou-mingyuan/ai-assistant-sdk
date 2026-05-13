<template>
  <section class="admin-demo">
    <div class="admin-demo-head">
      <h2>🛠 Admin SDK Demo</h2>
      <button type="button" class="admin-demo-toggle" @click="expanded = !expanded">
        {{ expanded ? '收起' : '展开' }}
      </button>
    </div>
    <p class="admin-demo-hint">
      演示如何用 <code>adminApi</code> SDK 调用 <code>/ai-assistant/admin/*</code> endpoints。
      需要后端启用 <code>AdminAuthFilter</code> 且持有有效的 <code>X-Admin-Token</code>。
    </p>

    <div v-if="expanded" class="admin-demo-body">
      <label class="admin-demo-row">
        <span>Base URL</span>
        <input v-model="baseUrl" type="text" placeholder="/ai-assistant" />
      </label>
      <label class="admin-demo-row">
        <span>Admin Token</span>
        <input v-model="adminToken" type="password" placeholder="admin token (从 server 配置取)" />
      </label>

      <div class="admin-demo-actions">
        <button type="button" :disabled="busy" @click="callOverview">Overview</button>
        <button type="button" :disabled="busy" @click="callRagStats">RAG Stats</button>
        <button type="button" :disabled="busy" @click="callPrompts">Prompts</button>
        <button type="button" :disabled="busy" @click="callSystem">System Info</button>
        <button type="button" :disabled="busy" @click="callFallback">Fallback Chain</button>
      </div>

      <div v-if="lastCall" class="admin-demo-result">
        <div class="admin-demo-meta">
          <span :class="['admin-demo-status', lastCall.success ? 'ok' : 'err']">
            {{ lastCall.success ? '✓' : '✗' }} {{ lastCall.endpoint }}
            <span v-if="lastCall.status">[HTTP {{ lastCall.status }}]</span>
          </span>
          <span class="admin-demo-elapsed">{{ lastCall.elapsedMs }} ms</span>
        </div>
        <pre class="admin-demo-json">{{ pretty(lastCall.payload) }}</pre>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import {
  adminOverview,
  adminRagStats,
  adminListPrompts,
  adminSystemInfo,
  adminGetFallbackChain,
  type AdminResult,
} from '@ai-assistant/vue';

const expanded = ref(false);
const baseUrl = ref(import.meta.env.VITE_AI_ASSISTANT_BASE_URL || '/ai-assistant');
const adminToken = ref('');
const busy = ref(false);

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
      payload: { error: '请先填写 Admin Token' },
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
  } finally {
    busy.value = false;
  }
}

const callOverview = () => run('GET /admin/overview', () => adminOverview(baseUrl.value, adminToken.value));
const callRagStats = () => run('GET /admin/rag/stats', () => adminRagStats(baseUrl.value, adminToken.value));
const callPrompts = () => run('GET /admin/prompts', () => adminListPrompts(baseUrl.value, adminToken.value));
const callSystem = () => run('GET /admin/system', () => adminSystemInfo(baseUrl.value, adminToken.value));
const callFallback = () => run('GET /admin/fallback-chain', () => adminGetFallbackChain(baseUrl.value, adminToken.value));

function pretty(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
</script>

<style scoped>
.admin-demo {
  margin-top: 2rem;
  padding: 1rem 1.25rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.04), rgba(6, 182, 212, 0.02));
}
.admin-demo-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}
.admin-demo-head h2 {
  margin: 0;
  font-size: 1.05rem;
}
.admin-demo-toggle {
  padding: 4px 10px;
  font-size: 12px;
  border-radius: 5px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
}
.admin-demo-hint {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  color: #475569;
}
.admin-demo-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 0.85rem;
}
.admin-demo-row span {
  width: 100px;
  color: #475569;
}
.admin-demo-row input {
  flex: 1;
  padding: 5px 9px;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  font-size: 0.85rem;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}
.admin-demo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 12px 0;
}
.admin-demo-actions button {
  padding: 5px 12px;
  font-size: 12px;
  border-radius: 5px;
  border: 1px solid #0ea5e9;
  background: #fff;
  color: #0ea5e9;
  cursor: pointer;
  transition: all 0.15s ease;
}
.admin-demo-actions button:hover:not(:disabled) {
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  color: #fff;
}
.admin-demo-actions button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.admin-demo-result {
  margin-top: 10px;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
}
.admin-demo-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  margin-bottom: 6px;
}
.admin-demo-status.ok { color: #15803d; font-weight: 600; }
.admin-demo-status.err { color: #b91c1c; font-weight: 600; }
.admin-demo-elapsed { color: #64748b; font-variant-numeric: tabular-nums; }
.admin-demo-json {
  margin: 0;
  font-size: 11px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  max-height: 300px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
