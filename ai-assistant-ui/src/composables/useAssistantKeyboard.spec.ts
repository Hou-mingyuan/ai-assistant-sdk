import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useAssistantKeyboard } from './useAssistantKeyboard';

describe('useAssistantKeyboard', () => {
  it('closes overlays in strict top-to-bottom Escape priority before shrinking or closing panel', () => {
    const isOpen = ref(true);
    const panelExpanded = ref(true);
    const edgeDockSettingsOpen = ref(true);
    const formAutoFillDialogOpen = ref(true);
    const sessionsDrawerOpen = ref(true);
    const onCloseFormAutoFillDialog = vi.fn(() => {
      formAutoFillDialogOpen.value = false;
    });

    const { onEscKeydown } = useAssistantKeyboard({
      options: {},
      panelRef: ref(undefined),
      isOpen,
      panelExpanded,
      fabHidden: ref(false),
      sessionsDrawerOpen,
      edgeDockSettingsOpen,
      formAutoFillDialogOpen,
      onCloseFormAutoFillDialog,
      clearMessages: vi.fn(),
      startNewSession: vi.fn(),
    });

    const esc = () => new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });

    // 1. Settings sheet closes first
    onEscKeydown(esc());
    expect(edgeDockSettingsOpen.value).toBe(false);
    expect(formAutoFillDialogOpen.value).toBe(true);
    expect(isOpen.value).toBe(true);

    // 2. FormAutoFillDialog closes before sessions drawer and panel
    onEscKeydown(esc());
    expect(onCloseFormAutoFillDialog).toHaveBeenCalledTimes(1);
    expect(formAutoFillDialogOpen.value).toBe(false);
    expect(sessionsDrawerOpen.value).toBe(true);
    expect(isOpen.value).toBe(true);

    // 3. Sessions drawer closes next
    onEscKeydown(esc());
    expect(sessionsDrawerOpen.value).toBe(false);
    expect(panelExpanded.value).toBe(true);

    // 4. Expanded panel restores, then panel closes
    onEscKeydown(esc());
    expect(panelExpanded.value).toBe(false);
    expect(isOpen.value).toBe(true);

    onEscKeydown(esc());
    expect(isOpen.value).toBe(false);
  });
});
