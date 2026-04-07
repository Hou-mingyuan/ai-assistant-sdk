import { describe, it, expect } from 'vitest'
import { detectMode } from './smartModeDetect'

describe('detectMode', () => {
  it('returns null for empty/short input', () => {
    expect(detectMode('')).toBeNull()
    expect(detectMode('a')).toBeNull()
  })

  it('detects translate keywords', () => {
    expect(detectMode('翻译这段话')).toBe('translate')
    expect(detectMode('Translate to English')).toBe('translate')
    expect(detectMode('帮我翻一下')).toBe('translate')
  })

  it('detects summarize keywords', () => {
    expect(detectMode('摘要这篇文章')).toBe('summarize')
    expect(detectMode('Summarize the report')).toBe('summarize')
    expect(detectMode('总结一下要点')).toBe('summarize')
  })

  it('detects CJK-Latin mixed as translate', () => {
    expect(detectMode('这个 function 怎么用')).toBe('translate')
  })

  it('detects long text without question as summarize', () => {
    const longText = '这是一段很长的文字。'.repeat(40)
    expect(detectMode(longText)).toBe('summarize')
  })

  it('detects question mark as chat', () => {
    expect(detectMode('什么是机器学习？')).toBe('chat')
  })

  it('detects short text as chat', () => {
    expect(detectMode('你好呀')).toBe('chat')
  })

  it('returns null for medium-length non-question text', () => {
    const medium = '这是一段中等长度的文字，没有问号结尾。'.repeat(3)
    expect(detectMode(medium)).toBeNull()
  })
})
