type Mode = 'translate' | 'summarize' | 'chat'

const TRANSLATE_HINTS = /^(翻译|译|translate|翻成|转为|帮我翻|translate\s+to)/i
const SUMMARIZE_HINTS = /^(摘要|总结|概括|summarize|summary|归纳|提炼|帮我总结)/i
const QUESTION_MARKS = /[?？]\s*$/

const CJK_RANGE = /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/
const LATIN_RANGE = /[a-zA-Z]{3,}/

/**
 * Detects the best mode based on user input text.
 * Returns null if no strong signal (stay in current mode).
 */
export function detectMode(text: string): Mode | null {
  const trimmed = text.trim()
  if (!trimmed || trimmed.length < 2) return null

  if (TRANSLATE_HINTS.test(trimmed)) return 'translate'
  if (SUMMARIZE_HINTS.test(trimmed)) return 'summarize'

  const hasCjk = CJK_RANGE.test(trimmed)
  const hasLatin = LATIN_RANGE.test(trimmed)
  const lines = trimmed.split('\n').filter(l => l.trim())

  if (hasCjk && hasLatin && lines.length <= 3 && trimmed.length < 500) {
    const cjkCount = (trimmed.match(/[\u4e00-\u9fff]/g) || []).length
    const latinCount = (trimmed.match(/[a-zA-Z]/g) || []).length
    const ratio = Math.min(cjkCount, latinCount) / Math.max(cjkCount, latinCount)
    if (ratio > 0.15 && ratio < 0.85) return 'translate'
  }

  if (trimmed.length > 300 && !QUESTION_MARKS.test(trimmed)) {
    return 'summarize'
  }

  if (QUESTION_MARKS.test(trimmed) || trimmed.length < 80) {
    return 'chat'
  }

  return null
}
