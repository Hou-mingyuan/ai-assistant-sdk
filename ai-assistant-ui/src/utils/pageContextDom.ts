export type PageContextBlock = { selector: string; label?: string }

/**
 * 按选择器抓取页面区块 innerText，拼接后截断到 maxChars（≤0 时不截断）。
 */
export function collectPageContextText(
  blocks: PageContextBlock[] | undefined,
  maxChars: number,
): string {
  if (!blocks?.length || typeof document === 'undefined') {
    return ''
  }
  const parts: string[] = []
  for (const b of blocks) {
    if (!b?.selector?.trim()) continue
    try {
      const el = document.querySelector(b.selector)
      if (!el) continue
      /* 克隆后去掉助手挂载点与悬浮球 DOM，避免宿主把组件放在同一容器内时把面板/对话拼进「页面」 */
      const clone = el.cloneNode(true) as HTMLElement
      clone.querySelectorAll('[data-ai-assistant-auto-mount]').forEach((n) => n.remove())
      clone.querySelectorAll('.ai-assistant-wrapper').forEach((n) => n.remove())
      const t = clone.innerText?.trim() || ''
      if (!t) continue
      const label = b.label?.trim() ? `${b.label!.trim()}:\n` : ''
      parts.push(label + t)
    } catch {
      continue
    }
  }
  let out = parts.join('\n\n---\n\n')
  if (maxChars > 0 && out.length > maxChars) {
    out = out.slice(0, maxChars) + '…'
  }
  return out
}

/**
 * 将页面正文块拼在用户消息之后，供模型使用。
 */
export function augmentMessageWithPageContext(userText: string, ctx: string): string {
  const c = ctx?.trim()
  if (!c) {
    return userText
  }
  return `${userText}\n\n--- page context ---\n${c}`
}

/**
 * 依次尝试 main → [role=main] → article → #app；克隆节点并移除助手相关 DOM，再取 innerText。
 */
export function collectSmartPageContextText(maxChars: number): string {
  if (typeof document === 'undefined') {
    return ''
  }
  const selectors = ['main', '[role="main"]', 'article', '#app']
  for (const sel of selectors) {
    const root = document.querySelector(sel) as HTMLElement | null
    if (!root) continue
    const clone = root.cloneNode(true) as HTMLElement
    clone.querySelectorAll('[data-ai-assistant-auto-mount]').forEach((n) => n.remove())
    clone.querySelector('.ai-assistant-wrapper')?.remove()

    let text = clone.innerText?.replace(/\s+/g, ' ').trim() || ''
    if (text.length < 80) {
      continue
    }
    if (maxChars > 0 && text.length > maxChars) {
      text = text.slice(0, maxChars) + '…'
    }
    return text
  }
  return ''
}
