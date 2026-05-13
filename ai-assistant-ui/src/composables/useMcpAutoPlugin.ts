/**
 * useMcpAutoPlugin
 * ----------------
 * 把 `useMcpClient` 列出的 MCP 工具自动注册为 `usePluginRegistry` 中的按钮。
 *
 * 典型用法（宿主组件）：
 *
 * ```ts
 * import { useMcpClient, useMcpAutoPlugin, providePluginRegistry } from '@ai-assistant/vue';
 *
 * providePluginRegistry();
 * const client = useMcpClient({ endpoint: '/ai-assistant/mcp', token });
 * const sync = useMcpAutoPlugin({
 *   client,
 *   position: 'header',
 *   prefix: 'mcp:',
 *   onToolResult: (toolName, result) => console.log(toolName, result),
 * });
 *
 * onMounted(async () => {
 *   await client.initialize();
 *   await sync.syncOnce();
 * });
 * ```
 *
 * 设计要点：
 * - 自带「按钮 id 前缀」（默认 `mcp:`）避免与宿主自有 plugin 冲突。
 * - 调用 tool 后通过 `onToolResult` 回调暴露结果，由宿主自行决定如何展示
 *   （插入气泡、弹 toast、写入剪贴板…），本 composable 不做 UI 决策。
 * - 重新同步时会 unregister 上次注册的所有 `mcp:` 前缀按钮，避免堆积。
 * - 不主动调用 `client.initialize()`：让宿主控制初始化时机（首屏 / 用户点击 / 路由切换）。
 */
import { computed, ref } from 'vue';

import type { McpTool } from './useMcpClient';
import type { useMcpClient } from './useMcpClient';
import type { AiPlugin, PluginContext } from './usePluginRegistry';

export type McpClientApi = ReturnType<typeof useMcpClient>;

export interface UseMcpAutoPluginOptions {
  /** A MCP client instance (already created via `useMcpClient`) */
  client: McpClientApi;
  /** Plugin registry surface; usually `usePluginRegistry()` returned object */
  registry: {
    registerPlugin: (plugin: AiPlugin) => void;
    unregisterPlugin: (id: string) => void;
  };
  /** Which slot to mount the tool buttons in; defaults to 'context' (right-click) */
  position?: AiPlugin['position'];
  /** Prefix for the generated plugin ids; defaults to 'mcp:' */
  prefix?: string;
  /** Build the JSON arguments to send to `tools/call`; default: send `{ input: ctx.input }` */
  buildArgs?: (tool: McpTool, ctx: PluginContext) => Record<string, unknown>;
  /** Fired when a tool finishes; default action is to append the textual content to messages */
  onToolResult?: (tool: McpTool, content: string, ctx: PluginContext) => void;
  /** Optional async error reporter; defaults to console.error */
  onError?: (tool: McpTool, err: unknown) => void;
}

const DEFAULT_PREFIX = 'mcp:';

export function useMcpAutoPlugin(opts: UseMcpAutoPluginOptions) {
  const prefix = opts.prefix ?? DEFAULT_PREFIX;
  const position = opts.position ?? 'context';
  const registeredIds = ref<string[]>([]);
  const lastSyncedAt = ref<number | null>(null);

  const tools = ref<McpTool[]>([]);
  const isSyncing = ref(false);
  const lastError = ref<string>('');

  function defaultBuildArgs(_tool: McpTool, ctx: PluginContext): Record<string, unknown> {
    return { input: ctx.input };
  }

  function defaultOnResult(tool: McpTool, content: string, ctx: PluginContext) {
    ctx.addMessage('assistant', `**${tool.name}**\n\n${content}`);
  }

  function defaultOnError(tool: McpTool, err: unknown) {
    console.error(`[useMcpAutoPlugin] tool "${tool.name}" failed:`, err);
  }

  function makePluginId(tool: McpTool): string {
    return `${prefix}${tool.name}`;
  }

  function unregisterAll() {
    for (const id of registeredIds.value) {
      try {
        opts.registry.unregisterPlugin(id);
      } catch {
        /* ignore */
      }
    }
    registeredIds.value = [];
  }

  function makePluginFor(tool: McpTool): AiPlugin {
    const buildArgs = opts.buildArgs ?? defaultBuildArgs;
    const onResult = opts.onToolResult ?? defaultOnResult;
    const onError = opts.onError ?? defaultOnError;
    return {
      id: makePluginId(tool),
      label: tool.name,
      position,
      action: async (ctx: PluginContext) => {
        try {
          const args = buildArgs(tool, ctx);
          const r = await opts.client.callTool(tool.name, args);
          if (r.isError) {
            onError(tool, new Error(`Tool returned isError=true`));
            return;
          }
          const textChunks = r.content
            .filter((c) => c.type === 'text' && typeof c.text === 'string')
            .map((c) => c.text as string);
          const merged = textChunks.join('\n').trim();
          if (merged) onResult(tool, merged, ctx);
        } catch (err) {
          onError(tool, err);
        }
      },
    };
  }

  async function syncOnce(): Promise<McpTool[]> {
    isSyncing.value = true;
    lastError.value = '';
    try {
      const list = await opts.client.listTools();
      tools.value = list;
      unregisterAll();
      for (const t of list) {
        const plugin = makePluginFor(t);
        opts.registry.registerPlugin(plugin);
        registeredIds.value.push(plugin.id);
      }
      lastSyncedAt.value = Date.now();
      return list;
    } catch (err) {
      lastError.value = err instanceof Error ? err.message : String(err);
      throw err;
    } finally {
      isSyncing.value = false;
    }
  }

  const registeredCount = computed(() => registeredIds.value.length);

  function dispose() {
    unregisterAll();
    tools.value = [];
  }

  return {
    tools,
    isSyncing,
    lastError,
    lastSyncedAt,
    registeredCount,
    syncOnce,
    dispose,
  };
}
