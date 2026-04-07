import { describe, it, expect } from 'vitest'
import { augmentMessageWithPageContext } from './pageContextDom'

describe('augmentMessageWithPageContext', () => {
  it('appends context after user text', () => {
    const result = augmentMessageWithPageContext('hello', 'page body text')
    expect(result).toContain('hello')
    expect(result).toContain('page body text')
    expect(result).toContain('--- page context ---')
  })

  it('returns original text when context is empty', () => {
    expect(augmentMessageWithPageContext('hello', '')).toBe('hello')
    expect(augmentMessageWithPageContext('hello', '  ')).toBe('hello')
  })

  it('handles null context', () => {
    expect(augmentMessageWithPageContext('hello', null as any)).toBe('hello')
    expect(augmentMessageWithPageContext('hello', undefined as any)).toBe('hello')
  })
})
