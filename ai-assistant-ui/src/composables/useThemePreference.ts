import { computed, ref, onMounted, onUnmounted, type ComputedRef, type Ref } from 'vue';

/**
 * Refactor (T1)：原 AiAssistant.vue 里 systemDark / reducedMotion / pageVisible
 * 三个 matchMedia 监听 + 用户主题覆盖（localStorage）的整合 composable。
 *
 * 提取动机：这块逻辑 100% 副作用、需要在 mount/unmount 成对清理，独立 composable
 * 比内联 onMounted/onUnmounted 更清晰，且可被任何其它组件复用（例如未来的
 * AdminDashboard / FormAutoFillDialog 主题适配）。
 *
 * 行为契约：
 *   - userOverride === null  → 跟随 options.theme
 *   - userOverride === 'dark' | 'light' → 显式覆盖（持久化）
 *   - options.theme === 'auto' 时按 systemDark 自动切换
 *   - 切换写入 localStorage，浏览器恢复后保留
 */

const THEME_OVERRIDE_KEY = 'ai-assistant-user-theme-override';

export type OptionsTheme = 'light' | 'dark' | 'auto' | undefined;
type UserOverride = 'light' | 'dark' | null;

function readPersistedOverride(): UserOverride {
  try {
    const v = localStorage.getItem(THEME_OVERRIDE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

export function useThemePreference(theme: ComputedRef<OptionsTheme> | Ref<OptionsTheme>) {
  const systemDark = ref(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const reducedMotion = ref(
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  const pageVisible = ref(!document.hidden);
  const userOverride = ref<UserOverride>(readPersistedOverride());

  let darkCleanup: (() => void) | null = null;
  let reducedCleanup: (() => void) | null = null;
  let visibilityCleanup: (() => void) | null = null;

  onMounted(() => {
    const darkMql = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (darkMql) {
      const handler = (e: MediaQueryListEvent) => {
        systemDark.value = e.matches;
      };
      darkMql.addEventListener('change', handler);
      darkCleanup = () => darkMql.removeEventListener('change', handler);
    }
    const reducedMql = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (reducedMql) {
      const handler = (e: MediaQueryListEvent) => {
        reducedMotion.value = e.matches;
      };
      reducedMql.addEventListener('change', handler);
      reducedCleanup = () => reducedMql.removeEventListener('change', handler);
    }
    const onVisibility = () => {
      pageVisible.value = !document.hidden;
    };
    document.addEventListener('visibilitychange', onVisibility);
    visibilityCleanup = () => document.removeEventListener('visibilitychange', onVisibility);
  });

  onUnmounted(() => {
    darkCleanup?.();
    reducedCleanup?.();
    visibilityCleanup?.();
  });

  const isDark = computed(() => {
    if (userOverride.value) return userOverride.value === 'dark';
    if (theme.value === 'dark') return true;
    if (theme.value === 'auto') return systemDark.value;
    return false;
  });

  function toggleManualTheme() {
    const next: 'light' | 'dark' = isDark.value ? 'light' : 'dark';
    userOverride.value = next;
    try {
      localStorage.setItem(THEME_OVERRIDE_KEY, next);
    } catch (e) {
      console.warn('[AiAssistant] persist theme override failed', e);
    }
  }

  return {
    systemDark,
    reducedMotion,
    pageVisible,
    userOverride,
    isDark,
    toggleManualTheme,
  };
}
