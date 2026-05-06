import { ref } from 'vue';
import { streamChat, type ChatPayload } from '../utils/api';
import { wsStreamChat } from '../utils/wsChat';

type Protocol = 'sse' | 'ws';

/**
 * SSE 优先，连接级失败后自动降级到 WebSocket。
 * 一旦降级成功，后续请求持续使用 WS（直到页面刷新重置）。
 * @param explicitWsUrl 可选：显式指定 WS 端点 URL，省略时从 baseUrl 推导
 */
export function useStreamWithFallback(explicitWsUrl?: string) {
  const preferredProtocol = ref<Protocol>('sse');

  function deriveWsUrl(baseUrl: string): string {
    if (explicitWsUrl) return explicitWsUrl;
    const u = new URL(baseUrl, window.location.href);
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
    if (!u.pathname.endsWith('/ws')) {
      u.pathname = u.pathname.replace(/\/?$/, '/ws');
    }
    return u.toString();
  }

  let sseFailCount = 0;
  const SSE_RETRY_THRESHOLD = 3;

  function isConnectionError(e: unknown): boolean {
    if (!(e instanceof Error)) return false;
    if (e.name === 'AbortError') return false;
    const msg = e.message.toLowerCase();
    if (msg.includes('abort')) return false;
    return (
      msg.includes('failed to fetch') ||
      msg.includes('network') ||
      e instanceof TypeError ||
      msg.includes('connection') ||
      /^http\s+5\d\d/.test(msg)
    );
  }

  async function* streamWithFallback(
    baseUrl: string,
    payload: ChatPayload,
    token?: string,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    if (preferredProtocol.value === 'ws') {
      try {
        yield* wsStreamChat(deriveWsUrl(baseUrl), payload, token, signal);
        return;
      } catch (e) {
        preferredProtocol.value = 'sse';
        sseFailCount = 0;
        throw e;
      }
    }

    try {
      let gotChunk = false;
      for await (const chunk of streamChat(baseUrl, payload, token, signal)) {
        gotChunk = true;
        yield chunk;
      }
      if (gotChunk) {
        sseFailCount = 0;
        return;
      }
    } catch (e) {
      if (signal?.aborted) throw e;
      if (!isConnectionError(e)) throw e;
    }

    if (signal?.aborted) return;

    sseFailCount++;
    if (sseFailCount >= SSE_RETRY_THRESHOLD) {
      preferredProtocol.value = 'ws';
    }
    yield* wsStreamChat(deriveWsUrl(baseUrl), payload, token, signal);
  }

  return { preferredProtocol, streamWithFallback };
}
