<template>
  <!--
    Floating Action Button：打开/关闭过渡期间保留在 DOM 中，便于从球心缩放面板。
    K38/K43：支持拖拽文件落下到悬浮球以 ingest 到知识库。
    Refactor (T1)：从 AiAssistant.vue 抽出。
  -->
  <button
    v-show="!fabHidden && (!isOpen || showFabDuringPanelAnim)"
    ref="fabRef"
    type="button"
    class="ai-fab"
    :class="{
      'ai-fab-dragging': fabDragging,
      'ai-fab-drop-active': fabDropActive,
    }"
    :style="fabLayoutStyle"
    :aria-label="props['aria-label']"
    @pointerdown="(ev: PointerEvent) => emit('pointerdown', ev)"
    @contextmenu.prevent="(ev: MouseEvent) => emit('contextmenu', ev)"
    @dragenter.prevent="(ev: DragEvent) => emit('drag-enter', ev)"
    @dragover.prevent="(ev: DragEvent) => emit('drag-over', ev)"
    @dragleave.prevent="(ev: DragEvent) => emit('drag-leave', ev)"
    @drop.prevent="(ev: DragEvent) => emit('drop', ev)"
  >
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <!-- Sparkle / star with 4 rays — modern AI assistant icon -->
      <path
        d="M12 2.5l1.95 5.85a1 1 0 0 0 .7.7L20.5 11l-5.85 1.95a1 1 0 0 0-.7.7L12 19.5l-1.95-5.85a1 1 0 0 0-.7-.7L3.5 11l5.85-1.95a1 1 0 0 0 .7-.7L12 2.5z"
      />
    </svg>
    <span v-if="fabDropActive" class="ai-fab-drop-hint" role="status" aria-live="polite">
      {{ dropHintText }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref, type CSSProperties } from 'vue';

const props = defineProps<{
  fabHidden: boolean;
  isOpen: boolean;
  showFabDuringPanelAnim: boolean;
  fabDragging: boolean;
  fabDropActive: boolean;
  fabLayoutStyle: CSSProperties;
  'aria-label': string;
  dropHintText: string;
}>();

const emit = defineEmits<{
  (e: 'pointerdown', ev: PointerEvent): void;
  (e: 'contextmenu', ev: MouseEvent): void;
  (e: 'drag-enter', ev: DragEvent): void;
  (e: 'drag-over', ev: DragEvent): void;
  (e: 'drag-leave', ev: DragEvent): void;
  (e: 'drop', ev: DragEvent): void;
}>();

/**
 * 父组件通过 template ref 拿到原生按钮：
 *   const fab = ref<InstanceType<typeof FabButton>>()
 *   fab.value?.fabRef
 * 用于 useFabDrag 的 pointer 坐标解算。
 */
const fabRef = ref<HTMLButtonElement>();

defineExpose({ fabRef });
</script>
