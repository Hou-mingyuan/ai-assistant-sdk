/**
 * useMarkdownWorker
 * -----------------
 * Off-main-thread Markdown rendering via Web Worker.
 *
 * Why this exists:
 *   Markdown rendering during SSE streaming is one of the heaviest per-chunk
 *   operations: marked + highlight.js together can take 5-15ms per render
 *   for non-trivial messages. On every stream chunk this blocks the main
 *   thread, eating into the 16.67ms frame budget and producing jank.
 *
 *   This composable shifts the marked() call into a Web Worker so the main
 *   thread can keep painting at 60FPS during streaming. DOMPurify still runs
 *   on the main thread (it needs DOM access), but it's much cheaper than
 *   marked + hljs.
 *
 * Architecture:
 *   - The worker script is constructed from a Blob URL at first use so we
 *     don't need build-time worker config. The host can override with a
 *     custom workerFactory if they want bundled hljs in the worker.
 *   - Request/response correlation via numeric ID.
 *   - Timeout fallback: if worker takes > timeoutMs, sync renderer (main
 *     thread) handles the request to avoid hangs.
 *   - Worker disposal on unmount (caller responsibility via dispose()).
 *
 * Usage:
 *
 * ```ts
 * import { marked } from 'marked';
 * const worker = useMarkdownWorker({
 *   syncRenderer: (md) => marked.parse(md),
 * });
 *
 * const html = await worker.render(markdownText);
 * onUnmounted(worker.dispose);
 * ```
 *
 * The default worker can render plain CommonMark (no highlighting). If the
 * host has heavy hljs needs, supply `workerFactory` returning a Worker that
 * imports the hljs bundle and exposes the same message protocol.
 */

import { ref, onUnmounted, type Ref } from 'vue';

export interface UseMarkdownWorkerOptions {
  /** Sync fallback renderer for when the worker is unavailable or times out. */
  syncRenderer: (markdown: string) => string;
  /** Custom worker factory; default constructs a Blob-URL worker. */
  workerFactory?: () => Worker;
  /** Max ms before falling back to sync. Default 2000. */
  timeoutMs?: number;
  /** Auto-dispose the worker on Vue unmount (default true). */
  autoDispose?: boolean;
}

interface InflightRequest {
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
  timeoutHandle: ReturnType<typeof setTimeout>;
  markdown: string;
}

/** Inline worker code as a string. Built into a Blob URL on first use. */
const DEFAULT_WORKER_SOURCE = `
self.onmessage = (event) => {
  const { id, markdown } = event.data || {};
  if (typeof markdown !== 'string') {
    self.postMessage({ id, error: 'invalid input' });
    return;
  }
  try {
    /* Minimal Markdown -> HTML transform: headings, bold, italic, code,
     * links, lists, paragraphs. Real implementations should ship 'marked'
     * via workerFactory; this default is just to demonstrate the pattern
     * and provide a graceful degradation when the host hasn't supplied a
     * full renderer. */
    let html = markdown;
    /* Escape HTML first */
    html = html.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    /* Fenced code blocks */
    html = html.replace(/\`\`\`([^\\n]*)\\n([\\s\\S]*?)\`\`\`/g, (_m, lang, code) => {
      const langClass = lang ? ' class="language-' + lang.trim() + '"' : '';
      return '<pre><code' + langClass + '>' + code + '</code></pre>';
    });
    /* Inline code */
    html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    /* Headings */
    html = html.replace(/^(\\#{1,6})\\s+(.+)$/gm, (_m, hashes, text) => {
      const n = hashes.length;
      return '<h' + n + '>' + text + '</h' + n + '>';
    });
    /* Bold */
    html = html.replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>');
    /* Italic */
    html = html.replace(/(^|[^*])\\*([^*]+)\\*/g, '$1<em>$2</em>');
    /* Links */
    html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2">$1</a>');
    /* Paragraphs - wrap non-block lines */
    html = html
      .split(/\\n{2,}/)
      .map((para) => {
        if (/^<(h\\d|pre|ul|ol|blockquote)/.test(para.trim())) return para;
        return '<p>' + para.replace(/\\n/g, '<br />') + '</p>';
      })
      .join('\\n');
    self.postMessage({ id, html });
  } catch (e) {
    self.postMessage({ id, error: String(e && e.message ? e.message : e) });
  }
};
`;

let blobUrlCache: string | null = null;

function defaultWorkerFactory(): Worker {
  if (typeof Worker === 'undefined') {
    throw new Error('Web Worker is not available in this runtime');
  }
  if (!blobUrlCache) {
    const blob = new Blob([DEFAULT_WORKER_SOURCE], { type: 'application/javascript' });
    blobUrlCache = URL.createObjectURL(blob);
  }
  return new Worker(blobUrlCache);
}

export function useMarkdownWorker(opts: UseMarkdownWorkerOptions) {
  const timeoutMs = Math.max(100, opts.timeoutMs ?? 2000);
  const inFlight = ref(0) as Ref<number>;
  const lastError = ref<string>('') as Ref<string>;
  /* If a custom factory is supplied, trust the host and assume the worker
   * is constructible (e.g. test stubs, polyfills). Only consult typeof
   * Worker when using the default Blob-URL factory. */
  const workerAvailable = ref(
    opts.workerFactory != null || typeof Worker !== 'undefined',
  ) as Ref<boolean>;

  let worker: Worker | null = null;
  let nextId = 1;
  const pending = new Map<number, InflightRequest>();

  function ensureWorker(): Worker | null {
    if (worker) return worker;
    try {
      const w = (opts.workerFactory ?? defaultWorkerFactory)();
      w.onmessage = (event: MessageEvent) => {
        const { id, html, error } = event.data || {};
        const req = pending.get(id);
        if (!req) return;
        pending.delete(id);
        clearTimeout(req.timeoutHandle);
        inFlight.value = Math.max(0, inFlight.value - 1);
        if (error) {
          /* Worker reported error: degrade to sync. */
          try {
            req.resolve(opts.syncRenderer(req.markdown));
          } catch (e) {
            req.reject(e);
          }
        } else if (typeof html === 'string') {
          req.resolve(html);
        } else {
          req.reject(new Error('Invalid worker response'));
        }
      };
      w.onerror = (ev) => {
        lastError.value = ev.message || 'worker error';
        workerAvailable.value = false;
        /* Fall back: degrade in-flight requests to sync renderer. */
        for (const [, req] of pending) {
          clearTimeout(req.timeoutHandle);
          try {
            req.resolve(opts.syncRenderer(req.markdown));
          } catch (e) {
            req.reject(e);
          }
        }
        pending.clear();
        inFlight.value = 0;
        worker = null;
      };
      worker = w;
      return w;
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e);
      workerAvailable.value = false;
      return null;
    }
  }

  function render(markdown: string): Promise<string> {
    if (!workerAvailable.value) {
      /* Worker unavailable from the start. Run sync inline (no Promise.race
       * cost). */
      return Promise.resolve().then(() => opts.syncRenderer(markdown));
    }
    const w = ensureWorker();
    if (!w) {
      return Promise.resolve().then(() => opts.syncRenderer(markdown));
    }

    return new Promise<string>((resolve, reject) => {
      const id = nextId++;
      const timeoutHandle = setTimeout(() => {
        if (!pending.has(id)) return;
        pending.delete(id);
        inFlight.value = Math.max(0, inFlight.value - 1);
        /* Worker took too long -- degrade to sync rather than hang forever. */
        try {
          resolve(opts.syncRenderer(markdown));
        } catch (e) {
          reject(e);
        }
      }, timeoutMs);
      pending.set(id, { resolve, reject, timeoutHandle, markdown });
      inFlight.value += 1;
      try {
        w.postMessage({ id, markdown });
      } catch (e) {
        pending.delete(id);
        clearTimeout(timeoutHandle);
        inFlight.value = Math.max(0, inFlight.value - 1);
        try {
          resolve(opts.syncRenderer(markdown));
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  function dispose() {
    if (worker) {
      worker.terminate();
      worker = null;
    }
    for (const [, req] of pending) {
      clearTimeout(req.timeoutHandle);
      req.reject(new Error('worker disposed'));
    }
    pending.clear();
    inFlight.value = 0;
  }

  if (opts.autoDispose !== false) {
    try {
      onUnmounted(dispose);
    } catch {
      /* outside of a component setup; ignore */
    }
  }

  return {
    render,
    dispose,
    inFlight: inFlight as Readonly<Ref<number>>,
    lastError: lastError as Readonly<Ref<string>>,
    workerAvailable: workerAvailable as Readonly<Ref<boolean>>,
  };
}
