import { describe, it, expect, vi } from 'vitest'
import { computed } from 'vue'
import { useAiMarkdownRenderer } from './useAiMarkdownRenderer'

const t = computed(() => ({
  copyCode: 'Copy',
} as any))

const options = { openCodeInIde: undefined }

describe('useAiMarkdownRenderer', () => {
  const { renderContent, renderStreamIncremental, resetStreamState, clearRenderCache } =
    useAiMarkdownRenderer(t, options)

  it('renders plain text as HTML', () => {
    const html = renderContent('Hello world', 'Copy', false)
    expect(html).toContain('Hello world')
    expect(html).toContain('<p>')
  })

  it('renders markdown bold', () => {
    const html = renderContent('**bold text**', 'Copy', false)
    expect(html).toContain('<strong>bold text</strong>')
  })

  it('renders code blocks with toolbar', () => {
    const html = renderContent('```js\nconsole.log("hi")\n```', 'Copy', false)
    expect(html).toContain('ai-code-wrap')
    expect(html).toContain('ai-code-copy')
    expect(html).toContain('console.log')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(renderContent('   ', 'Copy', false)).toBe('')
    expect(renderContent('', 'Copy', false)).toBe('')
  })

  it('adds stream caret for streaming last', () => {
    const html = renderContent('streaming...', 'Copy', true)
    expect(html).toContain('ai-stream-caret')
  })

  it('does not add caret for non-streaming', () => {
    const html = renderContent('done', 'Copy', false)
    expect(html).not.toContain('ai-stream-caret')
  })

  it('caches non-streaming renders', () => {
    clearRenderCache()
    const first = renderContent('cache test', 'Copy', false)
    const second = renderContent('cache test', 'Copy', false)
    expect(first).toBe(second)
  })

  it('does not cache streaming renders', () => {
    const a = renderContent('stream A', 'Copy', true)
    const b = renderContent('stream B', 'Copy', true)
    expect(a).not.toBe(b)
  })

  it('sanitizes dangerous HTML', () => {
    const html = renderContent('<script>alert(1)</script>', 'Copy', false)
    expect(html).not.toContain('<script>')
  })

  it('renders links in markdown', () => {
    const html = renderContent('[Google](https://google.com)', 'Copy', false)
    expect(html).toContain('href="https://google.com"')
    expect(html).toContain('Google')
  })

  it('renderStreamIncremental handles small appends', () => {
    resetStreamState()
    const first = renderStreamIncremental('Hello', 'Copy')
    expect(first).toContain('Hello')
    const second = renderStreamIncremental('Hello world', 'Copy')
    expect(second).toContain('world')
    expect(second).toContain('ai-stream-caret')
  })

  it('renderStreamIncremental falls back to full parse on code blocks', () => {
    resetStreamState()
    const html = renderStreamIncremental('```js\ncode\n```', 'Copy')
    expect(html).toContain('ai-code-wrap')
  })

  it('clearRenderCache resets everything', () => {
    renderContent('test clear', 'Copy', false)
    clearRenderCache()
    const html = renderContent('test clear', 'Copy', false)
    expect(html).toContain('test clear')
  })
})
