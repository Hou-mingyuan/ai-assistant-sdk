import { describe, it, expect, vi } from 'vitest';
import { useMcpClient, McpRpcError } from './useMcpClient';

interface MockResponse {
  ok?: boolean;
  status?: number;
  statusText?: string;
  body: unknown;
}

function makeFetch(responses: MockResponse[]): typeof fetch {
  let i = 0;
  return vi.fn(async () => {
    const r = responses[i++] ?? responses[responses.length - 1]!;
    return {
      ok: r.ok ?? true,
      status: r.status ?? 200,
      statusText: r.statusText ?? 'OK',
      json: async () => r.body,
    } as Response;
  }) as unknown as typeof fetch;
}

describe('useMcpClient', () => {
  it('initialize() sends JSON-RPC initialize and stores serverInfo', async () => {
    const fetchImpl = makeFetch([
      {
        body: {
          jsonrpc: '2.0',
          id: 1,
          result: {
            protocolVersion: '2025-03-26',
            serverInfo: { name: 'srv', version: '0.1' },
            capabilities: { tools: {} },
          },
        },
      },
    ]);
    const client = useMcpClient({ endpoint: '/mcp', fetchImpl });
    const info = await client.initialize();
    expect(info.serverInfo.name).toBe('srv');
    expect(client.initialized.value).toBe(true);
    expect(client.serverInfo.value?.name).toBe('srv');
  });

  it('listTools() returns the parsed tools array', async () => {
    const fetchImpl = makeFetch([
      {
        body: {
          jsonrpc: '2.0',
          id: 1,
          result: {
            tools: [
              { name: 'translate', description: 'd' },
              { name: 'summarize', inputSchema: { type: 'object' } },
            ],
          },
        },
      },
    ]);
    const client = useMcpClient({ endpoint: '/mcp', fetchImpl });
    const tools = await client.listTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('translate');
    expect(tools[1].inputSchema).toEqual({ type: 'object' });
  });

  it('listTools() tolerates a missing tools field by returning []', async () => {
    const fetchImpl = makeFetch([
      { body: { jsonrpc: '2.0', id: 1, result: {} } },
    ]);
    const client = useMcpClient({ endpoint: '/mcp', fetchImpl });
    const tools = await client.listTools();
    expect(tools).toEqual([]);
  });

  it('callTool() forwards name + arguments and parses content', async () => {
    const called = vi.fn();
    const fetchImpl: typeof fetch = vi.fn(async (_url, init) => {
      const parsed = JSON.parse(String((init as RequestInit | undefined)?.body ?? '{}'));
      called(parsed);
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          jsonrpc: '2.0',
          id: parsed.id,
          result: { content: [{ type: 'text', text: 'hi' }], isError: false },
        }),
      } as Response;
    }) as unknown as typeof fetch;
    const client = useMcpClient({ endpoint: '/mcp', fetchImpl });
    const r = await client.callTool('echo', { x: 1 });
    expect(r.content[0]).toEqual({ type: 'text', text: 'hi' });
    expect(called).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'tools/call',
        params: { name: 'echo', arguments: { x: 1 } },
      }),
    );
  });

  it('maps server error envelopes into McpRpcError', async () => {
    const fetchImpl = makeFetch([
      {
        body: {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32601, message: 'Method not found' },
        },
      },
    ]);
    const client = useMcpClient({ endpoint: '/mcp', fetchImpl });
    await expect(client.listTools()).rejects.toBeInstanceOf(McpRpcError);
    expect(client.lastError.value).toMatch(/Method not found/);
  });

  it('treats non-2xx HTTP as McpRpcError(-32000)', async () => {
    const fetchImpl = makeFetch([
      { ok: false, status: 503, statusText: 'Down', body: {} },
    ]);
    const client = useMcpClient({ endpoint: '/mcp', fetchImpl });
    await expect(client.initialize()).rejects.toMatchObject({ code: -32000 });
  });

  it('attaches Bearer + X-AI-Token headers when token provided', async () => {
    let capturedHeaders: Record<string, string> | undefined;
    const fetchImpl: typeof fetch = vi.fn(async (_url, init) => {
      const ri = init as RequestInit | undefined;
      capturedHeaders = ri?.headers as Record<string, string> | undefined;
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ jsonrpc: '2.0', id: 1, result: { tools: [] } }),
      } as Response;
    }) as unknown as typeof fetch;
    const client = useMcpClient({ endpoint: '/mcp', fetchImpl, token: 'tk' });
    await client.listTools();
    expect(capturedHeaders?.Authorization).toBe('Bearer tk');
    expect(capturedHeaders?.['X-AI-Token']).toBe('tk');
  });

  it('reset() clears initialized / serverInfo / lastError', async () => {
    const fetchImpl = makeFetch([
      {
        body: {
          jsonrpc: '2.0',
          id: 1,
          result: { serverInfo: { name: 'a', version: '1' }, protocolVersion: '1' },
        },
      },
    ]);
    const client = useMcpClient({ endpoint: '/mcp', fetchImpl });
    await client.initialize();
    expect(client.initialized.value).toBe(true);
    client.reset();
    expect(client.initialized.value).toBe(false);
    expect(client.serverInfo.value).toBeNull();
  });
});
