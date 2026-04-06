const URL_IN_TEXT = /https?:\/\/[^\s<>[\]"'()`]+/gi

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif)(\?[^#\s]*)?$/i

/** 常见于直链图床 / CDN 路径特征（启发式，非严谨） */
const IMAGE_HOST_HINT =
  /imgur\.com|i\.imgur|ibb\.co|raw\.githubusercontent\.com|\/image\/|\/images\//i

export function extractHttpUrls(text: string): string[] {
  if (!text) {
    return []
  }
  const m = text.match(URL_IN_TEXT)
  if (!m?.length) {
    return []
  }
  return [...new Set(m)]
}

export function isProbablyDirectImageUrl(url: string): boolean {
  if (!url) {
    return false
  }
  if (IMAGE_EXT.test(url)) {
    return true
  }
  if (IMAGE_HOST_HINT.test(url)) {
    return true
  }
  try {
    const p = new URL(url).pathname
    return IMAGE_EXT.test(p)
  } catch {
    return false
  }
}

export function firstNonImageHttpUrl(urls: string[]): string | undefined {
  for (const u of urls) {
    if (!isProbablyDirectImageUrl(u)) {
      return u
    }
  }
  return undefined
}

/** 页面为 https 时，将 http 图片链升级为 https，减少混内容拦截。 */
export function preferHttpsImageUrlWhenPageIsSecure(url: string): string {
  if (typeof window === 'undefined' || window.location.protocol !== 'https:') {
    return url
  }
  try {
    const u = new URL(url, window.location.href)
    if (u.protocol === 'http:') {
      u.protocol = 'https:'
      return u.href
    }
  } catch {
    /* ignore */
  }
  return url
}
