/**
 * usePromptHistory
 * -----------------
 * Terminal-style ↑/↓ prompt recall for any text input. Records the most
 * recently sent prompts (capped) and lets the user cycle back through them.
 *
 * Why this exists:
 *   Even after K11/K13/K14/K15/K16 polish + K22/K23/K24 feature work, the
 *   AI assistant input still loses every prompt the moment send() fires.
 *   Users who refine the same query 3-4 times in a row have to retype
 *   from scratch each round. usePromptHistory restores the muscle-memory
 *   pattern from bash / Cursor / VSCode / Telegram desktop: ↑ in an empty
 *   input field walks back through what you typed.
 *
 * API:
 *   const history = usePromptHistory({ max: 50, storageKey: 'foo' });
 *   history.record('hello');                  // append (dedup against last)
 *   history.recallOlder() => string | null;   // returns older entry or null
 *   history.recallNewer() => string | null;   // returns newer entry; null
 *                                             // at the bottom means "stop
 *                                             //  recalling, clear field"
 *   history.reset();                          // call after non-recall input
 *   history.entries;                          // readonly Ref<string[]>
 *
 * Persistence:
 *   - Opt-in via `storageKey`. localStorage is the only backend (no IndexedDB,
 *     no async — keeps recall O(1) for keystroke responsiveness).
 *   - Failures (private browsing / quota) degrade silently to in-memory only.
 *
 * Dedup rules:
 *   - record(x) ignores x if it equals the most-recent entry (avoids spamming
 *     ↑ history with the same prompt regenerated).
 *   - record('') is a no-op.
 *   - Trimmed comparison so whitespace-only edits don't bloat the buffer.
 */

import { ref, type Ref } from 'vue';

export interface UsePromptHistoryOptions {
  /** Maximum entries to keep (oldest dropped first). Default 50. */
  max?: number;
  /** localStorage key for persistence; omit for in-memory only. */
  storageKey?: string;
  /** Initial entries (useful for SSR or host-side seeding). */
  initial?: string[];
}

export interface UsePromptHistoryReturn {
  entries: Readonly<Ref<string[]>>;
  record(prompt: string): void;
  recallOlder(): string | null;
  recallNewer(): string | null;
  reset(): void;
  clear(): void;
}

const DEFAULT_MAX = 50;

function loadFromStorage(storageKey: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveToStorage(storageKey: string, entries: string[]) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    /* private browsing / quota — silently degrade. */
  }
}

export function usePromptHistory(opts: UsePromptHistoryOptions = {}): UsePromptHistoryReturn {
  const max = Math.max(1, Math.min(opts.max ?? DEFAULT_MAX, 500));
  const initial: string[] = [...(opts.initial ?? [])];

  if (opts.storageKey) {
    const stored = loadFromStorage(opts.storageKey);
    if (stored.length > 0) {
      /* Stored entries take precedence over `initial` because they represent
       * the user's actual history; `initial` is for first-launch seeding. */
      initial.splice(0, initial.length, ...stored);
    }
  }

  const entries = ref<string[]>(initial.slice(-max)) as Ref<string[]>;
  /* cursor === entries.value.length means "not currently recalling"; lower
   * indices walk towards older entries (cursor=length-1 is most recent). */
  let cursor = entries.value.length;

  function persistIfNeeded() {
    if (opts.storageKey) saveToStorage(opts.storageKey, entries.value);
  }

  function record(prompt: string) {
    const trimmed = prompt?.trim();
    if (!trimmed) return;
    const last = entries.value[entries.value.length - 1];
    if (last !== undefined && last.trim() === trimmed) {
      /* dedup against last */
      cursor = entries.value.length;
      return;
    }
    entries.value.push(prompt);
    while (entries.value.length > max) entries.value.shift();
    cursor = entries.value.length;
    persistIfNeeded();
  }

  function recallOlder(): string | null {
    if (entries.value.length === 0) return null;
    if (cursor > 0) cursor -= 1;
    return entries.value[cursor] ?? null;
  }

  function recallNewer(): string | null {
    if (entries.value.length === 0) return null;
    if (cursor < entries.value.length - 1) {
      cursor += 1;
      return entries.value[cursor] ?? null;
    }
    /* Past the most recent entry — caller should clear the field. */
    cursor = entries.value.length;
    return null;
  }

  function reset() {
    cursor = entries.value.length;
  }

  function clear() {
    entries.value = [];
    cursor = 0;
    persistIfNeeded();
  }

  return {
    entries: entries as Readonly<Ref<string[]>>,
    record,
    recallOlder,
    recallNewer,
    reset,
    clear,
  };
}
