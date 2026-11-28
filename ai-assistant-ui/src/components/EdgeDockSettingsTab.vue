<template>
  <div class="ai-dock-tab" :class="{ 'is-dark': isDark }">
    <div class="ai-dock-quick-bar">
      <button
        type="button"
        class="ai-dock-quick-btn"
        :class="{ active: edgeDock === 'left' }"
        @click="emit('dock-now', 'left')"
      >
        <AssistantIcon name="panel-left" :size="13" />
        <span>{{ isZh ? '靠左隐藏' : 'Dock Left' }}</span>
      </button>
      <button
        type="button"
        class="ai-dock-quick-btn"
        :class="{ active: edgeDock === 'right' }"
        @click="emit('dock-now', 'right')"
      >
        <AssistantIcon name="panel-right" :size="13" />
        <span>{{ isZh ? '靠右隐藏' : 'Dock Right' }}</span>
      </button>
      <button
        type="button"
        class="ai-dock-quick-btn"
        :class="{ active: edgeDock === 'none' }"
        @click="emit('dock-now', 'none')"
      >
        <AssistantIcon name="compass" :size="13" />
        <span>{{ isZh ? '自由悬浮' : 'Float' }}</span>
      </button>
    </div>

    <p class="ai-dock-settings-hint">
      {{
        isZh
          ? '拖动悬浮球贴边或点击上方快捷收起；选择样式后立即生效，防误触均支持先轻触探头、再点完全展开。'
          : 'Choose how the floating orb tucks into the screen edge when docked.'
      }}
    </p>

    <div class="ai-dock-style-grid" role="radiogroup" :aria-label="dockHeadingText">
      <button
        v-for="item in EDGE_DOCK_STYLES"
        :key="item.id"
        type="button"
        role="radio"
        class="ai-dock-style-card"
        :class="[{ active: modelValue === item.id }, `preview-${item.id}`]"
        :aria-checked="modelValue === item.id ? 'true' : 'false'"
        @click="emit('update:modelValue', item.id)"
      >
        <div class="ai-dock-style-preview" aria-hidden="true">
          <span class="ai-dock-pv-line" />
          <span class="ai-dock-pv-line short" />
          <span class="ai-dock-pv-shape">
            <span v-if="item.id === 'handle-bar'" class="ai-dock-pv-glow" />
            <span v-else-if="item.id === 'eye-strip'" class="ai-dock-pv-eyes">
              <i />
              <i />
            </span>
            <span v-else class="ai-dock-pv-visor">
              <i />
              <i />
            </span>
            <span v-if="item.id === 'nap-lean'" class="ai-dock-pv-dot" />
          </span>
        </div>

        <div class="ai-dock-style-meta">
          <div class="ai-dock-style-row">
            <span class="ai-dock-style-name">{{ isZh ? item.titleZh : item.titleEn }}</span>
            <span class="ai-dock-style-tag">{{ isZh ? item.tagZh : item.tagEn }}</span>
          </div>
          <span class="ai-dock-style-desc">{{ isZh ? item.descZh : item.descEn }}</span>
        </div>
        <span v-if="modelValue === item.id" class="ai-dock-style-check" aria-hidden="true">
          <AssistantIcon name="check" :size="12" :stroke-width="2.4" />
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import AssistantIcon from './AssistantIcon.vue';
import { EDGE_DOCK_STYLES, type EdgeDockStyle } from '../composables/useEdgeDockStyle';

defineProps<{
  modelValue: EdgeDockStyle;
  edgeDock: 'none' | 'left' | 'right';
  dockHeadingText: string;
  isDark: boolean;
  isZh: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: EdgeDockStyle];
  'dock-now': [edge: 'left' | 'right' | 'none'];
}>();
</script>

<style scoped>
.ai-dock-tab {
  display: flex;
  flex-direction: column;
  gap: 9px;
}
.ai-dock-quick-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
}
.ai-dock-quick-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  height: 30px;
  padding: 0 8px;
  border-radius: 8px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  background: rgba(148, 163, 184, 0.08);
  color: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.16s ease;
}
.ai-dock-quick-btn:hover {
  border-color: rgba(36, 87, 214, 0.55);
  background: rgba(36, 87, 214, 0.1);
}
.ai-dock-quick-btn.active {
  border-color: #2457d6;
  background: rgba(36, 87, 214, 0.14);
  color: #2457d6;
}
.ai-dock-tab.is-dark .ai-dock-quick-btn.active {
  color: var(--ai-theme-mark-dark, #8fb4ff);
  border-color: var(--ai-theme-to, #5b8def);
  background: color-mix(in srgb, var(--ai-theme-via, #2457d6) 20%, transparent);
}
.ai-dock-settings-hint {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.45;
  color: var(--ai-color-text-tertiary, #64748b);
}
.ai-dock-tab.is-dark .ai-dock-settings-hint {
  color: #94a3b8;
}
.ai-dock-style-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
.ai-dock-style-card {
  position: relative;
  text-align: left;
  padding: 6px 7px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.24);
  background: rgba(248, 250, 252, 0.72);
  color: inherit;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition:
    border-color 0.18s ease,
    background 0.18s ease,
    box-shadow 0.18s ease;
}
.ai-dock-tab.is-dark .ai-dock-style-card {
  background: rgba(30, 41, 59, 0.6);
  border-color: rgba(148, 163, 184, 0.2);
}
.ai-dock-style-card:hover {
  border-color: rgba(36, 87, 214, 0.52);
}
.ai-dock-style-card.active {
  border-color: #2457d6;
  background: rgba(36, 87, 214, 0.08);
  box-shadow: 0 0 0 1px rgba(36, 87, 214, 0.25);
}
.ai-dock-tab.is-dark .ai-dock-style-card.active {
  border-color: var(--ai-theme-to, #5b8def);
  background: color-mix(in srgb, var(--ai-theme-via, #2457d6) 16%, transparent);
}
.ai-dock-style-preview {
  position: relative;
  height: 34px;
  border-radius: 7px;
  overflow: hidden;
  background: #f1f5f9;
  border: 1px solid rgba(15, 23, 42, 0.08);
  padding: 6px 9px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.ai-dock-tab.is-dark .ai-dock-style-preview {
  background: #0b1220;
  border-color: rgba(148, 163, 184, 0.18);
}
.ai-dock-pv-line {
  width: 62%;
  height: 4.5px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.1);
}
.ai-dock-pv-line.short {
  width: 42%;
}
.ai-dock-tab.is-dark .ai-dock-pv-line {
  background: rgba(255, 255, 255, 0.12);
}
.ai-dock-pv-shape {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  border-radius: 999px;
  background: linear-gradient(145deg, #5b8def, #2457d6 58%, #163b8c);
  border: 1px solid rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}
.ai-dock-pv-visor {
  width: 13px;
  height: 9px;
  border-radius: 4.5px;
  border: 1.4px solid #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
}
.ai-dock-pv-visor i,
.ai-dock-pv-eyes i {
  display: block;
  width: 2px;
  height: 3.5px;
  border-radius: 99px;
  background: #fff;
}
.ai-dock-pv-glow {
  width: 2.5px;
  height: 11px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.92);
}
.ai-dock-pv-eyes {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ai-dock-pv-dot {
  position: absolute;
  top: 3px;
  left: 4px;
  width: 4.5px;
  height: 4.5px;
  border-radius: 99px;
  background: var(--ai-theme-mark-dark, #8fb4ff);
  box-shadow: 0 0 0 1px rgba(22, 59, 140, 0.65);
}
.preview-handle-bar .ai-dock-pv-shape {
  width: 7px;
  height: 26px;
  border-radius: 999px 0 0 999px;
  border-right: 0;
}
.preview-ear-clip .ai-dock-pv-shape {
  width: 15px;
  height: 26px;
  border-radius: 15px 0 0 15px;
  border-right: 0;
}
.preview-ghost-hotzone .ai-dock-pv-shape {
  opacity: 0.4;
  transform: translate(13px, -50%) scale(0.9) rotate(-18deg);
}
.preview-eye-strip .ai-dock-pv-shape {
  width: 10px;
  height: 26px;
  border-radius: 999px 0 0 999px;
  border-right: 0;
}
.preview-nap-lean .ai-dock-pv-shape {
  transform: translate(14px, -44%) rotate(-28deg);
}
.preview-halo-ring .ai-dock-pv-shape {
  background: rgba(36, 87, 214, 0.14);
  border: 2px solid #2457d6;
  transform: translate(15px, -50%) rotate(-18deg);
}
.preview-halo-ring .ai-dock-pv-visor {
  border-color: #2457d6;
}
.preview-halo-ring .ai-dock-pv-visor i {
  background: #2457d6;
}
.ai-dock-style-card:hover .ai-dock-pv-shape {
  transform: translate(-4px, -50%) rotate(0deg) scale(1);
  opacity: 1;
}
.preview-halo-ring:hover .ai-dock-pv-shape {
  background: linear-gradient(145deg, #5b8def, #2457d6 58%, #163b8c);
  border: 1px solid rgba(255, 255, 255, 0.4);
}
.preview-halo-ring:hover .ai-dock-pv-visor {
  border-color: #fff;
}
.preview-halo-ring:hover .ai-dock-pv-visor i {
  background: #fff;
}
.ai-dock-style-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.ai-dock-style-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}
.ai-dock-style-name {
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}
.ai-dock-style-tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(36, 87, 214, 0.1);
  color: #2457d6;
  white-space: nowrap;
}
.ai-dock-tab.is-dark .ai-dock-style-tag {
  background: color-mix(in srgb, var(--ai-theme-via, #2457d6) 22%, transparent);
  color: var(--ai-theme-mark-dark, #8fb4ff);
}
.ai-dock-style-desc {
  font-size: 11px;
  line-height: 1.3;
  color: var(--ai-color-text-tertiary, #64748b);
}
.ai-dock-tab.is-dark .ai-dock-style-desc {
  color: #94a3b8;
}
.ai-dock-style-check {
  position: absolute;
  top: 5px;
  left: 5px;
  width: 17px;
  height: 17px;
  border-radius: 999px;
  background: #2457d6;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
