/**
 * 面板记忆：把面板开合 / 展开 / 自定义尺寸持久化到 localStorage，刷新页面后恢复。
 * 与 useFabDrag 的悬浮球位置持久化同一套写法：读写都包 try/catch，localStorage 不可用、
 * 配额满或内容损坏时静默忽略，绝不影响面板本身的使用。
 */
import type { Ref } from 'vue';

export const PANEL_MEMORY_KEY = 'ai-assistant-panel-v1';

export interface PanelMemory {
  /** 关闭前面板是否打开 */
  open: boolean;
  /** 关闭前面板是否处于「展开」态（非自定义尺寸） */
  expanded: boolean;
  /** 用户拖拽缩放后的宽高（px），没有自定义尺寸时省略 */
  w?: number;
  h?: number;
}

export interface PanelMemoryStore {
  load(): PanelMemory | null;
  save(next: PanelMemory): void;
  clear(): void;
}

function isPositiveSize(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

/** 解析持久化原文；非法 JSON、非对象或四个字段都为空时返回 null。 */
export function readPanelMemory(raw: string | null): PanelMemory | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown> | null;
    if (!o || typeof o !== 'object') return null;
    const open = o.open === true;
    const expanded = o.expanded === true;
    const w = isPositiveSize(o.w) ? o.w : undefined;
    const h = isPositiveSize(o.h) ? o.h : undefined;
    if (!open && !expanded && w === undefined && h === undefined) return null;
    return { open, expanded, w, h };
  } catch {
    /* Ignore malformed persisted panel state. */
    return null;
  }
}

export function usePanelMemory(
  persist: Ref<boolean>,
  storageKey: Ref<string | undefined>,
): PanelMemoryStore {
  const key = () => storageKey.value || PANEL_MEMORY_KEY;

  return {
    load() {
      if (!persist.value) return null;
      try {
        return readPanelMemory(localStorage.getItem(key()));
      } catch {
        /* localStorage unavailable (SSR / privacy mode) — fall back to defaults. */
        return null;
      }
    },
    save(next) {
      if (!persist.value) return;
      try {
        localStorage.setItem(key(), JSON.stringify(next));
      } catch {
        /* Ignore localStorage write failures. */
      }
    },
    clear() {
      try {
        localStorage.removeItem(key());
      } catch {
        /* Ignore localStorage write failures. */
      }
    },
  };
}
