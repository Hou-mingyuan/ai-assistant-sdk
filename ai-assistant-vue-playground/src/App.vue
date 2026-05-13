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
        覆盖 15 个 admin endpoint 的完整管理面板。
      </p>
    </article>

    <AdminDemoPanel v-if="route === 'admin'" />
    <AiAssistant />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import AdminDemoPanel from './AdminDemoPanel.vue';

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
  background: linear-gradient(135deg, #0ea5e9, #06b6d4);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
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
</style>
