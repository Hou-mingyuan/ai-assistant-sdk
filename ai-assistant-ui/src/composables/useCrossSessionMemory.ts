/**
 * 跨会话记忆：在 localStorage 中持久化用户偏好、关键事实等信息，
 * 新会话开始时自动注入 system prompt，实现长期记忆。
 */
import { ref, computed } from 'vue';

export interface MemoryItem {
  id: string;
  text: string;
  createdAt: number;
  source: 'manual' | 'auto';
}

const STORAGE_KEY = 'ai-assistant-memory';
const MAX_ITEMS = 50;
const MAX_CHAR_BUDGET = 2000;

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function useCrossSessionMemory(storageKey = STORAGE_KEY) {
  const items = ref<MemoryItem[]>([]);
  let loaded = false;

  function load() {
    if (loaded) return;
    loaded = true;
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        items.value = parsed
          .filter(
            (o: unknown): o is MemoryItem =>
              typeof o === 'object' &&
              o !== null &&
              typeof (o as MemoryItem).id === 'string' &&
              typeof (o as MemoryItem).text === 'string',
          )
          .slice(0, MAX_ITEMS);
      }
    } catch {
      /* ignore */
    }
  }

  function save() {
    load();
    try {
      localStorage.setItem(storageKey, JSON.stringify(items.value.slice(0, MAX_ITEMS)));
    } catch {
      /* ignore quota */
    }
  }

  function addItem(text: string, source: 'manual' | 'auto' = 'manual'): MemoryItem {
    load();
    const trimmed = text.trim();
    const existing = items.value.find((m) => m.text === trimmed);
    if (existing) return existing;

    const item: MemoryItem = { id: genId(), text: trimmed, createdAt: Date.now(), source };
    items.value.unshift(item);
    if (items.value.length > MAX_ITEMS) {
      items.value = items.value.slice(0, MAX_ITEMS);
    }
    save();
    return item;
  }

  function removeItem(id: string) {
    load();
    items.value = items.value.filter((m) => m.id !== id);
    save();
  }

  function clearAll() {
    load();
    items.value = [];
    save();
  }

  /**
   * Build a system prompt fragment from stored memories,
   * respecting a character budget.
   */
  const memoryPromptFragment = computed(() => {
    load();
    if (items.value.length === 0) return '';
    let budget = MAX_CHAR_BUDGET;
    const lines: string[] = [];
    for (const m of items.value) {
      const line = `- ${m.text}`;
      if (budget - line.length < 0) break;
      lines.push(line);
      budget -= line.length;
    }
    if (lines.length === 0) return '';
    return `[User Memory]\nThe following are facts/preferences the user wants you to remember across conversations:\n${lines.join('\n')}\n`;
  });

  return {
    items,
    addItem,
    removeItem,
    clearAll,
    memoryPromptFragment,
  };
}
