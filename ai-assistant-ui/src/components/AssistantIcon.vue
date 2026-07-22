<template>
  <component
    :is="iconComponent"
    v-if="iconComponent"
    v-bind="$attrs"
    :size="size"
    :stroke-width="strokeWidth"
    :data-assistant-icon="name"
    aria-hidden="true"
    focusable="false"
  />
  <span v-else v-bind="$attrs" data-assistant-icon-fallback aria-hidden="true">
    {{ fallbackText }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { resolveAssistantIcon } from '../utils/assistantIcons';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    name: string;
    fallbackText?: string;
    size?: number;
    strokeWidth?: number;
  }>(),
  {
    fallbackText: '',
    size: 16,
    strokeWidth: 1.8,
  },
);

const iconComponent = computed(() => resolveAssistantIcon(props.name));
</script>
