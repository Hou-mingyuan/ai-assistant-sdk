<template>
  <svg
    v-bind="$attrs"
    class="ai-brand-mark ai-brand-mark-bot"
    :class="{
      'ai-brand-mark-animated': animated,
      'ai-brand-mark-active': active,
    }"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <rect
      class="ai-brand-bot-visor"
      x="3.5"
      y="5.5"
      width="17"
      height="13"
      rx="6"
      stroke="currentColor"
      stroke-width="1.75"
      fill="currentColor"
      fill-opacity="0.14"
    />
    <path d="M12 3V5.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    <circle class="ai-brand-bot-beacon" cx="12" cy="2.6" r="1.15" fill="currentColor" />
    <g class="ai-brand-bot-eyes-track" :style="eyeTrackStyle">
      <g class="ai-brand-bot-eyes">
        <rect x="8.1" y="10.3" width="2.2" height="3.5" rx="1.1" fill="currentColor" />
        <rect x="13.7" y="10.3" width="2.2" height="3.5" rx="1.1" fill="currentColor" />
      </g>
    </g>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    size?: number;
    animated?: boolean;
    active?: boolean;
    lookX?: number;
    lookY?: number;
  }>(),
  {
    size: 20,
    animated: true,
    active: false,
    lookX: 0,
    lookY: 0,
  },
);

const eyeTrackStyle = computed(() => ({
  transform: `translate(${props.lookX}px, ${props.lookY}px)`,
}));
</script>
