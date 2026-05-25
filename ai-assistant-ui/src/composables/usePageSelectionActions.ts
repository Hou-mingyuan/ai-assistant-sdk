import type { Ref } from 'vue';

type PageSelectionAction = 'ask' | 'translate' | 'summarize';
type AssistantMode = 'translate' | 'summarize' | 'chat';

interface UsePageSelectionActionsDeps {
  getSelectionText: () => string;
  dismissSelection: () => void;
  mode: Ref<AssistantMode>;
  input: Ref<string>;
  isOpen: Ref<boolean>;
  send: () => unknown;
  nextTickFn: (cb: () => void) => unknown;
}

export function usePageSelectionActions(deps: UsePageSelectionActionsDeps) {
  function onPageSelAction(action: PageSelectionAction) {
    const text = deps.getSelectionText();
    deps.dismissSelection();
    if (!text) return;

    if (action === 'ask') {
      deps.mode.value = 'chat';
    } else if (action === 'translate') {
      deps.mode.value = 'translate';
    } else {
      deps.mode.value = 'summarize';
    }
    deps.input.value = text;
    deps.isOpen.value = true;
    deps.nextTickFn(() => {
      if (action !== 'ask') {
        deps.send();
      }
    });
  }

  return {
    onPageSelAction,
  };
}
