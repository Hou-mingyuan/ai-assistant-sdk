import type { ComputedRef } from 'vue'
import { Marked, marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from '../utils/hljsRegistered'
import DOMPurify from 'dompurify'
import type { AiAssistantOptions } from '../index'
import type { I18nMessages } from '../utils/i18n'

const renderCache = new Map<string, string>()
const CACHE_CAP = 250

marked.use(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'language-',
    highlight(code, lang) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      try {
        return hljs.highlight(code, { language: language, ignoreIllegals: true }).value
      } catch {
        return hljs.highlightAuto(code).value
      }
    },
  }),
)

marked.setOptions({
  gfm: true,
  breaks: true,
})

/** 流式最后一泡每帧刷新：不用 highlight.js，减轻 CPU（落字结束后走完整 marked + 高亮并进缓存） */
const markedStreamOnly = new Marked()
markedStreamOnly.setOptions({ gfm: true, breaks: true })

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, '&#39;')
}

function toolbarHtml(copyLabel: string, showIde: boolean): string {
  const copy = `<button type="button" class="ai-code-copy" data-copy="true" aria-label="${escapeAttr(copyLabel)}">${escapeHtml(copyLabel)}</button>`
  const ide = showIde
    ? '<button type="button" class="ai-code-ide" data-ide="true" aria-label="IDE">IDE</button>'
    : ''
  return `<div class="ai-code-toolbar">${copy}${ide}</div>`
}

function wrapPreBlocks(html: string, copyLabel: string, showIde: boolean): string {
  return html.replace(/<pre(\s[^>]*)?>([\s\S]*?)<\/pre>/gi, (_full, attrs, inner) => {
    const a = attrs ?? ''
    return `<div class="ai-code-wrap">${toolbarHtml(copyLabel, showIde)}<pre${a}>${inner}</pre></div>`
  })
}

const PURIFY = {
  ADD_TAGS: ['button'],
  ADD_ATTR: ['data-ide', 'data-copy', 'data-highlighted', 'aria-label', 'class', 'type'],
}

export function useAiMarkdownRenderer(
  _t: ComputedRef<I18nMessages>,
  options: AiAssistantOptions,
) {
  function renderContent(raw: string, copyCodeLabel: string, isStreamingLast: boolean): string {
    const src = raw ?? ''
    if (!src.trim()) {
      return ''
    }

    const ide = Boolean(options.openCodeInIde)
    /* 流式最后一气泡每帧变化，不进缓存，避免缓存膨胀与逐帧淘汰 */
    if (!isStreamingLast) {
      const cacheKey = `${src}\0${copyCodeLabel}\0${ide}`
      const hit = renderCache.get(cacheKey)
      if (hit !== undefined) {
        renderCache.delete(cacheKey)
        renderCache.set(cacheKey, hit)
        return hit
      }
    }

    let html: string
    try {
      html = (isStreamingLast
        ? markedStreamOnly.parse(src, { async: false })
        : marked.parse(src, { async: false })) as string
    } catch {
      html = `<pre class="ai-md-fallback">${escapeHtml(src)}</pre>`
    }

    html = wrapPreBlocks(html, copyCodeLabel, ide)

    if (isStreamingLast) {
      html += '<span class="ai-stream-caret" aria-hidden="true"></span>'
    }

    html = String(DOMPurify.sanitize(html, PURIFY))

    if (!isStreamingLast) {
      const cacheKey = `${src}\0${copyCodeLabel}\0${ide}`
      if (renderCache.size >= CACHE_CAP) {
        const k = renderCache.keys().next().value
        if (k !== undefined) {
          renderCache.delete(k)
        }
      }
      renderCache.set(cacheKey, html)
    }
    return html
  }

  let lastStreamSrc = ''
  let lastStreamHtml = ''

  /**
   * Optimized streaming render: only re-parses when content changes significantly.
   * For small appends (< 80 chars delta), appends escaped text to avoid full re-parse.
   */
  function renderStreamIncremental(raw: string, copyCodeLabel: string): string {
    const src = raw ?? ''
    if (!src.trim()) return ''

    const delta = src.length - lastStreamSrc.length
    const ide = Boolean(options.openCodeInIde)

    if (delta > 0 && delta < 80 && src.startsWith(lastStreamSrc) && !src.includes('```')) {
      const appended = src.slice(lastStreamSrc.length)
      const escapedDelta = escapeHtml(appended).replace(/\n/g, '<br>')
      lastStreamSrc = src
      const caretIdx = lastStreamHtml.lastIndexOf('<span class="ai-stream-caret"')
      if (caretIdx >= 0) {
        lastStreamHtml = lastStreamHtml.slice(0, caretIdx) + escapedDelta +
          '<span class="ai-stream-caret" aria-hidden="true"></span>'
      } else {
        lastStreamHtml += escapedDelta
      }
      return lastStreamHtml
    }

    lastStreamSrc = src
    let html: string
    try {
      html = markedStreamOnly.parse(src, { async: false }) as string
    } catch {
      html = `<pre class="ai-md-fallback">${escapeHtml(src)}</pre>`
    }
    html = wrapPreBlocks(html, copyCodeLabel, ide)
    html += '<span class="ai-stream-caret" aria-hidden="true"></span>'
    html = String(DOMPurify.sanitize(html, PURIFY))
    lastStreamHtml = html
    return html
  }

  function resetStreamState() {
    lastStreamSrc = ''
    lastStreamHtml = ''
  }

  function clearRenderCache() {
    renderCache.clear()
    resetStreamState()
  }

  return { renderContent, renderStreamIncremental, resetStreamState, clearRenderCache }
}
