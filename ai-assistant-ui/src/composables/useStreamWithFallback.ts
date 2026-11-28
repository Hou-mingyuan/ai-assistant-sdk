import { ref } from 'vue';
import { streamChat, type ChatPayload, type ChatRuntimeMeta } from '../utils/api';
import { wsStreamChat } from '../utils/wsChat';

type Protocol = 'sse' | 'ws';

export interface StreamWithFallbackOptions {
  wsUrl?: string;
  enableWsFallback?: boolean;
}

/**
 * SSE 优先；若宿主启用了 WebSocket 降级且连接级失败，则自动降级到 WebSocket。
 */
export function useStreamWithFallback(explicitWsUrlOrOpts?: string | StreamWithFallbackOptions) {
  const explicitWsUrl =
    typeof explicitWsUrlOrOpts === 'string' ? explicitWsUrlOrOpts : explicitWsUrlOrOpts?.wsUrl;
  const wsFallbackEnabled =
    typeof explicitWsUrlOrOpts === 'object' && explicitWsUrlOrOpts !== null
      ? explicitWsUrlOrOpts.enableWsFallback !== false
      : true;
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
    onMeta?: (meta: ChatRuntimeMeta) => void,
    tenantId?: string,
  ): AsyncGenerator<string> {
    if (!wsFallbackEnabled) {
      const stream = tenantId
        ? streamChat(baseUrl, payload, token, signal, onMeta, tenantId)
        : streamChat(baseUrl, payload, token, signal, onMeta);
      yield* stream;
      return;
    }

    if (tenantId && preferredProtocol.value === 'ws') {
      preferredProtocol.value = 'sse';
      sseFailCount = 0;
    }

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
      const stream = tenantId
        ? streamChat(baseUrl, payload, token, signal, onMeta, tenantId)
        : streamChat(baseUrl, payload, token, signal, onMeta);
      for await (const chunk of stream) {
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

    if (tenantId) {
      throw new Error('SSE failed; WebSocket fallback cannot preserve X-Tenant-Id');
    }

    sseFailCount++;
    if (sseFailCount >= SSE_RETRY_THRESHOLD) {
      preferredProtocol.value = 'ws';
    }
    try {
      yield* wsStreamChat(deriveWsUrl(baseUrl), payload, token, signal);
    } catch (wsError) {
      // Design v2 hardening: the WS endpoint can be absent (e.g. hosts that
      // never enabled websocket) or blocked by proxies. Falling back to a
      // fresh SSE attempt avoids a dead end where both transports fail and
      // the user only sees a raw protocol error.
      if (signal?.aborted) throw wsError;
      if (!isConnectionError(wsError)) throw wsError;
      preferredProtocol.value = 'sse';
      sseFailCount = 0;
      yield* streamChat(baseUrl, payload, token, signal, onMeta);
    }
  }

  return { preferredProtocol, streamWithFallback };
}
