import { describe, it, expect } from 'vitest'
import {
  extractHttpUrls,
  isProbablyDirectImageUrl,
  firstNonImageHttpUrl,
} from './urlEmbed'

describe('extractHttpUrls', () => {
  it('extracts URLs from text', () => {
    const urls = extractHttpUrls('Check https://example.com and http://test.org/page')
    expect(urls).toEqual(['https://example.com', 'http://test.org/page'])
  })

  it('deduplicates URLs', () => {
    const urls = extractHttpUrls('https://a.com https://a.com')
    expect(urls).toHaveLength(1)
  })

  it('returns empty for no URLs', () => {
    expect(extractHttpUrls('no urls here')).toEqual([])
    expect(extractHttpUrls('')).toEqual([])
  })
})

describe('isProbablyDirectImageUrl', () => {
  it('detects image extensions', () => {
    expect(isProbablyDirectImageUrl('https://cdn.com/img.png')).toBe(true)
    expect(isProbablyDirectImageUrl('https://cdn.com/photo.jpg')).toBe(true)
    expect(isProbablyDirectImageUrl('https://cdn.com/anim.gif')).toBe(true)
    expect(isProbablyDirectImageUrl('https://cdn.com/pic.webp')).toBe(true)
  })

  it('detects image hosts', () => {
    expect(isProbablyDirectImageUrl('https://i.imgur.com/abc123')).toBe(true)
  })

  it('rejects non-image URLs', () => {
    expect(isProbablyDirectImageUrl('https://example.com/article')).toBe(false)
    expect(isProbablyDirectImageUrl('https://news.com/page.html')).toBe(false)
  })
})

describe('firstNonImageHttpUrl', () => {
  it('skips image URLs', () => {
    const urls = ['https://cdn.com/img.png', 'https://news.com/article']
    expect(firstNonImageHttpUrl(urls)).toBe('https://news.com/article')
  })

  it('returns undefined when all are images', () => {
    expect(firstNonImageHttpUrl(['https://a.com/x.jpg'])).toBeUndefined()
  })
})
