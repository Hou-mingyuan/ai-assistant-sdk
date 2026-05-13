import { describe, it, expect, vi, beforeEach } from 'vitest';

/* Hoist mocks so vi.mock factory can reference them without TDZ. */
const { mockOnMounted, mockOnUnmounted } = vi.hoisted(() => ({
  mockOnMounted: vi.fn((cb: () => void) => cb()),
  mockOnUnmounted: vi.fn(),
}));

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    onMounted: mockOnMounted,
    onUnmounted: mockOnUnmounted,
  };
});

import { useCommandPalette } from './useCommandPalette';
import type { CommandItem } from '../types/command-palette';

describe('useCommandPalette', () => {
  beforeEach(() => {
    mockOnMounted.mockClear();
    mockOnUnmounted.mockClear();
  });

  it('starts with open=false and the supplied initial commands', () => {
    const cmds: CommandItem[] = [
      { id: 'a', label: 'A', action: () => undefined },
      { id: 'b', label: 'B', action: () => undefined },
    ];
    const cp = useCommandPalette({ commands: cmds, registerShortcut: false });
    expect(cp.open.value).toBe(false);
    expect(cp.commands.value).toHaveLength(2);
  });

  it('toggle / show / hide control the open ref', () => {
    const cp = useCommandPalette({ registerShortcut: false });
    cp.show();
    expect(cp.open.value).toBe(true);
    cp.hide();
    expect(cp.open.value).toBe(false);
    cp.toggle();
    expect(cp.open.value).toBe(true);
    cp.toggle();
    expect(cp.open.value).toBe(false);
  });

  it('register() adds a new command', () => {
    const cp = useCommandPalette({ registerShortcut: false });
    cp.register({ id: 'new', label: 'New', action: () => undefined });
    expect(cp.commands.value).toHaveLength(1);
    expect(cp.commands.value[0]?.id).toBe('new');
  });

  it('register() replaces a command with an existing id', () => {
    const cp = useCommandPalette({
      registerShortcut: false,
      commands: [{ id: 'x', label: 'Old', action: () => undefined }],
    });
    cp.register({ id: 'x', label: 'New', action: () => undefined });
    expect(cp.commands.value).toHaveLength(1);
    expect(cp.commands.value[0]?.label).toBe('New');
  });

  it('register() can be called with an array', () => {
    const cp = useCommandPalette({ registerShortcut: false });
    cp.register([
      { id: 'a', label: 'A', action: () => undefined },
      { id: 'b', label: 'B', action: () => undefined },
    ]);
    expect(cp.commands.value).toHaveLength(2);
  });

  it('unregister() removes by id and returns true/false', () => {
    const cp = useCommandPalette({
      registerShortcut: false,
      commands: [
        { id: 'a', label: 'A', action: () => undefined },
        { id: 'b', label: 'B', action: () => undefined },
      ],
    });
    expect(cp.unregister('a')).toBe(true);
    expect(cp.commands.value).toHaveLength(1);
    expect(cp.unregister('does-not-exist')).toBe(false);
  });

  it('clear() empties the command list', () => {
    const cp = useCommandPalette({
      registerShortcut: false,
      commands: [{ id: 'a', label: 'A', action: () => undefined }],
    });
    cp.clear();
    expect(cp.commands.value).toHaveLength(0);
  });

  it('registerShortcut=false does not register keyboard listener', () => {
    useCommandPalette({ registerShortcut: false });
    expect(mockOnMounted).not.toHaveBeenCalled();
  });

  it('shortcut="false" returns null shortcut and skips listener', () => {
    const cp = useCommandPalette({ shortcut: false, registerShortcut: true });
    expect(cp.shortcut).toBeNull();
  });

  it('exposes the parsed shortcut string', () => {
    const cp = useCommandPalette({ shortcut: 'Ctrl+Shift+P', registerShortcut: false });
    expect(cp.shortcut).toBe('Ctrl+Shift+P');
  });

  it('registerShortcut=true adds and removes keydown listener on mount/unmount', () => {
    const cp = useCommandPalette({
      shortcut: 'Ctrl+K',
      registerShortcut: true,
    });
    expect(mockOnMounted).toHaveBeenCalledTimes(1);
    expect(cp.shortcut).toBe('Ctrl+K');
  });
});
