/**
 * Form Auto-Fill / Matcher
 * ------------------------
 * 把 parser 解出的 `ParsedPair[]` 与 scanner 扫出的 `FormField[]` 进行 1-to-1
 * 最佳分配匹配，并给每条匹配打 0~100 的置信度分。UI 据此决定默认勾选状态、
 * 排序、是否走 LLM 兜底。
 *
 * 匹配策略（按分值降序）：
 *   - exact:        100  完全相等（归一化后）
 *   - contains:      80  一方完全包含另一方（且长度差不超过 3 倍）
 *   - synonym:       60  命中同义词字典
 *   - substring:     50  最长公共子串 ≥ 较短串的 60%
 *   - levenshtein: 30~45 编辑距离归一化映射
 *   - none:           0  全都没命中
 *
 * 1-1 分配算法用「贪心 + 全局排序」：列出所有 (pair, field, score) 组合，
 * 按分数从高到低依次抢占；一旦 pair 或 field 已被占用则跳过。对典型规模
 * （< 50 字段 / < 30 pair）足够好；如有需要可后续替换为 Kuhn-Munkres。
 *
 * 模块**不**含 LLM 调用 —— 兜底交由 composable 在所有 match 完成后根据
 * `unmatched` + 全局阈值再决定是否调 /chat。
 */

import type { ParsedPair } from './parser';
import type { FormField } from './scanner';

export type MatchStrategy = 'exact' | 'contains' | 'synonym' | 'substring' | 'levenshtein' | 'none';

export interface MatchResult {
  pair: ParsedPair;
  field: FormField | null;
  confidence: number;
  strategy: MatchStrategy;
  /** 命中时哪一个 candidate label 起的作用（便于 UI 解释） */
  matchedLabel: string | null;
}

export interface MatcherOptions {
  /** 低于该分数视为「未匹配」，field 强制 null；默认 30 */
  minConfidence?: number;
  /**
   * 用户自定义同义词字典：每一组里的字符串视为同义。会与内置字典合并；
   * key 不重要，仅做分组。
   */
  synonyms?: Record<string, string[]>;
  /** 关闭内置同义词字典（仅用用户传入的） */
  disableBuiltinSynonyms?: boolean;
}

const BUILTIN_SYNONYMS: string[][] = [
  [
    '姓名',
    '名字',
    '客户',
    '客户名',
    '客户姓名',
    'name',
    'username',
    'full name',
    'client',
    'customer',
  ],
  [
    '电话',
    '手机',
    '手机号',
    '手机号码',
    '联系电话',
    'phone',
    'mobile',
    'tel',
    'telephone',
    'phone number',
  ],
  ['邮箱', '电子邮件', '邮件', 'email', 'e-mail', 'mail'],
  ['地址', '联系地址', '住址', 'address', 'addr', 'street'],
  ['公司', '单位', '企业', 'company', 'organization', 'org', 'employer'],
  ['职位', '岗位', 'title', 'position', 'job title', 'role'],
  ['日期', '时间', 'date', 'time', 'datetime', 'created at'],
  ['身份证', '身份证号', '证件号', 'id number', 'identity', 'identity number', 'ssn'],
  ['订单', '订单号', '单号', 'order', 'order no', 'order number', 'order id'],
  ['金额', '价格', '总金额', '总价', 'amount', 'price', 'total', 'total amount'],
  ['数量', 'qty', 'quantity', 'count'],
  ['备注', '说明', '描述', 'remark', 'remarks', 'note', 'notes', 'description', 'desc', 'comment'],
  ['兴趣', '爱好', '兴趣爱好', 'hobby', 'hobbies', 'interest', 'interests'],
  ['城市', 'city'],
  ['省', '省份', 'province', 'state'],
  ['国家', 'country', 'nation'],
  ['区', '区县', '区域', 'district', 'region'],
  ['邮编', '邮政编码', 'zip', 'zip code', 'postal', 'postal code'],
  ['性别', 'gender', 'sex'],
  ['年龄', 'age'],
  ['出生日期', '生日', 'birthday', 'birth date', 'dob', 'date of birth'],
  ['项目', '项目名', '项目名称', 'project', 'project name'],
  ['合同', '合同号', '合同编号', 'contract', 'contract no', 'contract number'],
];

/**
 * 主入口：返回与 `pairs` 等长的 `MatchResult[]`，顺序与入参一致。
 */
export function matchFields(
  pairs: ParsedPair[],
  fields: FormField[],
  opts: MatcherOptions = {},
): MatchResult[] {
  const minConfidence = opts.minConfidence ?? 30;
  const synGroups = buildSynonymGroups(opts);

  const results: MatchResult[] = pairs.map((pair) => ({
    pair,
    field: null,
    confidence: 0,
    strategy: 'none',
    matchedLabel: null,
  }));

  if (pairs.length === 0 || fields.length === 0) return results;

  const candidates: Array<{
    pairIdx: number;
    fieldIdx: number;
    score: number;
    strategy: MatchStrategy;
    matchedLabel: string;
  }> = [];

  for (let i = 0; i < pairs.length; i++) {
    for (let j = 0; j < fields.length; j++) {
      const best = scoreBestLabel(pairs[i]!.key, fields[j]!.labels, synGroups);
      if (best.score >= minConfidence) {
        candidates.push({
          pairIdx: i,
          fieldIdx: j,
          score: best.score,
          strategy: best.strategy,
          matchedLabel: best.label,
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const usedPairs = new Set<number>();
  const usedFields = new Set<number>();
  for (const c of candidates) {
    if (usedPairs.has(c.pairIdx) || usedFields.has(c.fieldIdx)) continue;
    results[c.pairIdx] = {
      pair: pairs[c.pairIdx]!,
      field: fields[c.fieldIdx]!,
      confidence: c.score,
      strategy: c.strategy,
      matchedLabel: c.matchedLabel,
    };
    usedPairs.add(c.pairIdx);
    usedFields.add(c.fieldIdx);
  }

  return results;
}

interface BestLabelScore {
  score: number;
  strategy: MatchStrategy;
  label: string;
}

function scoreBestLabel(key: string, labels: string[], synGroups: string[][]): BestLabelScore {
  let best: BestLabelScore = { score: 0, strategy: 'none', label: '' };
  for (const label of labels) {
    const s = scoreLabel(key, label, synGroups);
    if (s.score > best.score) {
      best = { ...s, label };
      if (best.score >= 100) return best;
    }
  }
  return best;
}

function scoreLabel(
  key: string,
  label: string,
  synGroups: string[][],
): { score: number; strategy: MatchStrategy } {
  const a = normalize(key);
  const b = normalize(label);
  if (!a || !b) return { score: 0, strategy: 'none' };

  if (a === b) return { score: 100, strategy: 'exact' };

  if (a.includes(b) || b.includes(a)) {
    const shorter = Math.min(a.length, b.length);
    const longer = Math.max(a.length, b.length);
    if (longer <= shorter * 3) return { score: 80, strategy: 'contains' };
  }

  if (isSynonym(a, b, synGroups)) return { score: 60, strategy: 'synonym' };

  const lcs = longestCommonSubstring(a, b);
  const shorter = Math.min(a.length, b.length);
  if (shorter > 0 && lcs >= Math.ceil(shorter * 0.6) && lcs >= 2) {
    return { score: 50, strategy: 'substring' };
  }

  const sim = levenshteinSimilarity(a, b);
  if (sim >= 0.55) {
    const score = Math.round(30 + (sim - 0.55) * (15 / 0.45));
    return { score: Math.min(45, Math.max(30, score)), strategy: 'levenshtein' };
  }

  return { score: 0, strategy: 'none' };
}

/**
 * 归一化：小写 / 折叠空白 / 去常见装饰字符 / 去常见前后缀。
 * 不剥离 CJK 字符；ASCII 标点几乎全去掉。
 */
export function normalize(s: string): string {
  if (!s) return '';
  let v = s.toLowerCase().normalize('NFKC');
  v = v.replace(/[\s\u3000]+/g, ' ').trim();
  v = v.replace(/[-_/\\.·•＊*#?？!！@()（）[\]【】<>《》:：;；,，"'`]/g, '');
  // 去常见提示性前后缀
  const trims = [
    '请输入',
    '请填写',
    '请选择',
    '输入',
    '选择',
    'please enter',
    'please input',
    'please select',
    'enter',
    'select',
    '*',
    '＊',
  ];
  for (const t of trims) {
    if (v.startsWith(t)) v = v.slice(t.length).trim();
    if (v.endsWith(t)) v = v.slice(0, v.length - t.length).trim();
  }
  return v;
}

function buildSynonymGroups(opts: MatcherOptions): string[][] {
  const groups: string[][] = [];
  if (!opts.disableBuiltinSynonyms) {
    for (const g of BUILTIN_SYNONYMS) {
      groups.push(g.map(normalize));
    }
  }
  if (opts.synonyms) {
    for (const list of Object.values(opts.synonyms)) {
      if (Array.isArray(list) && list.length > 1) {
        groups.push(list.map(normalize));
      }
    }
  }
  return groups;
}

function isSynonym(a: string, b: string, groups: string[][]): boolean {
  if (!a || !b) return false;
  for (const g of groups) {
    if (g.includes(a) && g.includes(b)) return true;
  }
  return false;
}

/** 经典 DP，O(|a| * |b|) 空间和时间。两串都已归一化后传入。 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length;
  const n = b.length;
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

export function levenshteinSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

export function longestCommonSubstring(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  let best = 0;
  let prev = new Array<number>(n + 1).fill(0);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a.charCodeAt(i - 1) === b.charCodeAt(j - 1)) {
        curr[j] = (prev[j - 1] ?? 0) + 1;
        if (curr[j]! > best) best = curr[j]!;
      } else {
        curr[j] = 0;
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return best;
}
