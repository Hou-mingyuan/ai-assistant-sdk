/**
 * P2 分享/发布：把单个 artifact 打包成「自包含、可独立打开」的 HTML 文档。
 *
 * 与 {@link ArtifactRunner} 的区别：ArtifactRunner 跑在沙箱 iframe 里、靠 postMessage
 * 把 console 回传父窗口；这里产出的是**脱离本服务也能直接打开**的单文件，运行型
 * (react/vue/js) 自带内联控制台，静态型 (code/markdown/mermaid/svg/html) 直接渲染。
 * 所有第三方库走 CDN，导出的 .html 双击即可在任意浏览器查看 —— 即「分享/发布」。
 */
import type { Artifact } from '../types/message';

const CDN = {
  react: 'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js',
  reactDom: 'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js',
  babel: 'https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.4/babel.min.js',
  vue: 'https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.global.prod.js',
  sfcLoader: 'https://cdn.jsdelivr.net/npm/vue3-sfc-loader@0.9.5/dist/vue3-sfc-loader.js',
  marked: 'https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js',
  domPurify: 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js',
  hljs: 'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.10.0/highlight.min.js',
  hljsCss: 'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.10.0/styles/github.min.css',
  mermaid: 'https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js',
};

/** type=code 时可在浏览器内真正运行的语言（其余按高亮源码展示）。 */
const JS_RUN_LANGS = new Set(['js', 'javascript', 'node', 'nodejs', 'mjs', 'ts', 'typescript']);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 转义会提前闭合外层 <script> 的片段，避免注入的内容破坏文档。 */
function safeScript(s: string): string {
  return s.replace(/<\/script/gi, '<\\/script');
}

/** React：去掉 import / export，让组件定义留在全局作用域，便于挂载。 */
function sanitizeReact(src: string): string {
  return src
    .replace(/^\s*import\s[^\n;]*;?\s*$/gm, '')
    .replace(/export\s+default\s+function/g, 'function')
    .replace(/export\s+default\s+class/g, 'class')
    .replace(/export\s+default\s+/g, 'window.__default = ')
    .replace(/export\s+(const|let|var|function|class)\s/g, '$1 ');
}

const PAGE_CSS = `
*{box-sizing:border-box}
html,body{margin:0}
body{font-family:system-ui,-apple-system,"Segoe UI",Roboto,"PingFang SC","Microsoft YaHei",sans-serif;color:#1f2328;background:#f6f8fa;line-height:1.6}
.art-head{display:flex;align-items:center;gap:10px;padding:14px 20px;background:#fff;border-bottom:1px solid #e5e7eb;position:sticky;top:0;z-index:5}
.art-badge{flex:none;font-size:12px;font-weight:600;color:#fff;background:#181818;border-radius:6px;padding:3px 9px;letter-spacing:.3px}
.art-title{font-size:16px;margin:0;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.art-main{max-width:960px;margin:0 auto;padding:20px}
.art-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;min-height:80px}
.art-code{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px;line-height:1.55;margin:0}
.art-code code{background:none;padding:0}
.art-md{background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:20px 26px}
.art-md :first-child{margin-top:0}
.art-md img{max-width:100%}
.art-md pre{background:#f6f8fa;padding:12px;border-radius:8px;overflow:auto}
.art-md code{background:rgba(175,184,193,.2);padding:.15em .35em;border-radius:4px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em}
.art-md pre code{background:none;padding:0}
.art-md table{border-collapse:collapse}
.art-md th,.art-md td{border:1px solid #d0d7de;padding:6px 12px}
.art-svg{display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px}
.art-svg svg{max-width:100%;height:auto}
.art-mermaid{display:flex;justify-content:center;background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px}
.art-console{max-width:960px;margin:0 auto 20px;background:#0d1117;color:#e6edf3;border-radius:10px;overflow:hidden}
.art-console-h{padding:8px 14px;font-size:12px;font-weight:600;background:#161b22;color:#9aa4af}
.art-console-b{padding:8px 14px;max-height:240px;overflow:auto;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12.5px}
.art-console-b:empty::after{content:"（暂无输出）";color:#6b7280}
.art-log{margin:2px 0;white-space:pre-wrap;word-break:break-word}
.art-log.art-error{color:#ff7b72}
.art-log.art-warn{color:#e3b341}
.art-foot{max-width:960px;margin:0 auto;padding:0 20px 28px;color:#9aa4af;font-size:12px}`;

interface PageOptions {
  title: string;
  badge: string;
  bodyMain: string;
  headExtra?: string;
  bodyScripts?: string;
  withConsole?: boolean;
}

function page(opts: PageOptions): string {
  const consoleHtml = opts.withConsole
    ? '<section class="art-console"><div class="art-console-h">控制台</div><div id="art-console-body" class="art-console-b"></div></section>'
    : '';
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(opts.title)}</title>
<style>${PAGE_CSS}</style>
${opts.headExtra || ''}
</head><body>
<header class="art-head"><span class="art-badge">${escapeHtml(opts.badge)}</span><h1 class="art-title">${escapeHtml(opts.title)}</h1></header>
<main class="art-main">${opts.bodyMain}</main>
${consoleHtml}
<footer class="art-foot">由 AI Assistant 生成 · 自包含分享文件</footer>
${opts.bodyScripts || ''}
</body></html>`;
}

/** 内联 console / 错误捕获：把输出追加到页面底部的控制台面板（自包含，不依赖父窗口）。 */
function consoleShimInline(): string {
  return `<script>(function(){
  var box=document.getElementById('art-console-body');
  function ser(a){if(typeof a==='string')return a;if(a instanceof Error)return (a.stack||a.message||String(a));try{return JSON.stringify(a,null,2);}catch(e){return String(a);}}
  function out(level,args){if(!box)return;var p=document.createElement('pre');p.className='art-log art-'+level;p.textContent=Array.prototype.map.call(args,ser).join(' ');box.appendChild(p);}
  ['log','info','warn','error','debug'].forEach(function(m){var o=console[m]?console[m].bind(console):function(){};console[m]=function(){out(m,arguments);o.apply(null,arguments);};});
  window.addEventListener('error',function(e){out('error',[e.message+(e.lineno?(' ('+e.lineno+':'+e.colno+')'):'')]);});
  window.addEventListener('unhandledrejection',function(e){var r=e.reason;out('error',['UnhandledRejection: '+((r&&(r.stack||r.message))||r)]);});
})();</script>`;
}

function reactPage(a: Artifact): string {
  const code = safeScript(sanitizeReact(a.content));
  return page({
    title: a.title,
    badge: 'React',
    headExtra: `<script src="${CDN.react}"></script><script src="${CDN.reactDom}"></script><script src="${CDN.babel}"></script>`,
    bodyMain: '<div id="root" class="art-card"></div>',
    withConsole: true,
    bodyScripts: `${consoleShimInline()}<script type="text/babel" data-presets="react">
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
</script>`,
  });
}

function vuePage(a: Artifact): string {
  const sfcJson = safeScript(JSON.stringify(a.content));
  return page({
    title: a.title,
    badge: 'Vue',
    headExtra: `<script src="${CDN.vue}"></script><script src="${CDN.sfcLoader}"></script>`,
    bodyMain: '<div id="app" class="art-card"></div>',
    withConsole: true,
    bodyScripts: `${consoleShimInline()}<script>
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
</script>`,
  });
}

function jsRunPage(a: Artifact): string {
  const lang = (a.lang || '').toLowerCase();
  const isTs = lang === 'ts' || lang === 'typescript';
  const code = safeScript(a.content);
  const userScript = isTs
    ? `<script src="${CDN.babel}"></script>\n<script type="text/babel" data-presets="typescript">\ntry {\n${code}\n} catch (e) { console.error(e); }\n</script>`
    : `<script>\ntry {\n${code}\n} catch (e) { console.error(e); }\n</script>`;
  return page({
    title: a.title,
    badge: (a.lang || 'JS').toUpperCase(),
    bodyMain: '<div id="app" class="art-card"></div>',
    withConsole: true,
    bodyScripts: `${consoleShimInline()}${userScript}`,
  });
}

function codePage(a: Artifact): string {
  const lang = (a.lang || '').toLowerCase();
  const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
  return page({
    title: a.title,
    badge: (a.lang || 'CODE').toUpperCase(),
    headExtra: `<link rel="stylesheet" href="${CDN.hljsCss}"><script src="${CDN.hljs}"></script>`,
    bodyMain: `<pre class="art-code"><code${cls}>${escapeHtml(a.content)}</code></pre>`,
    bodyScripts: '<script>try{hljs.highlightAll();}catch(e){}</script>',
  });
}

function markdownPage(a: Artifact): string {
  const json = safeScript(JSON.stringify(a.content));
  return page({
    title: a.title,
    badge: 'Markdown',
    headExtra: `<script src="${CDN.marked}"></script><script src="${CDN.domPurify}"></script>`,
    bodyMain: '<article id="md" class="art-md"></article>',
    bodyScripts: `<script>
(function(){
  var src = ${json};
  var el = document.getElementById('md');
  try {
    var html = (window.marked && marked.parse) ? marked.parse(src) : src;
    el.innerHTML = window.DOMPurify ? DOMPurify.sanitize(html) : html;
  } catch (e) { el.textContent = src; }
})();
</script>`,
  });
}

function mermaidPage(a: Artifact): string {
  const json = safeScript(JSON.stringify(a.content));
  return page({
    title: a.title,
    badge: 'Mermaid',
    headExtra: `<script src="${CDN.mermaid}"></script>`,
    bodyMain: '<div id="mmd" class="art-mermaid"></div>',
    bodyScripts: `<script>
(function(){
  var el = document.getElementById('mmd');
  try {
    el.textContent = ${json};
    el.classList.add('mermaid');
    mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' });
    mermaid.run({ nodes: [el] });
  } catch (e) { el.textContent = '图渲染失败：' + (e && e.message || e); }
})();
</script>`,
  });
}

function svgPage(a: Artifact): string {
  return page({
    title: a.title,
    badge: 'SVG',
    bodyMain: `<div class="art-svg">${a.content}</div>`,
  });
}

function htmlPage(a: Artifact): string {
  const c = a.content.trim();
  // 已是完整文档则原样输出（它本身就是可分享的单页）；否则套一层最小外壳。
  if (/<!doctype/i.test(c) || /<html[\s>]/i.test(c)) return a.content;
  return page({
    title: a.title,
    badge: 'HTML',
    bodyMain: `<div class="art-card">${a.content}</div>`,
  });
}

/** 把一个 artifact 渲染成自包含、可独立打开的完整 HTML 文档字符串。 */
export function buildShareableHtml(a: Artifact): string {
  switch (a.type) {
    case 'react':
      return reactPage(a);
    case 'vue':
      return vuePage(a);
    case 'mermaid':
      return mermaidPage(a);
    case 'markdown':
      return markdownPage(a);
    case 'svg':
      return svgPage(a);
    case 'html':
      return htmlPage(a);
    case 'code':
    default:
      return JS_RUN_LANGS.has((a.lang || '').toLowerCase()) ? jsRunPage(a) : codePage(a);
  }
}

/** 分享文件名：清洗标题为安全文件名（保留中文等 Unicode 字母），统一 .html 后缀。 */
export function shareableFileName(a: Artifact): string {
  const cleaned = (a.title || 'artifact')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return `${cleaned || 'artifact'}.html`;
}
