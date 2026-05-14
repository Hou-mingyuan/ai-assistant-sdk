/**
 * useLineDiff
 * -----------
 * Pure-function line-level diff for K40 CompareRegionsDialog. No third-party
 * dependency: a textbook LCS (Longest Common Subsequence) DP gives us the
 * canonical "shortest edit script" representation that GitHub / VSCode / git
 * diff all use.
 *
 * Why line-level (not char or token):
 * - assistant messages are typically prose / code, where line-aligned diffs
 *   read 100x better than char-level (which produces visual noise on long
 *   paragraphs).
 * - Side-by-side rendering naturally aligns line ↔ line; insertions show as
 *   added rows, deletions as removed rows, equal lines align on both sides.
 *
 * Algorithm:
 *   1. Split both texts into lines (keeping empty lines).
 *   2. DP table `dp[i][j]` = LCS length of left[..i] vs right[..j].
 *   3. Backtrack to emit ops in correct order.
 *   4. Pair into side-by-side rows: equal lines on both, additions on right
 *      only, deletions on left only.
 *
 * Complexity: O(n × m) time + space. For typical assistant messages
 * (≤ 500 lines), this is < 1ms. Long pastes (> 5000 lines) would benefit
 * from a Myers algorithm — out of scope for K40, can swap implementation
 * without changing the public types.
 *
 * Public API stays pure (no Vue ref) for ease of testing.
 */

export type DiffOp = 'equal' | 'add' | 'remove';

export interface DiffOpEntry {
  op: DiffOp;
  leftLine: number | null; // 1-indexed line number in `left`; null for additions
  rightLine: number | null; // 1-indexed line number in `right`; null for deletions
  text: string;
}

/**
 * Side-by-side row: aligned pair of (left line, right line). For an
 * "equal" diff, both sides are filled; for "add", left is null; for
 * "remove", right is null. Used directly by CompareRegionsDialog.
 */
export interface SideBySideRow {
  leftLine: number | null;
  rightLine: number | null;
  leftText: string;
  rightText: string;
  /** 'equal' / 'add' (right-only) / 'remove' (left-only) / 'change' (rare paired) */
  kind: 'equal' | 'add' | 'remove' | 'change';
}

function splitLines(text: string): string[] {
  if (!text) return [];
  return text.split('\n');
}

function computeOps(left: string[], right: string[]): DiffOpEntry[] {
  const n = left.length;
  const m = right.length;
  /* dp[i][j] = LCS length of left[0..i) vs right[0..j). */
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (left[i - 1] === right[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }
  /* Backtrack to build ops in reverse, then reverse. */
  const out: DiffOpEntry[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      out.push({ op: 'equal', leftLine: i, rightLine: j, text: left[i - 1]! });
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      out.push({ op: 'remove', leftLine: i, rightLine: null, text: left[i - 1]! });
      i--;
    } else {
      out.push({ op: 'add', leftLine: null, rightLine: j, text: right[j - 1]! });
      j--;
    }
  }
  while (i > 0) {
    out.push({ op: 'remove', leftLine: i, rightLine: null, text: left[i - 1]! });
    i--;
  }
  while (j > 0) {
    out.push({ op: 'add', leftLine: null, rightLine: j, text: right[j - 1]! });
    j--;
  }
  return out.reverse();
}

/**
 * Convert a flat op stream into side-by-side aligned rows.
 *
 * Heuristic：紧邻的 (remove, add) 或 (add, remove) 合并成单条 "change" 行
 * （GitHub diff 风格），让用户视觉上看到「同一行换成了那一行」而不是
 * 「先删后加占两行」。LCS backtrack 的输出顺序对小段差异可能出现 (add,
 * remove) 也可能出现 (remove, add)，两种顺序都尝试合并。多删 / 多加段
 * 不合并（保持原始顺序，避免乱阵）。
 */
export function opsToRows(ops: DiffOpEntry[]): SideBySideRow[] {
  const rows: SideBySideRow[] = [];
  let i = 0;
  while (i < ops.length) {
    const cur = ops[i]!;
    const next = ops[i + 1];
    const twoAhead = ops[i + 2];
    // 单对 (remove, add) 配对成 change
    if (cur.op === 'remove' && next?.op === 'add' && twoAhead?.op !== 'add') {
      rows.push({
        leftLine: cur.leftLine,
        rightLine: next.rightLine,
        leftText: cur.text,
        rightText: next.text,
        kind: 'change',
      });
      i += 2;
      continue;
    }
    // 单对 (add, remove) 也合并：left=remove, right=add，仍然 left 在视觉左侧
    if (cur.op === 'add' && next?.op === 'remove' && twoAhead?.op !== 'remove') {
      rows.push({
        leftLine: next.leftLine,
        rightLine: cur.rightLine,
        leftText: next.text,
        rightText: cur.text,
        kind: 'change',
      });
      i += 2;
      continue;
    }
    if (cur.op === 'equal') {
      rows.push({
        leftLine: cur.leftLine,
        rightLine: cur.rightLine,
        leftText: cur.text,
        rightText: cur.text,
        kind: 'equal',
      });
    } else if (cur.op === 'remove') {
      rows.push({
        leftLine: cur.leftLine,
        rightLine: null,
        leftText: cur.text,
        rightText: '',
        kind: 'remove',
      });
    } else {
      rows.push({
        leftLine: null,
        rightLine: cur.rightLine,
        leftText: '',
        rightText: cur.text,
        kind: 'add',
      });
    }
    i++;
  }
  return rows;
}

export interface DiffSummary {
  equal: number;
  added: number;
  removed: number;
  changed: number;
  /** Total non-equal rows. */
  delta: number;
}

export function summariseRows(rows: SideBySideRow[]): DiffSummary {
  let equal = 0;
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const r of rows) {
    if (r.kind === 'equal') equal++;
    else if (r.kind === 'add') added++;
    else if (r.kind === 'remove') removed++;
    else if (r.kind === 'change') changed++;
  }
  return { equal, added, removed, changed, delta: added + removed + changed };
}

export function diffLines(
  left: string,
  right: string,
): {
  rows: SideBySideRow[];
  summary: DiffSummary;
} {
  const ops = computeOps(splitLines(left), splitLines(right));
  const rows = opsToRows(ops);
  const summary = summariseRows(rows);
  return { rows, summary };
}
