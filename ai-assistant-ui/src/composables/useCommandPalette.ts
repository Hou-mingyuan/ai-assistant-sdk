import { ref, onMounted, onUnmounted } from 'vue';
import type { CommandItem } from '../types/command-palette';

export interface UseCommandPaletteOptions {
  /** Keyboard shortcut to toggle the palette. Default 'Ctrl+K' / '⌘+K'. */
  shortcut?: string | false;
  /** Whether to register the global keyboard listener. Default true. */
  registerShortcut?: boolean;
  /** Optional scope guard for pages that host more than one command palette. */
  shouldHandleShortcut?: (event: KeyboardEvent) => boolean;
  /** Initial commands to register. More can be added at runtime via register(). */
  commands?: CommandItem[];
}

const DEFAULT_SHORTCUT = navigator.platform.toLowerCase().includes('mac') ? 'Meta+K' : 'Ctrl+K';

function parseShortcut(s: string): {
  key: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
  alt: boolean;
} {
  const parts = s.split('+').map((p) => p.trim().toLowerCase());
  return {
    key: parts[parts.length - 1] ?? '',
    ctrl: parts.includes('ctrl'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
  };
}

function matchesShortcut(ev: KeyboardEvent, sc: ReturnType<typeof parseShortcut>): boolean {
  return (
    ev.key.toLowerCase() === sc.key &&
    ev.ctrlKey === sc.ctrl &&
    ev.metaKey === sc.meta &&
    ev.shiftKey === sc.shift &&
    ev.altKey === sc.alt
  );
}

export function useCommandPalette(opts: UseCommandPaletteOptions = {}) {
  const open = ref(false);
  const commands = ref<CommandItem[]>([...(opts.commands ?? [])]);

  const shortcutStr = opts.shortcut === false ? null : (opts.shortcut ?? DEFAULT_SHORTCUT);
  const sc = shortcutStr ? parseShortcut(shortcutStr) : null;

  function toggle() {
    open.value = !open.value;
  }

  function show() {
    open.value = true;
  }

  function hide() {
    open.value = false;
  }

  function register(cmd: CommandItem | CommandItem[]) {
    const arr = Array.isArray(cmd) ? cmd : [cmd];
    for (const c of arr) {
      const exists = commands.value.findIndex((x) => x.id === c.id);
      if (exists >= 0) {
        commands.value[exists] = c;
      } else {
        commands.value.push(c);
      }
    }
  }

  function unregister(id: string): boolean {
    const i = commands.value.findIndex((c) => c.id === id);
    if (i < 0) return false;
    commands.value.splice(i, 1);
    return true;
  }

  function clear() {
    commands.value = [];
  }

  function onKeyDown(ev: KeyboardEvent) {
    if (!sc) return;
    if (matchesShortcut(ev, sc)) {
      if (opts.shouldHandleShortcut?.(ev) === false) return;
      ev.preventDefault();
      toggle();
    }
  }

  if (opts.registerShortcut !== false && typeof window !== 'undefined') {
    onMounted(() => window.addEventListener('keydown', onKeyDown));
    onUnmounted(() => window.removeEventListener('keydown', onKeyDown));
  }

  return {
    open,
    commands,
    toggle,
    show,
    hide,
    register,
    unregister,
    clear,
    shortcut: shortcutStr,
  };
}
