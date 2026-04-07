/**
 * Highlights a DOM element on the page temporarily (e.g., when AI references it).
 * Adds a pulsing outline and scrolls into view.
 */
const HIGHLIGHT_CLASS = 'ai-dom-highlight'
const HIGHLIGHT_DURATION = 3000
let activeHighlights: { el: HTMLElement; timer: ReturnType<typeof setTimeout> }[] = []

export function highlightElement(selector: string, duration = HIGHLIGHT_DURATION): boolean {
  const el = document.querySelector(selector) as HTMLElement | null
  if (!el) return false

  clearHighlights()

  el.classList.add(HIGHLIGHT_CLASS)
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })

  const timer = setTimeout(() => {
    el.classList.remove(HIGHLIGHT_CLASS)
    activeHighlights = activeHighlights.filter(h => h.el !== el)
  }, duration)

  activeHighlights.push({ el, timer })
  return true
}

export function highlightByText(text: string, duration = HIGHLIGHT_DURATION): boolean {
  if (!text || text.length < 4) return false
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  const needle = text.toLowerCase().trim()
  let node: Node | null
  while ((node = walker.nextNode())) {
    const content = node.textContent?.toLowerCase() || ''
    if (content.includes(needle)) {
      const parent = node.parentElement
      if (parent && !parent.closest('.ai-assistant-wrapper')) {
        return highlightElement(getUniqueSelector(parent), duration)
      }
    }
  }
  return false
}

export function clearHighlights(): void {
  for (const h of activeHighlights) {
    h.el.classList.remove(HIGHLIGHT_CLASS)
    clearTimeout(h.timer)
  }
  activeHighlights = []
}

function getUniqueSelector(el: HTMLElement): string {
  if (el.id) return `#${CSS.escape(el.id)}`
  const path: string[] = []
  let current: HTMLElement | null = el
  while (current && current !== document.body) {
    let seg = current.tagName.toLowerCase()
    if (current.id) {
      path.unshift(`#${CSS.escape(current.id)}`)
      break
    }
    const parent = current.parentElement
    if (parent) {
      const siblings = Array.from(parent.children).filter(c => c.tagName === current!.tagName)
      if (siblings.length > 1) {
        seg += `:nth-of-type(${siblings.indexOf(current) + 1})`
      }
    }
    path.unshift(seg)
    current = current.parentElement
  }
  return path.join(' > ')
}

export function injectHighlightStyles(): void {
  if (document.querySelector('[data-ai-highlight-styles]')) return
  const style = document.createElement('style')
  style.setAttribute('data-ai-highlight-styles', '')
  style.textContent = `
    .${HIGHLIGHT_CLASS} {
      outline: 3px solid #6366f1 !important;
      outline-offset: 4px !important;
      border-radius: 4px !important;
      animation: ai-highlight-pulse 1s ease-in-out 2 !important;
    }
    @keyframes ai-highlight-pulse {
      0%, 100% { outline-color: #6366f1; }
      50% { outline-color: #818cf8; }
    }
  `
  document.head.appendChild(style)
}
