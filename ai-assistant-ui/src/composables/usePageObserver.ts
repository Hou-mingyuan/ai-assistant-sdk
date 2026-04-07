import { ref, onMounted, onUnmounted, type Ref } from 'vue'

/**
 * Monitors the host page for significant content changes using MutationObserver.
 * Exposes a `pageChanged` flag that resets after being consumed.
 */
export function usePageObserver(
  rootSelector = 'main, [role="main"], article, #app',
  debounceMs = 2000,
) {
  const pageChanged = ref(false)
  const lastSnapshot = ref('')
  let observer: MutationObserver | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function takeSnapshot(root: Element): string {
    const clone = root.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.ai-assistant-wrapper, [data-ai-assistant-auto-mount], script, style')
      .forEach(n => n.remove())
    return (clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 5000)
  }

  function checkForChanges(root: Element) {
    const current = takeSnapshot(root)
    if (lastSnapshot.value && current !== lastSnapshot.value) {
      const diff = Math.abs(current.length - lastSnapshot.value.length)
      if (diff > 50 || levenshteinApprox(current.slice(0, 200), lastSnapshot.value.slice(0, 200)) > 20) {
        pageChanged.value = true
      }
    }
    lastSnapshot.value = current
  }

  function levenshteinApprox(a: string, b: string): number {
    if (a === b) return 0
    let diff = 0
    const len = Math.min(a.length, b.length)
    for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) diff++
    }
    return diff + Math.abs(a.length - b.length)
  }

  function consumeChange(): boolean {
    const changed = pageChanged.value
    pageChanged.value = false
    return changed
  }

  onMounted(() => {
    const selectors = rootSelector.split(',').map(s => s.trim())
    let root: Element | null = null
    for (const sel of selectors) {
      root = document.querySelector(sel)
      if (root) break
    }
    if (!root) return

    lastSnapshot.value = takeSnapshot(root)

    observer = new MutationObserver(() => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        if (root) checkForChanges(root)
      }, debounceMs)
    })

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  })

  onUnmounted(() => {
    if (observer) { observer.disconnect(); observer = null }
    if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
  })

  return { pageChanged, consumeChange }
}
