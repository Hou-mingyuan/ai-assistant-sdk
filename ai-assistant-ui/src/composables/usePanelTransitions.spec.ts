import { ref } from 'vue';
import { describe, expect, it } from 'vitest';
import { usePanelTransitions } from './usePanelTransitions';

describe('usePanelTransitions', () => {
  it('shows the fab during enter and hides it once the panel has entered', () => {
    const p = usePanelTransitions({ panelMountedForLayout: ref(true) });
    expect(p.showFabDuringPanelAnim.value).toBe(true);
    p.onPanelAfterEnter();
    expect(p.showFabDuringPanelAnim.value).toBe(false);
    p.onPanelBeforeEnter();
    expect(p.showFabDuringPanelAnim.value).toBe(true);
  });

  it('shows the fab again while the panel is leaving', () => {
    const p = usePanelTransitions({ panelMountedForLayout: ref(true) });
    p.onPanelAfterEnter();
    p.onPanelBeforeLeave();
    expect(p.showFabDuringPanelAnim.value).toBe(true);
  });

  it('unmounts the panel layout after leave', () => {
    const panelMountedForLayout = ref(true);
    const p = usePanelTransitions({ panelMountedForLayout });
    p.onPanelAfterLeave();
    expect(panelMountedForLayout.value).toBe(false);
  });
});
