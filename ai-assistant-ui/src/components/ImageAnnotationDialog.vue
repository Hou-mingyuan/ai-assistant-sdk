<template>
  <Teleport to="body">
    <Transition name="ai-modal">
      <div v-if="open" class="ai-annotation-overlay" :class="{ 'ai-dark': isDark }">
        <div class="ai-annotation-dialog" role="dialog" aria-modal="true">
          <div class="ai-annotation-head">
            <h2>{{ t.annotateImage }}</h2>
            <button type="button" class="ai-annotation-close" @click="emit('close')">
              &times;
            </button>
          </div>
          <div class="ai-annotation-tools">
            <button
              v-for="item in tools"
              :key="item.value"
              type="button"
              :class="{ active: tool === item.value }"
              @click="tool = item.value"
            >
              {{ item.label }}
            </button>
            <span class="ai-annotation-spacer"></span>
            <button type="button" :disabled="annotations.length === 0" @click="undo">
              {{ t.annotationUndo }}
            </button>
            <button type="button" :disabled="annotations.length === 0" @click="clear">
              {{ t.annotationClear }}
            </button>
          </div>
          <div class="ai-annotation-canvas-wrap">
            <canvas
              ref="canvasRef"
              class="ai-annotation-canvas"
              @pointerdown="onPointerDown"
              @pointermove="onPointerMove"
              @pointerup="onPointerUp"
              @pointercancel="onPointerCancel"
            ></canvas>
          </div>
          <div class="ai-annotation-actions">
            <button type="button" @click="emit('close')">{{ t.annotationCancel }}</button>
            <button type="button" class="primary" @click="save">{{ t.annotationDone }}</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { I18nMessages } from '../utils/i18n';
import {
  drawImageAnnotation,
  renderAnnotatedImage,
  type ImageAnnotation,
  type ImageAnnotationType,
} from '../utils/imageAnnotation';

const props = defineProps<{
  open: boolean;
  imageSrc: string;
  isDark: boolean;
  t: I18nMessages;
}>();

const emit = defineEmits<{
  close: [];
  save: [dataUrl: string];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const sourceImage = ref<HTMLImageElement | null>(null);
const tool = ref<ImageAnnotationType>('rect');
const annotations = ref<ImageAnnotation[]>([]);
const draft = ref<ImageAnnotation | null>(null);

const tools = computed(() => [
  { value: 'rect' as const, label: props.t.annotationRect },
  { value: 'arrow' as const, label: props.t.annotationArrow },
  { value: 'text' as const, label: props.t.annotationText },
]);

watch(
  () => [props.open, props.imageSrc] as const,
  async ([open]) => {
    if (!open || !props.imageSrc) return;
    annotations.value = [];
    draft.value = null;
    await loadSourceImage();
    await nextTick();
    redraw();
  },
  { immediate: true },
);

async function loadSourceImage() {
  sourceImage.value = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load annotation source'));
    img.src = props.imageSrc;
  });
}

function redraw() {
  const canvas = canvasRef.value;
  const img = sourceImage.value;
  if (!canvas || !img) return;
  canvas.width = img.naturalWidth || img.width || 1;
  canvas.height = img.naturalHeight || img.height || 1;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  annotations.value.forEach((annotation) => drawImageAnnotation(ctx, annotation));
  if (draft.value) drawImageAnnotation(ctx, draft.value);
}

function pointFromEvent(ev: PointerEvent) {
  const canvas = canvasRef.value!;
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - rect.left) / rect.width) * canvas.width,
    y: ((ev.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function onPointerDown(ev: PointerEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  canvas.setPointerCapture(ev.pointerId);
  const p = pointFromEvent(ev);
  if (tool.value === 'text') {
    const text = window.prompt(props.t.annotationTextPrompt || 'Annotation text');
    if (!text?.trim()) return;
    annotations.value.push({
      id: String(Date.now()),
      type: 'text',
      x1: p.x,
      y1: p.y,
      x2: p.x,
      y2: p.y,
      color: '#ef4444',
      text,
    });
    redraw();
    return;
  }
  draft.value = {
    id: String(Date.now()),
    type: tool.value,
    x1: p.x,
    y1: p.y,
    x2: p.x,
    y2: p.y,
    color: '#ef4444',
  };
}

function onPointerMove(ev: PointerEvent) {
  if (!draft.value) return;
  const p = pointFromEvent(ev);
  draft.value = { ...draft.value, x2: p.x, y2: p.y };
  redraw();
}

function onPointerUp(ev: PointerEvent) {
  if (!draft.value) return;
  canvasRef.value?.releasePointerCapture(ev.pointerId);
  const next = draft.value;
  draft.value = null;
  if (Math.abs(next.x2 - next.x1) + Math.abs(next.y2 - next.y1) > 6) {
    annotations.value.push(next);
  }
  redraw();
}

function onPointerCancel(ev: PointerEvent) {
  canvasRef.value?.releasePointerCapture(ev.pointerId);
  draft.value = null;
  redraw();
}

function undo() {
  annotations.value = annotations.value.slice(0, -1);
  redraw();
}

function clear() {
  annotations.value = [];
  redraw();
}

async function save() {
  const output = annotations.value.length
    ? await renderAnnotatedImage(props.imageSrc, annotations.value)
    : props.imageSrc;
  emit('save', output);
}
</script>
