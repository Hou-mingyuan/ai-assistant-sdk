<template>
  <Teleport to="body">
    <div
      v-if="state.visible"
      class="ai-cite-card"
      :class="{ 'ai-dark': dark }"
      :style="{ left: state.x + 'px', top: state.y + 'px' }"
      role="tooltip"
    >
      <span v-if="state.title" class="ai-cite-card-title">{{ state.title }}</span>
      <span v-if="state.domain" class="ai-cite-card-domain">{{ state.domain }}</span>
      <span v-if="state.snippet" class="ai-cite-card-snippet">{{ state.snippet }}</span>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { CitationCardState } from '../composables/useCitationHover';

defineProps<{
  state: CitationCardState;
  dark?: boolean;
}>();
</script>
