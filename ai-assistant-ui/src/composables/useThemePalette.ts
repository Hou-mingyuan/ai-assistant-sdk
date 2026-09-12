import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue';

const THEME_STORAGE_KEY = 'ai-assistant.theme.palette.v1';
const THEME_SYNC_EVENT = 'ai-assistant-theme-change';
export type ThemePresetId = 'sky' | 'sunset' | 'forest' | 'plum' | 'graphite';
const THEME_PRESETS: Record<
  ThemePresetId,
  { from: string; via: string; to: string; mark: string; darkMark: string }
> = {
  sky: {
    from: '#163b8c',
    via: '#2457d6',
    to: '#5b8def',
    mark: '#2457d6',
    darkMark: '#8fb4ff',
  },
  sunset: {
    from: '#9a3412',
    via: '#c2410c',
    to: '#f97316',
    mark: '#c2410c',
    darkMark: '#fdba74',
  },
  forest: {
    from: '#065f46',
    via: '#0f766e',
    to: '#2dd4bf',
    mark: '#0f766e',
    darkMark: '#5eead4',
  },
  plum: {
    from: '#075985',
    via: '#0891b2',
    to: '#22d3ee',
    mark: '#0891b2',
    darkMark: '#67e8f9',
  },
  graphite: {
    from: '#050505',
    via: '#171717',
    to: '#2b2b2b',
    mark: '#171717',
    darkMark: '#fafafa',
  },
};

export function useThemePalette() {
const themePalette = ref<ThemePresetId>(
  (() => {
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY) as ThemePresetId | null;
      if (v && v in THEME_PRESETS) return v;
    } catch {
      /* SSR / disabled localStorage — fall through to default */
    }
    return 'graphite';
  })(),
);
watch(themePalette, (v) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, v);
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(THEME_SYNC_EVENT, {
        detail: { theme: v, source: 'assistant' },
      }),
    );
  }
});
function onExternalThemeChange(event: Event) {
  const next = (event as CustomEvent<{ theme?: string }>).detail?.theme as
    ThemePresetId | undefined;
  if (next && next in THEME_PRESETS && next !== themePalette.value) {
    themePalette.value = next;
  }
}
const themePaletteVars = computed<Record<string, string>>(() => {
  const p = THEME_PRESETS[themePalette.value];
  return {
    '--ai-theme-from': p.from,
    '--ai-theme-via': p.via,
    '--ai-theme-to': p.to,
    '--ai-theme-mark': p.mark,
    '--ai-theme-mark-dark': p.darkMark,
  };
});
onMounted(() => window.addEventListener(THEME_SYNC_EVENT, onExternalThemeChange));
onBeforeUnmount(() => window.removeEventListener(THEME_SYNC_EVENT, onExternalThemeChange));
return { themePalette, themePaletteVars };
}
