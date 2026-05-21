import { ref, type Ref } from 'vue';

export interface UsePromptTemplateInteractionOptions {
  input: Ref<string>;
}

export function usePromptTemplateInteraction(options: UsePromptTemplateInteractionOptions) {
  const promptTemplateOpen = ref(false);

  function onPromptTemplateUse(rendered: string): void {
    options.input.value = rendered;
    promptTemplateOpen.value = false;
  }

  return {
    promptTemplateOpen,
    onPromptTemplateUse,
  };
}
