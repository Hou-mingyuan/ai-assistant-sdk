<template>
  <Teleport to="body">
    <Transition name="ai-export-toast-t">
      <div
        v-if="text"
        class="ai-export-toast"
        :class="{ 'ai-dark': isDark }"
        :style="{ '--export-accent': color }"
        role="status"
        aria-live="polite"
      >
        {{ text }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  text: string
  color: string
  isDark: boolean
}>()
</script>
