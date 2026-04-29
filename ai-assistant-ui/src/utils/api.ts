export interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatPayload {
  action: 'translate' | 'summarize' | 'chat';
  text: string;
  targetLang?: string;
  history?: HistoryMessage[];
  /** 对话模式可选：覆盖服务端默认 system prompt（需后端 allow-client-system-prompt） */
  systemPrompt?: string;
  /** 对话模式可选：须在服务端 allowed-models 白名单内 */
  model?: string;
  /** Base64 image data (data URI or raw base64) for vision models */
  imageData?: string;
}

export interface ModelsListResult {
  success: boolean;
  models?: string[];
  defaultModel?: string;
  error?: string;
}

export interface ChatResult {
  success: boolean;
  result?: string;
  error?: string;
}

export interface UrlPreviewResult {
  success: boolean;
  imageUrl?: string;
  title?: string;
  summary?: string;
  imageUrls?: string[];
  error?: string;
}

function buildHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const normalizedToken = normalizeToken(token);
  if (normalizedToken) headers['X-AI-Token'] = normalizedToken;
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
  const data = event
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, ''))
    .join('\n')
    .trim();
  return data && data !== '[DONE]' ? data : undefined;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const FILE_UPLOAD_TIMEOUT_MS = 300_000;
const EXPORT_TIMEOUT_MS = 180_000;

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
  const body: Record<string, unknown> = { format, title, messages };
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

/** Fetch the list of available models from the server. */
export async function fetchModels(baseUrl: string, token?: string): Promise<ModelsListResult> {
  const headers: Record<string, string> = {};
  const normalizedToken = normalizeToken(token);
  if (normalizedToken) headers['X-AI-Token'] = normalizedToken;
  const res = await fetch(apiUrl(baseUrl, '/models'), {
    headers,
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
): Promise<ChatResult> {
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
