import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMcpAutoPlugin } from './useMcpAutoPlugin';
import type { McpTool, McpToolCallResult } from './useMcpClient';
import type { AiPlugin, PluginContext } from './usePluginRegistry';

function makeFakeClient(
  tools: McpTool[],
  callResults: Record<string, McpToolCallResult> = {},
) {
  return {
    listTools: vi.fn(async () => tools),
    callTool: vi.fn(async (name: string) => callResults[name] ?? { content: [] }),
  } as unknown as Parameters<typeof useMcpAutoPlugin>[0]['client'];
}

function makeFakeRegistry() {
  const registered = new Map<string, AiPlugin>();
  return {
    registered,
    registerPlugin: vi.fn((p: AiPlugin) => {
      registered.set(p.id, p);
    }),
    unregisterPlugin: vi.fn((id: string) => {
      registered.delete(id);
    }),
  };
}

function makeFakeCtx(input = ''): PluginContext & { added: Array<{ role: string; content: string }> } {
  const added: Array<{ role: string; content: string }> = [];
  return {
    input,
    messages: [],
    setInput: vi.fn(),
    addMessage: vi.fn((role, content) => added.push({ role, content })),
    added,
  } as unknown as PluginContext & { added: typeof added };
}

describe('useMcpAutoPlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('syncOnce registers a plugin per tool with the default prefix', async () => {
    const client = makeFakeClient([
      { name: 'translate' },
      { name: 'summarize' },
    ]);
    const registry = makeFakeRegistry();
    const auto = useMcpAutoPlugin({ client, registry });
    await auto.syncOnce();
    expect(registry.registerPlugin).toHaveBeenCalledTimes(2);
    expect(Array.from(registry.registered.keys())).toEqual([
      'mcp:translate',
      'mcp:summarize',
    ]);
    expect(auto.registeredCount.value).toBe(2);
  });

  it('uses custom prefix and position when provided', async () => {
    const client = makeFakeClient([{ name: 'foo' }]);
    const registry = makeFakeRegistry();
    const auto = useMcpAutoPlugin({
      client,
      registry,
      prefix: 'tool/',
      position: 'header',
    });
    await auto.syncOnce();
    const plugin = registry.registered.get('tool/foo');
    expect(plugin).toBeDefined();
    expect(plugin?.position).toBe('header');
  });

  it('syncOnce unregisters previously registered tools before re-adding', async () => {
    const client1 = makeFakeClient([{ name: 'a' }, { name: 'b' }]);
    const registry = makeFakeRegistry();
    const auto = useMcpAutoPlugin({ client: client1, registry });
    await auto.syncOnce();
    expect(registry.registered.size).toBe(2);
    /* simulate the server now returning a different set */
    (client1.listTools as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{ name: 'c' }]);
    await auto.syncOnce();
    expect(Array.from(registry.registered.keys())).toEqual(['mcp:c']);
  });

  it('plugin action calls the tool and writes the merged text via onToolResult default', async () => {
    const client = makeFakeClient(
      [{ name: 'echo' }],
      {
        echo: {
          content: [
            { type: 'text', text: 'line 1' },
            { type: 'text', text: 'line 2' },
            { type: 'image' },
          ],
        },
      },
    );
    const registry = makeFakeRegistry();
    const auto = useMcpAutoPlugin({ client, registry });
    await auto.syncOnce();
    const plugin = registry.registered.get('mcp:echo')!;
    const ctx = makeFakeCtx('hello');
    await plugin.action(ctx);
    expect(client.callTool).toHaveBeenCalledWith('echo', { input: 'hello' });
    expect(ctx.added).toEqual([
      { role: 'assistant', content: expect.stringContaining('echo') },
    ]);
    expect(ctx.added[0].content).toContain('line 1');
    expect(ctx.added[0].content).toContain('line 2');
  });

  it('custom buildArgs and onToolResult override defaults', async () => {
    const client = makeFakeClient(
      [{ name: 'sum' }],
      { sum: { content: [{ type: 'text', text: '42' }] } },
    );
    const registry = makeFakeRegistry();
    const onToolResult = vi.fn();
    const auto = useMcpAutoPlugin({
      client,
      registry,
      buildArgs: (tool, ctx) => ({ q: ctx.input, tool: tool.name }),
      onToolResult,
    });
    await auto.syncOnce();
    const plugin = registry.registered.get('mcp:sum')!;
    await plugin.action(makeFakeCtx('1+1'));
    expect(client.callTool).toHaveBeenCalledWith('sum', { q: '1+1', tool: 'sum' });
    expect(onToolResult).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'sum' }),
      '42',
      expect.anything(),
    );
  });

  it('isError response triggers onError instead of onToolResult', async () => {
    const client = makeFakeClient(
      [{ name: 'fail' }],
      { fail: { content: [{ type: 'text', text: 'should not show' }], isError: true } },
    );
    const registry = makeFakeRegistry();
    const onError = vi.fn();
    const onToolResult = vi.fn();
    const auto = useMcpAutoPlugin({ client, registry, onError, onToolResult });
    await auto.syncOnce();
    const plugin = registry.registered.get('mcp:fail')!;
    await plugin.action(makeFakeCtx());
    expect(onError).toHaveBeenCalled();
    expect(onToolResult).not.toHaveBeenCalled();
  });

  it('listTools failure surfaces lastError and rethrows', async () => {
    const client = {
      listTools: vi.fn(async () => {
        throw new Error('network down');
      }),
      callTool: vi.fn(),
    } as unknown as Parameters<typeof useMcpAutoPlugin>[0]['client'];
    const registry = makeFakeRegistry();
    const auto = useMcpAutoPlugin({ client, registry });
    await expect(auto.syncOnce()).rejects.toThrow('network down');
    expect(auto.lastError.value).toContain('network down');
    expect(auto.isSyncing.value).toBe(false);
  });

  it('dispose() unregisters all and clears tools', async () => {
    const client = makeFakeClient([{ name: 'x' }, { name: 'y' }]);
    const registry = makeFakeRegistry();
    const auto = useMcpAutoPlugin({ client, registry });
    await auto.syncOnce();
    expect(registry.registered.size).toBe(2);
    auto.dispose();
    expect(registry.registered.size).toBe(0);
    expect(auto.tools.value).toHaveLength(0);
  });
});
