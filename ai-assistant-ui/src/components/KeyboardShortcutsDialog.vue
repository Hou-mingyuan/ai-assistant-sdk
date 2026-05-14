<template>
  <Teleport to="body">
    <Transition name="ai-modal">
      <div
        v-if="open"
        class="ai-personalize-overlay ai-kbd-overlay"
        :class="{ 'ai-dark': isDark }"
        role="presentation"
        @click.self="$emit('close')"
      >
        <div
          class="ai-personalize-dialog ai-kbd-dialog"
          role="dialog"
          aria-modal="true"
          :aria-labelledby="titleId"
          @click.stop
        >
          <div class="ai-personalize-head">
            <h2 :id="titleId" class="ai-personalize-title">
              {{ t.kbdTitle || 'Keyboard shortcuts' }}
            </h2>
            <button
              type="button"
              class="ai-personalize-close"
              :aria-label="t.closePanel"
              @click="$emit('close')"
            >
              &times;
            </button>
          </div>
          <div class="ai-kbd-content">
            <section v-for="group in groups" :key="group.title" class="ai-kbd-group">
              <h3 class="ai-kbd-group-title">{{ group.title }}</h3>
              <dl class="ai-kbd-list">
                <div v-for="item in group.items" :key="item.combo" class="ai-kbd-row">
                  <dt class="ai-kbd-keys">
                    <kbd v-for="(k, ki) in item.keys" :key="ki" class="ai-kbd-key">{{ k }}</kbd>
                  </dt>
                  <dd class="ai-kbd-desc">{{ item.desc }}</dd>
                </div>
              </dl>
            </section>
          </div>
          <p class="ai-kbd-foot">
            {{ t.kbdFootTip || 'Press Esc to close · Press Ctrl + / again to reopen' }}
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { I18nMessages } from '../utils/i18n';

const props = defineProps<{
  open: boolean;
  isDark: boolean;
  t: I18nMessages;
}>();

defineEmits<{
  (e: 'close'): void;
}>();

const titleId = `ai-kbd-title-${Math.random().toString(36).slice(2, 8)}`;

interface ShortcutItem {
  combo: string;
  keys: string[];
  desc: string;
}
interface ShortcutGroup {
  title: string;
  items: ShortcutItem[];
}

const isMac =
  typeof navigator !== 'undefined' &&
  (navigator.platform?.startsWith('Mac') || navigator.userAgent?.includes('Mac'));
const ctrlKeyLabel = isMac ? '⌘' : 'Ctrl';

const groups = computed<ShortcutGroup[]>(() => {
  const t = props.t;
  return [
    {
      title: t.kbdGroupGlobal || 'Global',
      items: [
        {
          combo: 'open-help',
          keys: [ctrlKeyLabel, '/'],
          desc: t.kbdOpenHelp || 'Show this shortcut sheet',
        },
        {
          combo: 'toggle-panel',
          keys: [ctrlKeyLabel, 'Shift', 'L'],
          desc: t.kbdClearMessages || 'Clear all messages',
        },
        {
          combo: 'new-session',
          keys: [ctrlKeyLabel, 'Shift', 'N'],
          desc: t.kbdNewSession || 'Start new session',
        },
        {
          combo: 'focus-search',
          keys: [ctrlKeyLabel, 'Shift', 'F'],
          desc: t.kbdFocusSearch || 'Focus message search box',
        },
        {
          combo: 'toggle-export',
          keys: [ctrlKeyLabel, 'Shift', 'S'],
          desc: t.kbdToggleExport || 'Toggle batch export menu',
        },
        {
          combo: 'screen-capture',
          keys: [ctrlKeyLabel, 'Shift', 'I'],
          desc: t.kbdScreenCapture || 'Capture the screen as an image attachment',
        },
        {
          combo: 'toggle-memory',
          keys: [ctrlKeyLabel, 'Shift', 'M'],
          desc: t.kbdToggleMemory || 'Toggle memory panel',
        },
        {
          combo: 'close-overlay',
          keys: ['Esc'],
          desc: t.kbdCloseOverlay || 'Close active dialog / popover',
        },
      ],
    },
    {
      title: t.kbdGroupInput || 'Composer',
      items: [
        {
          combo: 'send-enter',
          keys: ['Enter'],
          desc: t.kbdSendEnter || 'Send message (or insert newline if Ctrl+Enter mode)',
        },
        {
          combo: 'send-ctrl-enter',
          keys: [ctrlKeyLabel, 'Enter'],
          desc: t.kbdSendCtrlEnter || 'Force send (regardless of Enter mode)',
        },
        {
          combo: 'bold',
          keys: [ctrlKeyLabel, 'B'],
          desc: t.kbdBold || 'Bold selection / insert **',
        },
        {
          combo: 'italic',
          keys: [ctrlKeyLabel, 'I'],
          desc: t.kbdItalic || 'Italic selection / insert *',
        },
        { combo: 'code', keys: [ctrlKeyLabel, 'E'], desc: t.kbdCode || 'Inline code / insert `' },
        { combo: 'link', keys: [ctrlKeyLabel, 'K'], desc: t.kbdLink || 'Insert link placeholder' },
      ],
    },
    {
      title: t.kbdGroupSlash || 'Slash menu',
      items: [
        {
          combo: 'open-slash',
          keys: ['/'],
          desc: t.kbdOpenSlash || 'Trigger slash command (first char of textarea)',
        },
        {
          combo: 'navigate',
          keys: ['↑', '↓'],
          desc: t.kbdNavigateSlash || 'Move highlight up / down',
        },
        {
          combo: 'select-slash',
          keys: ['Enter'],
          desc: t.kbdSelectSlash || 'Run highlighted command',
        },
        { combo: 'cancel-slash', keys: ['Esc'], desc: t.kbdCancelSlash || 'Close slash menu' },
      ],
    },
  ];
});
</script>
