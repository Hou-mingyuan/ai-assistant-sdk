<template>
  <!--
    L1：表单自动填充完成后的 toast + Undo 按钮。
    Teleport 到 body 以便面板关闭时仍可见。5s 自动消失由父组件的 composable 控制。
    Refactor (T1)：从 AiAssistant.vue 抽出。
  -->
  <Teleport to="body">
    <Transition name="ai-modal">
      <div
        v-if="visible"
        class="ai-form-fill-toast"
        :class="{ 'ai-dark': isDark }"
        role="status"
        aria-live="polite"
      >
        <span class="ai-form-fill-toast-text">{{ text }}</span>
        <button
          v-if="undoAvailable"
          type="button"
          class="ai-form-fill-toast-btn"
          @click="emit('undo')"
        >
          {{ undoLabel }}
        </button>
        <button
          type="button"
          class="ai-form-fill-toast-close"
          :aria-label="closeAriaLabel"
          @click="emit('dismiss')"
        >
          &times;
        </button>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  isDark: boolean;
  text: string;
  undoAvailable: boolean;
  undoLabel: string;
  closeAriaLabel: string;
}>();

const emit = defineEmits<{
  (e: 'undo'): void;
  (e: 'dismiss'): void;
}>();
</script>
