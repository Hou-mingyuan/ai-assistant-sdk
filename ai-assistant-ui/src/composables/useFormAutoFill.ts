/**
 * useFormAutoFill
 * ---------------
 * Phase 1：把剪贴板里的 `A: 234 / B: 1234` 类键值对解析后，按字段名/语义自动
 * 写入页面表单。本 composable 串起 parser → scanner → matcher → filler 四个
 * pure-function 模块，并提供：
 *   - `dialogOpen` 等响应式状态，给 `<FormAutoFillDialog>` 当 props 用
 *   - `inspectPasteText(text)`：粘贴自动检测入口（用户在聊天输入框 Ctrl+V）
 *   - `triggerFromText(text)`：斜杠命令 `/fill` 手动入口
 *   - `confirmFill()` / `undoLastFill()`：用户在对话框点确认/撤销时调用
 *
 * 设计要点：
 *   - 不直接 import `i18n` 模块；调用方传入 `t` 即可。
 *   - 不直接做 LLM 兜底（Phase 3 才上）；本期 `allowLlmFallback` 仅占位。
 *   - 不监听全局 `paste` 事件，由调用方在合适时机（如 ChatInputArea 的 paste
 *     回调）显式调用 `inspectPasteText`，避免污染宿主页面其它输入框。
 *   - `confirmFill` 总是在一次 microtask 内完成所有写入，方便整批 undo。
 */

import { computed, ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import { parseFormData, parseFormDataAsTable } from '../utils/formAutoFill/parser';
import type { ParsedPair, ParsedTable } from '../utils/formAutoFill/parser';
import { scanFormFields, scanFormRows } from '../utils/formAutoFill/scanner';
import type {
  FormField,
  FormRow,
  ScanFormFieldsOptions,
  ScanFormRowsOptions,
} from '../utils/formAutoFill/scanner';
import { matchFields } from '../utils/formAutoFill/matcher';
import type { MatchResult, MatcherOptions } from '../utils/formAutoFill/matcher';
import {
  fillField,
  highlightFilledField,
  undoFills,
  clearFillHighlights,
} from '../utils/formAutoFill/filler';
import type { FillRecord } from '../utils/formAutoFill/filler';

export interface FormAutoFillOptions {
  /** CSS selector 限定扫描根节点。默认 `body`。若页面里有 `[data-ai-fillable]` 元素，会优先扫那些。 */
  target?: string;
  /** 排除字段的 selector 列表（如全局搜索框） */
  excludeSelectors?: string[];
  /** 用户自定义同义词字典：每组（key 不重要）里的字符串视为同义 */
  synonyms?: Record<string, string[]>;
  /** 关闭内置同义词字典 */
  disableBuiltinSynonyms?: boolean;
  /**
   * Option alias 字典：把 `<option value="gz">广州</option>` 之类的 option
   * 与用户可能写的别名（`'guangzhou'`、`'canton'` 等）打通。键是 canonical
   * 值（通常是 option 的 label 或 value），值是别名列表。与内置字典合并。
   *
   * 例：
   * ```ts
   * optionAliases: {
   *   '广州': ['canton', 'guang-zhou'],
   *   'admin': ['root', '管理员'],
   * }
   * ```
   */
  optionAliases?: Record<string, string[]>;
  /** 匹配最低置信度，默认 30；低于此值的字段在预览里不会被默认勾选 */
  minConfidence?: number;
  /** 在预览里默认勾选所需的置信度（一般高于 minConfidence），默认 50 */
  defaultPickConfidence?: number;
  /** 粘贴时自动检测并弹横幅/对话框，默认 true */
  autoDetectPaste?: boolean;
  /** 触发自动检测所需的最少键值对数，默认 2 */
  autoDetectMinPairs?: number;
  /**
   * （Phase 3 占位）允许调用 LLM 兜底匹配低置信度字段。Phase 1 仅暴露字段，
   * 不会真的发起请求；composable 只在所有匹配结果都 < 阈值时把状态置 true，
   * 由调用方在 Phase 3 接上 /chat。
   */
  allowLlmFallback?: boolean;
  /**
   * Phase 2: 表格批量填入。开启时粘贴 TSV / CSV / Markdown / 多空格对齐的
   * 多行数据会被识别为「N 行 × M 列表格」，每行依次填入页面上 `[data-ai-
   * fillable-row]` 标记的行容器（按 DOM 顺序）。
   *
   * - `false` / `undefined`（默认）：关闭表格模式，多行粘贴仍按单 pair 解析
   * - `true`：开启，使用所有默认值
   * - 对象：精细配置
   */
  tableMode?: boolean | TableModeOptions;
}

export interface TableModeOptions {
  /** 行容器 selector，默认 `[data-ai-fillable-row]` */
  rowSelector?: string;
  /**
   * 当粘贴行数超过页面已有行数时调用，宿主在此处插入新行（如点击 antd
   * Table 的「+ 新增行」按钮、或往 form 数据数组 push 一项）。不提供时多余
   * 数据行被忽略且 dialog 顶部会给出提示。
   */
  onAddRow?: () => void | Promise<void>;
  /** 检测表格的最少数据行，默认 2 */
  minDataRows?: number;
}

export interface TableModeInfo {
  /** 列名（来源于粘贴文本的首行） */
  headers: string[];
  /** 数据行数 */
  dataRowCount: number;
  /** 当前页面上 `[data-ai-fillable-row]` 行数（开 dialog 时快照） */
  formRowCount: number;
  /** 因 form 行数不够而被忽略的数据行数（无 onAddRow 时 > 0） */
  truncatedRows: number;
}

export interface UseFormAutoFillReturn {
  /** 预览对话框是否打开 */
  dialogOpen: Ref<boolean>;
  /** 当前模式：`pair`（单条键值对）或 `table`（多行表格批量） */
  mode: Ref<'pair' | 'table'>;
  /** 表格模式的元信息（mode === 'table' 时非 null） */
  tableInfo: Ref<TableModeInfo | null>;
  /** 当前所有匹配结果（顺序 = 用户粘贴/输入顺序；表格模式下是行 × 列扁平展开） */
  matches: Ref<MatchResult[]>;
  /** 没有匹配到字段的 pair（field === null） */
  unmatched: ComputedRef<ParsedPair[]>;
  /** 可供「手动指认字段」用的全部已扫到字段（包含未被匹配的） */
  availableFields: Ref<FormField[]>;
  /** 用户在预览里实际勾选要填的 match index */
  selectedIndices: Ref<Set<number>>;
  /** 最近一次填入的所有 FillRecord，供 `undoLastFill` 使用 */
  lastFillRecords: Ref<FillRecord[]>;
  /** 填完后的轻量 toast 是否显示（5s 内可撤销） */
  toastVisible: Ref<boolean>;
  /** toast 上展示的总结字符串（{filled}/{failed}） */
  toastSummary: Ref<{ filled: number; failed: number } | null>;
  /** 当 unmatched 数量 ≥ 1 且全部匹配都低于 minConfidence 时为 true，便于 UI 提示 “可调 LLM” */
  llmFallbackHinted: Ref<boolean>;
  /** 粘贴检测入口：返回 true 表示已发起建议（autoDetectPaste 关闭则永远 false） */
  inspectPasteText: (text: string) => boolean;
  /** 斜杠命令入口：用 text 直接尝试匹配并打开对话框；空 text 时尝试读 navigator.clipboard */
  triggerFromText: (text: string) => Promise<boolean>;
  /** 关闭预览对话框，清空当前匹配状态 */
  closeDialog: () => void;
  /** 切换某条 match 的勾选 */
  toggleSelection: (idx: number) => void;
  setAllSelections: (checked: boolean) => void;
  /** 手动把某条 pair 重新指认到另一个字段（fieldId 为 null 取消指认） */
  overrideMatch: (pairIdx: number, fieldId: string | null) => void;
  /** 确认填入：返回成功/失败数；自动关闭对话框 + 显示 toast */
  confirmFill: () => { filled: number; failed: number };
  /** 撤销最近一次填入 */
  undoLastFill: () => void;
  /** 隐藏 toast（手动关闭） */
  dismissToast: () => void;
}

export interface UseFormAutoFillDeps {
  /** 选项配置；可为 ref/computed 以响应宿主配置热更新 */
  options: ComputedRef<FormAutoFillOptions> | Ref<FormAutoFillOptions>;
}

const TOAST_AUTO_DISMISS_MS = 5000;

export function useFormAutoFill(deps: UseFormAutoFillDeps): UseFormAutoFillReturn {
  const dialogOpen = ref(false);
  const mode = ref<'pair' | 'table'>('pair');
  const tableInfo = ref<TableModeInfo | null>(null);
  const matches = ref<MatchResult[]>([]);
  const availableFields = ref<FormField[]>([]);
  const selectedIndices = ref(new Set<number>());
  const lastFillRecords = ref<FillRecord[]>([]);
  const toastVisible = ref(false);
  const toastSummary = ref<{ filled: number; failed: number } | null>(null);
  const llmFallbackHinted = ref(false);
  let toastTimer: ReturnType<typeof setTimeout> | null = null;

  const unmatched = computed<ParsedPair[]>(() =>
    matches.value.filter((m) => !m.field).map((m) => m.pair),
  );

  function resolveOptions(): FormAutoFillOptions {
    const v = deps.options.value;
    return v ?? {};
  }

  function buildScannerOptions(): ScanFormFieldsOptions {
    const o = resolveOptions();
    const out: ScanFormFieldsOptions = {};
    if (o.target && typeof document !== 'undefined') {
      const root = document.querySelector(o.target);
      if (root instanceof HTMLElement) out.root = root;
    }
    if (o.excludeSelectors?.length) out.excludeSelectors = [...o.excludeSelectors];
    return out;
  }

  function buildMatcherOptions(): MatcherOptions {
    const o = resolveOptions();
    return {
      minConfidence: o.minConfidence,
      synonyms: o.synonyms,
      disableBuiltinSynonyms: o.disableBuiltinSynonyms,
    };
  }

  function tableModeEnabled(): TableModeOptions | null {
    const o = resolveOptions();
    if (!o.tableMode) return null;
    return o.tableMode === true ? {} : o.tableMode;
  }

  function buildRowScannerOptions(tm: TableModeOptions): ScanFormRowsOptions {
    const opts = buildScannerOptions();
    const o: ScanFormRowsOptions = { ...opts };
    if (tm.rowSelector) o.rowSelector = tm.rowSelector;
    return o;
  }

  async function tryOpenAsTable(text: string): Promise<boolean> {
    const tm = tableModeEnabled();
    if (!tm) return false;
    const table = parseFormDataAsTable(text, { minDataRows: tm.minDataRows });
    if (!table) return false;
    const rows = scanFormRows(buildRowScannerOptions(tm));
    if (rows.length === 0) return false;
    await openWithTable(table, rows, tm);
    return true;
  }

  function inspectPasteText(text: string): boolean {
    const o = resolveOptions();
    if (o.autoDetectPaste === false) return false;
    if (!text || typeof text !== 'string') return false;

    // 先试表格，命中就走表格模式
    if (tableModeEnabled()) {
      const tm = tableModeEnabled()!;
      const table = parseFormDataAsTable(text, { minDataRows: tm.minDataRows });
      if (table) {
        const rows = scanFormRows(buildRowScannerOptions(tm));
        if (rows.length > 0) {
          void openWithTable(table, rows, tm);
          return true;
        }
      }
    }

    const minPairs = Math.max(1, o.autoDetectMinPairs ?? 2);
    const parsed = parseFormData(text);
    if (parsed.length < minPairs) return false;
    openWithPairs(parsed);
    return true;
  }

  async function triggerFromText(text: string): Promise<boolean> {
    let source = text?.trim() ?? '';
    if (!source && typeof navigator !== 'undefined') {
      try {
        const clip = await navigator.clipboard?.readText?.();
        if (clip) source = clip;
      } catch {
        // 用户未授权读剪贴板；继续以空字符串处理
      }
    }
    if (!source) return false;
    if (await tryOpenAsTable(source)) return true;
    const parsed = parseFormData(source);
    if (parsed.length === 0) return false;
    openWithPairs(parsed);
    return true;
  }

  function openWithPairs(pairs: ParsedPair[]): void {
    const fields = scanFormFields(buildScannerOptions());
    availableFields.value = fields;
    const ms = matchFields(pairs, fields, buildMatcherOptions());
    matches.value = ms;
    selectedIndices.value = computeDefaultSelections(ms);
    llmFallbackHinted.value = computeLlmHint(ms);
    mode.value = 'pair';
    tableInfo.value = null;
    dialogOpen.value = true;
  }

  async function openWithTable(
    table: ParsedTable,
    initialRows: FormRow[],
    tm: TableModeOptions,
  ): Promise<void> {
    let rows = initialRows;
    let truncated = 0;
    const want = table.rows.length;
    if (rows.length < want && tm.onAddRow) {
      // 依次调用 host 的 onAddRow 直到行数足够；每次调用后重新扫描以拿到新行。
      // 用 await 串行执行，避免 host 在异步中并发推数据出错。
      const maxAttempts = want - rows.length + 8; // 防御：极端情况下不要无限循环
      for (let i = 0; i < maxAttempts && rows.length < want; i++) {
        try {
          await tm.onAddRow();
        } catch {
          break;
        }
        rows = scanFormRows(buildRowScannerOptions(tm));
      }
    }
    if (rows.length < want) truncated = want - rows.length;
    const usableRows = rows.slice(0, Math.min(want, rows.length));

    const aggregated: MatchResult[] = [];
    const allFields: FormField[] = [];
    for (let i = 0; i < usableRows.length; i++) {
      const dataRow = table.rows[i]!;
      const formRow = usableRows[i]!;
      allFields.push(...formRow.fields);
      // 关键：用「纯 header（不带 #N 后缀）」做匹配，让 matcher 的同义词字典
      // 正常工作；事后再把 #N 行号附加到 pair.key 上做 UI 展示。
      const pairsForMatch: ParsedPair[] = table.headers.map((h, col) => ({
        key: h,
        value: dataRow[col] ?? '',
        raw: `${formRow.rowId}: ${h} = ${dataRow[col] ?? ''}`,
      }));
      const ms = matchFields(pairsForMatch, formRow.fields, buildMatcherOptions());
      const suffix = usableRows.length === 1 ? '' : ` #${i + 1}`;
      for (const m of ms) {
        aggregated.push(suffix ? { ...m, pair: { ...m.pair, key: `${m.pair.key}${suffix}` } } : m);
      }
    }
    availableFields.value = allFields;
    matches.value = aggregated;
    selectedIndices.value = computeDefaultSelections(aggregated);
    llmFallbackHinted.value = computeLlmHint(aggregated);
    mode.value = 'table';
    tableInfo.value = {
      headers: table.headers,
      dataRowCount: want,
      formRowCount: rows.length,
      truncatedRows: truncated,
    };
    dialogOpen.value = true;
  }

  function computeDefaultSelections(ms: MatchResult[]): Set<number> {
    const o = resolveOptions();
    const defaultPick = o.defaultPickConfidence ?? 50;
    const out = new Set<number>();
    ms.forEach((m, idx) => {
      if (!m.field) return;
      if (m.confidence < defaultPick) return;
      // 决策 4-C：仅当字段为空时默认勾选
      if (m.field.currentValue) return;
      out.add(idx);
    });
    return out;
  }

  function computeLlmHint(ms: MatchResult[]): boolean {
    const o = resolveOptions();
    if (!o.allowLlmFallback) return false;
    if (ms.length === 0) return false;
    const unmatchedCount = ms.filter((m) => !m.field).length;
    if (unmatchedCount === 0) return false;
    return true;
  }

  function closeDialog(): void {
    dialogOpen.value = false;
    matches.value = [];
    selectedIndices.value = new Set();
    llmFallbackHinted.value = false;
    mode.value = 'pair';
    tableInfo.value = null;
  }

  function toggleSelection(idx: number): void {
    const set = new Set(selectedIndices.value);
    if (set.has(idx)) set.delete(idx);
    else set.add(idx);
    selectedIndices.value = set;
  }

  function setAllSelections(checked: boolean): void {
    if (!checked) {
      selectedIndices.value = new Set();
      return;
    }
    const set = new Set<number>();
    matches.value.forEach((m, idx) => {
      if (m.field) set.add(idx);
    });
    selectedIndices.value = set;
  }

  function overrideMatch(pairIdx: number, fieldId: string | null): void {
    const next = [...matches.value];
    const cur = next[pairIdx];
    if (!cur) return;
    if (fieldId === null) {
      next[pairIdx] = { ...cur, field: null, confidence: 0, strategy: 'none', matchedLabel: null };
    } else {
      const field = availableFields.value.find((f) => f.id === fieldId);
      if (!field) return;
      next[pairIdx] = {
        ...cur,
        field,
        confidence: 100,
        strategy: 'exact',
        matchedLabel: field.labels[0] ?? null,
      };
      // 同一字段不允许两次指认；把别处用同一字段的清掉
      next.forEach((m, i) => {
        if (i !== pairIdx && m.field?.id === field.id) {
          next[i] = { ...m, field: null, confidence: 0, strategy: 'none', matchedLabel: null };
        }
      });
    }
    matches.value = next;
  }

  function confirmFill(): { filled: number; failed: number } {
    const records: FillRecord[] = [];
    const selected = Array.from(selectedIndices.value);
    const o = resolveOptions();
    const fillOpts = { optionAliases: o.optionAliases };
    for (const idx of selected) {
      const m = matches.value[idx];
      if (!m?.field) continue;
      const record = fillField(m.field, m.pair.value, fillOpts);
      records.push(record);
      if (record.success) highlightFilledField(m.field);
    }
    const filled = records.filter((r) => r.success).length;
    const failed = records.length - filled;
    lastFillRecords.value = records.filter((r) => r.success);
    toastSummary.value = { filled, failed };
    toastVisible.value = filled > 0 || failed > 0;
    dialogOpen.value = false;
    matches.value = [];
    selectedIndices.value = new Set();
    if (toastTimer) clearTimeout(toastTimer);
    if (toastVisible.value) {
      toastTimer = setTimeout(() => {
        toastVisible.value = false;
        toastSummary.value = null;
      }, TOAST_AUTO_DISMISS_MS);
    }
    return { filled, failed };
  }

  function undoLastFill(): void {
    if (lastFillRecords.value.length === 0) return;
    undoFills(lastFillRecords.value);
    clearFillHighlights();
    lastFillRecords.value = [];
    toastVisible.value = false;
    toastSummary.value = null;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  function dismissToast(): void {
    toastVisible.value = false;
    toastSummary.value = null;
    if (toastTimer) {
      clearTimeout(toastTimer);
      toastTimer = null;
    }
  }

  return {
    dialogOpen,
    mode,
    tableInfo,
    matches,
    unmatched,
    availableFields,
    selectedIndices,
    lastFillRecords,
    toastVisible,
    toastSummary,
    llmFallbackHinted,
    inspectPasteText,
    triggerFromText,
    closeDialog,
    toggleSelection,
    setAllSelections,
    overrideMatch,
    confirmFill,
    undoLastFill,
    dismissToast,
  };
}
