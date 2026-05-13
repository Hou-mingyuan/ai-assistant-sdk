import { describe, it, expect, vi } from 'vitest';
import { useMcpStream, type EventSourceLike } from './useMcpStream';

class FakeEventSource implements EventSourceLike {
  public readonly url: string;
  public readonly listeners = new Map<string, ((ev: { data?: string }) => void)[]>();
  public onerror: ((ev?: unknown) => void) | null = null;
  public onopen: ((ev?: unknown) => void) | null = null;
  public closed = false;
  static instances: FakeEventSource[] = [];

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }

  close(): void {
    this.closed = true;
  }

  addEventListener(type: string, listener: (ev: { data?: string }) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  dispatch(type: string, data: string) {
    for (const fn of this.listeners.get(type) ?? []) {
      fn({ data });
    }
  }
}

describe('useMcpStream', () => {
  it('start() opens an EventSource and marks connected on open', () => {
    FakeEventSource.instances = [];
    const stream = useMcpStream({
      streamEndpoint: '/mcp/stream',
      eventSourceFactory: (url) => new FakeEventSource(url),
    });
    stream.start();
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toBe('/mcp/stream');
    expect(stream.connected.value).toBe(false);
    FakeEventSource.instances[0].onopen?.();
    expect(stream.connected.value).toBe(true);
    stream.stop();
  });

  it('appends token as query parameter when provided', () => {
    FakeEventSource.instances = [];
    const stream = useMcpStream({
      streamEndpoint: '/mcp/stream',
      token: ' abc ',
      eventSourceFactory: (url) => new FakeEventSource(url),
    });
    stream.start();
    expect(FakeEventSource.instances[0].url).toBe('/mcp/stream?token=abc');
    stream.stop();
  });

  it('appends token with & when URL already has a query', () => {
    FakeEventSource.instances = [];
    const stream = useMcpStream({
      streamEndpoint: '/mcp/stream?v=1',
      token: 'xyz',
      eventSourceFactory: (url) => new FakeEventSource(url),
    });
    stream.start();
    expect(FakeEventSource.instances[0].url).toBe('/mcp/stream?v=1&token=xyz');
    stream.stop();
  });

  it('dispatches notification events to registered listeners', () => {
    FakeEventSource.instances = [];
    const stream = useMcpStream({
      streamEndpoint: '/mcp/stream',
      eventSourceFactory: (url) => new FakeEventSource(url),
    });
    const received: unknown[] = [];
    stream.on((n) => received.push(n));
    stream.start();
    FakeEventSource.instances[0].dispatch(
      'notification',
      JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/tools/list_changed',
      }),
    );
    expect(received).toEqual([
      {
        jsonrpc: '2.0',
        method: 'notifications/tools/list_changed',
      },
    ]);
    stream.stop();
  });

  it('ignores malformed JSON payloads silently', () => {
    FakeEventSource.instances = [];
    const stream = useMcpStream({
      streamEndpoint: '/mcp/stream',
      eventSourceFactory: (url) => new FakeEventSource(url),
    });
    const received: unknown[] = [];
    stream.on((n) => received.push(n));
    stream.start();
    FakeEventSource.instances[0].dispatch('notification', '{not-json');
    FakeEventSource.instances[0].dispatch(
      'notification',
      JSON.stringify({ jsonrpc: '1.0', method: 'x' }),
    );
    expect(received).toEqual([]);
    stream.stop();
  });

  it('on() returns an unregister function', () => {
    FakeEventSource.instances = [];
    const stream = useMcpStream({
      streamEndpoint: '/mcp/stream',
      eventSourceFactory: (url) => new FakeEventSource(url),
    });
    const received: unknown[] = [];
    const off = stream.on((n) => received.push(n));
    stream.start();
    off();
    FakeEventSource.instances[0].dispatch(
      'notification',
      JSON.stringify({ jsonrpc: '2.0', method: 'x' }),
    );
    expect(received).toEqual([]);
    stream.stop();
  });

  it('schedules reconnect on EventSource error with exponential backoff', async () => {
    vi.useFakeTimers();
    try {
      FakeEventSource.instances = [];
      const stream = useMcpStream({
        streamEndpoint: '/mcp/stream',
        minBackoffMs: 100,
        maxBackoffMs: 1000,
        backoffFactor: 2,
        eventSourceFactory: (url) => new FakeEventSource(url),
      });
      stream.start();
      FakeEventSource.instances[0].onerror?.();
      expect(stream.connected.value).toBe(false);
      expect(stream.reconnectAttempts.value).toBe(1);
      expect(FakeEventSource.instances).toHaveLength(1);
      vi.advanceTimersByTime(100);
      expect(FakeEventSource.instances).toHaveLength(2);
      FakeEventSource.instances[1].onerror?.();
      vi.advanceTimersByTime(199);
      expect(FakeEventSource.instances).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(FakeEventSource.instances).toHaveLength(3);
      stream.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('stop() cancels pending reconnect and closes the EventSource', () => {
    vi.useFakeTimers();
    try {
      FakeEventSource.instances = [];
      const stream = useMcpStream({
        streamEndpoint: '/mcp/stream',
        minBackoffMs: 100,
        eventSourceFactory: (url) => new FakeEventSource(url),
      });
      stream.start();
      FakeEventSource.instances[0].onerror?.();
      stream.stop();
      vi.advanceTimersByTime(10_000);
      expect(FakeEventSource.instances).toHaveLength(1);
      expect(FakeEventSource.instances[0].closed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
