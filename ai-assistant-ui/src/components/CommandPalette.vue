<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="ai-cmd-palette-backdrop"
      role="dialog"
      aria-modal="true"
      :aria-label="props.title"
      @click.self="close"
      @keydown.esc="close"
    >
      <div
        class="ai-cmd-palette"
        @keydown.down.prevent="moveDown"
        @keydown.up.prevent="moveUp"
        @keydown.enter.prevent="runActive"
      >
        <div class="ai-cmd-palette-search">
          <span class="ai-cmd-palette-icon" aria-hidden="true">🔍</span>
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            class="ai-cmd-palette-input"
            :placeholder="props.placeholder"
            spellcheck="false"
            autocomplete="off"
            @input="activeIndex = 0"
          />
          <kbd class="ai-cmd-palette-kbd">ESC</kbd>
        </div>

        <ul class="ai-cmd-palette-list" role="listbox">
          <li
            v-for="(cmd, idx) in filteredCommands"
            :key="cmd.id"
            role="option"
            :aria-selected="idx === activeIndex"
            :class="['ai-cmd-palette-item', { active: idx === activeIndex }]"
            @click="run(cmd)"
            @mouseenter="activeIndex = idx"
          >
            <span class="ai-cmd-palette-item-icon" :aria-hidden="true">{{ cmd.icon ?? '◯' }}</span>
            <span class="ai-cmd-palette-item-label">{{ cmd.label }}</span>
            <span v-if="cmd.group" class="ai-cmd-palette-item-group">{{ cmd.group }}</span>
            <kbd v-if="cmd.shortcut" class="ai-cmd-palette-item-kbd">{{ cmd.shortcut }}</kbd>
          </li>
          <li v-if="!filteredCommands.length" class="ai-cmd-palette-empty">
            {{ props.emptyText }}
          </li>
        </ul>

        <div class="ai-cmd-palette-foot">
          <span><kbd>↑↓</kbd> 导航</span>
          <span><kbd>Enter</kbd> 执行</span>
          <span><kbd>ESC</kbd> 关闭</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import type { CommandItem } from '../types/command-palette';

interface Props {
  open: boolean;
  commands: CommandItem[];
  title?: string;
  placeholder?: string;
  emptyText?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: '命令面板 / Command Palette',
  placeholder: '搜索命令...',
  emptyText: '没有匹配的命令',
});

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
}>();

const query = ref('');
const activeIndex = ref(0);
const searchInput = ref<HTMLInputElement | null>(null);

const filteredCommands = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) return props.commands;
  return props.commands.filter((c) => {
    const hay = [c.label, c.group ?? '', c.shortcut ?? '', ...(c.keywords ?? [])]
      .join(' ')
      .toLowerCase();
    return hay.includes(q);
  });
});

watch(
  () => props.open,
  async (v) => {
    if (v) {
      query.value = '';
      activeIndex.value = 0;
      await nextTick();
      searchInput.value?.focus();
    }
  },
);

watch(filteredCommands, (list) => {
  if (activeIndex.value >= list.length) {
    activeIndex.value = Math.max(0, list.length - 1);
  }
});

function close() {
  emit('update:open', false);
}

function moveDown() {
  if (!filteredCommands.value.length) return;
  activeIndex.value = (activeIndex.value + 1) % filteredCommands.value.length;
}

function moveUp() {
  if (!filteredCommands.value.length) return;
  activeIndex.value =
    activeIndex.value === 0 ? filteredCommands.value.length - 1 : activeIndex.value - 1;
}

function runActive() {
  const cmd = filteredCommands.value[activeIndex.value];
  if (cmd) run(cmd);
}

async function run(cmd: CommandItem) {
  close();
  try {
    await cmd.action();
  } catch (e) {
    console.warn('[CommandPalette] action threw', e);
  }
}
</script>

<style scoped>
.ai-cmd-palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  animation: ai-cmd-fade-in 160ms cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes ai-cmd-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.ai-cmd-palette {
  background: #ffffff;
  border-radius: 16px;
  box-shadow:
    0 24px 64px -16px rgba(15, 23, 42, 0.36),
    0 12px 32px rgba(15, 23, 42, 0.18),
    0 1px 4px rgba(15, 23, 42, 0.08);
  width: min(580px, calc(100vw - 32px));
  max-height: calc(76vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ai-cmd-pop-in 200ms cubic-bezier(0.16, 1, 0.3, 1);
  font-family:
    'Inter',
    'SF Pro Text',
    -apple-system,
    BlinkMacSystemFont,
    'PingFang SC',
    'Microsoft YaHei',
    sans-serif;
}

@media (prefers-color-scheme: dark) {
  .ai-cmd-palette {
    background: #0f172a;
    color: #e2e8f0;
  }
}

@keyframes ai-cmd-pop-in {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.ai-cmd-palette-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid #e2e8f0;
}

@media (prefers-color-scheme: dark) {
  .ai-cmd-palette-search {
    border-bottom-color: #1e293b;
  }
}

.ai-cmd-palette-icon {
  font-size: 16px;
  opacity: 0.7;
}

.ai-cmd-palette-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: inherit;
  letter-spacing: -0.005em;
}

.ai-cmd-palette-kbd,
.ai-cmd-palette-item-kbd {
  padding: 2px 6px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 11px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  color: #64748b;
  font-weight: 500;
}

@media (prefers-color-scheme: dark) {
  .ai-cmd-palette-kbd,
  .ai-cmd-palette-item-kbd {
    background: #1e293b;
    border-color: #334155;
    color: #94a3b8;
  }
}

.ai-cmd-palette-list {
  list-style: none;
  margin: 0;
  padding: 4px;
  overflow-y: auto;
  flex: 1;
  scrollbar-width: thin;
}

.ai-cmd-palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13.5px;
  transition: background-color 100ms;
}

.ai-cmd-palette-item.active {
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(6, 182, 212, 0.1));
  color: #0ea5e9;
}

@media (prefers-color-scheme: dark) {
  .ai-cmd-palette-item.active {
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(34, 211, 238, 0.12));
    color: #38bdf8;
  }
}

.ai-cmd-palette-item-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.ai-cmd-palette-item-label {
  flex: 1;
}

.ai-cmd-palette-item-group {
  font-size: 11px;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.ai-cmd-palette-empty {
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.ai-cmd-palette-foot {
  display: flex;
  gap: 16px;
  padding: 10px 16px;
  border-top: 1px solid #e2e8f0;
  font-size: 11px;
  color: #94a3b8;
}

@media (prefers-color-scheme: dark) {
  .ai-cmd-palette-foot {
    border-top-color: #1e293b;
  }
}

.ai-cmd-palette-foot kbd {
  padding: 1px 5px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 10px;
  margin-right: 4px;
}

@media (prefers-color-scheme: dark) {
  .ai-cmd-palette-foot kbd {
    background: #1e293b;
    border-color: #334155;
  }
}
</style>
