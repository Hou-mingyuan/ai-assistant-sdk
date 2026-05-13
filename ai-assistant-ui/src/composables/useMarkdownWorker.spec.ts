import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMarkdownWorker } from './useMarkdownWorker';

/** Stub Worker that runs synchronously in the same thread for testing. */
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

describe('useMarkdownWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders via worker when available', async () => {
    const sync = vi.fn((md: string) => `<sync>${md}</sync>`);
    const stub = new StubWorker(() => ({ html: '<worker>output</worker>' }));
    const worker = useMarkdownWorker({
      syncRenderer: sync,
      workerFactory: () => stub as unknown as Worker,
      autoDispose: false,
    });
    const promise = worker.render('# hi');
    await vi.runAllTimersAsync();
    const html = await promise;
    expect(html).toBe('<worker>output</worker>');
    expect(sync).not.toHaveBeenCalled();
    worker.dispose();
  });

  it('falls back to sync renderer when worker reports an error', async () => {
    const sync = vi.fn((md: string) => `<sync>${md}</sync>`);
    const stub = new StubWorker(() => ({ error: 'parse failed' }));
    const worker = useMarkdownWorker({
      syncRenderer: sync,
      workerFactory: () => stub as unknown as Worker,
      autoDispose: false,
    });
    const promise = worker.render('# bad');
    await vi.runAllTimersAsync();
    const html = await promise;
    expect(sync).toHaveBeenCalledWith('# bad');
    expect(html).toBe('<sync># bad</sync>');
    worker.dispose();
  });

  it('falls back to sync on timeout', async () => {
    const sync = vi.fn(() => '<timeout-fallback />');
    /* Use a stub that never replies. */
    const stub = new StubWorker(() => ({}));
    stub.postMessage = vi.fn(); /* swallow the message, no onmessage will fire */

    const worker = useMarkdownWorker({
      syncRenderer: sync,
      workerFactory: () => stub as unknown as Worker,
      timeoutMs: 100,
      autoDispose: false,
    });
    const promise = worker.render('foo');
    vi.advanceTimersByTime(150);
    const html = await promise;
    expect(html).toBe('<timeout-fallback />');
    worker.dispose();
  });

  it('falls back to sync when Worker is not defined', async () => {
    vi.useRealTimers();
    const sync = vi.fn(() => '<no-worker />');
    /* workerFactory returning a Worker that throws on construction simulates
     * "Worker unavailable" path. */
    const factory = vi.fn(() => {
      throw new Error('no Worker');
    });
    const worker = useMarkdownWorker({
      syncRenderer: sync,
      workerFactory: factory as unknown as () => Worker,
      autoDispose: false,
    });
    const html = await worker.render('x');
    expect(sync).toHaveBeenCalled();
    expect(html).toBe('<no-worker />');
    worker.dispose();
  });

  it('dispose() terminates the worker and rejects in-flight requests', async () => {
    const sync = vi.fn(() => '<sync />');
    const stub = new StubWorker(() => ({}));
    stub.postMessage = vi.fn();
    const worker = useMarkdownWorker({
      syncRenderer: sync,
      workerFactory: () => stub as unknown as Worker,
      autoDispose: false,
    });
    const promise = worker.render('x');
    worker.dispose();
    await expect(promise).rejects.toThrow('worker disposed');
    expect(stub.terminated).toBe(true);
  });

  it('inFlight counter goes up and back to zero', async () => {
    const sync = vi.fn(() => '<x />');
    const stub = new StubWorker(() => ({ html: '<ok />' }));
    const worker = useMarkdownWorker({
      syncRenderer: sync,
      workerFactory: () => stub as unknown as Worker,
      autoDispose: false,
    });
    const promise = worker.render('y');
    expect(worker.inFlight.value).toBe(1);
    await vi.runAllTimersAsync();
    await promise;
    expect(worker.inFlight.value).toBe(0);
    worker.dispose();
  });
});
