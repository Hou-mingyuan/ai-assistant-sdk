import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useStreamWithFallback } from './useStreamWithFallback';

vi.mock('../utils/api', () => ({
  streamChat: vi.fn(),
}));

vi.mock('../utils/wsChat', () => ({
  wsStreamChat: vi.fn(),
}));

import { streamChat } from '../utils/api';
import { wsStreamChat } from '../utils/wsChat';

const mockedStreamChat = vi.mocked(streamChat);
const mockedWsStreamChat = vi.mocked(wsStreamChat);

async function collectAsync(gen: AsyncGenerator<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const c of gen) chunks.push(c);
  return chunks;
}

describe('useStreamWithFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses SSE by default', async () => {
    async function* fakeStream() {
      yield 'hello';
      yield ' world';
    }
    mockedStreamChat.mockReturnValue(fakeStream());

    const { streamWithFallback, preferredProtocol } = useStreamWithFallback();
    const chunks = await collectAsync(
      streamWithFallback('http://test', { action: 'chat', text: 'hi' }),
    );

    expect(chunks).toEqual(['hello', ' world']);
    expect(preferredProtocol.value).toBe('sse');
    expect(mockedWsStreamChat).not.toHaveBeenCalled();
  });

  it('falls back to WS on single SSE error but stays SSE', async () => {
    async function* failingStream(): AsyncGenerator<string> {
      yield* [];
      throw new Error('Failed to fetch');
    }
    async function* wsStream() {
      yield 'ws hello';
    }

    mockedStreamChat.mockReturnValue(failingStream());
    mockedWsStreamChat.mockReturnValue(wsStream());

    const { streamWithFallback, preferredProtocol } = useStreamWithFallback();
    const chunks = await collectAsync(
      streamWithFallback('http://test', { action: 'chat', text: 'hi' }),
    );

    expect(chunks).toEqual(['ws hello']);
    expect(preferredProtocol.value).toBe('sse');
  });

  it('switches to WS after 3 consecutive SSE failures', async () => {
    async function* failingStream(): AsyncGenerator<string> {
      yield* [];
      throw new Error('Failed to fetch');
    }
    async function* wsStream() {
      yield 'ws ok';
    }

    const { streamWithFallback, preferredProtocol } = useStreamWithFallback();
    for (let i = 0; i < 3; i++) {
      mockedStreamChat.mockReturnValue(failingStream());
      mockedWsStreamChat.mockReturnValue(wsStream());
      await collectAsync(streamWithFallback('http://test', { action: 'chat', text: 'hi' }));
    }

    expect(preferredProtocol.value).toBe('ws');
  });

  it('does not fall back on non-connection errors', async () => {
    async function* errorStream(): AsyncGenerator<string> {
      yield* [];
      throw new Error('LLM rate limited');
    }
    mockedStreamChat.mockReturnValue(errorStream());

    const { streamWithFallback } = useStreamWithFallback();
    await expect(
      collectAsync(streamWithFallback('http://test', { action: 'chat', text: 'hi' })),
    ).rejects.toThrow('LLM rate limited');
  });

  it('does not degrade on AbortError', async () => {
    async function* abortStream(): AsyncGenerator<string> {
      yield* [];
      const e = new Error('The operation was aborted');
      e.name = 'AbortError';
      throw e;
    }
    mockedStreamChat.mockReturnValue(abortStream());

    const { streamWithFallback } = useStreamWithFallback();
    await expect(
      collectAsync(streamWithFallback('http://test', { action: 'chat', text: 'hi' })),
    ).rejects.toThrow();
    expect(mockedWsStreamChat).not.toHaveBeenCalled();
  });

  it('uses WS directly after previous fallback', async () => {
    async function* wsStream() {
      yield 'direct ws';
    }
    mockedWsStreamChat.mockReturnValue(wsStream());

    const { streamWithFallback, preferredProtocol } = useStreamWithFallback();
    preferredProtocol.value = 'ws';

    const chunks = await collectAsync(
      streamWithFallback('http://test', { action: 'chat', text: 'hi' }),
    );
    expect(chunks).toEqual(['direct ws']);
    expect(mockedStreamChat).not.toHaveBeenCalled();
  });

  it('resets to SSE when direct WS streaming fails', async () => {
    async function* wsStream(): AsyncGenerator<string> {
      yield* [];
      throw new Error('websocket disconnected');
    }
    mockedWsStreamChat.mockReturnValue(wsStream());

    const { streamWithFallback, preferredProtocol } = useStreamWithFallback();
    preferredProtocol.value = 'ws';

    await expect(
      collectAsync(streamWithFallback('http://test', { action: 'chat', text: 'hi' })),
    ).rejects.toThrow('websocket disconnected');
    expect(preferredProtocol.value).toBe('sse');
  });

  it('falls back to WS when SSE completes without chunks', async () => {
    async function* emptyStream(): AsyncGenerator<string> {
      yield* [];
    }
    async function* wsStream() {
      yield 'ws after empty';
    }

    mockedStreamChat.mockReturnValue(emptyStream());
    mockedWsStreamChat.mockReturnValue(wsStream());

    const { streamWithFallback, preferredProtocol } = useStreamWithFallback();
    const chunks = await collectAsync(
      streamWithFallback('https://api.example.com/chat/ws', { action: 'chat', text: 'hi' }),
    );

    expect(chunks).toEqual(['ws after empty']);
    expect(preferredProtocol.value).toBe('sse');
    expect(mockedWsStreamChat).toHaveBeenCalledWith(
      'wss://api.example.com/chat/ws',
      { action: 'chat', text: 'hi' },
      undefined,
      undefined,
    );
  });

  it('uses an explicit WS URL when provided', async () => {
    async function* failingStream(): AsyncGenerator<string> {
      yield* [];
      throw new TypeError('Network failure');
    }
    async function* wsStream() {
      yield 'explicit ws';
    }

    mockedStreamChat.mockReturnValue(failingStream());
    mockedWsStreamChat.mockReturnValue(wsStream());

    const { streamWithFallback } = useStreamWithFallback('ws://custom.example.com/socket');
    const chunks = await collectAsync(
      streamWithFallback('https://api.example.com/chat', { action: 'chat', text: 'hi' }),
    );

    expect(chunks).toEqual(['explicit ws']);
    expect(mockedWsStreamChat).toHaveBeenCalledWith(
      'ws://custom.example.com/socket',
      { action: 'chat', text: 'hi' },
      undefined,
      undefined,
    );
  });
});
