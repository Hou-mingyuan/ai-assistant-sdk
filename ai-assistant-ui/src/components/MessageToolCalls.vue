<template>
  <div v-if="toolCalls.length > 0" class="ai-tool-calls">
    <div v-for="(tc, tci) in toolCalls" :key="tci" class="ai-tool-call-item">
      <!-- Header: always visible -->
      <div class="ai-tool-call-summary">
        <span class="ai-tool-call-status" :class="'ai-tool-' + tc.status">
          <svg
            v-if="tc.status === 'running'"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
            class="ai-tool-spin"
          >
            <path
              d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
            />
          </svg>
          <svg
            v-else-if="tc.status === 'done'"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
            />
          </svg>
        </span>
        <span class="ai-tool-call-name">{{ tc.name }}</span>
        <span v-if="badge(tc)" class="ai-tool-call-badge">{{ badge(tc) }}</span>
      </div>

      <!-- Structured result: always visible, rendered without the model -->
      <div v-if="tc.structured" class="ai-tool-call-body ai-tool-structured">
        <template v-if="tc.structured.kind === 'records'">
          <div class="ai-tool-table-wrap">
            <table class="ai-tool-table">
              <thead>
                <tr>
                  <th class="ai-tool-table-idx">#</th>
                  <th v-for="(c, ci) in tc.structured.columns" :key="ci">{{ c }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="tc.structured.rows.length === 0">
                  <td :colspan="tc.structured.columns.length + 1" class="ai-tool-table-empty">
                    {{ emptyLabel }}
                  </td>
                </tr>
                <tr v-for="(row, ri) in tc.structured.rows" :key="ri">
                  <td class="ai-tool-table-idx">{{ offset(tc.structured) + ri + 1 }}</td>
                  <td v-for="(cell, ci) in row" :key="ci">{{ fmt(cell) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <!-- Pager: re-runs the same *_query_data tool with a new page (no model round-trip) -->
          <div v-if="canPage(tc)" class="ai-tool-pager">
            <button
              type="button"
              class="ai-tool-pager-btn"
              :disabled="busy[tci] || tc.structured.pageIndex <= 1"
              @click="goPage(tci, tc, tc.structured.pageIndex - 1, tc.structured.pageSize)"
            >
              ‹ {{ props.t?.toolPagePrev || '上一页' }}
            </button>
            <span class="ai-tool-pager-info">{{
              interpolate(props.t?.toolPageOf, '第 {page} / {pages} 页', {
                page: tc.structured.pageIndex,
                pages: pages(tc.structured),
              })
            }}</span>
            <button
              type="button"
              class="ai-tool-pager-btn"
              :disabled="busy[tci] || tc.structured.pageIndex >= pages(tc.structured)"
              @click="goPage(tci, tc, tc.structured.pageIndex + 1, tc.structured.pageSize)"
            >
              {{ props.t?.toolPageNext || '下一页' }} ›
            </button>
            <label class="ai-tool-pager-size">
              {{ props.t?.toolPageSize || '每页' }}
              <select
                :value="String(tc.structured.pageSize)"
                :disabled="busy[tci]"
                @change="goPage(tci, tc, 1, Number(($event.target as HTMLSelectElement).value))"
              >
                <option v-for="s in sizeOptions(tc.structured)" :key="s" :value="String(s)">{{ s }}</option>
              </select>
            </label>
            <span v-if="busy[tci]" class="ai-tool-pager-busy">{{ props.t?.toolPageLoading || '加载中…' }}</span>
            <span v-if="errors[tci]" class="ai-tool-pager-error">{{ errors[tci] }}</span>
          </div>
        </template>

        <ul v-else-if="tc.structured.kind === 'schema'" class="ai-tool-field-list">
          <li v-for="(f, fi) in tc.structured.fields" :key="fi" class="ai-tool-field">
            <span class="ai-tool-field-name">{{ f.name || f.id }}</span>
            <span v-if="f.id && f.id !== f.name" class="ai-tool-field-id">{{ f.id }}</span>
            <span v-if="f.type" class="ai-tool-field-type">{{ f.type }}</span>
          </li>
          <li v-if="tc.structured.fields.length === 0" class="ai-tool-table-empty">
            {{ emptyLabel }}
          </li>
        </ul>

        <div v-else class="ai-tool-chips">
          <span v-for="(m, mi) in tc.structured.modules" :key="mi" class="ai-tool-chip">
            <span class="ai-tool-chip-name">{{ m.name || m.id }}</span>
            <span v-if="m.id && m.id !== m.name" class="ai-tool-chip-id">{{ m.id }}</span>
            <span v-if="m.type" class="ai-tool-chip-type">{{ m.type }}</span>
          </span>
          <span v-if="tc.structured.modules.length === 0" class="ai-tool-table-empty">
            {{ emptyLabel }}
          </span>
        </div>
      </div>

      <!-- Raw arguments / raw JSON: collapsed when a structured view exists -->
      <details class="ai-tool-raw" :open="tc.status === 'running' || !tc.structured">
        <summary class="ai-tool-raw-summary">{{ rawLabel(tc) }}</summary>
        <div class="ai-tool-call-body">
          <pre v-if="tc.arguments" class="ai-tool-call-args">{{ tc.arguments }}</pre>
          <div v-if="tc.result" class="ai-tool-call-result">
            <span class="ai-tool-result-label">{{ toolResultLabel }}</span>
            <pre class="ai-tool-call-result-pre">{{ tc.result }}</pre>
          </div>
        </div>
      </details>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from 'vue';
import { parseToolResult } from '../types/message';
import type { ToolCallEntry, ToolResultStructured } from '../types/message';
import type { I18nMessages } from '../utils/i18n/types';
import type { ToolCallResult } from '../utils/api';

type RecordsResult = Extract<ToolResultStructured, { kind: 'records' }>;

const props = defineProps<{
  toolCalls: ToolCallEntry[];
  toolResultLabel: string;
  t?: I18nMessages;
  /** Host-provided re-query (POST /tools/execute). Present → pager is shown for *_query_data results. */
  callTool?: (name: string, args: Record<string, unknown>) => Promise<ToolCallResult>;
}>();

const PAGE_SIZES = [20, 50, 100];
/** Per-entry pager state, keyed by the index in `toolCalls`. */
const busy = reactive<Record<number, boolean>>({});
const errors = reactive<Record<number, string>>({});

function canPage(tc: ToolCallEntry): boolean {
  return (
    !!props.callTool &&
    tc.status === 'done' &&
    tc.structured?.kind === 'records' &&
    tc.name.endsWith('_query_data')
  );
}

function pages(s: RecordsResult): number {
  return Math.max(1, Math.ceil(Number(s.total) / Math.max(1, s.pageSize)));
}

/** Offer the standard sizes plus whatever the model originally asked for, so the select never goes blank. */
function sizeOptions(s: RecordsResult): number[] {
  return Array.from(new Set([...PAGE_SIZES, s.pageSize])).sort((a, b) => a - b);
}

/**
 * Re-run the tool with the original arguments but a new page. The entry lives on the message's
 * `toolCalls`, so assigning `structured`/`result` updates the rendered table in place.
 */
async function goPage(tci: number, tc: ToolCallEntry, pageIndex: number, pageSize: number): Promise<void> {
  if (!props.callTool || busy[tci]) return;
  let base: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(tc.arguments || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = parsed as Record<string, unknown>;
  } catch {
    base = {};
  }
  if (typeof base.moduleId !== 'string' || !base.moduleId) {
    errors[tci] = props.t?.toolPageNoArgs || '原始参数缺少 moduleId，无法翻页';
    return;
  }
  busy[tci] = true;
  errors[tci] = '';
  try {
    const res = await props.callTool(tc.name, { ...base, pageIndex, pageSize });
    if (!res.success) {
      errors[tci] = res.error || props.t?.toolPageFail || '翻页查询失败';
      return;
    }
    const raw = JSON.stringify(res.result ?? {});
    const structured = parseToolResult(raw);
    if (!structured || structured.kind !== 'records') {
      errors[tci] = props.t?.toolPageNoRecords || '返回结果不是记录集';
      return;
    }
    tc.structured = structured;
    tc.result = raw;
    tc.status = 'done';
  } catch (e) {
    errors[tci] = e instanceof Error ? e.message : String(e);
  } finally {
    busy[tci] = false;
  }
}

function interpolate(tpl: string | undefined, fallback: string, vars: Record<string, number>): string {
  let out = tpl || fallback;
  for (const [k, v] of Object.entries(vars)) out = out.replace(`{${k}}`, String(v));
  return out;
}

function offset(s: RecordsResult): number {
  return Math.max(0, (s.pageIndex - 1) * s.pageSize);
}

function badge(tc: ToolCallEntry): string {
  const s = tc.structured;
  if (!s) return '';
  if (s.kind === 'records') {
    return interpolate(props.t?.toolRowsSummary, '共 {total} 条 · 显示 {shown} 条 · 第 {page} 页', {
      total: s.total,
      shown: s.rows.length,
      page: s.pageIndex,
    });
  }
  if (s.kind === 'schema') return interpolate(props.t?.toolFieldsCount, '{count} 个字段', { count: s.fields.length });
  return interpolate(props.t?.toolModulesCount, '{total} 个模块', { total: s.total });
}

const emptyLabel = computed(() => props.t?.toolEmptyRecords || '没有符合条件的记录');

function rawLabel(tc: ToolCallEntry): string {
  if (!tc.structured) return tc.arguments ? (props.t?.toolShowRaw || '参数') : (props.t?.toolShowRaw || '原始数据');
  return props.t?.toolShowRaw || '查看原始结果';
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}
</script>

<style scoped>
.ai-tool-call-summary {
  cursor: default;
}
.ai-tool-call-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
  color: var(--ai-text, #171717);
  opacity: 0.65;
  white-space: nowrap;
}
.ai-tool-structured {
  border-top: 1px solid var(--ai-border, rgba(17, 17, 17, 0.08));
}
.ai-tool-table-wrap {
  margin: 4px 0;
  max-height: 280px;
  overflow: auto;
  border: 1px solid var(--ai-border, rgba(17, 17, 17, 0.08));
  border-radius: 6px;
}
.ai-tool-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11.5px;
  color: var(--ai-text, #171717);
}
.ai-tool-table th,
.ai-tool-table td {
  padding: 4px 8px;
  border-bottom: 1px solid var(--ai-border, rgba(17, 17, 17, 0.08));
  border-right: 1px solid var(--ai-border, rgba(17, 17, 17, 0.08));
  text-align: left;
  white-space: nowrap;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.ai-tool-table th {
  position: sticky;
  top: 0;
  background: var(--ai-surface, #f3f4f6);
  font-weight: 600;
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
}
.ai-tool-table tbody tr:hover td {
  background: color-mix(in srgb, var(--primary, #181818) 5%, transparent);
}
.ai-tool-table-idx {
  width: 2.2em;
  text-align: right;
  opacity: 0.55;
  font-variant-numeric: tabular-nums;
}
.ai-tool-table-empty {
  padding: 8px;
  font-size: 11.5px;
  opacity: 0.6;
  list-style: none;
}
.ai-tool-field-list,
.ai-tool-chips {
  margin: 4px 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
}
.ai-tool-field,
.ai-tool-chip {
  display: inline-flex;
  align-items: baseline;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid var(--ai-border, rgba(17, 17, 17, 0.08));
  background: var(--ai-surface, #f3f4f6);
  font-size: 11px;
  color: var(--ai-text, #171717);
}
.ai-tool-field-name,
.ai-tool-chip-name {
  font-weight: 600;
}
.ai-tool-field-id,
.ai-tool-chip-id,
.ai-tool-field-type,
.ai-tool-chip-type {
  font-family: 'SF Mono', 'Cascadia Code', 'Fira Code', monospace;
  opacity: 0.6;
}
.ai-tool-chip-type {
  text-transform: uppercase;
  font-size: 10px;
}
.ai-tool-raw {
  border-top: 1px solid var(--ai-border, rgba(17, 17, 17, 0.08));
}
.ai-tool-raw-summary {
  padding: 3px 10px;
  font-size: 11px;
  opacity: 0.6;
  cursor: pointer;
  user-select: none;
  list-style: none;
}
.ai-tool-raw-summary::-webkit-details-marker {
  display: none;
}
.ai-tool-raw-summary::before {
  content: '▸ ';
}
.ai-tool-raw[open] .ai-tool-raw-summary::before {
  content: '▾ ';
}
.ai-tool-raw .ai-tool-call-body {
  border-top: none;
}
.ai-tool-pager {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  padding: 4px 2px 2px;
  font-size: 11.5px;
  color: var(--ai-text, #171717);
}
.ai-tool-pager-btn {
  padding: 1px 8px;
  font-size: 11px;
  line-height: 1.5;
  border: 1px solid var(--ai-border, rgba(17, 17, 17, 0.12));
  border-radius: 4px;
  background: var(--ai-surface, #f3f4f6);
  color: inherit;
  cursor: pointer;
}
.ai-tool-pager-btn:hover:not(:disabled) {
  border-color: var(--primary, #181818);
}
.ai-tool-pager-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.ai-tool-pager-info {
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.ai-tool-pager-size {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  opacity: 0.8;
  white-space: nowrap;
}
.ai-tool-pager-size select {
  font-size: 11px;
  padding: 1px 2px;
  border: 1px solid var(--ai-border, rgba(17, 17, 17, 0.12));
  border-radius: 4px;
  background: var(--ai-surface, #f3f4f6);
  color: inherit;
}
.ai-tool-pager-busy {
  opacity: 0.6;
}
.ai-tool-pager-error {
  flex-basis: 100%;
  font-size: 11px;
  color: var(--ai-danger, #c0392b);
  word-break: break-all;
}
</style>
