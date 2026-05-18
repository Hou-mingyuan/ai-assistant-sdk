<template>
  <div class="ai-footer-model-row">
    <div class="ai-mode-segmented" role="tablist" aria-label="Mode">
      <button
        type="button"
        role="tab"
        class="ai-mode-segment"
        :class="{ active: mode === 'chat' }"
        :aria-selected="mode === 'chat' ? 'true' : 'false'"
        @click="$emit('changeMode', 'chat')"
      >
        {{ t.chat }}
      </button>
      <button
        type="button"
        role="tab"
        class="ai-mode-segment"
        :class="{ active: mode === 'translate' }"
        :aria-selected="mode === 'translate' ? 'true' : 'false'"
        @click="$emit('changeMode', 'translate')"
      >
        {{ t.translate }}
      </button>
      <button
        type="button"
        role="tab"
        class="ai-mode-segment"
        :class="{ active: mode === 'summarize' }"
        :aria-selected="mode === 'summarize' ? 'true' : 'false'"
        @click="$emit('changeMode', 'summarize')"
      >
        {{ t.summarize }}
      </button>
    </div>
    <div
      v-if="showModelPicker && hasBaseUrl"
      class="ai-model-picker"
      :class="{ 'ai-model-picker-open': modelPickerOpen }"
    >
      <button
        type="button"
        class="ai-model-select ai-model-picker-trigger"
        :disabled="loading || modelChoices.length === 0"
        :aria-label="t.modelLabel"
        :aria-expanded="modelPickerOpen ? 'true' : 'false'"
        @click="modelPickerOpen = !modelPickerOpen"
      >
        <span class="ai-model-picker-current">{{ selectedModel || modelListMessage }}</span>
        <span
          v-if="selectedModel && selectedModel === effectiveDefaultModel"
          class="ai-model-default-badge"
        >
          {{ t.modelDefaultBadge }}
        </span>
      </button>
      <Transition name="ai-slash-fade">
        <div v-if="modelPickerOpen" class="ai-model-menu" role="listbox">
          <input
            v-model="modelSearch"
            class="ai-model-search-input"
            type="search"
            :placeholder="t.modelSearchPlaceholder"
            autocomplete="off"
            @keydown.escape.stop.prevent="modelPickerOpen = false"
          />
          <div v-if="groupedModelChoices.length" class="ai-model-groups">
            <div v-for="group in groupedModelChoices" :key="group.name" class="ai-model-group">
              <div class="ai-model-group-title">{{ group.name }}</div>
              <button
                v-for="model in group.models"
                :key="model"
                type="button"
                class="ai-model-option"
                :class="{ active: model === selectedModel }"
                role="option"
                :aria-selected="model === selectedModel ? 'true' : 'false'"
                @click="selectModel(model)"
              >
                <span class="ai-model-option-name">{{ model }}</span>
                <span v-if="model === effectiveDefaultModel" class="ai-model-default-badge">
                  {{ t.modelDefaultBadge }}
                </span>
              </button>
            </div>
          </div>
          <div v-else class="ai-model-empty">{{ t.modelNoMatches }}</div>
        </div>
      </Transition>
    </div>
    <span
      class="ai-model-runtime"
      :class="`ai-model-runtime-${modelStatusKind}`"
      :title="modelStatusText"
    >
      <span class="ai-model-runtime-dot" aria-hidden="true"></span>
      <span class="ai-model-runtime-label">{{ modelStatusText }}</span>
    </span>
    <span v-if="modelCapabilityTags.length" class="ai-model-capabilities">
      <span
        v-for="tag in modelCapabilityTags"
        :key="tag"
        class="ai-model-capability"
        :class="{ 'ai-model-capability-vision': tag === t.modelCapabilityVision }"
      >
        {{ tag }}
      </span>
    </span>
    <span class="ai-model-row-spacer" />
    <button
      v-if="pageContextConfigured"
      type="button"
      class="ai-page-context-badge"
      :class="{ 'ai-page-context-badge-off': !pageContextEnabled }"
      :title="
        pageContextEnabled
          ? t.pageContextOnTooltip || 'Page context will be attached to your next message'
          : t.pageContextOffTooltip || 'Page context attachment is disabled'
      "
      :aria-pressed="pageContextEnabled ? 'true' : 'false'"
      @click="$emit('togglePageContext')"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path
          d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"
        />
      </svg>
      <span class="ai-page-context-badge-label">
        {{
          pageContextEnabled
            ? `${t.pageContextOn || 'Context'}${(pageContextBlockCount ?? 0) > 1 ? ' · ' + pageContextBlockCount : ''}`
            : t.pageContextOff || 'Context off'
        }}
      </span>
    </button>
    <slot v-if="advancedToolsOpen" name="model-row-actions" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import type { I18nMessages } from '../utils/i18n';

const props = defineProps<{
  mode: 'translate' | 'summarize' | 'chat';
  loading: boolean;
  hasBaseUrl: boolean;
  showModelPicker: boolean;
  selectedModel: string;
  defaultModel: string;
  modelChoices: string[];
  modelCapabilities?: Record<string, string[]>;
  modelListMessage: string;
  modelStatusText: string;
  modelStatusKind: 'ready' | 'checking' | 'warning' | 'offline';
  pageContextConfigured: boolean;
  pageContextEnabled: boolean;
  pageContextBlockCount: number;
  advancedToolsOpen: boolean;
  t: I18nMessages;
}>();

const emit = defineEmits<{
  'update:selectedModel': [value: string];
  changeMode: [mode: 'translate' | 'summarize' | 'chat'];
  togglePageContext: [];
}>();

const modelPickerOpen = ref(false);
const modelSearch = ref('');

const effectiveDefaultModel = computed(() => props.defaultModel || props.modelChoices[0] || '');
const filteredModelChoices = computed(() => {
  const q = modelSearch.value.trim().toLowerCase();
  if (!q) return props.modelChoices;
  return props.modelChoices.filter((model) => model.toLowerCase().includes(q));
});
const groupedModelChoices = computed(() => {
  const groups = new Map<string, string[]>();
  for (const model of filteredModelChoices.value) {
    const group = inferModelGroup(model);
    groups.set(group, [...(groups.get(group) ?? []), model]);
  }
  return Array.from(groups, ([name, models]) => ({ name, models }));
});
const selectedModelNormalized = computed(() => props.selectedModel.trim().toLowerCase());
const modelCapabilityTags = computed(() => {
  if (!props.selectedModel.trim()) return [];
  const tags = [props.t.modelCapabilityText];
  if (
    modelHasCapability(props.selectedModel, 'vision') ||
    isLikelyVisionModel(selectedModelNormalized.value)
  ) {
    tags.push(props.t.modelCapabilityVision);
  }
  if (
    modelHasCapability(props.selectedModel, 'tools') ||
    isLikelyToolModel(selectedModelNormalized.value)
  ) {
    tags.push(props.t.modelCapabilityTools);
  }
  if (
    modelHasCapability(props.selectedModel, 'longContext') ||
    isLikelyLongContextModel(selectedModelNormalized.value)
  ) {
    tags.push(props.t.modelCapabilityLongContext);
  }
  return tags;
});

function inferModelGroup(model: string) {
  const token = model.trim().split(/[/:_\-\s.]+/)[0];
  if (!token || token.length < 2) return props.t.modelGroupOther;
  return token;
}

function selectModel(model: string) {
  emit('update:selectedModel', model);
  modelPickerOpen.value = false;
  modelSearch.value = '';
}

function isLikelyVisionModel(model: string) {
  if (!model) return false;
  return (
    /(?:^|[-_:./])(?:vl|vision|visual|image|multimodal|omni)(?:[-_:./]|$)/i.test(model) ||
    /gpt-4o|gemini|pixtral|llava|qwen.*vl|minimax-m2\.\d+|claude-(?:3|4)/i.test(model)
  );
}

function isLikelyToolModel(model: string) {
  if (!model) return false;
  return /tool|function|agent|mcp|assistant|gpt-|claude|qwen|deepseek|glm|kimi|doubao|minimax/i.test(
    model,
  );
}

function isLikelyLongContextModel(model: string) {
  if (!model) return false;
  return /(?:32k|64k|100k|128k|200k|256k|1m|long|context)/i.test(model);
}

function modelHasCapability(model: string, capability: string) {
  const caps = props.modelCapabilities?.[model] ?? props.modelCapabilities?.[model.trim()];
  return caps?.some((cap) => cap.toLowerCase() === capability.toLowerCase()) ?? false;
}
</script>
