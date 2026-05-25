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

export type HistoryMessage = ApiSchemas['MessageItem'];

export type ChatPayload = ApiSchemas['ChatRequest'];

export type ModelsListResult = ApiSchemas['ModelsListResponse'];

export type ModelDetail = ApiSchemas['ModelDetail'];

export interface FetchModelsOptions {
  probe?: boolean;
}

export type ChatResult = ApiSchemas['ChatResponse'];
export type ChatRuntimeMeta = ApiSchemas['RuntimeMeta'];

export type RuntimeModelConfigResult = ApiSchemas['RuntimeModelConfigResult'];

export type RuntimeModelConfigPayload = ApiSchemas['RuntimeModelConfigPayload'];

export type UrlPreviewResult = ApiSchemas['UrlPreviewResponse'];

export interface HealthResult {
  success?: boolean;
  webSearchProvider?: string;
  webSearchStableProviderConfigured?: boolean;
  webSearchMaxResults?: number;
}

export type ExportRequestPayload = JsonRequestBody<'/export', 'post'>;

export type FileUploadResponse = JsonResponse<'/file/summarize', 'post'>;

export type PromptTemplatesResponse = JsonResponse<'/templates', 'get'>;

export type RuntimeDiscoverModelsResult = JsonResponse<
  '/admin/runtime/model-config/discover-models',
  'post'
>;

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const normalizedToken = normalizeToken(token);
  if (normalizedToken) headers['X-AI-Token'] = normalizedToken;
  return headers;
}

function buildRuntimeConfigHeaders(token?: string, adminToken?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const normalizedAdminToken = normalizeToken(adminToken);
  const normalizedToken = normalizeToken(token);
  if (normalizedAdminToken) {
    headers['X-Admin-Token'] = normalizedAdminToken;
  } else if (normalizedToken) {
    headers['X-AI-Token'] = normalizedToken;
  }
  return headers;
}

function normalizeToken(token?: string): string | undefined {
  const trimmed = token?.trim();
  return trimmed ? trimmed : undefined;
}

function apiUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}${path}`;
}

function parseSseDataEvent(event: string): string | undefined {
  /* Per SSE spec only the *first* whitespace after `data:` is the separator
   * and must be stripped; trailing data spaces are part of the payload. We
   * intentionally avoid a closing `.trim()` so chunks like `data:  world`
   * keep the leading space and concatenate to the previous chunk as
   * `Hello world` rather than `Helloworld`. */
  const data = event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, ''))
    .join('\n');
  if (!data) return undefined;
  if (data === '[DONE]') return undefined;
  return data;
}

function streamMetaFromHeaders(headers?: Headers): ChatRuntimeMeta | undefined {
  if (!headers) return undefined;
  const visionInputCountRaw = headers.get('X-AI-Vision-Input-Count');
  const webSearchResultCountRaw = headers.get('X-AI-Web-Search-Result-Count');
  const webSearchSourceUrlsRaw = headers.get('X-AI-Web-Search-Source-Urls');
  const meta: ChatRuntimeMeta = {
    requestedModel: headers.get('X-AI-Requested-Model') || undefined,
    effectiveModel: headers.get('X-AI-Effective-Model') || undefined,
    provider: headers.get('X-AI-Provider') || undefined,
    fallback: headers.get('X-AI-Fallback') === 'true' ? true : undefined,
    visionInputCount: visionInputCountRaw ? Number(visionInputCountRaw) : undefined,
    visionRoute: headers.get('X-AI-Vision-Route') || undefined,
    webSearchEnabled: headers.get('X-AI-Web-Search') === 'true' ? true : undefined,
    webSearchProvider: headers.get('X-AI-Web-Search-Provider') || undefined,
    webSearchFallback:
      headers.get('X-AI-Web-Search-Fallback') === 'true'
        ? true
        : headers.get('X-AI-Web-Search-Fallback') === 'false'
          ? false
          : undefined,
    webSearchResultCount: webSearchResultCountRaw ? Number(webSearchResultCountRaw) : undefined,
    webSearchSourceUrls: parseEncodedHeaderList(webSearchSourceUrlsRaw),
  };
  return Object.values(meta).some((value) => value !== undefined) ? meta : undefined;
}

function parseEncodedHeaderList(raw?: string | null): string[] | undefined {
  if (!raw) return undefined;
  const values = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .filter(Boolean);
  return values.length ? values : undefined;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const FILE_UPLOAD_TIMEOUT_MS = 300_000;
const EXPORT_TIMEOUT_MS = 180_000;
const MODEL_LIST_CACHE_TTL_MS = 30_000;

type CachedModelsResult = {
  expiresAt: number;
  result: ModelsListResult;
};

const modelsCache = new Map<string, CachedModelsResult>();
const modelsInFlight = new Map<string, Promise<ModelsListResult>>();

export function __clearApiCachesForTests(): void {
  modelsCache.clear();
  modelsInFlight.clear();
}

export type ExportFormat = 'xlsx' | 'docx' | 'pdf';

export type ExportProgressPhase = 'response' | 'download';

/**
 * Export chat messages to a file via the server-side `/export` endpoint.
 * Downloads the generated file (XLSX/DOCX/PDF) in the browser.
 *
 * @param baseUrl   AI assistant API base URL
 * @param format    Target format: 'xlsx', 'docx', or 'pdf'
 * @param title     Export file title (used as filename stem)
 * @param messages  Array of chat messages to export
 * @param token     Optional X-AI-Token for authentication
 * @param onProgress Optional callback for download progress phases
 */
export async function postServerExport(
  baseUrl: string,
  format: ExportFormat,
  title: string,
  messages: { role: string; content: string }[],
  token?: string,
  onProgress?: (phase: ExportProgressPhase) => void,
  theme?: 'light' | 'dark',
): Promise<{ ok: true } | { ok: false; error: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const normalizedToken = normalizeToken(token);
  if (normalizedToken) headers['X-AI-Token'] = normalizedToken;
  const body: ExportRequestPayload = { format, title, messages };
  if (theme) body.theme = theme;
  const res = await fetch(apiUrl(baseUrl, '/export'), {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    return { ok: false, error: err || `HTTP ${res.status}` };
  }
  onProgress?.('response');
  let blob = await res.blob();
  /* PDF 的 application/pdf 在部分浏览器会对 blob: 内联预览而不出「另存为」；改为 octet-stream 促发下载 */
  if (format === 'pdf') {
    const buf = await blob.arrayBuffer();
    blob = new Blob([buf], { type: 'application/octet-stream' });
  }
  const cd = res.headers.get('Content-Disposition');
  let filename = `export.${format}`;
  if (cd) {
    /* 优先 filename="..."；仅在没有时再解析 filename*=UTF-8''（避免异常 filename* 污染下载名） */
    const quoted = cd.match(/filename="([^"]+)"/i);
    if (quoted?.[1]) {
      filename = quoted[1];
    } else {
      const star = cd.match(/filename\*=UTF-8''([^;\s]+)/i);
      if (star?.[1]) {
        try {
          filename = decodeURIComponent(star[1]);
        } catch {
          filename = star[1];
        }
      }
    }
  }
  onProgress?.('download');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return { ok: true };
}

export type PromptTemplateEntry = PromptTemplatesResponse[number];

export interface PromptTemplatesListResult {
  success: boolean;
  templates?: PromptTemplateEntry[];
  error?: string;
}

/**
 * Fetch the server-side prompt template registry (`GET /templates`).
 *
 * The endpoint returns a flat JSON array (not wrapped in `{success, ...}`), so
 * this helper normalises both successful and failed responses into the same
 * `PromptTemplatesListResult` shape used by the UI layer.
 */
export async function fetchPromptTemplates(
  baseUrl: string,
  token?: string,
): Promise<PromptTemplatesListResult> {
  const headers: Record<string, string> = {};
  const normalizedToken = normalizeToken(token);
  if (normalizedToken) headers['X-AI-Token'] = normalizedToken;
  try {
    const res = await fetch(apiUrl(baseUrl, '/templates'), {
      headers,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      return { success: false, error: 'Unexpected response: expected an array' };
    }
    const templates: PromptTemplateEntry[] = data
      .filter((item): item is Record<string, unknown> => item != null && typeof item === 'object')
      .map((item) => ({
        name: typeof item.name === 'string' ? item.name : '',
        template: typeof item.template === 'string' ? item.template : '',
        hasFewShot: item.hasFewShot === true,
      }))
      .filter((t) => t.name && t.template);
    return { success: true, templates };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Fetch the list of available models from the server. */
export async function fetchModels(
  baseUrl: string,
  token?: string,
  options: FetchModelsOptions = {},
): Promise<ModelsListResult> {
  const normalizedToken = normalizeToken(token);
  const probe = options.probe === true;
  const cacheKey = `${baseUrl.replace(/\/+$/, '')}::${normalizedToken ?? ''}::probe=${probe}`;
  const now = Date.now();
  const cached = modelsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }
  const pending = modelsInFlight.get(cacheKey);
  if (pending) return pending;

  const headers: Record<string, string> = {};
  if (normalizedToken) headers['X-AI-Token'] = normalizedToken;
  const request = (async () => {
    const res = await fetch(apiUrl(baseUrl, probe ? '/models?probe=true' : '/models'), {
      headers,
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
    }
    const result = (await res.json()) as ModelsListResult;
    if (result.success) {
      modelsCache.set(cacheKey, {
        expiresAt: Date.now() + MODEL_LIST_CACHE_TTL_MS,
        result,
      });
    }
    return result;
  })();
  modelsInFlight.set(cacheKey, request);
  try {
    return await request;
  } finally {
    modelsInFlight.delete(cacheKey);
  }
}

export async function fetchHealth(baseUrl: string, token?: string): Promise<HealthResult> {
  const res = await fetch(apiUrl(baseUrl, '/health'), {
    method: 'GET',
    headers: buildHeaders(token),
  });
  if (!res.ok) {
    return { success: false };
  }
  return res.json();
}

export async function fetchRuntimeModelConfig(
  baseUrl: string,
  token?: string,
  adminToken?: string,
): Promise<RuntimeModelConfigResult> {
  const res = await fetch(apiUrl(baseUrl, '/admin/runtime/model-config'), {
    headers: buildRuntimeConfigHeaders(token, adminToken),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }
  return res.json();
}

export async function saveRuntimeModelConfig(
  baseUrl: string,
  payload: RuntimeModelConfigPayload,
  token?: string,
  adminToken?: string,
): Promise<RuntimeModelConfigResult> {
  const res = await fetch(apiUrl(baseUrl, '/admin/runtime/model-config'), {
    method: 'POST',
    headers: buildRuntimeConfigHeaders(token, adminToken),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }
  return res.json();
}

export async function discoverRuntimeProviderModels(
  baseUrl: string,
  token?: string,
  adminToken?: string,
): Promise<RuntimeDiscoverModelsResult> {
  const res = await fetch(apiUrl(baseUrl, '/admin/runtime/model-config/discover-models'), {
    method: 'POST',
    headers: buildRuntimeConfigHeaders(token, adminToken),
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }
  return res.json();
}

/** Fetch URL preview (title, summary, images) from the server. */
export async function fetchUrlPreview(
  baseUrl: string,
  url: string,
  token?: string,
): Promise<UrlPreviewResult> {
  const q = encodeURIComponent(url);
  const headers: Record<string, string> = {};
  const normalizedToken = normalizeToken(token);
  if (normalizedToken) headers['X-AI-Token'] = normalizedToken;
  const res = await fetch(apiUrl(baseUrl, `/url-preview?url=${q}`), {
    headers,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }
  return res.json();
}

/** Send a synchronous chat/translate/summarize request. */
export async function postChat(
  baseUrl: string,
  payload: ChatPayload,
  token?: string,
): Promise<ChatResult> {
  const res = await fetch(apiUrl(baseUrl, '/chat'), {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }
  return res.json();
}

/** Upload a file for summarization or translation. */
export async function uploadFile(
  baseUrl: string,
  file: File,
  action: 'summarize' | 'translate' = 'summarize',
  targetLang = 'zh',
  token?: string,
): Promise<FileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (action === 'translate') {
    formData.append('targetLang', targetLang);
  }

  const headers: Record<string, string> = {};
  const normalizedToken = normalizeToken(token);
  if (normalizedToken) headers['X-AI-Token'] = normalizedToken;

  const endpoint = action === 'translate' ? '/file/translate' : '/file/summarize';
  const res = await fetch(apiUrl(baseUrl, endpoint), {
    method: 'POST',
    headers,
    body: formData,
    signal: AbortSignal.timeout(FILE_UPLOAD_TIMEOUT_MS),
  });
  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}: ${res.statusText}` };
  }
  return res.json();
}

/**
 * Streaming chat/translate/summarize via SSE. Yields content deltas.
 * Pass an {@link AbortSignal} to cancel the stream mid-flight.
 */
export async function* streamChat(
  baseUrl: string,
  payload: ChatPayload,
  token?: string,
  signal?: AbortSignal,
  onMeta?: (meta: ChatRuntimeMeta) => void,
): AsyncGenerator<string> {
  const res = await fetch(apiUrl(baseUrl, '/stream'), {
    method: 'POST',
    headers: buildHeaders(token),
    body: JSON.stringify(payload),
    signal,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const meta = streamMetaFromHeaders(res.headers);
  if (meta) onMeta?.(meta);

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Stream not available');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const trailing = parseSseDataEvent(buffer);
        if (trailing) yield trailing;
        break;
      }

      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      let eventEnd = buffer.indexOf('\n\n');
      while (eventEnd >= 0) {
        const event = buffer.slice(0, eventEnd);
        buffer = buffer.slice(eventEnd + 2);
        const data = parseSseDataEvent(event);
        if (data) yield data;
        eventEnd = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
