<template>
  <div class="ai-theme-switcher" role="radiogroup" aria-label="主题色 / Primary color">
    <button
      v-for="t in themes"
      :key="t.id"
      type="button"
      role="radio"
      :aria-checked="modelValue === t.id"
      :title="t.label"
      :class="['ai-theme-swatch', { active: modelValue === t.id }]"
      :style="{
        '--theme-from': t.from,
        '--theme-via': t.via,
        '--theme-to': t.to,
      }"
      @click="emit('update:modelValue', t.id)"
    >
      <span class="ai-theme-swatch-fill" />
      <span class="ai-theme-swatch-label">{{ t.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface ThemePreset {
  id: string;
  label: string;
  from: string;
  via: string;
  to: string;
}

interface Props {
  modelValue: string;
  presets?: ThemePreset[];
}

const props = withDefaults(defineProps<Props>(), {
  presets: () => [
    { id: 'sky', label: 'Sky', from: '#0ea5e9', via: '#06b6d4', to: '#3b82f6' },
    { id: 'sunset', label: 'Sunset', from: '#f59e0b', via: '#f43f5e', to: '#a855f7' },
    { id: 'forest', label: 'Forest', from: '#10b981', via: '#14b8a6', to: '#06b6d4' },
    { id: 'plum', label: 'Plum', from: '#a855f7', via: '#ec4899', to: '#f43f5e' },
    { id: 'graphite', label: 'Graphite', from: '#64748b', via: '#475569', to: '#334155' },
  ],
});

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const themes = props.presets;

defineExpose({ themes });
</script>

<style scoped>
.ai-theme-switcher {
  display: inline-flex;
  gap: 6px;
  padding: 4px;
  background: rgba(241, 245, 249, 0.6);
  border-radius: 999px;
}

@media (prefers-color-scheme: dark) {
  .ai-theme-switcher {
    background: rgba(30, 41, 59, 0.6);
  }
}

.ai-theme-swatch {
  --theme-from: #0ea5e9;
  --theme-via: #06b6d4;
  --theme-to: #3b82f6;
  position: relative;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 999px;
  cursor: pointer;
  padding: 3px;
  transition: transform 160ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

.ai-theme-swatch:hover {
  transform: scale(1.08);
}

.ai-theme-swatch:active {
  transform: scale(0.95);
}

.ai-theme-swatch-fill {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(135deg, var(--theme-from), var(--theme-via), var(--theme-to));
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
  transition: box-shadow 200ms;
}

.ai-theme-swatch.active {
  box-shadow: 0 0 0 2px var(--theme-from);
}

.ai-theme-swatch.active .ai-theme-swatch-fill {
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.24);
}

.ai-theme-swatch-label {
  position: absolute;
  bottom: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #64748b;
  font-weight: 500;
  white-space: nowrap;
  opacity: 0;
  transition: opacity 160ms;
  pointer-events: none;
}

.ai-theme-swatch:hover .ai-theme-swatch-label,
.ai-theme-swatch.active .ai-theme-swatch-label {
  opacity: 1;
}

@media (prefers-color-scheme: dark) {
  .ai-theme-swatch-label { color: #94a3b8; }
}

@media (prefers-reduced-motion: reduce) {
  .ai-theme-swatch,
  .ai-theme-swatch-fill,
  .ai-theme-swatch-label {
    transition: none;
  }
}
</style>
