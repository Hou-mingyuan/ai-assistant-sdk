import { describe, expect, it } from 'vitest';

import { computeRectFromResizePointer, type PanelRect } from './usePanelResize';

const startRect: PanelRect = { wl: 100, wt: 80, w: 400, h: 300 };
const clamp = (w: number, h: number) => ({
  w: Math.max(300, Math.min(480, Math.round(w))),
  h: Math.max(280, Math.min(360, Math.round(h))),
});

describe('computeRectFromResizePointer', () => {
  it('anchors southeast resize at the original top-left corner', () => {
    expect(computeRectFromResizePointer('se', startRect, 450, 360, clamp)).toEqual({
      wl: 100,
      wt: 80,
      w: 350,
      h: 280,
    });
  });

  it('anchors northwest resize at the original bottom-right corner after clamping', () => {
    expect(computeRectFromResizePointer('nw', startRect, 240, 190, clamp)).toEqual({
      wl: 200,
      wt: 100,
      w: 300,
      h: 280,
    });
  });

  it('moves only the west edge for horizontal west resize', () => {
    expect(computeRectFromResizePointer('w', startRect, 180, 999, clamp)).toEqual({
      wl: 180,
      wt: 80,
      w: 320,
      h: 300,
    });
  });
});
