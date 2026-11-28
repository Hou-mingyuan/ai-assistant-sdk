import { beforeEach, describe, expect, it } from 'vitest';
import {
  EDGE_DOCK_STYLES,
  EDGE_DOCK_STYLE_KEY,
  isValidEdgeDockStyle,
  useEdgeDockStyle,
} from './useEdgeDockStyle';

describe('useEdgeDockStyle', () => {
  beforeEach(() => {
    localStorage.removeItem(EDGE_DOCK_STYLE_KEY);
  });

  it('provides all 6 edge dock styles and defaults to handle-bar', () => {
    expect(EDGE_DOCK_STYLES).toHaveLength(6);
    const state = useEdgeDockStyle();
    expect(state.edgeDockStyle.value).toBe('handle-bar');
    expect(state.edgeDockStyleClass.value).toBe('dock-style-handle-bar');
  });

  it('persists valid style changes and restores them on next mount', () => {
    const first = useEdgeDockStyle();
    first.setEdgeDockStyle('eye-strip');
    expect(first.edgeDockStyleClass.value).toBe('dock-style-eye-strip');
    expect(localStorage.getItem(EDGE_DOCK_STYLE_KEY)).toBe('eye-strip');

    const second = useEdgeDockStyle('nap-lean');
    expect(second.edgeDockStyle.value).toBe('eye-strip');
  });

  it('rejects invalid styles while honoring initial host override when unstored', () => {
    expect(isValidEdgeDockStyle('halo-ring')).toBe(true);
    expect(isValidEdgeDockStyle('unknown-mode')).toBe(false);

    const state = useEdgeDockStyle('nap-lean');
    expect(state.edgeDockStyle.value).toBe('nap-lean');
    // @ts-expect-error testing runtime guard with invalid input
    state.setEdgeDockStyle('invalid');
    expect(state.edgeDockStyle.value).toBe('nap-lean');
  });
});
