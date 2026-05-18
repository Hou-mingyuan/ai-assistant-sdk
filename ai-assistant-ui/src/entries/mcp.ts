export { useMcpClient, McpRpcError } from '../composables/useMcpClient';
export type {
  McpClientOptions,
  McpTool,
  McpInitializeResult,
  McpToolCallResult,
} from '../composables/useMcpClient';
export { useMcpAutoPlugin } from '../composables/useMcpAutoPlugin';
export type { UseMcpAutoPluginOptions } from '../composables/useMcpAutoPlugin';
export { useMcpStream, McpStreamUnavailable } from '../composables/useMcpStream';
export type {
  McpStreamOptions,
  McpStreamNotification,
  EventSourceLike,
} from '../composables/useMcpStream';
