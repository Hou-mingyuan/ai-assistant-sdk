/**
 * Admin API client
 * ----------------
 * 包装后端 `/admin/*` 端点（由 `AdminDashboardController` 暴露），
 * 用于宿主在自有运维页面里调用。所有调用：
 *
 * 1. **认证**：注入 `X-Admin-Token`，失败回退 `X-AI-Token`（与 server 端
 *    `AdminAuthFilter` 校验逻辑一致）。
 * 2. **统一错误处理**：返回 `Promise<AdminResult<T>>`：
 *    - HTTP 2xx → `{ success: true, data: <T> }`
 *    - HTTP 4xx/5xx → `{ success: false, error: 'HTTP 403: ...' }`
 *    - 网络/超时 → `{ success: false, error: '<message>' }`
 * 3. **超时**：默认 30s，可通过 options.timeoutMs 覆盖；用 AbortSignal.timeout
 *    避免内存泄漏。
 *
 * 不包含 UI；宿主可基于此自由组装 admin 仪表板（推荐独立路由 `/admin`，
 * 配合 server 端 `AdminAuthFilter` 保护）。
 *
 * 端点对照表
 * ----------
 * | 函数 | 后端路由 |
 * |---|---|
 * | adminOverview | GET  /admin/overview |
 * | adminListTokens | GET  /admin/tokens[?tenantId=] |
 * | adminSetTokenQuota | POST /admin/tokens/quota |
 * | adminListPrompts | GET  /admin/prompts |
 * | adminCreatePrompt | POST /admin/prompts |
 * | adminListTools | GET  /admin/tools |
 * | adminIngestRag | POST /admin/rag/ingest |
 * | adminRagStats | GET  /admin/rag/stats[?namespace=] |
 * | adminConfigureAbTest | POST /admin/ab-test |
 * | adminListAbTests | GET  /admin/ab-test |
 * | adminSetFallbackChain | POST /admin/fallback-chain |
 * | adminGetFallbackChain | GET  /admin/fallback-chain |
 * | adminListPlugins | GET  /admin/plugins |
 * | adminUnloadPlugin | POST /admin/plugins/{id}/unload |
 * | adminSystemInfo | GET  /admin/system |
 */

import type { components, paths } from '../types/api-generated';

type ApiSchemas = components['schemas'];
type ApiPaths = paths;

type JsonResponse<Path extends keyof ApiPaths, Method extends keyof ApiPaths[Path]> =
  NonNullable<ApiPaths[Path][Method]> extends {
    responses: { 200: { content: { 'application/json': infer Response } } };
  }
    ? Response
    : never;

type JsonRequestBody<Path extends keyof ApiPaths, Method extends keyof ApiPaths[Path]> =
  NonNullable<ApiPaths[Path][Method]> extends {
    requestBody: { content: { 'application/json': infer Request } };
  }
    ? Request
    : never;

const DEFAULT_TIMEOUT_MS = 30_000;
const ADMIN_PATH_PREFIX = '/admin';

export interface AdminResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** HTTP status code, present on non-2xx server responses */
  status?: number;
}

export interface AdminCallOptions {
  /** Override request timeout in milliseconds (default 30000) */
  timeoutMs?: number;
  /** Custom fetch implementation (for SSR / testing); defaults to globalThis.fetch */
  fetchImpl?: typeof fetch;
}

/* ────────────────────────────────────────────────────────────────
 * Response shapes
 * ──────────────────────────────────────────────────────────────── */

export type AdminOverview = JsonResponse<'/admin/overview', 'get'>;

export type AdminTokenUsage = JsonResponse<'/admin/tokens', 'get'>;

export type AdminTokenQuotaRequest = JsonRequestBody<'/admin/tokens/quota', 'post'>;

export type AdminTokenQuotaResult = JsonResponse<'/admin/tokens/quota', 'post'>;

export type AdminPromptEntry = ApiSchemas['AdminPromptEntry'];

export type AdminPromptMap = JsonResponse<'/admin/prompts', 'get'>;

export type AdminPromptCreateRequest = JsonRequestBody<'/admin/prompts', 'post'>;

export type AdminPromptCreateResult = JsonResponse<'/admin/prompts', 'post'>;

export type AdminToolEntry = ApiSchemas['AdminToolEntry'];

export type AdminToolMap = JsonResponse<'/admin/tools', 'get'>;

export type AdminRagStats = JsonResponse<'/admin/rag/stats', 'get'>;

export type AdminRagIngestRequest = JsonRequestBody<'/admin/rag/ingest', 'post'>;

export type AdminRagIngestResult = JsonResponse<'/admin/rag/ingest', 'post'>;

export type AdminAbTestConfig = ApiSchemas['AdminAbTestConfig'];

export type AdminAbTestMap = JsonResponse<'/admin/ab-test', 'get'>;

export type AdminAbTestRequest = JsonRequestBody<'/admin/ab-test', 'post'>;

export type AdminAbTestResult = JsonResponse<'/admin/ab-test', 'post'>;

export type AdminFallbackChain = JsonResponse<'/admin/fallback-chain', 'get'>;

export type AdminFallbackChainRequest = JsonRequestBody<'/admin/fallback-chain', 'post'>;

export type AdminFallbackChainResult = JsonResponse<'/admin/fallback-chain', 'post'>;

export type AdminPluginsResult = JsonResponse<'/admin/plugins', 'get'>;

export type AdminPluginUnloadResult = JsonResponse<'/admin/plugins/{pluginId}/unload', 'post'>;

export type AdminSystemInfo = JsonResponse<'/admin/system', 'get'>;

/* ────────────────────────────────────────────────────────────────
 * Internal helpers
 * ──────────────────────────────────────────────────────────────── */

function normalizeAdminToken(token?: string): string | undefined {
  const trimmed = token?.trim();
  return trimmed ? trimmed : undefined;
}

function buildAdminHeaders(token: string | undefined, json: boolean): Record<string, string> {
  const headers: Record<string, string> = {};
  if (json) headers['Content-Type'] = 'application/json';
  const t = normalizeAdminToken(token);
  if (t) {
    headers['X-Admin-Token'] = t;
    /* 与 AdminAuthFilter 的回退顺序保持一致：X-Admin-Token 优先，
     * X-AI-Token 兜底（便于宿主仅持有主 token 时也能尝试） */
    headers['X-AI-Token'] = t;
  }
  return headers;
}

function adminUrl(
  baseUrl: string,
  path: string,
  query?: Record<string, string | undefined>,
): string {
  const root = baseUrl.replace(/\/+$/, '');
  let url = `${root}${ADMIN_PATH_PREFIX}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== '') params.set(k, v);
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

async function adminFetch<T>(
  url: string,
  init: RequestInit,
  options?: AdminCallOptions,
): Promise<AdminResult<T>> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options?.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { success: false, error: 'fetch is not available in this runtime' };
  }
  try {
    const res = await fetchImpl(url, {
      ...init,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      let errorBody = '';
      try {
        errorBody = await res.text();
      } catch {
        /* ignore body read errors */
      }
      return {
        success: false,
        status: res.status,
        error: `HTTP ${res.status}: ${res.statusText}${errorBody ? ' - ' + errorBody.slice(0, 200) : ''}`,
      };
    }
    const data = (await res.json()) as T;
    return { success: true, data };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, error: msg };
  }
}

/* ────────────────────────────────────────────────────────────────
 * Public API
 * ──────────────────────────────────────────────────────────────── */

/** GET /admin/overview — usage / token / tools / prompts / AB tests counts. */
export function adminOverview(
  baseUrl: string,
  adminToken: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminOverview>> {
  return adminFetch<AdminOverview>(
    adminUrl(baseUrl, '/overview'),
    { method: 'GET', headers: buildAdminHeaders(adminToken, false) },
    options,
  );
}

/** GET /admin/tokens[?tenantId=] — per-tenant or global token usage snapshot. */
export function adminListTokens(
  baseUrl: string,
  adminToken: string,
  tenantId?: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminTokenUsage>> {
  return adminFetch<AdminTokenUsage>(
    adminUrl(baseUrl, '/tokens', { tenantId }),
    { method: 'GET', headers: buildAdminHeaders(adminToken, false) },
    options,
  );
}

/** POST /admin/tokens/quota — set per-tenant daily token quota. */
export function adminSetTokenQuota(
  baseUrl: string,
  adminToken: string,
  tenantId: string,
  dailyLimit: number,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminTokenQuotaResult>> {
  const body: AdminTokenQuotaRequest = { tenantId, dailyLimit };
  return adminFetch(
    adminUrl(baseUrl, '/tokens/quota'),
    {
      method: 'POST',
      headers: buildAdminHeaders(adminToken, true),
      body: JSON.stringify(body),
    },
    options,
  );
}

/** GET /admin/prompts — list registered prompt templates. */
export function adminListPrompts(
  baseUrl: string,
  adminToken: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminPromptMap>> {
  return adminFetch<AdminPromptMap>(
    adminUrl(baseUrl, '/prompts'),
    { method: 'GET', headers: buildAdminHeaders(adminToken, false) },
    options,
  );
}

/** POST /admin/prompts — register or update a prompt template. */
export function adminCreatePrompt(
  baseUrl: string,
  adminToken: string,
  name: string,
  template: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminPromptCreateResult>> {
  const body: AdminPromptCreateRequest = { name, template };
  return adminFetch(
    adminUrl(baseUrl, '/prompts'),
    {
      method: 'POST',
      headers: buildAdminHeaders(adminToken, true),
      body: JSON.stringify(body),
    },
    options,
  );
}

/** GET /admin/tools — list available capability tools. */
export function adminListTools(
  baseUrl: string,
  adminToken: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminToolMap>> {
  return adminFetch<AdminToolMap>(
    adminUrl(baseUrl, '/tools'),
    { method: 'GET', headers: buildAdminHeaders(adminToken, false) },
    options,
  );
}

/** POST /admin/rag/ingest — ingest a document into the global RAG store. */
export function adminIngestRag(
  baseUrl: string,
  adminToken: string,
  content: string,
  opts?: { namespace?: string; docId?: string } & AdminCallOptions,
): Promise<AdminResult<AdminRagIngestResult>> {
  const body: AdminRagIngestRequest = { content };
  if (opts?.namespace) body.namespace = opts.namespace;
  if (opts?.docId) body.docId = opts.docId;
  return adminFetch(
    adminUrl(baseUrl, '/rag/ingest'),
    {
      method: 'POST',
      headers: buildAdminHeaders(adminToken, true),
      body: JSON.stringify(body),
    },
    opts,
  );
}

/** GET /admin/rag/stats[?namespace=] — document count for a RAG namespace. */
export function adminRagStats(
  baseUrl: string,
  adminToken: string,
  namespace?: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminRagStats>> {
  return adminFetch<AdminRagStats>(
    adminUrl(baseUrl, '/rag/stats', { namespace }),
    { method: 'GET', headers: buildAdminHeaders(adminToken, false) },
    options,
  );
}

/** POST /admin/ab-test — configure an A/B test between two models. */
export function adminConfigureAbTest(
  baseUrl: string,
  adminToken: string,
  name: string,
  modelA: string,
  modelB: string,
  opts?: { percentA?: number } & AdminCallOptions,
): Promise<AdminResult<AdminAbTestResult>> {
  const body: AdminAbTestRequest = { name, modelA, modelB };
  if (opts?.percentA != null) body.percentA = opts.percentA;
  return adminFetch(
    adminUrl(baseUrl, '/ab-test'),
    {
      method: 'POST',
      headers: buildAdminHeaders(adminToken, true),
      body: JSON.stringify(body),
    },
    opts,
  );
}

/** GET /admin/ab-test — list active A/B tests. */
export function adminListAbTests(
  baseUrl: string,
  adminToken: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminAbTestMap>> {
  return adminFetch<AdminAbTestMap>(
    adminUrl(baseUrl, '/ab-test'),
    { method: 'GET', headers: buildAdminHeaders(adminToken, false) },
    options,
  );
}

/** POST /admin/fallback-chain — set the global model fallback chain. */
export function adminSetFallbackChain(
  baseUrl: string,
  adminToken: string,
  chain: string[],
  options?: AdminCallOptions,
): Promise<AdminResult<AdminFallbackChainResult>> {
  const body: AdminFallbackChainRequest = { chain };
  return adminFetch(
    adminUrl(baseUrl, '/fallback-chain'),
    {
      method: 'POST',
      headers: buildAdminHeaders(adminToken, true),
      body: JSON.stringify(body),
    },
    options,
  );
}

/** GET /admin/fallback-chain — get the global model fallback chain. */
export function adminGetFallbackChain(
  baseUrl: string,
  adminToken: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminFallbackChain>> {
  return adminFetch<AdminFallbackChain>(
    adminUrl(baseUrl, '/fallback-chain'),
    { method: 'GET', headers: buildAdminHeaders(adminToken, false) },
    options,
  );
}

/** GET /admin/plugins — list loaded plugins. */
export function adminListPlugins(
  baseUrl: string,
  adminToken: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminPluginsResult>> {
  return adminFetch<AdminPluginsResult>(
    adminUrl(baseUrl, '/plugins'),
    { method: 'GET', headers: buildAdminHeaders(adminToken, false) },
    options,
  );
}

/** POST /admin/plugins/{id}/unload — unload a plugin by id. */
export function adminUnloadPlugin(
  baseUrl: string,
  adminToken: string,
  pluginId: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminPluginUnloadResult>> {
  return adminFetch(
    adminUrl(baseUrl, `/plugins/${encodeURIComponent(pluginId)}/unload`),
    { method: 'POST', headers: buildAdminHeaders(adminToken, false) },
    options,
  );
}

/** GET /admin/system — JVM / system runtime info. */
export function adminSystemInfo(
  baseUrl: string,
  adminToken: string,
  options?: AdminCallOptions,
): Promise<AdminResult<AdminSystemInfo>> {
  return adminFetch<AdminSystemInfo>(
    adminUrl(baseUrl, '/system'),
    { method: 'GET', headers: buildAdminHeaders(adminToken, false) },
    options,
  );
}
