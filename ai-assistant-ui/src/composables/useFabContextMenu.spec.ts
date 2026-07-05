import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useFabContextMenu, type FabDockEdge } from './useFabContextMenu';

function makeMenu() {
  const isOpen = ref(false);
  const fabHidden = ref(false);
  const edgeDock = ref<FabDockEdge>('none');
  const dock = vi.fn();
  const fabEl = {
    getBoundingClientRect: () => ({
      left: 10,
      top: 20,
      bottom: 50,
      right: 60,
      width: 50,
      height: 30,
    }),
  } as unknown as HTMLElement;
  const menu = useFabContextMenu({ isOpen, fabHidden, edgeDock, getFab: () => fabEl, dock });
  return { isOpen, fabHidden, edgeDock, dock, menu };
}

describe('useFabContextMenu', () => {
  it('opens the menu at the fab anchor on contextmenu', () => {
    const { menu } = makeMenu();
    const e = { preventDefault: vi.fn() } as unknown as MouseEvent;
    menu.onFabContextMenu(e);
    expect(e.preventDefault).toHaveBeenCalled();
    expect(menu.fabCtxMenu.value.show).toBe(true);
    expect(menu.fabCtxMenu.value.x).toBe(10);
    expect(menu.fabCtxMenu.value.y).toBe(56);
  });

  it('does not open while the panel is open', () => {
    const { menu, isOpen } = makeMenu();
    isOpen.value = true;
    menu.onFabContextMenu({ preventDefault: vi.fn() } as unknown as MouseEvent);
    expect(menu.fabCtxMenu.value.show).toBe(false);
  });

  it('does not open while the fab is hidden', () => {
    const { menu, fabHidden } = makeMenu();
    fabHidden.value = true;
    menu.onFabContextMenu({ preventDefault: vi.fn() } as unknown as MouseEvent);
    expect(menu.fabCtxMenu.value.show).toBe(false);
  });

  it('closeFabCtxMenu hides the menu', () => {
    const { menu } = makeMenu();
    menu.onFabContextMenu({ preventDefault: vi.fn() } as unknown as MouseEvent);
    menu.closeFabCtxMenu();
    expect(menu.fabCtxMenu.value.show).toBe(false);
  });

  it('hideFabUntilPageReload hides the fab and closes the panel + menu', () => {
    const { menu, isOpen, fabHidden } = makeMenu();
    isOpen.value = true;
    menu.onFabContextMenu({ preventDefault: vi.fn() } as unknown as MouseEvent);
    menu.hideFabUntilPageReload();
    expect(fabHidden.value).toBe(true);
    expect(isOpen.value).toBe(false);
    expect(menu.fabCtxMenu.value.show).toBe(false);
  });

  it('dockFab delegates to the dock callback and closes the menu', () => {
    const { menu, dock } = makeMenu();
    menu.onFabContextMenu({ preventDefault: vi.fn() } as unknown as MouseEvent);
    menu.dockFab('left');
    expect(dock).toHaveBeenCalledWith('left');
    expect(menu.fabCtxMenu.value.show).toBe(false);
  });
});
