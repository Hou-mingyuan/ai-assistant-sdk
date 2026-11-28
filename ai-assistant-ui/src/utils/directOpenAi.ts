import type { ProviderProtocol } from '../composables/useConnectionConfig';
import type { ChatPayload, ChatRuntimeMeta } from './api';

const DIRECT_CHAT_TIMEOUT_MS = 90_000;
const DIRECT_MODELS_TIMEOUT_MS = 15_000;
const MAX_DIRECT_TEXT_FILE_CHARS = 48_000;
const ANTHROPIC_API_VERSION = '2023-06-01';

const TEXT_FILE_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'tsv',
  'log',
  'json',
  'xml',
  'html',
  'htm',
  'yml',
  'yaml',
]);

function parseAndValidateBaseUrl(rawBaseUrl: string): { parsed: URL; isAbsolute: boolean } {
  const trimmed = rawBaseUrl.trim();
  if (!trimmed) {
    throw new Error('Base URL is required');
  }
  const normalized = trimmed.replace(/\/+$/, '');
  const originBase = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
  const parsed = new URL(normalized, originBase);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Base URL must use http:// or https://');
  }
  parsed.search = '';
  parsed.hash = '';
  return { parsed, isAbsolute: /^https?:\/\//i.test(normalized) };
}

function formatResolvedUrl(parsed: URL, isAbsolute: boolean): string {
  return isAbsolute ? parsed.toString() : `${parsed.pathname}${parsed.search}`;
}

export function resolveOpenAiEndpoint(
  rawBaseUrl: string,
  endpointPath: '/chat/completions' | '/models',
): string {
  const { parsed, isAbsolute } = parseAndValidateBaseUrl(rawBaseUrl);
  let cleanPath = parsed.pathname.replace(/\/+$/, '');
  if (/\/chat\/completions$/i.test(cleanPath)) {
    if (endpointPath === '/chat/completions') return formatResolvedUrl(parsed, isAbsolute);
    cleanPath = cleanPath.replace(/\/chat\/completions$/i, '');
  } else if (/\/models$/i.test(cleanPath)) {
    if (endpointPath === '/models') return formatResolvedUrl(parsed, isAbsolute);
    cleanPath = cleanPath.replace(/\/models$/i, '');
  }
  parsed.pathname = !cleanPath ? `/v1${endpointPath}` : `${cleanPath}${endpointPath}`;
  return formatResolvedUrl(parsed, isAbsolute);
}

/** Resolve endpoint URL for OpenAI, Anthropic, or Gemini protocols. */
export function resolveProviderEndpoint(
  rawBaseUrl: string,
  protocol: ProviderProtocol,
  endpoint: 'chat' | 'models',
  model?: string,
): string {
  if (protocol === 'openai') {
    return resolveOpenAiEndpoint(
      rawBaseUrl,
      endpoint === 'models' ? '/models' : '/chat/completions',
    );
  }
  const { parsed, isAbsolute } = parseAndValidateBaseUrl(rawBaseUrl);
  let cleanPath = parsed.pathname.replace(/\/+$/, '');

  if (protocol === 'anthropic') {
    cleanPath = cleanPath.replace(/\/(v1\/)?(messages|models)$/i, '');
    const pathTail = endpoint === 'models' ? '/models' : '/messages';
    parsed.pathname = /\/v1$/i.test(cleanPath)
      ? `${cleanPath}${pathTail}`
      : `${cleanPath}/v1${pathTail}`;
    return formatResolvedUrl(parsed, isAbsolute);
  }

  cleanPath = cleanPath.replace(/\/models(?:\/[^/]+:(?:stream)?generateContent)?$/i, '');
  const versioned = /\/v1(?:beta\d*)?$/i.test(cleanPath) ? cleanPath : `${cleanPath}/v1beta`;
  if (endpoint === 'models') {
    parsed.pathname = `${versioned}/models`;
  } else {
    const cleanModel = (model || '').trim().replace(/^models\//, '');
    if (!cleanModel) {
      throw new Error('请先填写或选择一个模型名称');
    }
    parsed.pathname = `${versioned}/models/${encodeURIComponent(cleanModel)}:streamGenerateContent`;
    parsed.search = '?alt=sse';
  }
  return formatResolvedUrl(parsed, isAbsolute);
}

function buildProtocolHeaders(
  protocol: ProviderProtocol,
  apiKey?: string,
  includeJsonContentType = true,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  const key = apiKey?.trim();
  if (protocol === 'openai') {
    if (key) headers.Authorization = `Bearer ${key}`;
    return headers;
  }
  if (protocol === 'anthropic') {
    headers['anthropic-version'] = ANTHROPIC_API_VERSION;
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
    if (key) headers['x-api-key'] = key;
    return headers;
  }
  if (key) headers['x-goog-api-key'] = key;
  return headers;
}

export interface DirectModelsResult {
  success: boolean;
  models: string[];
  error?: string;
}

export async function fetchOpenAiModels(
  baseUrl: string,
  apiKey?: string,
): Promise<DirectModelsResult> {
  return fetchProviderModels('openai', baseUrl, apiKey);
}

function parseProviderModelList(
  protocol: ProviderProtocol,
  json: Record<string, unknown>,
): string[] {
  if (protocol === 'gemini') {
    const raw = Array.isArray(json.models) ? json.models : [];
    return Array.from(
      new Set(
        raw
          .filter((item) => {
            if (!item || typeof item !== 'object') return false;
            const methods = (item as Record<string, unknown>).supportedGenerationMethods;
            return !Array.isArray(methods) || methods.includes('generateContent');
          })
          .map((item) => {
            const name = (item as Record<string, unknown>).name;
            return typeof name === 'string' ? name.replace(/^models\//, '').trim() : '';
          })
          .filter(Boolean),
      ),
    );
  }
  const rawList = Array.isArray(json.data)
    ? json.data
    : Array.isArray(json.models)
      ? json.models
      : [];
  return Array.from(
    new Set(
      rawList
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            const obj = item as Record<string, unknown>;
            if (typeof obj.id === 'string') return obj.id.trim();
            if (typeof obj.name === 'string') return obj.name.trim();
          }
          return '';
        })
        .filter(Boolean),
    ),
  );
}

export async function fetchProviderModels(
  protocol: ProviderProtocol,
  baseUrl: string,
  apiKey?: string,
): Promise<DirectModelsResult> {
  let url: string;
  try {
    url = resolveProviderEndpoint(baseUrl, protocol, 'models');
  } catch (e: unknown) {
    return { success: false, models: [], error: e instanceof Error ? e.message : String(e) };
  }

  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: buildProtocolHeaders(protocol, apiKey, false),
      signal: AbortSignal.timeout(DIRECT_MODELS_TIMEOUT_MS),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        success: false,
        models: [],
        error: extractDirectErrorMessage(text, res.status, res.statusText),
      };
    }
    const json = (await res.json()) as Record<string, unknown>;
    return { success: true, models: parseProviderModelList(protocol, json) };
  } catch (e: unknown) {
    return {
      success: false,
      models: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

type OpenAiChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content:
    | string
    | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
};

function resolveCurrentUserText(payload: ChatPayload): string {
  let userText = typeof payload.text === 'string' ? payload.text : '';
  if (payload.action === 'translate') {
    const lang = payload.targetLang || 'zh';
    userText = `Translate the following content into ${lang}:\n\n${userText}`;
  } else if (payload.action === 'summarize') {
    userText = `Summarize the following content clearly:\n\n${userText}`;
  }
  if (typeof payload.pageContext === 'string' && payload.pageContext.trim()) {
    userText = `${userText}\n\n[Page Context]\n${payload.pageContext.trim()}`;
  }
  return userText;
}

function collectPayloadImages(payload: ChatPayload): string[] {
  if (Array.isArray(payload.imageDataList)) {
    return payload.imageDataList.filter((u): u is string => typeof u === 'string' && u.length > 0);
  }
  return typeof payload.imageData === 'string' && payload.imageData ? [payload.imageData] : [];
}

function parseDataImageUri(uri: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;,]+);base64,(.+)$/i.exec(uri);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

export function buildOpenAiMessages(payload: ChatPayload): OpenAiChatMessage[] {
  const out: OpenAiChatMessage[] = [];
  if (typeof payload.systemPrompt === 'string' && payload.systemPrompt.trim()) {
    out.push({ role: 'system', content: payload.systemPrompt.trim() });
  }
  if (Array.isArray(payload.history)) {
    for (const item of payload.history) {
      if (!item || (item.role !== 'user' && item.role !== 'assistant' && item.role !== 'system')) {
        continue;
      }
      if (typeof item.content === 'string' && item.content) {
        out.push({ role: item.role, content: item.content });
      }
    }
  }

  const userText = resolveCurrentUserText(payload);
  const images = collectPayloadImages(payload);

  if (images.length > 0) {
    out.push({
      role: 'user',
      content: [
        { type: 'text', text: userText || 'Describe the attached image(s).' },
        ...images.map((url) => ({ type: 'image_url' as const, image_url: { url } })),
      ],
    });
  } else {
    out.push({ role: 'user', content: userText });
  }
  return out;
}

function pushAnthropicTurn(
  merged: Array<{ role: 'user' | 'assistant'; blocks: Array<Record<string, unknown>> }>,
  role: 'user' | 'assistant',
  blocks: Array<Record<string, unknown>>,
) {
  if (!blocks.length) return;
  if (merged.length === 0 && role === 'assistant') return;
  const last = merged[merged.length - 1];
  if (last && last.role === role) {
    last.blocks.push(...blocks);
  } else {
    merged.push({ role, blocks: [...blocks] });
  }
}

function buildAnthropicBody(model: string, payload: ChatPayload): Record<string, unknown> {
  const systemParts: string[] = [];
  if (typeof payload.systemPrompt === 'string' && payload.systemPrompt.trim()) {
    systemParts.push(payload.systemPrompt.trim());
  }
  const merged: Array<{ role: 'user' | 'assistant'; blocks: Array<Record<string, unknown>> }> = [];
  if (Array.isArray(payload.history)) {
    for (const item of payload.history) {
      if (!item || typeof item.content !== 'string' || !item.content) continue;
      if (item.role === 'system') systemParts.push(item.content);
      else if (item.role === 'user' || item.role === 'assistant') {
        pushAnthropicTurn(merged, item.role, [{ type: 'text', text: item.content }]);
      }
    }
  }
  const userText = resolveCurrentUserText(payload);
  const images = collectPayloadImages(payload);
  if (images.length > 0) {
    const blocks: Array<Record<string, unknown>> = [
      { type: 'text', text: userText || 'Describe the attached image(s).' },
    ];
    for (const url of images) {
      const parsed = parseDataImageUri(url);
      if (parsed) {
        blocks.push({
          type: 'image',
          source: { type: 'base64', media_type: parsed.mimeType, data: parsed.data },
        });
      }
    }
    pushAnthropicTurn(merged, 'user', blocks);
  } else {
    pushAnthropicTurn(merged, 'user', [{ type: 'text', text: userText }]);
  }

  const messages = merged.map((turn) => ({
    role: turn.role,
    content:
      turn.blocks.length === 1 && turn.blocks[0].type === 'text'
        ? (turn.blocks[0].text as string)
        : turn.blocks,
  }));

  return {
    model,
    max_tokens: 4096,
    stream: true,
    ...(systemParts.length > 0 ? { system: systemParts.join('\n\n') } : {}),
    messages,
  };
}

function buildGeminiBody(payload: ChatPayload): Record<string, unknown> {
  const systemParts: string[] = [];
  if (typeof payload.systemPrompt === 'string' && payload.systemPrompt.trim()) {
    systemParts.push(payload.systemPrompt.trim());
  }
  const contents: Array<{ role: 'user' | 'model'; parts: Array<Record<string, unknown>> }> = [];
  if (Array.isArray(payload.history)) {
    for (const item of payload.history) {
      if (!item || typeof item.content !== 'string' || !item.content) continue;
      if (item.role === 'system') systemParts.push(item.content);
      else if (item.role === 'user' || item.role === 'assistant') {
        contents.push({
          role: item.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: item.content }],
        });
      }
    }
  }
  const userText = resolveCurrentUserText(payload);
  const userParts: Array<Record<string, unknown>> = [
    { text: userText || 'Describe the attached image(s).' },
  ];
  for (const url of collectPayloadImages(payload)) {
    const parsed = parseDataImageUri(url);
    if (parsed) {
      userParts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } });
    }
  }
  contents.push({ role: 'user', parts: userParts });

  return {
    ...(systemParts.length > 0
      ? { systemInstruction: { parts: [{ text: systemParts.join('\n\n') }] } }
      : {}),
    contents,
  };
}

function extractDirectErrorMessage(raw: string, status: number, statusText: string): string {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const errObj = parsed.error;
      if (
        errObj &&
        typeof errObj === 'object' &&
        typeof (errObj as Record<string, unknown>).message === 'string'
      ) {
        return `HTTP ${status}: ${(errObj as Record<string, unknown>).message}`;
      }
      if (typeof parsed.message === 'string') return `HTTP ${status}: ${parsed.message}`;
    } catch {
      /* ignore non-JSON body */
    }
  }
  return `HTTP ${status}: ${statusText || 'Request failed'}`;
}

function extractEventJson(rawEvent: string): Record<string, unknown> | null {
  const dataLines = rawEvent
    .split('\n')
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.replace(/^data:\s?/, ''));
  if (!dataLines.length) return null;
  const joined = dataLines.join('\n').trim();
  if (!joined || joined === '[DONE]') return null;
  try {
    const parsed = JSON.parse(joined) as Record<string, unknown>;
    if (parsed.error && typeof parsed.error === 'object') {
      const msg = (parsed.error as Record<string, unknown>).message;
      throw new Error(typeof msg === 'string' ? msg : 'Upstream model error');
    }
    return parsed;
  } catch (e: unknown) {
    if (e instanceof Error && !e.message.toLowerCase().includes('json')) {
      throw e;
    }
    return null;
  }
}

function parseProviderSseDelta(protocol: ProviderProtocol, rawEvent: string): string | undefined {
  const parsed = extractEventJson(rawEvent);
  if (!parsed) return undefined;

  if (protocol === 'openai') {
    const choices = Array.isArray(parsed.choices) ? parsed.choices : [];
    const first = choices[0] as Record<string, unknown> | undefined;
    if (!first) return undefined;
    const delta = first.delta as Record<string, unknown> | undefined;
    if (delta && typeof delta.content === 'string') return delta.content;
    const message = first.message as Record<string, unknown> | undefined;
    if (message && typeof message.content === 'string') return message.content;
    return undefined;
  }

  if (protocol === 'anthropic') {
    if (parsed.type === 'content_block_delta') {
      const delta = parsed.delta as Record<string, unknown> | undefined;
      if (delta && typeof delta.text === 'string') return delta.text;
    }
    return undefined;
  }

  const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];
  const first = candidates[0] as Record<string, unknown> | undefined;
  const content = first?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  const text = parts
    .map((part) =>
      part && typeof (part as Record<string, unknown>).text === 'string'
        ? ((part as Record<string, unknown>).text as string)
        : '',
    )
    .join('');
  return text || undefined;
}

function extractNonStreamText(protocol: ProviderProtocol, json: Record<string, unknown>): string {
  if (protocol === 'openai') {
    const first = (Array.isArray(json.choices) ? json.choices[0] : undefined) as
      Record<string, unknown> | undefined;
    const msg = first?.message as Record<string, unknown> | undefined;
    return typeof msg?.content === 'string' ? msg.content : '';
  }
  if (protocol === 'anthropic') {
    const content = Array.isArray(json.content) ? json.content : [];
    return content
      .map((item) =>
        item && typeof (item as Record<string, unknown>).text === 'string'
          ? ((item as Record<string, unknown>).text as string)
          : '',
      )
      .join('');
  }
  const first = (Array.isArray(json.candidates) ? json.candidates[0] : undefined) as
    Record<string, unknown> | undefined;
  const content = first?.content as Record<string, unknown> | undefined;
  const parts = Array.isArray(content?.parts) ? content.parts : [];
  return parts
    .map((p) =>
      p && typeof (p as Record<string, unknown>).text === 'string'
        ? ((p as Record<string, unknown>).text as string)
        : '',
    )
    .join('');
}

async function* readSseTextStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  parseEvent: (rawEvent: string) => string | undefined,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        const trailing = parseEvent(buffer);
        if (trailing) yield trailing;
        break;
      }
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      let eventEnd = buffer.indexOf('\n\n');
      while (eventEnd >= 0) {
        const event = buffer.slice(0, eventEnd);
        buffer = buffer.slice(eventEnd + 2);
        const delta = parseEvent(event);
        if (delta) yield delta;
        eventEnd = buffer.indexOf('\n\n');
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}

export async function* streamDirectProviderChat(
  protocol: ProviderProtocol,
  baseUrl: string,
  payload: ChatPayload,
  apiKey?: string,
  signal?: AbortSignal,
  onMeta?: (meta: ChatRuntimeMeta) => void,
): AsyncGenerator<string> {
  const model =
    typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : '';
  if (!model) {
    throw new Error('请先在设置中填写或选择模型名称（Model）');
  }
  const url = resolveProviderEndpoint(baseUrl, protocol, 'chat', model);
  const body =
    protocol === 'openai'
      ? { model, messages: buildOpenAiMessages(payload), stream: true }
      : protocol === 'anthropic'
        ? buildAnthropicBody(model, payload)
        : buildGeminiBody(payload);

  const res = await fetch(url, {
    method: 'POST',
    headers: buildProtocolHeaders(protocol, apiKey, true),
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(DIRECT_CHAT_TIMEOUT_MS),
  });

  if (!res.ok) {
    const rawErr = await res.text().catch(() => '');
    throw new Error(extractDirectErrorMessage(rawErr, res.status, res.statusText));
  }

  onMeta?.({
    requestedModel: model,
    effectiveModel: model,
    provider: `direct-${protocol}`,
  });

  const contentType = res.headers?.get?.('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await res.json()) as Record<string, unknown>;
    const text = extractNonStreamText(protocol, json);
    if (text) yield text;
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Stream body is unavailable');
  yield* readSseTextStream(reader, (ev) => parseProviderSseDelta(protocol, ev));
}

export async function* streamDirectOpenAiChat(
  baseUrl: string,
  payload: ChatPayload,
  apiKey?: string,
  signal?: AbortSignal,
  onMeta?: (meta: ChatRuntimeMeta) => void,
): AsyncGenerator<string> {
  yield* streamDirectProviderChat('openai', baseUrl, payload, apiKey, signal, onMeta);
}

export async function readTextFileForDirectQa(
  file: File,
  question?: string,
): Promise<{ ok: true; promptText: string } | { ok: false; error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isTextLike = TEXT_FILE_EXTENSIONS.has(ext) || file.type.startsWith('text/');
  if (!isTextLike) {
    return {
      ok: false,
      error:
        '直连模型模式仅支持直接读取文本/Markdown/JSON/CSV 文件；解析 PDF/Word/Excel 请在设置中切回「后端代理」模式。',
    };
  }
  const rawText = await file.text();
  const truncated =
    rawText.length > MAX_DIRECT_TEXT_FILE_CHARS
      ? `${rawText.slice(0, MAX_DIRECT_TEXT_FILE_CHARS)}\n\n...[已截断，仅展示前 ${MAX_DIRECT_TEXT_FILE_CHARS} 字符]`
      : rawText;
  const trimmedQ = question?.trim();
  const instruction = trimmedQ
    ? `请结合以下上传文件内容回答问题：\n问题：${trimmedQ}`
    : '请用中文总结以下上传文件的核心内容、关键要点和待办事项：';
  return {
    ok: true,
    promptText: `${instruction}\n\n文件名：${file.name}\n\`\`\`\n${truncated}\n\`\`\``,
  };
}
