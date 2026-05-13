/**
 * useMermaidRenderer
 * ------------------
 * 把 `useAiMarkdownRenderer` 留下的 `<div class="ai-mermaid-placeholder">`
 * 占位符 lazy 替换成 SVG。
 *
 * 设计要点：
 * - **可选 peer**：`mermaid` 不在 `dependencies` 里，宿主需要自行 `npm i mermaid`。
 *   未安装时 `loadMermaid()` 静默失败，placeholder 仍然保留源码可读，不破坏页面。
 * - **动态 import + @vite-ignore**：避免 vite build 阶段 resolve 失败。
 * - **单例 module 状态**：所有 MessageList 共享同一份 mermaid 引擎，避免重复
 *   `mermaid.initialize`。
 * - **每个 placeholder 唯一 id**：mermaid.render 必须传 svg id，使用全局自增。
 * - **错误降级**：渲染失败的 placeholder 转成 `<pre>` 显示原始源码 + 错误信息。
 */

interface MermaidLib {
  initialize(opts: Record<string, unknown>): void;
  render(id: string, src: string): Promise<{ svg: string; bindFunctions?: (el: Element) => void }>;
}

let mermaidPromise: Promise<MermaidLib | null> | null = null;
let nextRenderId = 0;

function decodeMermaidSource(encoded: string): string {
  if (!encoded) return '';
  try {
    if (typeof atob === 'function') {
      return decodeURIComponent(escape(atob(encoded)));
    }
  } catch {
    /* fallthrough */
  }
  try {
    return decodeURIComponent(encoded);
  } catch {
    return encoded;
  }
}

/* Stored in a variable so neither Vite's static analyser nor Vitest's
   transform pipeline try to resolve `mermaid` at build / test time. The
   real resolution happens at runtime through the host application's module
   resolver — i.e. it works only if the host has actually installed
   `mermaid`, which is exactly the "optional peer" semantic we want. */
const MERMAID_PKG: string = 'mermaid';

function loadMermaid(): Promise<MermaidLib | null> {
  if (mermaidPromise) return mermaidPromise;
  mermaidPromise = (async () => {
    try {
      const mod = await import(/* @vite-ignore */ MERMAID_PKG);
      const lib: MermaidLib = (mod as { default?: MermaidLib }).default ?? (mod as unknown as MermaidLib);
      if (!lib?.render || !lib?.initialize) return null;
      lib.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'strict',
        flowchart: { useMaxWidth: true, htmlLabels: false },
        sequence: { useMaxWidth: true },
      });
      return lib;
    } catch {
      return null;
    }
  })();
  return mermaidPromise;
}

export interface MermaidRenderOptions {
  /** 强制重新渲染（即使已带 `data-mermaid-rendered`），默认 false */
  force?: boolean;
}

export function useMermaidRenderer() {
  async function renderInside(root: HTMLElement | null | undefined, opts: MermaidRenderOptions = {}) {
    if (!root) return;
    const placeholders = root.querySelectorAll<HTMLElement>('.ai-mermaid-placeholder');
    if (placeholders.length === 0) return;
    const lib = await loadMermaid();
    if (!lib) {
      for (const el of Array.from(placeholders)) {
        if (el.dataset.mermaidRendered === 'fallback') continue;
        el.dataset.mermaidRendered = 'fallback';
        const src = decodeMermaidSource(el.dataset.mermaidSrc ?? '');
        el.innerHTML = `<pre class="ai-mermaid-fallback">${escapeForPre(src)}</pre>`;
      }
      return;
    }
    for (const el of Array.from(placeholders)) {
      if (!opts.force && el.dataset.mermaidRendered === 'true') continue;
      const src = decodeMermaidSource(el.dataset.mermaidSrc ?? '');
      if (!src.trim()) continue;
      const id = `ai-mermaid-${++nextRenderId}`;
      try {
        const { svg, bindFunctions } = await lib.render(id, src);
        el.innerHTML = svg;
        el.dataset.mermaidRendered = 'true';
        bindFunctions?.(el);
      } catch (err) {
        el.dataset.mermaidRendered = 'error';
        const msg = err instanceof Error ? err.message : String(err);
        el.innerHTML = `<pre class="ai-mermaid-error">Mermaid render error:\n${escapeForPre(msg)}\n\n${escapeForPre(src)}</pre>`;
      }
    }
  }

  return { renderInside };
}

function escapeForPre(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
