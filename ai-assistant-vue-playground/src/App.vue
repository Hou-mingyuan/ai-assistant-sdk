<template>
  <div class="page">
    <nav class="page-nav" aria-label="playground navigation">
      <button
        type="button"
        :class="['page-nav-tab', { active: route === 'demo' }]"
        @click="setRoute('demo')"
      >
        <span class="page-nav-emoji" aria-hidden="true">🤖</span>
        AI Assistant Demo
      </button>
      <button
        type="button"
        :class="['page-nav-tab', { active: route === 'admin' }]"
        @click="setRoute('admin')"
      >
        <span class="page-nav-emoji" aria-hidden="true">🛠</span>
        Admin Console
      </button>
      <span class="page-nav-spacer" />
      <ColorThemeSwitcher v-model="theme" class="page-nav-theme" />
      <button
        type="button"
        class="page-nav-cmdk"
        title="打开命令面板 (Ctrl+K / ⌘+K)"
        @click="cmd.toggle"
      >
        <span aria-hidden="true">⌘</span>K
      </button>
      <a
        class="page-nav-hint"
        href="https://github.com/Hou-mingyuan/ai-assistant-sdk"
        target="_blank"
        rel="noopener"
      >GitHub ↗</a>
    </nav>

    <article v-if="route === 'demo'" class="demo-assistant-page-context">
      <h1>AI Assistant 悬浮球演示</h1>
      <p>
        请先启动 <code>ai-assistant-demo</code>（端口 8080），再在本目录执行
        <code>npm run dev</code>。页面右下角为悬浮球，请求经 Vite 代理到
        <code>/ai-assistant</code>。
      </p>
      <p class="demo-hint">
        切到顶栏的 <strong>Admin Console</strong> 标签可看到本轮 K4 改进 -- 7 个 tab
        覆盖 15 个 admin endpoint 的完整管理面板。<br />
        按 <kbd>Ctrl+K</kbd> / <kbd>⌘+K</kbd> 打开 K16 命令面板，
        顶栏色块切换 K16 主题色，悬浮球 K13/K14/K15 微交互全部就绪。
      </p>
    </article>

    <AdminDemoPanel v-if="route === 'admin'" />

    <CommandPalette v-model:open="cmd.open.value" :commands="cmd.commands.value" />

    <!-- K32: K24 onReaction visualisation. Stacks at the bottom-left when
         the user clicks a reaction emoji under an assistant message, so the
         developer can verify the event payload propagation end-to-end. -->
    <div v-if="reactionLog.length > 0" class="reaction-log">
      <div class="reaction-log-head">
        <span>👍 onReaction events</span>
        <button type="button" class="reaction-log-clear" @click="reactionLog = []">
          clear
        </button>
      </div>
      <ul class="reaction-log-list">
        <li v-for="(entry, i) in reactionLog" :key="i" class="reaction-log-item">
          <span class="reaction-log-emoji">{{ entry.emoji }}</span>
          <span class="reaction-log-meta">
            #{{ entry.messageIndex }}
            <span :class="['reaction-log-state', entry.toggled ? 'off' : 'on']">
              {{ entry.toggled ? 'cleared' : 'set' }}
            </span>
          </span>
          <time class="reaction-log-time">{{ entry.timeStr }}</time>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import AdminDemoPanel from './AdminDemoPanel.vue';
import CommandPalette from '../../ai-assistant-ui/src/components/CommandPalette.vue';
import ColorThemeSwitcher from '../../ai-assistant-ui/src/components/ColorThemeSwitcher.vue';
import { useCommandPalette } from '../../ai-assistant-ui/src/composables/useCommandPalette';

/* K16 demo wiring: Color theme switcher controls the playground primary color
 * via CSS variable update; useCommandPalette registers two demo commands. */
const theme = ref<string>(localStorage.getItem('playground-theme') ?? 'sky');
const themePalettes: Record<string, [string, string, string]> = {
  sky: ['#0ea5e9', '#06b6d4', '#3b82f6'],
  sunset: ['#f59e0b', '#f43f5e', '#a855f7'],
  forest: ['#10b981', '#14b8a6', '#06b6d4'],
  plum: ['#a855f7', '#ec4899', '#f43f5e'],
  graphite: ['#64748b', '#475569', '#334155'],
};

watch(
  theme,
  (v) => {
    localStorage.setItem('playground-theme', v);
    const [from, , to] = themePalettes[v] ?? themePalettes.sky!;
    document.documentElement.style.setProperty('--demo-primary-from', from);
    document.documentElement.style.setProperty('--demo-primary-to', to);
  },
  { immediate: true },
);

const cmd = useCommandPalette({
  shortcut: 'Ctrl+K',
  commands: [
    {
      id: 'nav-demo',
      label: '切换到 AI 助手 Demo',
      group: '导航',
      icon: '🤖',
      shortcut: 'g d',
      action: () => setRoute('demo'),
    },
    {
      id: 'nav-admin',
      label: '切换到 Admin Console',
      group: '导航',
      icon: '🛠',
      shortcut: 'g a',
      action: () => setRoute('admin'),
    },
    {
      id: 'theme-sky',
      label: '主题: Sky',
      group: '主题',
      icon: '🩵',
      action: () => (theme.value = 'sky'),
    },
    {
      id: 'theme-sunset',
      label: '主题: Sunset',
      group: '主题',
      icon: '🌅',
      action: () => (theme.value = 'sunset'),
    },
    {
      id: 'theme-forest',
      label: '主题: Forest',
      group: '主题',
      icon: '🌲',
      action: () => (theme.value = 'forest'),
    },
    {
      id: 'theme-plum',
      label: '主题: Plum',
      group: '主题',
      icon: '🫐',
      action: () => (theme.value = 'plum'),
    },
    {
      id: 'open-github',
      label: '打开 GitHub 仓库',
      group: '外链',
      icon: '🔗',
      keywords: ['github', 'repo'],
      action: () => window.open('https://github.com/Hou-mingyuan/ai-assistant-sdk', '_blank'),
    },
    {
      id: 'open-docs',
      label: '打开本地文档站',
      group: '外链',
      icon: '📖',
      keywords: ['docs', 'guide'],
      action: () => window.open('http://localhost:5174', '_blank'),
    },
  ],
});

type Route = 'demo' | 'admin';

const route = ref<Route>(resolveRoute());

function resolveRoute(): Route {
  if (typeof window === 'undefined') return 'demo';
  return window.location.hash === '#/admin' ? 'admin' : 'demo';
}

function setRoute(next: Route) {
  route.value = next;
  if (typeof window === 'undefined') return;
  const targetHash = next === 'admin' ? '#/admin' : '';
  if (window.location.hash !== targetHash) {
    window.history.pushState({}, '', `${window.location.pathname}${targetHash}`);
  }
}

function onPopState() {
  route.value = resolveRoute();
}

onMounted(() => window.addEventListener('popstate', onPopState));
onBeforeUnmount(() => window.removeEventListener('popstate', onPopState));

/* K32: K24 onReaction visualisation
 * ----------------------------------
 * The AiAssistant widget is auto-mounted by `app.use(AiAssistant, opts)`
 * in main.ts (not by the <AiAssistant /> tag in this template), so we
 * receive reaction events via the global `ai-assistant-reaction` window
 * event that main.ts re-dispatches. This keeps App.vue
 * autoMountToBody-friendly and works regardless of whether the host
 * registered the component or not.
 *
 * The log displays the latest 8 events with timestamp + state so the
 * developer can verify the K24 event-propagation contract end-to-end.
 */
interface ReactionEntry {
  messageIndex: number;
  emoji: string;
  toggled: boolean;
  timeStr: string;
}
const reactionLog = ref<ReactionEntry[]>([]);

function onAssistantReactionEvent(ev: Event) {
  const detail = (ev as CustomEvent<{ messageIndex: number; emoji: string; toggled: boolean }>)
    .detail;
  if (!detail || typeof detail.messageIndex !== 'number') return;
  const time = new Date();
  const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(
    time.getMinutes(),
  ).padStart(2, '0')}:${String(time.getSeconds()).padStart(2, '0')}`;
  reactionLog.value = [
    { ...detail, timeStr },
    ...reactionLog.value,
  ].slice(0, 8);
}

onMounted(() => window.addEventListener('ai-assistant-reaction', onAssistantReactionEvent));
onBeforeUnmount(() =>
  window.removeEventListener('ai-assistant-reaction', onAssistantReactionEvent),
);
</script>

<style scoped>
.page {
  padding: 1.5rem 2rem;
  max-width: 880px;
  margin: 0 auto;
  font-family: system-ui, sans-serif;
  line-height: 1.6;
  color: #1e293b;
}

.page-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 1.5rem;
  padding: 8px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(6, 182, 212, 0.04));
  border: 1px solid #e2e8f0;
}

.page-nav-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  font-size: 0.88rem;
  font-weight: 500;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  color: #475569;
  cursor: pointer;
  transition: all 0.18s ease;
}

.page-nav-tab:hover {
  background: rgba(255, 255, 255, 0.6);
  color: #0ea5e9;
}

.page-nav-tab.active {
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 2px 8px -2px rgba(14, 165, 233, 0.5);
}

.page-nav-emoji {
  font-size: 1.1rem;
}

.page-nav-spacer {
  flex: 1;
}

.page-nav-theme {
  margin-right: 8px;
}

.page-nav-cmdk {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 0.78rem;
  font-weight: 500;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.12);
  color: #334155;
  cursor: pointer;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  transition: all 0.15s ease;
}

.page-nav-cmdk:hover {
  background: rgba(14, 165, 233, 0.10);
  border-color: rgba(14, 165, 233, 0.32);
  color: #0ea5e9;
}

.page-nav-hint {
  font-size: 0.8rem;
  color: #64748b;
  text-decoration: none;
  padding: 4px 10px;
  border-radius: 6px;
  transition: all 0.15s ease;
}

.page-nav-hint:hover {
  background: rgba(14, 165, 233, 0.08);
  color: #0ea5e9;
}

.demo-assistant-page-context {
  padding: 1.25rem 1.5rem;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  background: #fff;
}

.demo-assistant-page-context h1 {
  margin: 0 0 0.5rem;
  font-size: 1.4rem;
  background: linear-gradient(
    135deg,
    var(--demo-primary-from, #0ea5e9),
    var(--demo-primary-to, #06b6d4)
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.demo-hint kbd {
  display: inline-block;
  padding: 1px 6px;
  margin: 0 2px;
  background: rgba(15, 23, 42, 0.06);
  border: 1px solid rgba(15, 23, 42, 0.12);
  border-radius: 4px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
  font-size: 0.75em;
  font-weight: 500;
}

.demo-hint {
  margin: 0.75rem 0 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(14, 165, 233, 0.08);
  font-size: 0.86rem;
  color: #0c4a6e;
}

code {
  background: #f1f5f9;
  padding: 0.15em 0.4em;
  border-radius: 4px;
  font-size: 0.9em;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}

/* K32: K24 onReaction event visualiser — stacks at the bottom-left so it
 * never overlaps with the AI assistant fab at bottom-right. */
.reaction-log {
  position: fixed;
  bottom: 16px;
  left: 16px;
  width: 260px;
  z-index: 9999;
  background: rgba(255, 255, 255, 0.96);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(14, 165, 233, 0.18);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(15, 23, 42, 0.14);
  font-size: 12px;
  overflow: hidden;
  animation: reactionLogIn 200ms cubic-bezier(0.2, 0.9, 0.3, 1);
}

@keyframes reactionLogIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.reaction-log-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.08), rgba(59, 130, 246, 0.05));
  font-weight: 600;
  color: #0369a1;
}

.reaction-log-clear {
  border: none;
  background: transparent;
  font-size: 11px;
  color: #64748b;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: background 0.15s;
}

.reaction-log-clear:hover {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}

.reaction-log-list {
  list-style: none;
  margin: 0;
  padding: 6px 8px 8px;
  max-height: 220px;
  overflow-y: auto;
}

.reaction-log-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;
  font-variant-numeric: tabular-nums;
  transition: background 0.15s;
}

.reaction-log-item:hover {
  background: rgba(15, 23, 42, 0.04);
}

.reaction-log-emoji {
  font-size: 16px;
  line-height: 1;
}

.reaction-log-meta {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #475569;
}

.reaction-log-state.on {
  color: #16a34a;
  font-weight: 500;
}

.reaction-log-state.off {
  color: #dc2626;
  font-weight: 500;
}

.reaction-log-time {
  color: #94a3b8;
  font-size: 10px;
  font-family: ui-monospace, Menlo, Consolas, monospace;
}
</style>
