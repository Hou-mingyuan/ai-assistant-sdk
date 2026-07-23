import { computed, type ComputedRef, type Ref } from 'vue';

/**
 * Wrapper / panel inline style computeds extracted from AiAssistant.vue
 * (refactor batch 10).
 *
 * Intentionally a NEW composable rather than folding into usePanelGeometry:
 * these styles mix theme (color / palette vars) with geometry outputs, so
 * keeping them separate preserves usePanelGeometry's single "geometry only"
 * responsibility. Geometry values are injected; behaviour is identical to the
 * previous inline computeds.
 */
export type FabScreenQuadrant = 'tl' | 'tr' | 'bl' | 'br';

export interface UseWrapperStylesOptions {
  color: ComputedRef<string>;
  themePaletteVars: ComputedRef<Record<string, string>>;
  panelMountedForLayout: Ref<boolean>;
  isMobileViewport: Ref<boolean>;
  effectivePanelWidthPx: () => number;
  effectivePanelHeightPx: () => number;
  fabLeft: Ref<number | null>;
  fabTop: Ref<number | null>;
  wrapperOffsetFromFab: (quadrant: FabScreenQuadrant) => { dx: number; dy: number };
  openPanelQuadrant: Ref<FabScreenQuadrant>;
  panelTransformOrigin: ComputedRef<string>;
}

export function useWrapperStyles(deps: UseWrapperStylesOptions) {
  const {
    color,
    themePaletteVars,
    panelMountedForLayout,
    isMobileViewport,
    effectivePanelWidthPx,
    effectivePanelHeightPx,
    fabLeft,
    fabTop,
    wrapperOffsetFromFab,
    openPanelQuadrant,
    panelTransformOrigin,
  } = deps;

  const wrapperStyle = computed(() => {
    const st: Record<string, string> = { '--primary': color.value, ...themePaletteVars.value };
    const mobilePanel = panelMountedForLayout.value && isMobileViewport.value;
    if (mobilePanel) {
      Object.assign(st, {
        position: 'fixed',
        inset: '0',
        width: 'auto',
        height: 'auto',
        maxWidth: 'none',
        maxHeight: 'none',
      });
    } else if (panelMountedForLayout.value) {
      st.width = `${effectivePanelWidthPx()}px`;
      st.height = `${effectivePanelHeightPx()}px`;
    }
    if (!mobilePanel && fabLeft.value !== null && fabTop.value !== null) {
      let L = fabLeft.value;
      let T = fabTop.value;
      if (panelMountedForLayout.value) {
        const { dx, dy } = wrapperOffsetFromFab(openPanelQuadrant.value);
        L += dx;
        T += dy;
      }
      st.left = `${L}px`;
      st.top = `${T}px`;
      st.right = 'auto';
      st.bottom = 'auto';
    }
    return st;
  });

  const panelStyle = computed(() => {
    const st: Record<string, string> = {
      '--primary': color.value,
      transformOrigin: panelTransformOrigin.value,
    };
    if (panelMountedForLayout.value && isMobileViewport.value) {
      Object.assign(st, {
        inset: '0',
        boxSizing: 'border-box',
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
      });
    }
    return st;
  });

  return { wrapperStyle, panelStyle };
}
