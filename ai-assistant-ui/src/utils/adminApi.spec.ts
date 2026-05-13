import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  adminOverview,
  adminListTokens,
  adminSetTokenQuota,
  adminCreatePrompt,
  adminIngestRag,
  adminRagStats,
  adminSetFallbackChain,
  adminUnloadPlugin,
} from './adminApi';

/**
 * 单元测试侧重：
 * - 路径拼装正确（含 /admin 前缀、query 参数、path encoding）
 * - 认证 headers 同时注入 X-Admin-Token + X-AI-Token
 * - 2xx → success: true + data
 * - 4xx/5xx → success: false + error 含 HTTP status
 * - 网络异常 → success: false + error 含原始消息
 * - POST body 是 JSON 序列化
 */

function makeFetchMock(
  resp: { ok: boolean; status?: number; statusText?: string; json?: unknown; text?: string },
) {
  return vi.fn(
    async () =>
      ({
        ok: resp.ok,
        status: resp.status ?? (resp.ok ? 200 : 500),
        statusText: resp.statusText ?? (resp.ok ? 'OK' : 'Error'),
        json: async () => resp.json ?? {},
        text: async () => resp.text ?? '',
      }) as unknown as Response,
  );
}

describe('adminApi', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('adminOverview composes /admin/overview URL and parses 200 JSON', async () => {
    const fetchImpl = makeFetchMock({
      ok: true,
      json: {
        usage: { total: 42 },
        tokenUsage: { used: 10 },
        registeredTools: 5,
        promptTemplates: 3,
        activeABTests: 1,
      },
    });
    const r = await adminOverview('https://api.test', 'tok', { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.test/admin/overview');
    expect((init as RequestInit).method).toBe('GET');
    expect(r.success).toBe(true);
    expect(r.data?.registeredTools).toBe(5);
  });

  it('injects X-Admin-Token AND X-AI-Token headers for auth fallback', async () => {
    const fetchImpl = makeFetchMock({ ok: true, json: {} });
    await adminOverview('https://api.test/', '  secret-token  ', { fetchImpl });
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-Admin-Token']).toBe('secret-token');
    expect(headers['X-AI-Token']).toBe('secret-token');
    /* GET 请求不应带 Content-Type */
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('omits auth headers when token is blank', async () => {
    const fetchImpl = makeFetchMock({ ok: true, json: {} });
    await adminOverview('https://api.test', '   ', { fetchImpl });
    const headers = (fetchImpl.mock.calls[0][1] as RequestInit).headers as Record<string, string>;
    expect(headers['X-Admin-Token']).toBeUndefined();
    expect(headers['X-AI-Token']).toBeUndefined();
  });

  it('appends optional query parameter (tenantId)', async () => {
    const fetchImpl = makeFetchMock({ ok: true, json: { tenant: 'acme' } });
    await adminListTokens('https://api.test', 't', 'acme', { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/admin/tokens?tenantId=acme');
  });

  it('omits query parameter when value is undefined', async () => {
    const fetchImpl = makeFetchMock({ ok: true, json: {} });
    await adminListTokens('https://api.test', 't', undefined, { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/admin/tokens');
  });

  it('POST adminSetTokenQuota body is JSON with tenantId + dailyLimit', async () => {
    const fetchImpl = makeFetchMock({ ok: true, json: { success: true } });
    await adminSetTokenQuota('https://api.test', 't', 'tenant-1', 50000, { fetchImpl });
    const init = fetchImpl.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({ tenantId: 'tenant-1', dailyLimit: 50000 });
  });

  it('POST adminCreatePrompt body includes name and template', async () => {
    const fetchImpl = makeFetchMock({ ok: true, json: { success: true, name: 'greet' } });
    await adminCreatePrompt('https://api.test', 't', 'greet', 'Hello {{name}}', { fetchImpl });
    expect(JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      name: 'greet',
      template: 'Hello {{name}}',
    });
  });

  it('POST adminIngestRag wraps content + optional namespace + docId', async () => {
    const fetchImpl = makeFetchMock({
      ok: true,
      json: { success: true, namespace: 'docs', chunks: 3 },
    });
    await adminIngestRag('https://api.test', 't', 'lorem ipsum', {
      namespace: 'docs',
      docId: 'doc-7',
      fetchImpl,
    });
    expect(JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      content: 'lorem ipsum',
      namespace: 'docs',
      docId: 'doc-7',
    });
  });

  it('adminRagStats with default namespace omits query', async () => {
    const fetchImpl = makeFetchMock({
      ok: true,
      json: { namespace: 'default', documentCount: 0 },
    });
    await adminRagStats('https://api.test', 't', undefined, { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/admin/rag/stats');
  });

  it('adminSetFallbackChain body wraps chain array', async () => {
    const fetchImpl = makeFetchMock({ ok: true, json: { success: true, chain: ['a', 'b'] } });
    await adminSetFallbackChain('https://api.test', 't', ['model-a', 'model-b'], { fetchImpl });
    expect(JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)).toEqual({
      chain: ['model-a', 'model-b'],
    });
  });

  it('adminUnloadPlugin URI-encodes pluginId', async () => {
    const fetchImpl = makeFetchMock({ ok: true, json: { success: true, pluginId: 'a:b/c' } });
    await adminUnloadPlugin('https://api.test', 't', 'a:b/c', { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/admin/plugins/a%3Ab%2Fc/unload');
    expect((fetchImpl.mock.calls[0][1] as RequestInit).method).toBe('POST');
  });

  it('returns error result on HTTP 403 with body excerpt', async () => {
    const fetchImpl = makeFetchMock({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      text: '{"error":"Unauthorized"}',
    });
    const r = await adminOverview('https://api.test', 'bad', { fetchImpl });
    expect(r.success).toBe(false);
    expect(r.status).toBe(403);
    expect(r.error).toContain('HTTP 403');
    expect(r.error).toContain('Unauthorized');
  });

  it('returns error result on network exception', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });
    const r = await adminOverview('https://api.test', 't', { fetchImpl });
    expect(r.success).toBe(false);
    expect(r.error).toBe('ECONNREFUSED');
  });

  it('strips trailing slashes from baseUrl', async () => {
    const fetchImpl = makeFetchMock({ ok: true, json: {} });
    await adminOverview('https://api.test///', 't', { fetchImpl });
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api.test/admin/overview');
  });
});
