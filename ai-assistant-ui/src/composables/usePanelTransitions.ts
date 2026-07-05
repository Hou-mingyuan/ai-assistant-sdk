import { ref, type Ref } from 'vue';

/**
 * Chat panel enter/leave transition flags extracted from AiAssistant.vue
 * (refactor batch 8).
 *
 * Owns `showFabDuringPanelAnim` and the four <Transition> hooks. The layout
 * mount flag is owned by the panel geometry layer and injected here. Behaviour
 * is identical to the previous inline handlers.
 */
export interface UsePanelTransitionsOptions {
  panelMountedForLayout: Ref<boolean>;
}

export function usePanelTransitions(deps: UsePanelTransitionsOptions) {
  const { panelMountedForLayout } = deps;
  const showFabDuringPanelAnim = ref(true);

  function onPanelBeforeEnter() {
    showFabDuringPanelAnim.value = true;
  }
  function onPanelAfterEnter() {
    showFabDuringPanelAnim.value = false;
  }
  function onPanelBeforeLeave() {
    showFabDuringPanelAnim.value = true;
  }
  function onPanelAfterLeave() {
    panelMountedForLayout.value = false;
  }

  return {
    showFabDuringPanelAnim,
    onPanelBeforeEnter,
    onPanelAfterEnter,
    onPanelBeforeLeave,
    onPanelAfterLeave,
  };
}
