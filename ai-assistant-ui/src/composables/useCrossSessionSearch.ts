/**
 * useCrossSessionSearch
 * ----------------------
 * 跨整个 useMultiSession 历史的全文搜索。与 useSessionSearch（单会话内）互补：
 *
 *   useSessionSearch:           messages in the *currently open* chat
 *   useCrossSessionSearch (本): EVERY message in EVERY persisted session
 *
 * 设计要点：
 * - 调用方传入响应式 `sessions` + `query`；本 composable 内部 debounce 200ms，
 *   避免每按一键就遍历整个 historic 数据集。
 * - 返回三层视图：
 *     `matches`            扁平按时间倒序的匹配条目列表
 *     `matchesBySession`   Map<sessionId, matches[]> 给 SessionsDrawer 用
 *     `totalMatches`       聚合数字给 UI badge / aria-live
 * - 每条匹配带 `snippet`：HTML-safe，匹配关键词已包 <mark> tag，
 *   前后各 `snippetPadding` 个字符，避免出现 5K 字符的 dump。
 * - 大小写不敏感；不支持正则（SessionsDrawer 期望简单 substring）。
 * - 性能：O(n) 全表扫描 + 早退（达到 maxPerSession 即停止扫该 session）。
 *   1000 条 session × 50 条 msg × 200 char content ≈ 10MB 字符串扫描，
 *   在 chrome 上 < 5ms，单次输入足够 ride debounce。
 */
import { computed, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue';

export interface CrossSessionSearchMessageView {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

export interface CrossSessionSearchSessionView {
  id: string;
  title: string;
  createdAt: number;
  messages: CrossSessionSearchMessageView[];
}

export interface CrossSessionMatch {
  sessionId: string;
  sessionTitle: string;
  msgIndex: number;
  role: 'user' | 'assistant';
  rawText: string;
  /** HTML-safe snippet, with the matched substring wrapped in `<mark>`. */
  snippet: string;
  /** Absolute char offset of the first match in the raw message. */
  matchOffset: number;
  timestamp?: number;
}

export interface UseCrossSessionSearchOptions {
  sessions: Ref<CrossSessionSearchSessionView[]>;
  query: Ref<string>;
  /** Default 200ms; pass 0 to bypass debounce for tests. */
  debounceMs?: number;
  /** Pre/post chars wrapped around the match in the snippet. Default 30. */
  snippetPadding?: number;
  /** Max matches surfaced per session. Default 3 (UI density). */
  maxPerSession?: number;
}

export interface UseCrossSessionSearchReturn {
  matches: ComputedRef<CrossSessionMatch[]>;
  matchesBySession: ComputedRef<Map<string, CrossSessionMatch[]>>;
  totalMatches: ComputedRef<number>;
  /** Debounced/normalised query (trimmed, lower-cased). Useful for UI. */
  effectiveQuery: ComputedRef<string>;
}

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c] ?? c);
}

export function buildSnippet(
  raw: string,
  matchOffset: number,
  matchLen: number,
  padding: number,
): string {
  if (matchOffset < 0 || matchLen <= 0) return escapeHtml(raw);
  const from = Math.max(0, matchOffset - padding);
  const to = Math.min(raw.length, matchOffset + matchLen + padding);
  const prefix = from > 0 ? '…' : '';
  const suffix = to < raw.length ? '…' : '';
  const before = raw.slice(from, matchOffset);
  const match = raw.slice(matchOffset, matchOffset + matchLen);
  const after = raw.slice(matchOffset + matchLen, to);
  return (
    prefix +
    escapeHtml(before) +
    '<mark class="ai-cross-search-hl">' +
    escapeHtml(match) +
    '</mark>' +
    escapeHtml(after) +
    suffix
  );
}

export function useCrossSessionSearch(
  opts: UseCrossSessionSearchOptions,
): UseCrossSessionSearchReturn {
  const debouncedQuery = ref('');
  const debounceMs = Math.max(0, opts.debounceMs ?? 200);
  const padding = Math.max(8, opts.snippetPadding ?? 30);
  const maxPerSession = Math.max(1, opts.maxPerSession ?? 3);

  let timer: ReturnType<typeof setTimeout> | null = null;
  watch(
    opts.query,
    (v) => {
      if (debounceMs === 0) {
        debouncedQuery.value = v;
        return;
      }
      if (timer != null) clearTimeout(timer);
      timer = setTimeout(() => {
        debouncedQuery.value = v;
        timer = null;
      }, debounceMs);
    },
    { immediate: true },
  );
  onUnmounted(() => {
    if (timer != null) {
      clearTimeout(timer);
      timer = null;
    }
  });

  const effectiveQuery = computed(() => debouncedQuery.value.trim());

  const matches = computed<CrossSessionMatch[]>(() => {
    const q = effectiveQuery.value;
    if (!q) return [];
    const ql = q.toLowerCase();
    const out: CrossSessionMatch[] = [];
    for (const session of opts.sessions.value) {
      let sessionHits = 0;
      const messages = session.messages ?? [];
      for (let i = 0; i < messages.length && sessionHits < maxPerSession; i++) {
        const m = messages[i];
        const content = m?.content ?? '';
        if (!content) continue;
        const offset = content.toLowerCase().indexOf(ql);
        if (offset < 0) continue;
        out.push({
          sessionId: session.id,
          sessionTitle: session.title,
          msgIndex: i,
          role: m.role,
          rawText: content,
          matchOffset: offset,
          snippet: buildSnippet(content, offset, q.length, padding),
          timestamp: m.timestamp,
        });
        sessionHits++;
      }
    }
    out.sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0));
    return out;
  });

  const matchesBySession = computed(() => {
    const map = new Map<string, CrossSessionMatch[]>();
    for (const m of matches.value) {
      const arr = map.get(m.sessionId) ?? [];
      arr.push(m);
      map.set(m.sessionId, arr);
    }
    return map;
  });

  const totalMatches = computed(() => matches.value.length);

  return { matches, matchesBySession, totalMatches, effectiveQuery };
}
