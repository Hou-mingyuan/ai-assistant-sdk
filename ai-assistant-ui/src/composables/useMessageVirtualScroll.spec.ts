import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { useMessageVirtualScroll } from './useMessageVirtualScroll';

describe('useMessageVirtualScroll', () => {
  it('is disabled (full render) when below minActivationCount', () => {
    const messageCount = ref(20);
    const viewportHeight = ref(400);
    const scrollTop = ref(0);
    const vs = useMessageVirtualScroll({
      messageCount,
      viewportHeight,
      scrollTop,
      minActivationCount: 60,
    });
    expect(vs.window.value.enabled).toBe(false);
    expect(vs.window.value.startIndex).toBe(0);
    expect(vs.window.value.endIndex).toBe(20);
    expect(vs.window.value.topSpacer).toBe(0);
    expect(vs.window.value.bottomSpacer).toBe(0);
  });

  it('activates and produces a forward window when above threshold', () => {
    const messageCount = ref(200);
    const viewportHeight = ref(450);
    const scrollTop = ref(0);
    const vs = useMessageVirtualScroll({
      messageCount,
      viewportHeight,
      scrollTop,
      estimatedItemHeight: 90,
      overscan: 2,
      minActivationCount: 60,
    });
    const w = vs.window.value;
    expect(w.enabled).toBe(true);
    expect(w.startIndex).toBe(0);
    /* viewport 450 / 90 ≈ 5 visible + 2 overscan = 7 → endIndex around 7 */
    expect(w.endIndex).toBeGreaterThanOrEqual(5);
    expect(w.endIndex).toBeLessThanOrEqual(9);
    expect(w.topSpacer).toBe(0);
    expect(w.bottomSpacer).toBe(90 * (200 - w.endIndex));
  });

  it('shifts the window when scrollTop advances', () => {
    const messageCount = ref(200);
    const viewportHeight = ref(450);
    const scrollTop = ref(900);
    const vs = useMessageVirtualScroll({
      messageCount,
      viewportHeight,
      scrollTop,
      estimatedItemHeight: 90,
      overscan: 0,
      minActivationCount: 60,
    });
    const w = vs.window.value;
    /* scrollTop 900 / 90 = 10 → start at item 10 */
    expect(w.startIndex).toBe(10);
    expect(w.topSpacer).toBe(900);
  });

  it('honours measured per-item heights instead of the estimate', () => {
    const messageCount = ref(100);
    const viewportHeight = ref(300);
    const scrollTop = ref(0);
    const vs = useMessageVirtualScroll({
      messageCount,
      viewportHeight,
      scrollTop,
      estimatedItemHeight: 50,
      overscan: 0,
      minActivationCount: 60,
    });
    /* Make the first 5 items tall (200px) and verify totalHeight reflects it */
    for (let i = 0; i < 5; i++) vs.updateMeasuredHeight(i, 200);
    /* totalHeight = 5*200 + 95*50 = 1000 + 4750 = 5750 */
    expect(vs.totalHeight.value).toBe(5750);
  });

  it('clearMeasured wipes the measurement cache', () => {
    const messageCount = ref(80);
    const viewportHeight = ref(300);
    const scrollTop = ref(0);
    const vs = useMessageVirtualScroll({
      messageCount,
      viewportHeight,
      scrollTop,
    });
    vs.updateMeasuredHeight(0, 250);
    expect(vs.measuredHeights.value.size).toBe(1);
    vs.clearMeasured();
    expect(vs.measuredHeights.value.size).toBe(0);
  });

  it('clamps endIndex to messageCount near the bottom of the list', () => {
    const messageCount = ref(80);
    const viewportHeight = ref(800);
    const scrollTop = ref(80 * 90); // past the end
    const vs = useMessageVirtualScroll({
      messageCount,
      viewportHeight,
      scrollTop,
      estimatedItemHeight: 90,
      overscan: 4,
      minActivationCount: 60,
    });
    const w = vs.window.value;
    expect(w.endIndex).toBe(80);
    expect(w.bottomSpacer).toBe(0);
  });

  it('ignores invalid update calls', () => {
    const messageCount = ref(100);
    const viewportHeight = ref(300);
    const scrollTop = ref(0);
    const vs = useMessageVirtualScroll({
      messageCount,
      viewportHeight,
      scrollTop,
    });
    vs.updateMeasuredHeight(-1, 100);
    vs.updateMeasuredHeight(5, 0);
    vs.updateMeasuredHeight(5, -10);
    expect(vs.measuredHeights.value.size).toBe(0);
  });
});
