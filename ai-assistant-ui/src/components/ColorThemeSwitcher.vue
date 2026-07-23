<template>
  <div class="ai-theme-switcher" role="radiogroup" aria-label="界面色调 / Interface tone">
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
    { id: 'graphite', label: 'Obsidian', from: '#050505', via: '#171717', to: '#2b2b2b' },
    { id: 'sky', label: 'Cobalt', from: '#163b8c', via: '#2457d6', to: '#5b8def' },
    { id: 'plum', label: 'Pulse', from: '#075985', via: '#0891b2', to: '#22d3ee' },
    { id: 'forest', label: 'Circuit', from: '#065f46', via: '#0f766e', to: '#2dd4bf' },
    { id: 'sunset', label: 'Ember', from: '#9a3412', via: '#c2410c', to: '#f97316' },
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
  border: 1px solid rgba(17, 17, 17, 0.08);
  background: rgba(245, 245, 245, 0.82);
  border-radius: 999px;
}

@media (prefers-color-scheme: dark) {
  .ai-theme-switcher {
    border-color: rgba(255, 255, 255, 0.12);
    background: rgba(23, 23, 23, 0.82);
  }
}

.ai-theme-swatch {
  --theme-from: #090909;
  --theme-via: #171717;
  --theme-to: #262626;
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
  box-shadow: 0 1px 3px rgba(17, 17, 17, 0.18);
  transition: box-shadow 200ms;
}

.ai-theme-swatch.active {
  box-shadow: 0 0 0 2px var(--theme-from);
}

.ai-theme-swatch.active .ai-theme-swatch-fill {
  box-shadow: 0 2px 6px rgba(17, 17, 17, 0.24);
}

.ai-theme-swatch-label {
  position: absolute;
  bottom: -22px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: #737373;
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
  .ai-theme-swatch-label {
    color: #a3a3a3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .ai-theme-swatch,
  .ai-theme-swatch-fill,
  .ai-theme-swatch-label {
    transition: none;
  }
}
</style>
