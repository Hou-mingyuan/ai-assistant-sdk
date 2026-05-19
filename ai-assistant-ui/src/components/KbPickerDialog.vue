<template>
  <!--
    K43 + K48：拖拽多个 KB 时弹出的目标选择器。Teleport 到 body 以摆脱 panel 层级。
    自动消失 12s 在父组件 setTimeout 控制；本组件只负责 UI + 键盘事件转发。
    Refactor (T1)：从 AiAssistant.vue 抽出。
  -->
  <Teleport to="body">
    <Transition name="ai-modal">
      <div
        v-if="visible"
        class="ai-kb-picker-shell"
        :class="{ 'ai-dark': isDark }"
        role="dialog"
        aria-modal="false"
        tabindex="-1"
        :aria-label="ariaLabel"
        @keydown="(ev: KeyboardEvent) => emit('keydown', ev)"
      >
        <div class="ai-kb-picker-card" role="menu">
          <div class="ai-kb-picker-head">
            <span class="ai-kb-picker-title">{{ title }}</span>
            <span class="ai-kb-picker-meta">{{ subtitle }}</span>
            <button
              type="button"
              class="ai-kb-picker-close"
              :aria-label="closeAriaLabel"
              @click="emit('close')"
            >
              &times;
            </button>
          </div>
          <ul class="ai-kb-picker-list">
            <li v-for="(kb, idx) in knowledgeBases" :key="kb.id">
              <button
                type="button"
                class="ai-kb-picker-item"
                role="menuitem"
                @click="emit('pick', kb.id)"
              >
                <span v-if="idx < 9" class="ai-kb-picker-item-shortcut">
                  {{ idx + 1 }}
                </span>
                <span class="ai-kb-picker-item-name">{{ kb.name }}</span>
                <span class="ai-kb-picker-item-meta">
                  {{ kb.docs.length }}
                  {{ docsUnit }}
                </span>
              </button>
            </li>
            <li>
              <button
                type="button"
                class="ai-kb-picker-item ai-kb-picker-item-create"
                role="menuitem"
                @click="emit('create-new')"
              >
                <span class="ai-kb-picker-item-shortcut">N</span>
                <span class="ai-kb-picker-item-name">+ {{ newKbLabel }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
export interface KbPickerKb {
  id: string;
  name: string;
  docs: Array<{ id?: string } | unknown>;
}

defineProps<{
  visible: boolean;
  isDark: boolean;
  knowledgeBases: KbPickerKb[];
  title: string;
  subtitle: string;
  ariaLabel: string;
  closeAriaLabel: string;
  docsUnit: string;
  newKbLabel: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'pick', kbId: string): void;
  (e: 'create-new'): void;
  (e: 'keydown', ev: KeyboardEvent): void;
}>();
</script>
