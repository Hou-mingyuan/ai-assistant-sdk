import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { useWrapperStyles, type FabScreenQuadrant } from './useWrapperStyles';

function setup(
  o: { mounted?: boolean; mobile?: boolean; fabLeft?: number | null; fabTop?: number | null } = {},
) {
  const panelMountedForLayout = ref(o.mounted ?? false);
  const isMobileViewport = ref(o.mobile ?? false);
  const fabLeft = ref<number | null>(o.fabLeft ?? null);
  const fabTop = ref<number | null>(o.fabTop ?? null);
  const openPanelQuadrant = ref<FabScreenQuadrant>('br');
  return useWrapperStyles({
    color: computed(() => '#123456'),
    themePaletteVars: computed(() => ({ '--ai-theme-from': '#aabbcc' })),
    panelMountedForLayout,
    isMobileViewport,
    effectivePanelWidthPx: () => 480,
    effectivePanelHeightPx: () => 520,
    fabLeft,
    fabTop,
    wrapperOffsetFromFab: () => ({ dx: 10, dy: 20 }),
    openPanelQuadrant,
    panelTransformOrigin: computed(() => 'bottom right'),
  });
}

describe('useWrapperStyles', () => {
  it('wrapperStyle exposes primary + palette vars and no size/position when idle', () => {
    const { wrapperStyle } = setup();
    expect(wrapperStyle.value).toEqual({ '--primary': '#123456', '--ai-theme-from': '#aabbcc' });
  });

  it('wrapperStyle includes panel size when mounted for layout', () => {
    const { wrapperStyle } = setup({ mounted: true });
    expect(wrapperStyle.value.width).toBe('480px');
    expect(wrapperStyle.value.height).toBe('520px');
  });

  it('uses exact viewport edges for a mounted mobile panel', () => {
    const { wrapperStyle, panelStyle } = setup({
      mounted: true,
      mobile: true,
      fabLeft: 100,
      fabTop: 200,
    });
    expect(wrapperStyle.value).toMatchObject({
      position: 'fixed',
      inset: '0',
      width: 'auto',
      height: 'auto',
      maxWidth: 'none',
      maxHeight: 'none',
    });
    expect(wrapperStyle.value).not.toHaveProperty('left');
    expect(wrapperStyle.value).not.toHaveProperty('top');
    expect(panelStyle.value).toMatchObject({
      inset: '0',
      boxSizing: 'border-box',
      width: '100%',
      height: '100%',
      maxWidth: '100%',
      maxHeight: '100%',
    });
  });

  it('wrapperStyle pins to the fab position when fab coords are set', () => {
    const { wrapperStyle } = setup({ fabLeft: 100, fabTop: 200 });
    expect(wrapperStyle.value.left).toBe('100px');
    expect(wrapperStyle.value.top).toBe('200px');
    expect(wrapperStyle.value.right).toBe('auto');
  });

  it('wrapperStyle applies the fab offset only when mounted for layout', () => {
    const { wrapperStyle } = setup({ mounted: true, fabLeft: 100, fabTop: 200 });
    expect(wrapperStyle.value.left).toBe('110px');
    expect(wrapperStyle.value.top).toBe('220px');
  });

  it('panelStyle exposes primary color and transform origin', () => {
    const { panelStyle } = setup();
    expect(panelStyle.value).toEqual({ '--primary': '#123456', transformOrigin: 'bottom right' });
  });
});
