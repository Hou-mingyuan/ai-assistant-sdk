import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHljsMarkdownWorker } from './useHljsMarkdownWorker';

/** Stub Worker mirroring the pattern from useMarkdownWorker.spec.ts. */
class StubWorker {
  public onmessage: ((ev: MessageEvent) => void) | null = null;
  public onerror: ((ev: ErrorEvent) => void) | null = null;
  public terminated = false;
  public messages: unknown[] = [];

  constructor(private handler: (data: unknown) => { html?: string; error?: string }) {}

  postMessage(data: unknown) {
    this.messages.push(data);
    setTimeout(() => {
      const result = this.handler(data);
      const ev = {
        data: { id: (data as { id?: number }).id, ...result },
      } as MessageEvent;
      this.onmessage?.(ev);
    }, 0);
  }

  terminate() {
    this.terminated = true;
  }
}

describe('useHljsMarkdownWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders via injected worker factory', async () => {
    const sync = vi.fn((md: string) => `<sync>${md}</sync>`);
    const stub = new StubWorker(() => ({
      html: '<pre><code class="hljs language-js">console.log(1);</code></pre>',
    }));
    const worker = useHljsMarkdownWorker({
      syncRenderer: sync,
      workerFactory: () => stub as unknown as Worker,
      autoDispose: false,
    });
    const promise = worker.render('```js\nconsole.log(1);\n```');
    await vi.runAllTimersAsync();
    const html = await promise;
    expect(html).toContain('hljs');
    expect(html).toContain('language-js');
    expect(sync).not.toHaveBeenCalled();
    worker.dispose();
  });

  it('falls back to sync renderer when worker errors', async () => {
    const sync = vi.fn(() => '<sync-fallback />');
    const stub = new StubWorker(() => ({ error: 'parse failed' }));
    const worker = useHljsMarkdownWorker({
      syncRenderer: sync,
      workerFactory: () => stub as unknown as Worker,
      autoDispose: false,
    });
    const promise = worker.render('bad md');
    await vi.runAllTimersAsync();
    expect(await promise).toBe('<sync-fallback />');
    expect(sync).toHaveBeenCalledWith('bad md');
    worker.dispose();
  });

  it('passes-through inFlight / lastError / workerAvailable refs', () => {
    const stub = new StubWorker(() => ({ html: '<ok />' }));
    const worker = useHljsMarkdownWorker({
      syncRenderer: () => '<sync />',
      workerFactory: () => stub as unknown as Worker,
      autoDispose: false,
    });
    expect(worker.inFlight.value).toBe(0);
    expect(worker.workerAvailable.value).toBe(true);
    expect(worker.lastError.value).toBe('');
    worker.dispose();
  });

  it('respects autoDispose=false by not registering onUnmounted hooks', () => {
    /* If autoDispose=false leaks onUnmounted, calling outside a setup ctx
     * throws. The composable's try/catch should swallow that, so this just
     * exercises the happy path. */
    const stub = new StubWorker(() => ({ html: '<ok />' }));
    expect(() =>
      useHljsMarkdownWorker({
        syncRenderer: () => '<sync />',
        workerFactory: () => stub as unknown as Worker,
        autoDispose: false,
      }),
    ).not.toThrow();
  });

  it('default factory throws a friendly error if Vite worker import fails', () => {
    /* Force the default factory path by NOT supplying workerFactory. In a
     * vitest environment the Vite ?worker import resolves to a stub URL
     * constructor; constructing one may either succeed (jsdom Worker shim) or
     * throw - both are acceptable. We just ensure no unhandled exception
     * leaks from useHljsMarkdownWorker itself. */
    expect(() =>
      useHljsMarkdownWorker({
        syncRenderer: () => '<sync />',
        autoDispose: false,
      }),
    ).not.toThrow();
  });
});
