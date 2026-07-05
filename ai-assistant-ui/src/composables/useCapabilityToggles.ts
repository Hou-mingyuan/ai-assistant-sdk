import { ref } from 'vue';

/**
 * LLM behaviour capability toggles (deep-think / web-search / fast-reply)
 * extracted from AiAssistant.vue (refactor batch 6).
 *
 * Each toggle flips its reactive flag and surfaces a transient toast via the
 * injected `notify`. Behaviour (including the existing hardcoded zh toast copy)
 * is preserved verbatim from the previous inline setters; this batch only
 * relocates the logic, it does not change the messages or introduce i18n.
 */
export interface UseCapabilityTogglesOptions {
  notify: (text: string, ms: number) => void;
}

export function useCapabilityToggles(deps: UseCapabilityTogglesOptions) {
  const { notify } = deps;

  const deepThinkEnabled = ref(false);
  const webSearchEnabled = ref(false);
  const fastReplyEnabled = ref(false);

  function setDeepThinkEnabled(value: boolean) {
    deepThinkEnabled.value = value;
    notify(value ? '深度思考已开启：回答会更审慎但可能更慢' : '深度思考已关闭', 1800);
  }

  function setWebSearchEnabled(value: boolean) {
    webSearchEnabled.value = value;
    notify(value ? '联网搜索已开启：回答前会先检索网页' : '联网搜索已关闭', 1800);
  }

  function setFastReplyEnabled(value: boolean) {
    fastReplyEnabled.value = value;
    notify(value ? '快速回答已开启：简单问题会优先走快模型' : '快速回答已关闭', 1800);
  }

  return {
    deepThinkEnabled,
    webSearchEnabled,
    fastReplyEnabled,
    setDeepThinkEnabled,
    setWebSearchEnabled,
    setFastReplyEnabled,
  };
}
