/**
 * Form Auto-Fill / Parser
 * -----------------------
 * 把用户从剪贴板粘贴的纯文本拆成「键 → 值」对，喂给后续的 matcher 与 filler。
 *
 * 支持的输入形态（混排也可识别）：
 *   - 每行一对：`A: 234`
 *   - 中文冒号：`姓名：张三`
 *   - 等号：    `email=foo@bar.com`
 *   - Tab 分隔：`订单号\t1234`
 *   - 多空格 ≥ 2：`Phone   13800000000`
 *   - 同一行多对，用 `,` `;` `|` 或两个以上空格切割：
 *       `A:1, B:2; C:3`
 *   - 值带引号（保留引号内字符，包括分隔符）：
 *       `备注: "购买 2 件, 含运费"`
 *   - 多行连续文本，自动按行拆，再按行内分隔符拆
 *
 * 不识别的输入会被忽略（不会塞回结果），保证结果一定是「有键有值」的 pair。
 *
 * 这是一个**纯函数**模块，不依赖 DOM / Vue，便于单测与未来在 worker 里跑。
 */

export interface ParsedPair {
  /** 用户写的字段名（已 trim，但保留大小写与原语言） */
  key: string;
  /** 用户写的字段值（已 trim，去除包裹引号） */
  value: string;
  /** 原始片段，便于在 UI 里显示「这条来自哪段文本」 */
  raw: string;
}

export interface ParseFormDataOptions {
  /**
   * 是否合并同 key 的多次出现。
   * - `'last-wins'`（默认）：后出现的覆盖前一个
   * - `'first-wins'`：保留第一个
   * - `'keep-all'`：都保留（数组顺序不变）
   */
  duplicateKeyStrategy?: 'last-wins' | 'first-wins' | 'keep-all';
  /** 单条 value 的最大长度，截断超长输入避免误填一整段文章。默认 1000 */
  maxValueLength?: number;
}

/**
 * 主入口：把任意粘贴文本解析为 `ParsedPair[]`。
 *
 * 解析算法：
 *   1) 先按换行切成 logical lines（保留行号便于 raw 还原）。
 *   2) 每行尝试找「键值分隔符」`: : = \t 或 ≥2 个空格`；找到首个即为分隔点。
 *   3) 若没找到分隔符，再尝试把整行当成「行内多对」按 `, ; |` 拆分递归。
 *   4) 引号包裹的值不参与第 3) 步的二次拆分。
 *
 * 不做的事（避免误判）：
 *   - 不尝试推断「连续数字串」的语义（电话 / 银行卡 / 日期靠 matcher / filler 处理）。
 *   - 不做语言侦测；中文键值对走同一条路径。
 *   - 不大写化或同义词替换；那是 matcher 的活。
 */
export function parseFormData(input: string, opts: ParseFormDataOptions = {}): ParsedPair[] {
  if (!input || typeof input !== 'string') return [];
  const text = input.replace(/\r\n?/g, '\n');
  const maxValueLength = opts.maxValueLength ?? 1000;
  const strategy = opts.duplicateKeyStrategy ?? 'last-wins';

  const rawLines = text.split('\n');
  const collected: ParsedPair[] = [];

  for (const rawLine of rawLines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 只有「确实像内联多对」才拆 `,;|` —— 否则像 `备注: 张三, 上海` 这种
    // 单条 value 里的逗号会被错误地当成「另一个键值对的开始」。
    const segments = maybeSplitInline(line);
    for (const seg of segments) {
      const pair = parseSinglePair(seg);
      if (!pair) continue;
      if (pair.value.length > maxValueLength) {
        pair.value = pair.value.slice(0, maxValueLength).trimEnd();
      }
      collected.push(pair);
    }
  }

  return dedupeByStrategy(collected, strategy);
}

/**
 * 单段（已经分好的一小段）解析。返回 null 表示没有可识别的键值分隔符。
 *
 * 优先级：`:` / `：` > `=` > `\t` > `≥2 个空格`。这样像 `Email: a=b@x.com`
 * 这种「值里带等号」的情况能正确按冒号切，而不是被等号切碎。
 */
function parseSinglePair(seg: string): ParsedPair | null {
  const raw = seg;
  const trimmed = seg.trim();
  if (!trimmed) return null;

  const separators: Array<{ test: (s: string) => number }> = [
    { test: (s) => firstIndexOfAny(s, [':', '：']) },
    { test: (s) => s.indexOf('=') },
    { test: (s) => s.indexOf('\t') },
    { test: (s) => indexOfMultiSpace(s) },
  ];

  for (const sep of separators) {
    const idx = sep.test(trimmed);
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).replace(/^[\s\t]+/, '');
    if (idx > 0 && trimmed[idx] === ' ') {
      // 多空格分隔时把后续连续空格也吃掉
      value = trimmed.slice(idx).replace(/^\s+/, '');
    }
    if (!key) continue;
    value = unquote(value).trim();
    if (!value) continue;
    return { key, value, raw };
  }

  return null;
}

function firstIndexOfAny(s: string, needles: string[]): number {
  let best = -1;
  for (const n of needles) {
    const i = s.indexOf(n);
    if (i >= 0 && (best === -1 || i < best)) best = i;
  }
  return best;
}

/** 找到第一处「连续 ≥2 个普通空格」的位置；找不到返回 -1。 */
function indexOfMultiSpace(s: string): number {
  const m = /\s{2,}/.exec(s);
  return m ? m.index : -1;
}

/**
 * 决定一行是否真的应该按 `, ; |` 拆成多对：
 *   - 如果行里没有任何 `, ; | ， ；`，不拆。
 *   - 拆完之后**每段都得长得像 key:value（含 :/=/Tab/≥2 空格之一）**，否则
 *     说明逗号在 value 内部（如 `备注: 一,二,三`），还原成单段。
 * 这样把 「张三,李四」这种「值里有逗号」的常见场景从误拆里救出来，又保留
 * 「A:1, B:2, C:3」的真正内联多对能力。
 */
export function maybeSplitInline(line: string): string[] {
  if (!/[,;|，；]/.test(line)) return [line];
  const segs = splitInlineSegments(line);
  if (segs.length <= 1) return [line];
  const allLookLikePair = segs.every((s) => /[:：=\t]|\s{2,}/.test(s));
  return allLookLikePair ? segs : [line];
}

/**
 * 行内多对拆分：按 `, ; |` 切，但引号包裹的子串不会被切开。
 * 例：`A:1, B:"hello, world", C:3` → ['A:1', 'B:"hello, world"', 'C:3']
 */
export function splitInlineSegments(line: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inQuote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      buf += ch;
      if (ch === inQuote) inQuote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = ch;
      buf += ch;
      continue;
    }
    if (ch === ',' || ch === ';' || ch === '|' || ch === '，' || ch === '；') {
      if (buf.trim()) out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  if (buf.trim()) out.push(buf);
  return out;
}

/**
 * 去掉外层成对的引号（"…" / '…' / 「…」 / 『…』 / “…” / ‘…’）。
 * 不递归 — 一层就够；嵌套引号留在原位。
 */
export function unquote(s: string): string {
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['「', '」'],
    ['『', '』'],
    ['“', '”'],
    ['‘', '’'],
  ];
  for (const [open, close] of pairs) {
    if (s.startsWith(open) && s.endsWith(close) && s.length >= open.length + close.length) {
      return s.slice(open.length, s.length - close.length);
    }
  }
  return s;
}

/**
 * Phase 2: 把多行粘贴文本识别为「重复行模板的表格」。
 *
 * 支持的输入形态：
 *   - TSV（Tab 分隔）：Excel 复制出来就是它
 *   - CSV（逗号分隔）：含引号包裹的 cell
 *   - Markdown 表格：`| a | b |\n|---|---|\n| 1 | 2 |`
 *   - 等宽空白对齐：`姓名   电话\n张三   1380...`（≥2 空格分隔列）
 *
 * 返回 null 的判定条件（其中之一就 null）：
 *   - 总行数 < 3（至少 header + 2 行数据）
 *   - 首行用任何分隔符切都不足 2 列
 *   - 数据行中能与首行 cell 数对齐（差 ≤ 1）的不足 2 行
 *
 * 单行短文本 / 缺数据 / 缺分隔符的输入都不会被误识别为表格。
 */
export interface ParsedTable {
  /** 列名（来源于首行各 cell，已 trim、unquote） */
  headers: string[];
  /** 每行的 cell 列表，长度对齐到 headers.length（多余截断，不足留空字符串） */
  rows: string[][];
  /** 原始首尾几行（debug 用） */
  raw: string;
}

export interface ParseFormDataAsTableOptions {
  /** 数据行最少行数，默认 2 */
  minDataRows?: number;
  /** 列数下限（含 header），默认 2 */
  minColumns?: number;
}

type TableSeparator =
  | { kind: 'tab' }
  | { kind: 'comma' }
  | { kind: 'pipe' }
  | { kind: 'multispace' };

export function parseFormDataAsTable(
  input: string,
  opts: ParseFormDataAsTableOptions = {},
): ParsedTable | null {
  if (!input || typeof input !== 'string') return null;
  const text = input.replace(/\r\n?/g, '\n');
  const allLines = text.split('\n').map((l) => l.trimEnd());
  let lines = allLines.filter((l) => l.trim().length > 0);
  if (lines.length < 3) return null;

  // Markdown table：跳过分隔行 `|---|---|`
  if (lines[1] && /^\s*\|?[\s|:-]+\|?\s*$/.test(lines[1]) && /[-]/.test(lines[1])) {
    lines = [lines[0]!, ...lines.slice(2)];
  }
  if (lines.length < 3) return null;

  const minDataRows = opts.minDataRows ?? 2;
  const minColumns = opts.minColumns ?? 2;

  const candidates: TableSeparator[] = [
    { kind: 'tab' },
    { kind: 'pipe' },
    { kind: 'comma' },
    { kind: 'multispace' },
  ];
  for (const sep of candidates) {
    const headerCells = splitTableRow(lines[0]!, sep);
    if (headerCells.length < minColumns) continue;
    const dataRows: string[][] = [];
    // 严格 column 对齐：每行的 cell 数必须等于 header；
    // 否则极易把单 pair 行（"city = guangzhou"）误识别为「1 列的数据行」。
    // 真实从 Excel 复制的 TSV 会自动补 trailing tabs；手敲输入要么用 multispace
    // 要么对齐 column，要么走 pair 模式。
    for (let i = 1; i < lines.length; i++) {
      const cells = splitTableRow(lines[i]!, sep);
      if (cells.length !== headerCells.length) continue;
      // 至少有一格非空的行才算数据行
      if (cells.some((c) => c.length > 0)) dataRows.push(cells);
    }
    if (dataRows.length < minDataRows) continue;
    return {
      headers: headerCells.map((c) => unquote(c).trim()),
      rows: dataRows.map((r) => r.map((c) => unquote(c).trim())),
      raw: lines.join('\n'),
    };
  }
  return null;
}

function splitTableRow(line: string, sep: TableSeparator): string[] {
  if (sep.kind === 'tab') return splitSimple(line, '\t');
  if (sep.kind === 'pipe') {
    const trimmed = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '');
    return splitSimple(trimmed, '|').map((c) => c.trim());
  }
  if (sep.kind === 'comma') return splitCsvRow(line);
  // multispace: ≥2 个空格切
  return line
    .split(/\s{2,}|\t/)
    .map((c) => c.trim())
    .filter((_, i, arr) => arr.length > 1);
}

function splitSimple(line: string, sep: string): string[] {
  return line.split(sep).map((c) => c.trim());
}

/** 简化 CSV：单字符 `"` 包裹，包裹内允许 `""` 转义；不支持新行内嵌。 */
function splitCsvRow(line: string): string[] {
  const out: string[] = [];
  let buf = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        buf += '"';
        i++;
        continue;
      }
      if (ch === '"') {
        inQuote = false;
        continue;
      }
      buf += ch;
      continue;
    }
    if (ch === '"') {
      inQuote = true;
      continue;
    }
    if (ch === ',') {
      out.push(buf);
      buf = '';
      continue;
    }
    buf += ch;
  }
  out.push(buf);
  return out.map((c) => c.trim());
}

function dedupeByStrategy(
  pairs: ParsedPair[],
  strategy: 'last-wins' | 'first-wins' | 'keep-all',
): ParsedPair[] {
  if (strategy === 'keep-all') return pairs;
  const seen = new Map<string, number>();
  const out: ParsedPair[] = [];
  for (const p of pairs) {
    const norm = p.key.toLowerCase();
    const prev = seen.get(norm);
    if (prev === undefined) {
      seen.set(norm, out.length);
      out.push(p);
      continue;
    }
    if (strategy === 'last-wins') {
      out[prev] = p;
    }
  }
  return out;
}
