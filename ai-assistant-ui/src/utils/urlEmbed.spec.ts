import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  extractHttpUrls,
  isProbablyDirectImageUrl,
  firstNonImageHttpUrl,
  preferHttpsImageUrlWhenPageIsSecure,
} from './urlEmbed';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('extractHttpUrls', () => {
  it('extracts URLs from text', () => {
    const urls = extractHttpUrls('Check https://example.com and http://test.org/page');
    expect(urls).toEqual(['https://example.com', 'http://test.org/page']);
  });

  it('deduplicates URLs', () => {
    const urls = extractHttpUrls('https://a.com https://a.com');
    expect(urls).toHaveLength(1);
  });

  it('returns empty for no URLs', () => {
    expect(extractHttpUrls('no urls here')).toEqual([]);
    expect(extractHttpUrls('')).toEqual([]);
  });
});

describe('isProbablyDirectImageUrl', () => {
  it('detects image extensions', () => {
    expect(isProbablyDirectImageUrl('https://cdn.com/img.png')).toBe(true);
    expect(isProbablyDirectImageUrl('https://cdn.com/photo.jpg')).toBe(true);
    expect(isProbablyDirectImageUrl('https://cdn.com/anim.gif')).toBe(true);
    expect(isProbablyDirectImageUrl('https://cdn.com/pic.webp')).toBe(true);
    expect(isProbablyDirectImageUrl('https://cdn.com/vector.svg?version=1')).toBe(true);
    expect(isProbablyDirectImageUrl('https://cdn.com/image.avif')).toBe(true);
  });

  it('detects image hosts', () => {
    expect(isProbablyDirectImageUrl('https://i.imgur.com/abc123')).toBe(true);
    expect(isProbablyDirectImageUrl('https://raw.githubusercontent.com/acme/repo/main/image')).toBe(
      true,
    );
    expect(isProbablyDirectImageUrl('https://example.com/images/cover')).toBe(true);
  });

  it('rejects non-image URLs', () => {
    expect(isProbablyDirectImageUrl('')).toBe(false);
    expect(isProbablyDirectImageUrl('https://example.com/article')).toBe(false);
    expect(isProbablyDirectImageUrl('https://news.com/page.html')).toBe(false);
    expect(isProbablyDirectImageUrl('not a valid url')).toBe(false);
  });
});

describe('firstNonImageHttpUrl', () => {
  it('skips image URLs', () => {
    const urls = ['https://cdn.com/img.png', 'https://news.com/article'];
    expect(firstNonImageHttpUrl(urls)).toBe('https://news.com/article');
  });

  it('returns undefined when all are images', () => {
    expect(firstNonImageHttpUrl(['https://a.com/x.jpg'])).toBeUndefined();
  });
});

describe('preferHttpsImageUrlWhenPageIsSecure', () => {
  it('upgrades http image URLs on secure pages', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        href: 'https://app.example.com/chat',
      },
    });

    expect(preferHttpsImageUrlWhenPageIsSecure('http://cdn.example.com/image.png')).toBe(
      'https://cdn.example.com/image.png',
    );
  });

  it('keeps http image URLs unchanged on non-secure pages', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'http:',
        href: 'http://localhost:5173/chat',
      },
    });

    expect(preferHttpsImageUrlWhenPageIsSecure('http://cdn.example.com/image.png')).toBe(
      'http://cdn.example.com/image.png',
    );
  });

  it('keeps invalid URLs unchanged', () => {
    vi.stubGlobal('window', {
      location: {
        protocol: 'https:',
        href: 'https://app.example.com/chat',
      },
    });

    expect(preferHttpsImageUrlWhenPageIsSecure('http://[invalid-url')).toBe('http://[invalid-url');
  });
});
