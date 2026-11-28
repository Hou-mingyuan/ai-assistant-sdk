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
      'ai-fab-loading': loading,
      'ai-fab-docked': edgeDock !== 'none',
      'ai-fab-dock-revealed': dockRevealed && edgeDock !== 'none',
    }"
    :style="fabLayoutStyle"
    :aria-label="ariaLabel"
    @pointerdown="(ev: PointerEvent) => emit('pointerdown', ev)"
    @pointermove="onFabPointerMove"
    @pointerleave="resetEyeTracking"
    @pointercancel="resetEyeTracking"
    @contextmenu.prevent="(ev: MouseEvent) => emit('contextmenu', ev)"
    @dragenter.prevent="(ev: DragEvent) => emit('drag-enter', ev)"
    @dragover.prevent="(ev: DragEvent) => emit('drag-over', ev)"
    @dragleave.prevent="(ev: DragEvent) => emit('drag-leave', ev)"
    @drop.prevent="(ev: DragEvent) => emit('drop', ev)"
  >
    <span class="ai-fab-core" aria-hidden="true">
      <span
        v-if="edgeDock !== 'none' && edgeDockStyle === 'handle-bar'"
        class="ai-fab-dock-bar-glow"
      />
      <span
        v-if="edgeDock !== 'none' && edgeDockStyle === 'eye-strip'"
        class="ai-fab-dock-mini-eyes"
      >
        <span class="ai-fab-dock-mini-eye" />
        <span class="ai-fab-dock-mini-eye" />
      </span>
      <span
        v-if="edgeDock !== 'none' && edgeDockStyle === 'nap-lean'"
        class="ai-fab-dock-halo-dot"
      />
      <AssistantIcon v-if="fabDropActive" name="upload" :size="22" class="ai-fab-drop-icon" />
      <BrandMark
        v-else
        class="ai-fab-brand"
        :size="25"
        :active="loading"
        :look-x="eyeX"
        :look-y="eyeY"
      />
      <span v-if="loading && !fabDropActive" class="ai-fab-live-dot" />
    </span>
    <span v-if="fabDropActive" class="ai-fab-drop-hint" role="status" aria-live="polite">
      {{ dropHintText }}
    </span>
  </button>
</template>

<script setup lang="ts">
import { ref, type CSSProperties } from 'vue';
import AssistantIcon from './AssistantIcon.vue';
import BrandMark from './BrandMark.vue';
import type { EdgeDockStyle } from '../composables/useEdgeDockStyle';

const props = withDefaults(
  defineProps<{
    fabHidden: boolean;
    isOpen: boolean;
    showFabDuringPanelAnim: boolean;
    fabDragging: boolean;
    fabDropActive: boolean;
    fabLayoutStyle: CSSProperties;
    ariaLabel: string;
    dropHintText: string;
    loading?: boolean;
    edgeDock?: 'none' | 'left' | 'right';
    dockRevealed?: boolean;
    edgeDockStyle?: EdgeDockStyle;
  }>(),
  {
    loading: false,
    edgeDock: 'none',
    dockRevealed: false,
    edgeDockStyle: 'handle-bar',
  },
);

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
const eyeX = ref(0);
const eyeY = ref(0);

function resetEyeTracking() {
  eyeX.value = 0;
  eyeY.value = 0;
}

function onFabPointerMove(ev: PointerEvent) {
  if (props.fabDragging || props.fabDropActive) {
    resetEyeTracking();
    return;
  }
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    resetEyeTracking();
    return;
  }
  const el = fabRef.value;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const nx = Math.max(-1, Math.min(1, ((ev.clientX - rect.left) / rect.width - 0.5) * 2));
  const ny = Math.max(-1, Math.min(1, ((ev.clientY - rect.top) / rect.height - 0.5) * 2));
  eyeX.value = Number((nx * 2.1).toFixed(2));
  eyeY.value = Number((ny * 1.6).toFixed(2));
}

defineExpose({ fabRef });
</script>
