import { computed, watch, type ComputedRef, type Ref } from 'vue';
import type { CommandItem } from '../types/command-palette';
import type { I18nMessages } from '../utils/i18n';

/**
 * Refactor (T1-Wave2)：Command Palette 的注册 watch 统一留在这里。
 *
 * Command definitions now come from command families; this composable only owns
 * clear + register timing so defineExpose keeps using the same cmdPalette instance.
 */

export interface BuiltInCommandsDeps {
  t: ComputedRef<I18nMessages>;
  isOpen: Ref<boolean>;
  isDark: ComputedRef<boolean> | Ref<boolean>;
  startNewSession: () => void;
  clearMessages: () => void;
  toggleManualTheme: () => void;
  openPersonalize: () => void;
  memoryOpen: Ref<boolean>;
  kbPanelOpen: Ref<boolean>;
  keyboardHelpOpen: Ref<boolean>;
  /**
   * 来自外层 useCommandPalette() 的实例。本 composable 不持有 palette 状态，
   * 仅注册命令；这样调用方可以把 palette 暴露给宿主用 defineExpose。
   */
  cmdPalette: {
    register: (cmds: CommandItem[]) => void;
    clear: () => void;
    open: Ref<boolean>;
    commands: Ref<CommandItem[]>;
  };
  extraCommands?: ComputedRef<CommandItem[]> | Ref<CommandItem[]>;
}

export function useBuiltInCommands(deps: BuiltInCommandsDeps) {
  const { cmdPalette, extraCommands } = deps;

  const builtInCommands = computed<CommandItem[]>(() => extraCommands?.value ?? []);

  watch(
    builtInCommands,
    (cmds) => {
      cmdPalette.clear();
      cmdPalette.register(cmds);
    },
    { immediate: true },
  );

  return { builtInCommands };
}
