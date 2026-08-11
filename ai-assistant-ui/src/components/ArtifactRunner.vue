<script setup lang="ts">
/* eslint-disable no-useless-escape -- 故意保留 `<\/script>` 转义：在 JS 模板串里拼接 iframe srcdoc 的 HTML，反斜杠用于防止浏览器 HTML 解析器把外层 <script> 提前闭合，删除会破坏沙箱文档拼接 */
/**
 * P2：可运行 / 可实时预览的 artifact 渲染器（在沙箱 iframe 内执行）。
 *
 * - react → CDN 加载 React + ReactDOM + Babel，转译 JSX 后挂载组件（默认导出 / App）
 * - vue   → CDN 加载 Vue3 + vue3-sfc-loader，在浏览器内编译 SFC（含 <script setup>/<style>）后挂载
 * - js    → 直接在沙箱执行（ts 经 Babel 转译），主要看 console 输出，也支持往 #app 写 DOM
 *
 * console / 运行错误经 postMessage 回传父窗口，渲染成下方“控制台”面板。
 *
 * 安全说明：iframe 用 sandbox 隔离。为让框架加载器（Babel / vue3-sfc-loader 都依赖
 * new Function/eval）与模块解析稳定工作，这里启用了 allow-same-origin —— 仅用于本地 demo
 * 的实时预览（执行的是用户自己 AI 助手产出的代码），不应用于运行不可信第三方代码。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { Artifact } from '../types/message';
import { buildShareableHtml } from '../utils/artifactHtml';
import AssistantIcon from './AssistantIcon.vue';

const props = defineProps<{ artifact: Artifact }>();

interface LogLine {
  level: string;
  text: string;
}

const CDN = {
  react: 'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js',
  reactDom: 'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js',
  babel: 'https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.4/babel.min.js',
  vue: 'https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.global.prod.js',
  sfcLoader: 'https://cdn.jsdelivr.net/npm/vue3-sfc-loader@0.9.5/dist/vue3-sfc-loader.js',
};

const channelId = 'airun-' + Math.random().toString(36).slice(2, 10);
const logs = ref<LogLine[]>([]);
const runKey = ref(0);
const consoleOpen = ref(false);
const ready = ref(false);
/** 错误横幅是否被用户手动关掉（重新运行 / 切换 artifact 时复位）。 */
const errorDismissed = ref(false);

const kind = computed<'react' | 'vue' | 'js'>(() => {
  if (props.artifact.type === 'react') return 'react';
  if (props.artifact.type === 'vue') return 'vue';
  return 'js';
});

/** 把会提前闭合外层 <script> 的片段转义掉，避免注入的用户代码破坏 iframe 文档。 */
function safeScript(s: string): string {
  return s.replace(/<\/script/gi, '<\\/script');
}

/** 通用 console / 错误捕获脚本（注入每个沙箱文档）。 */
function consoleShim(): string {
  return `
  (function(){
    var CID=${JSON.stringify(channelId)};
    function ser(a){
      if(typeof a==='string')return a;
      if(a instanceof Error)return (a.stack||a.message||String(a));
      try{return JSON.stringify(a,null,2);}catch(e){return String(a);}
    }
    function send(level,args){
      try{parent.postMessage({__airun:CID,level:level,text:Array.prototype.map.call(args,ser).join(' ')},'*');}catch(e){}
    }
    ['log','info','warn','error','debug'].forEach(function(m){
      var orig=console[m]?console[m].bind(console):function(){};
      console[m]=function(){send(m,arguments);orig.apply(null,arguments);};
    });
    window.addEventListener('error',function(e){
      send('error',[e.message+(e.filename&&e.lineno?(' ('+e.lineno+':'+e.colno+')'):'')]);
    });
    window.addEventListener('unhandledrejection',function(e){
      var r=e.reason;send('error',['UnhandledRejection: '+((r&&(r.stack||r.message))||r)]);
    });
    parent.postMessage({__airun:CID,level:'__ready'},'*');
  })();`;
}

/** React：去掉 import / export，保证组件定义留在全局作用域，便于挂载。 */
function sanitizeReact(src: string): string {
  return src
    .replace(/^\s*import\s[^\n;]*;?\s*$/gm, '')
    .replace(/export\s+default\s+function/g, 'function')
    .replace(/export\s+default\s+class/g, 'class')
    .replace(/export\s+default\s+/g, 'window.__default = ')
    .replace(/export\s+(const|let|var|function|class)\s/g, '$1 ');
}

function reactDoc(src: string): string {
  const code = safeScript(sanitizeReact(src));
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f2328}#root{padding:12px}</style>
<script src="${CDN.react}"><\/script>
<script src="${CDN.reactDom}"><\/script>
<script src="${CDN.babel}"><\/script>
</head><body>
<div id="root"></div>
<script>${consoleShim()}<\/script>
<script type="text/babel" data-presets="react">
const { useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, useLayoutEffect, Fragment, createContext } = React;
try {
${code}
} catch (e) { console.error(e); }
;(function(){
  try {
    var Comp = window.__default
      || (typeof App !== 'undefined' && App)
      || (typeof Component !== 'undefined' && Component);
    if (!Comp) { console.error('未找到要渲染的组件：请定义一个名为 App 的组件，或用 export default 导出。'); return; }
    ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Comp));
  } catch (e) { console.error(e); }
})();
<\/script>
</body></html>`;
}

function vueDoc(src: string): string {
  const sfcJson = safeScript(JSON.stringify(src));
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0}body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#1f2328}#app{padding:12px}</style>
<script src="${CDN.vue}"><\/script>
<script src="${CDN.sfcLoader}"><\/script>
</head><body>
<div id="app"></div>
<script>${consoleShim()}<\/script>
<script>
(function(){
  try {
    var loader = window['vue3-sfc-loader'];
    if (!loader || !loader.loadModule) { console.error('vue3-sfc-loader 加载失败（检查网络/CDN）。'); return; }
    var source = ${sfcJson};
    var options = {
      moduleCache: { vue: Vue },
      getFile: function(url){
        if (url === '/main.vue' || /\\.vue$/.test(url)) return Promise.resolve(source);
        return Promise.reject(new Error('找不到文件：' + url));
      },
      addStyle: function(text){ var s=document.createElement('style'); s.textContent=text; document.head.appendChild(s); },
      log: function(type){ var a=Array.prototype.slice.call(arguments,1); (console[type]||console.log).apply(console,a); }
    };
    loader.loadModule('/main.vue', options)
      .then(function(comp){ Vue.createApp(comp).mount('#app'); })
      .catch(function(e){ console.error(e && (e.stack||e.message) || e); });
  } catch (e) { console.error(e); }
})();
<\/script>
</body></html>`;
}

function jsDoc(src: string): string {
  const lang = (props.artifact.lang || '').toLowerCase();
  const isTs = lang === 'ts' || lang === 'typescript';
  const code = safeScript(src);
  const userScript = isTs
    ? `<script src="${CDN.babel}"><\/script>\n<script type="text/babel" data-presets="typescript">\ntry {\n${code}\n} catch (e) { console.error(e); }\n<\/script>`
    : `<script>\ntry {\n${code}\n} catch (e) { console.error(e); }\n<\/script>`;
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>html,body{margin:0}body{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;color:#1f2328}#app{padding:12px}</style>
</head><body>
<div id="app"></div>
<script>${consoleShim()}<\/script>
${userScript}
</body></html>`;
}

const srcdoc = computed(() => {
  // 依赖 runKey 触发重算（重新运行时强制刷新文档）
  void runKey.value;
  const src = props.artifact.content;
  if (kind.value === 'react') return reactDoc(src);
  if (kind.value === 'vue') return vueDoc(src);
  return jsDoc(src);
});

function onMessage(e: MessageEvent) {
  const d = e.data;
  if (!d || d.__airun !== channelId) return;
  if (d.level === '__ready') {
    ready.value = true;
    return;
  }
  logs.value.push({ level: String(d.level || 'log'), text: String(d.text ?? '') });
  if (logs.value.length > 300) logs.value.splice(0, logs.value.length - 300);
}

function rerun() {
  logs.value = [];
  ready.value = false;
  errorDismissed.value = false;
  runKey.value += 1;
}

function clearLogs() {
  logs.value = [];
}

/* 切换到另一个 artifact 时复位运行状态。 */
watch(
  () => props.artifact.id + '|' + props.artifact.content,
  () => {
    logs.value = [];
    ready.value = false;
    errorDismissed.value = false;
    runKey.value += 1;
  },
);

onMounted(() => window.addEventListener('message', onMessage));
onBeforeUnmount(() => window.removeEventListener('message', onMessage));

const kindLabel = computed(() =>
  kind.value === 'react' ? 'React 预览' : kind.value === 'vue' ? 'Vue 预览' : 'JS 运行',
);
const errorCount = computed(() => logs.value.filter((l) => l.level === 'error').length);
/** 最近一条错误文案，用于错误横幅的一行提示。 */
const lastError = computed(() => {
  for (let i = logs.value.length - 1; i >= 0; i--) {
    if (logs.value[i].level === 'error') return logs.value[i].text;
  }
  return '';
});

/** 点击错误横幅的“查看控制台”：展开控制台并收起横幅。 */
function showConsoleFromBanner() {
  consoleOpen.value = true;
  errorDismissed.value = true;
}

/** 在新标签页打开渲染后的自包含预览（复用分享导出的同一份 HTML）。 */
function openInNewTab() {
  const blob = new Blob([buildShareableHtml(props.artifact)], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
</script>

<template>
  <div class="ai-artifact-runner">
    <div class="ai-artifact-runner-bar">
      <span class="ai-artifact-runner-kind">{{ kindLabel }}</span>
      <span v-if="!ready" class="ai-artifact-runner-loading">加载运行环境…</span>
      <span class="ai-artifact-runner-spacer"></span>
      <button
        type="button"
        class="ai-artifact-btn"
        title="在新标签页打开渲染后的预览"
        @click="openInNewTab"
      >
        <AssistantIcon name="external-link" :size="14" />
        <span>新标签</span>
      </button>
      <button type="button" class="ai-artifact-btn" title="重新运行" @click="rerun">
        <AssistantIcon name="rotate-ccw" :size="14" />
        <span>重新运行</span>
      </button>
    </div>

    <div v-if="errorCount && !errorDismissed" class="ai-artifact-runner-error" role="alert">
      <span class="ai-artifact-runner-error-icon" aria-hidden="true">
        <AssistantIcon name="triangle-alert" :size="18" />
      </span>
      <div class="ai-artifact-runner-error-body">
        <strong class="ai-artifact-runner-error-title">运行出错</strong>
        <span class="ai-artifact-runner-error-msg">{{ lastError }}</span>
      </div>
      <button type="button" class="ai-artifact-runner-error-link" @click="showConsoleFromBanner">
        查看控制台
      </button>
      <button
        type="button"
        class="ai-artifact-runner-error-close"
        title="关闭提示"
        aria-label="关闭提示"
        @click="errorDismissed = true"
      >
        <AssistantIcon name="x" :size="15" />
      </button>
    </div>

    <div class="ai-artifact-runner-frame-wrap">
      <iframe
        :key="runKey"
        class="ai-artifact-runner-frame"
        sandbox="allow-scripts allow-same-origin allow-popups allow-modals allow-forms"
        :srcdoc="srcdoc"
        title="Artifact live preview"
      ></iframe>
    </div>

    <div class="ai-artifact-console" :class="{ 'is-collapsed': !consoleOpen }">
      <div class="ai-artifact-console-head">
        <button
          type="button"
          class="ai-artifact-console-toggle"
          @click="consoleOpen = !consoleOpen"
        >
          <AssistantIcon :name="consoleOpen ? 'chevron-down' : 'chevron-right'" :size="14" />
          控制台
          <span class="ai-artifact-console-count">{{ logs.length }}</span>
          <span v-if="errorCount" class="ai-artifact-console-errcount">{{ errorCount }} 错误</span>
        </button>
        <button
          v-if="logs.length"
          type="button"
          class="ai-artifact-console-clear"
          @click="clearLogs"
        >
          清空
        </button>
      </div>
      <div v-if="consoleOpen" class="ai-artifact-console-body">
        <p v-if="!logs.length" class="ai-artifact-console-empty">（暂无输出）</p>
        <pre
          v-for="(l, i) in logs"
          :key="i"
          class="ai-artifact-console-line"
          :class="`is-${l.level}`"
          >{{ l.text }}</pre>
      </div>
    </div>
  </div>
</template>
