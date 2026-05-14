/**
 * useMcpClient
 * ------------
 * 轻量 MCP（Model Context Protocol）HTTP 客户端 composable。
 *
 * 与 `usePluginRegistry`（前端按钮注册器）不同，`useMcpClient` 真的通过 HTTP
 * JSON-RPC 与一个 MCP 服务器对话：
 *
 * - 默认连接 SDK 自家后端 `/ai-assistant/mcp`（McpServerController 实现），
 *   该端点把所有 `AssistantCapability` 暴露成 tools；
 * - 也可指向任何兼容 MCP 协议的服务器（只要走 JSON-RPC over HTTP POST）。
 *
 * 设计要点：
 * - 单条 RPC 请求自带递增 id，对应响应按 id 路由。
 * - 不实现 SSE / WebSocket 通知通道（多数 MCP server 仍支持纯 HTTP），
 *   保持 composable 体积最小；如需 streaming，宿主自行接 EventSource。
 * - `listTools()` 与 `callTool()` 返回经过校验的强类型对象；协议错误抛
 *   `McpRpcError`，由调用方处理。
 * - 不依赖任何运行时配置：endpoint / token 都通过 options 注入，便于测试。
 */
import { ref, type Ref } from 'vue';

export interface McpClientOptions {
  /** Endpoint URL of the MCP server, e.g. `/ai-assistant/mcp` */
  endpoint: string;
  /** Optional bearer / X-AI-Token; injected into both `Authorization` and `X-AI-Token` */
  token?: string;
  /** Override the protocol version sent on `initialize`; defaults to `2025-03-26` */
  protocolVersion?: string;
  /** Network timeout in ms for each RPC call; defaults to 30s */
  timeoutMs?: number;
  /** Optional fetch implementation, useful for SSR / Node tests */
  fetchImpl?: typeof fetch;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpInitializeResult {
  protocolVersion: string;
  serverInfo: { name: string; version: string };
  capabilities?: Record<string, unknown>;
}

export interface McpToolCallResult {
  content: Array<{ type: string; text?: string; [k: string]: unknown }>;
  isError?: boolean;
}

export class McpRpcError extends Error {
  public readonly code: number;
  public readonly data?: unknown;
  constructor(code: number, message: string, data?: unknown) {
    super(message);
    this.code = code;
    this.data = data;
    this.name = 'McpRpcError';
  }
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_PROTOCOL = '2025-03-26';

export function useMcpClient(opts: McpClientOptions) {
  const fetchFn = opts.fetchImpl ?? fetch;
  let nextId = 1;

  const initialized = ref(false);
  const serverInfo = ref<McpInitializeResult['serverInfo'] | null>(null);
  const lastError = ref<string>('');
  const inFlight = ref(0);

  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = opts.token?.trim();
    if (token) {
      h.Authorization = `Bearer ${token}`;
      h['X-AI-Token'] = token;
    }
    return h;
  }

  async function rpc<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    const id = nextId++;
    const body = JSON.stringify({ jsonrpc: '2.0', id, method, params: params ?? {} });
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT);
    inFlight.value += 1;
    try {
      const res = await fetchFn(opts.endpoint, {
        method: 'POST',
        headers: buildHeaders(),
        body,
        signal: ctrl.signal,
      });
      if (!res.ok) {
        throw new McpRpcError(-32000, `HTTP ${res.status} ${res.statusText}`);
      }
      const json = (await res.json()) as {
        id?: number;
        result?: T;
        error?: { code: number; message: string; data?: unknown };
      };
      if (json.error) {
        throw new McpRpcError(json.error.code, json.error.message, json.error.data);
      }
      if (json.result == null) {
        throw new McpRpcError(-32603, 'MCP response missing `result` field');
      }
      return json.result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError.value = msg;
      throw e;
    } finally {
      clearTimeout(timeout);
      inFlight.value = Math.max(0, inFlight.value - 1);
    }
  }

  async function initialize(): Promise<McpInitializeResult> {
    const result = await rpc<McpInitializeResult>('initialize', {
      protocolVersion: opts.protocolVersion ?? DEFAULT_PROTOCOL,
      clientInfo: { name: 'ai-assistant-ui', version: '1.0.0' },
      capabilities: {},
    });
    serverInfo.value = result.serverInfo;
    initialized.value = true;
    return result;
  }

  async function listTools(): Promise<McpTool[]> {
    const result = await rpc<{ tools?: McpTool[] }>('tools/list');
    return Array.isArray(result.tools) ? result.tools : [];
  }

  async function callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<McpToolCallResult> {
    const result = await rpc<McpToolCallResult>('tools/call', { name, arguments: args });
    return {
      content: Array.isArray(result.content) ? result.content : [],
      isError: result.isError === true,
    };
  }

  function reset() {
    initialized.value = false;
    serverInfo.value = null;
    lastError.value = '';
    nextId = 1;
  }

  return {
    initialized: initialized as Readonly<Ref<boolean>>,
    serverInfo: serverInfo as Readonly<Ref<McpInitializeResult['serverInfo'] | null>>,
    lastError: lastError as Readonly<Ref<string>>,
    inFlight: inFlight as Readonly<Ref<number>>,
    initialize,
    listTools,
    callTool,
    reset,
  };
}
