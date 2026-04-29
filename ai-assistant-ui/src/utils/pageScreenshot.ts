/**
 * Captures the visible viewport or a specific element as a base64 PNG.
 * Uses native Canvas API with html2canvas (dynamically loaded if available).
 * Falls back to a text snapshot if html2canvas is not installed.
 */
export async function captureScreenshot(
  target?: HTMLElement | null,
): Promise<{ type: 'image'; data: string } | { type: 'text'; data: string }> {
  const el = target || document.body;

  const h2c = await loadHtml2Canvas();
  if (h2c) {
    try {
      const canvas = await h2c(el, {
        useCORS: true,
        allowTaint: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        logging: false,
        width: Math.min(el.scrollWidth, 1920),
        height: Math.min(el.scrollHeight, 4096),
      });
      const dataUrl = canvas.toDataURL('image/png', 0.85);
      return { type: 'image', data: dataUrl };
    } catch {
      return { type: 'text', data: extractVisibleText(el) };
    }
  }

  return { type: 'text', data: extractVisibleText(el) };
}

function extractVisibleText(el: HTMLElement): string {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('script, style, noscript').forEach((n) => n.remove());
  clone
    .querySelectorAll('.ai-assistant-wrapper, [data-ai-assistant-auto-mount]')
    .forEach((n) => n.remove());
  return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 24000);
}

type Html2CanvasFn = (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement>;
let cachedH2c: Html2CanvasFn | null | false = null;

async function loadHtml2Canvas(): Promise<Html2CanvasFn | null> {
  if (cachedH2c === false) return null;
  if (cachedH2c) return cachedH2c;
  try {
    const mod = await import('html2canvas');
    const fn = (mod.default || mod) as Html2CanvasFn;
    if (typeof fn === 'function') {
      cachedH2c = fn;
      return fn;
    }
  } catch {
    cachedH2c = false;
  }
  return null;
}

export function isHtml2CanvasAvailable(): boolean {
  return cachedH2c !== false;
}
