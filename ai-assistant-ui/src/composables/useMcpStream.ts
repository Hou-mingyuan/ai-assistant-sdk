/**
 * useMcpStream
 * ------------
 * MCP server 通知通道（SSE / EventSource 实现），配合 `useMcpClient` 的请求-响应
 * 通道使用。
 *
 * MCP 协议规定 server 可以异步推送 `notifications/tools/list_changed`、
 * `notifications/prompts/list_changed`、`notifications/resources/updated` 等事件。
 * 标准 HTTP+JSON-RPC client 无法接收这些；可选 SSE 通道用于订阅。
 *
 * 默认连接 `${endpoint}?stream=1`（也可通过 `streamEndpoint` 显式指定 URL）。
 * 服务端需要 `Content-Type: text/event-stream`，每个事件遵循：
 *
 *     event: notification
 *     data: {"jsonrpc":"2.0","method":"notifications/tools/list_changed"}
 *
 * 当 EventSource 不可用（如 SSR / Node）时本 composable 退化为 no-op，
 * 调用 `start()` 会抛 `McpStreamUnavailable`。
 *
 * 设计要点：
 * - 自动重连：默认 backoff 1s → 30s（factor 2），可配置；EventSource 本身的
 *   reconnect 仅在 retry 字段被服务端发送时才生效，宿主不可靠地控制。
 * - 事件分发：监听器列表，不挂全局 bus。
 * - 与 `useMcpClient.listTools()` 配合：onListChanged 触发后宿主可重新拉取
 *   tools。
 */
import { ref, type Ref } from 'vue';

export interface McpStreamOptions {
  /** MCP server SSE endpoint, e.g. `/ai-assistant/mcp/stream` */
  streamEndpoint: string;
  /** Optional bearer token; appended as `?token=` query if not empty */
  token?: string;
  /** Minimum reconnect backoff, ms (default 1000) */
  minBackoffMs?: number;
  /** Maximum reconnect backoff, ms (default 30000) */
  maxBackoffMs?: number;
  /** Multiplier per failed attempt (default 2) */
  backoffFactor?: number;
  /** Custom EventSource factory; useful for SSR / testing */
  eventSourceFactory?: (url: string) => EventSourceLike;
}

export interface McpStreamNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

/** Subset of EventSource used here; allows easy mocking. */
export interface EventSourceLike {
  close(): void;
  addEventListener(type: string, listener: (ev: { data?: string }) => void): void;
  onerror?: ((ev?: unknown) => void) | null;
  onopen?: ((ev?: unknown) => void) | null;
}

export class McpStreamUnavailable extends Error {
  constructor(reason: string) {
    super(`MCP SSE stream unavailable: ${reason}`);
    this.name = 'McpStreamUnavailable';
  }
}

type Listener = (n: McpStreamNotification) => void;

const DEFAULT_MIN_BACKOFF = 1000;
const DEFAULT_MAX_BACKOFF = 30_000;
const DEFAULT_BACKOFF_FACTOR = 2;

export function useMcpStream(opts: McpStreamOptions) {
  const minBackoff = Math.max(100, opts.minBackoffMs ?? DEFAULT_MIN_BACKOFF);
  const maxBackoff = Math.max(minBackoff, opts.maxBackoffMs ?? DEFAULT_MAX_BACKOFF);
  const backoffFactor = Math.max(1.1, opts.backoffFactor ?? DEFAULT_BACKOFF_FACTOR);

  const connected = ref(false);
  const lastError = ref<string>('');
  const reconnectAttempts = ref(0);

  const listeners = new Set<Listener>();
  let es: EventSourceLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function listenerKeysFromUrl(token?: string): string {
    if (!token) return opts.streamEndpoint;
    const sep = opts.streamEndpoint.includes('?') ? '&' : '?';
    return `${opts.streamEndpoint}${sep}token=${encodeURIComponent(token)}`;
  }

  function defaultFactory(url: string): EventSourceLike {
    if (typeof EventSource === 'undefined') {
      throw new McpStreamUnavailable('EventSource is not defined in this runtime');
    }
    return new EventSource(url) as unknown as EventSourceLike;
  }

  function scheduleReconnect() {
    if (stopped) return;
    const backoff = Math.min(
      maxBackoff,
      Math.round(minBackoff * Math.pow(backoffFactor, reconnectAttempts.value)),
    );
    reconnectAttempts.value += 1;
    if (reconnectTimer != null) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      if (!stopped) start();
    }, backoff);
  }

  function start() {
    stopped = false;
    const factory = opts.eventSourceFactory ?? defaultFactory;
    const url = listenerKeysFromUrl(opts.token?.trim() || undefined);
    try {
      const next = factory(url);
      es = next;
      next.addEventListener('notification', (ev) => {
        const data = ev?.data;
        if (typeof data !== 'string') return;
        try {
          const n = JSON.parse(data) as McpStreamNotification;
          if (n && n.method && n.jsonrpc === '2.0') {
            for (const fn of listeners) {
              try {
                fn(n);
              } catch (e) {
                /* listener errors should not break the stream */
                console.warn('[useMcpStream] listener threw', e);
              }
            }
          }
        } catch {
          /* swallow malformed JSON; the server contract is best-effort */
        }
      });
      next.onopen = () => {
        connected.value = true;
        reconnectAttempts.value = 0;
        lastError.value = '';
      };
      next.onerror = () => {
        connected.value = false;
        lastError.value = 'connection error';
        es?.close();
        es = null;
        scheduleReconnect();
      };
    } catch (e) {
      lastError.value = e instanceof Error ? e.message : String(e);
      if (e instanceof McpStreamUnavailable) {
        throw e;
      }
      scheduleReconnect();
    }
  }

  function stop() {
    stopped = true;
    if (reconnectTimer != null) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (es) {
      es.close();
      es = null;
    }
    connected.value = false;
  }

  function on(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return {
    connected: connected as Readonly<Ref<boolean>>,
    lastError: lastError as Readonly<Ref<string>>,
    reconnectAttempts: reconnectAttempts as Readonly<Ref<number>>,
    start,
    stop,
    on,
  };
}
