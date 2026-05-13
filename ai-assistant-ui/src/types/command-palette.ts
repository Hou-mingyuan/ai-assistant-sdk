/**
 * Shared types for the CommandPalette component and its composable.
 * Extracted to a standalone .ts file so vitest can type-check independently
 * of the .vue SFC.
 */

export interface CommandItem {
  /** Unique identifier (used by register/unregister and key in the list). */
  id: string;
  /** Display label shown in the palette list. */
  label: string;
  /** Optional group / category label (right-aligned chip in the list). */
  group?: string;
  /** Optional emoji or single-glyph icon shown left of the label. */
  icon?: string;
  /** Optional human-readable shortcut, e.g. "Ctrl+Shift+P" -- shown only. */
  shortcut?: string;
  /** Additional search keywords to widen filter hits. */
  keywords?: string[];
  /** Invoked when the user picks this item (Enter or click). May be async. */
  action: () => void | Promise<void>;
}
