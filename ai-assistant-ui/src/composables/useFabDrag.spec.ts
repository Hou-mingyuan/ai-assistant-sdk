import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useFabDrag } from './useFabDrag';

function mountFabDragHarness() {
  const isOpen = ref(false);
  const fabHidden = ref(false);
  const persistFab = ref(false);
  let drag!: ReturnType<typeof useFabDrag>;

  const Comp = defineComponent({
    setup() {
      drag = useFabDrag(isOpen, fabHidden, persistFab, 'bottom-right');
      return () => h('div');
    },
  });

  const wrapper = mount(Comp);
  return { wrapper, isOpen, drag };
}

describe('useFabDrag', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1280, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true });
  });

  function dispatchPointerDrag(
    btn: HTMLButtonElement,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) {
    const down = new Event('pointerdown', { bubbles: true }) as unknown as PointerEvent;
    Object.defineProperties(down, {
      button: { value: 0 },
      pointerId: { value: 1 },
      clientX: { value: startX },
      clientY: { value: startY },
    });
    btn.setPointerCapture = vi.fn();
    btn.dispatchEvent(down);

    const move = new Event('pointermove') as unknown as PointerEvent;
    Object.defineProperties(move, {
      pointerId: { value: 1 },
      clientX: { value: endX },
      clientY: { value: endY },
    });
    window.dispatchEvent(move);

    const up = new Event('pointerup') as unknown as PointerEvent;
    Object.defineProperties(up, {
      pointerId: { value: 1 },
      clientX: { value: endX },
      clientY: { value: endY },
    });
    window.dispatchEvent(up);
  }

  it('requires one click to reveal a docked FAB and a second click to open the panel', () => {
    const { wrapper, isOpen, drag } = mountFabDragHarness();
    const btn = document.createElement('button');
    btn.addEventListener('pointerdown', drag.onFabPointerDown);

    drag.dockFab('right');
    expect(drag.edgeDock.value).toBe('right');
    expect(drag.fabLeft.value).toBe(1280 - drag.FAB_SIZE);
    expect(drag.dockRevealed.value).toBe(false);

    // First click while docked: emerges completely without opening panel or shifting wrapper left
    dispatchPointerDrag(btn, 1260, 400, 1260, 400);
    expect(drag.dockRevealed.value).toBe(true);
    expect(drag.fabLeft.value).toBe(1280 - drag.FAB_SIZE);
    expect(isOpen.value).toBe(false);

    // Second click while revealed: opens chat panel and resets reveal flag
    dispatchPointerDrag(btn, 1220, 400, 1220, 400);
    expect(isOpen.value).toBe(true);
    expect(drag.dockRevealed.value).toBe(false);

    wrapper.unmount();
  });

  it('snaps flush to edge dock when dragged to the viewport border and undocks on break drag', () => {
    const { wrapper, isOpen, drag } = mountFabDragHarness();
    const btn = document.createElement('button');
    btn.addEventListener('pointerdown', drag.onFabPointerDown);

    // Drag up to right viewport border (>= innerWidth - FAB_SIZE - 12)
    dispatchPointerDrag(btn, 1180, 400, 1222, 400);
    expect(drag.edgeDock.value).toBe('right');
    expect(drag.fabLeft.value).toBe(1280 - drag.FAB_SIZE);
    expect(drag.dockRevealed.value).toBe(false);
    expect(isOpen.value).toBe(false);

    // Drag away beyond DOCK_BREAK_PX (> 10px) undocks back to free-float
    dispatchPointerDrag(btn, 1260, 400, 1160, 400);
    expect(drag.edgeDock.value).toBe('none');
    expect(drag.dockRevealed.value).toBe(false);

    // Drag to left viewport border (<= 12px) docks flush to left: 0
    dispatchPointerDrag(btn, 1140, 400, 20, 400);
    expect(drag.edgeDock.value).toBe('left');
    expect(drag.fabLeft.value).toBe(0);

    wrapper.unmount();
  });
});
