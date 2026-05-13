import type { ComputedRef } from 'vue';
import { Marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs, { ensureLanguage } from '../utils/hljsRegistered';
import DOMPurify from 'dompurify';
import type { AiAssistantOptions } from '../index';
import type { I18nMessages } from '../utils/i18n';

const renderCache = new Map<string, string>();
const CACHE_CAP = 250;

/**
 * Mermaid sentinel：highlight 阶段无法直接返回非高亮内容（marked-highlight 会
 * 把返回值塞进 `<code class="language-mermaid">`），因此我们在源码上做识别，
 * 把 ```mermaid 代码块替换为带 source 的 placeholder div，绕过 marked 解析。
 * 真正的 SVG 渲染在浏览器侧由 `useMermaidRenderer` 负责（动态 import）。
 */
const MERMAID_FENCE_RE = /(^|\n)```mermaid\s*\n([\s\S]*?)\n?```\s*(?=\n|$)/g;

function encodeMermaidSource(src: string): string {
  /* 用 base64 避免 source 里的 HTML / 引号转义 */
  if (typeof btoa === 'function') {
    try {
      return btoa(unescape(encodeURIComponent(src)));
    } catch {
      /* fallthrough */
    }
  }
  return encodeURIComponent(src);
}

function extractMermaidBlocks(src: string): string {
  return src.replace(MERMAID_FENCE_RE, (_, lead: string, body: string) => {
    const encoded = encodeMermaidSource(body);
    return `${lead}\n<div class="ai-mermaid-placeholder" data-mermaid-src="${encoded}">${escapeHtml(body)}</div>\n`;
  });
}

const markedFull = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'language-',
    highlight(code, lang) {
      if (lang && !hljs.getLanguage(lang)) ensureLanguage(lang);
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
      try {
        return hljs.highlight(code, { language, ignoreIllegals: true }).value;
      } catch {
        return hljs.highlightAuto(code).value;
      }
    },
  }),
  { gfm: true, breaks: true },
);

const markedStreamOnly = new Marked({ gfm: true, breaks: true });

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

function toolbarHtml(copyLabel: string, showIde: boolean): string {
  const copy = `<button type="button" class="ai-code-copy" data-copy="true" aria-label="${escapeAttr(copyLabel)}">${escapeHtml(copyLabel)}</button>`;
  const ide = showIde
    ? '<button type="button" class="ai-code-ide" data-ide="true" aria-label="IDE">IDE</button>'
    : '';
  return `<div class="ai-code-toolbar">${copy}${ide}</div>`;
}

function wrapPreBlocks(html: string, copyLabel: string, showIde: boolean): string {
  return html.replace(/<pre(\s[^>]*)?>([\s\S]*?)<\/pre>/gi, (_full, attrs, inner) => {
    const a = attrs ?? '';
    const lineCount = (inner.match(/\n/g)?.length ?? 0) + 1;
    /* 行号使用 CSS counter（见 styles），这里只在需要时挂 data-lineno-count，
       让 CSS 知道总行数（用于固定 gutter 宽度）。逻辑行 ≥ 2 才显示行号，
       避免单行片段被加上多余的「1」前缀。 */
    const wrapClass = lineCount >= 2 ? 'ai-code-wrap ai-code-lineno' : 'ai-code-wrap';
    return `<div class="${wrapClass}" data-line-count="${lineCount}">${toolbarHtml(copyLabel, showIde)}<pre${a}>${inner}</pre></div>`;
  });
}

const PURIFY = {
  ADD_TAGS: ['button', 'mark'],
  ADD_ATTR: [
    'data-ide',
    'data-copy',
    'data-highlighted',
    'data-line-count',
    'data-mermaid-src',
    'aria-label',
    'class',
    'type',
  ],
};

export function useAiMarkdownRenderer(_t: ComputedRef<I18nMessages>, options: AiAssistantOptions) {
  function renderContent(raw: string, copyCodeLabel: string, isStreamingLast: boolean): string {
    const src = raw ?? '';
    if (!src.trim()) {
      return '';
    }

    const ide = Boolean(options.openCodeInIde);
    /* 流式最后一气泡每帧变化，不进缓存，避免缓存膨胀与逐帧淘汰 */
    if (!isStreamingLast) {
      const cacheKey = `${src}\0${copyCodeLabel}\0${ide}`;
      const hit = renderCache.get(cacheKey);
      if (hit !== undefined) {
        renderCache.delete(cacheKey);
        renderCache.set(cacheKey, hit);
        return hit;
      }
    }

    /* 非流式时把 mermaid 围栏先抽走，避免被 marked-highlight 当成普通代码块。
       流式期间不抽：内容尚未闭合，提前替换会渲染半截图谋反而更糟。 */
    const preprocessed = isStreamingLast ? src : extractMermaidBlocks(src);

    let html: string;
    try {
      html = (
        isStreamingLast
          ? markedStreamOnly.parse(preprocessed, { async: false })
          : markedFull.parse(preprocessed, { async: false })
      ) as string;
    } catch {
      html = `<pre class="ai-md-fallback">${escapeHtml(src)}</pre>`;
    }

    html = wrapPreBlocks(html, copyCodeLabel, ide);

    if (isStreamingLast) {
      html += '<span class="ai-stream-caret" aria-hidden="true"></span>';
    }

    html = String(DOMPurify.sanitize(html, PURIFY));

    if (!isStreamingLast) {
      const cacheKey = `${src}\0${copyCodeLabel}\0${ide}`;
      if (renderCache.size >= CACHE_CAP) {
        const k = renderCache.keys().next().value;
        if (k !== undefined) {
          renderCache.delete(k);
        }
      }
      renderCache.set(cacheKey, html);
    }
    return html;
  }

  let lastStreamSrc = '';
  let lastStreamHtml = '';

  /**
   * Optimized streaming render: only re-parses when content changes significantly.
   * For small appends (< 80 chars delta), appends escaped text to avoid full re-parse.
   */
  function renderStreamIncremental(raw: string, copyCodeLabel: string): string {
    const src = raw ?? '';
    if (!src.trim()) return '';

    const delta = src.length - lastStreamSrc.length;
    const ide = Boolean(options.openCodeInIde);

    if (delta > 0 && delta < 80 && src.startsWith(lastStreamSrc) && !src.includes('```')) {
      const appended = src.slice(lastStreamSrc.length);
      const escapedDelta = escapeHtml(appended).replace(/\n/g, '<br>');
      lastStreamSrc = src;
      const caretIdx = lastStreamHtml.lastIndexOf('<span class="ai-stream-caret"');
      let candidate: string;
      if (caretIdx >= 0) {
        candidate =
          lastStreamHtml.slice(0, caretIdx) +
          escapedDelta +
          '<span class="ai-stream-caret" aria-hidden="true"></span>';
      } else {
        candidate = lastStreamHtml + escapedDelta;
      }
      lastStreamHtml = String(DOMPurify.sanitize(candidate, PURIFY));
      return lastStreamHtml;
    }

    lastStreamSrc = src;
    let html: string;
    try {
      html = markedStreamOnly.parse(src, { async: false }) as string;
    } catch {
      html = `<pre class="ai-md-fallback">${escapeHtml(src)}</pre>`;
    }
    html = wrapPreBlocks(html, copyCodeLabel, ide);
    html += '<span class="ai-stream-caret" aria-hidden="true"></span>';
    html = String(DOMPurify.sanitize(html, PURIFY));
    lastStreamHtml = html;
    return html;
  }

  function resetStreamState() {
    lastStreamSrc = '';
    lastStreamHtml = '';
  }

  function clearRenderCache() {
    renderCache.clear();
    resetStreamState();
  }

  return { renderContent, renderStreamIncremental, resetStreamState, clearRenderCache };
}
