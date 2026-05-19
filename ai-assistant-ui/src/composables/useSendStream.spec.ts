/**
 * Unit tests for {@link useSendStream}'s independently-exported pure helpers.
 *
 * The orchestration entry point (`useSendStream(deps).send()`) is intentionally
 * left to integration / browser tests because it owns DOM-bound side effects
 * (`requestAnimationFrame`, scroll coalescing, message-list mutation). The
 * branch heavy normalisation / sanitisation pipeline that used to live inline
 * in `AiAssistant.vue` is what these tests pin down so the SFC split cannot
 * silently regress upstream-service-error mapping, abort detection, or tool-
 * trace stripping.
 */
import { computed, ref } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getMessages } from '../utils/i18n';
import {
  countBraceBalance,
  hasVisibleAssistantContent,
  isAssistantAbortError,
  isVisionCapableModel,
  normalizeAssistantServiceError,
  sanitizeAssistantContent,
  shouldWarnForVisionModel,
  stripInternalToolTrace,
  useSendStream,
} from './useSendStream';

const en = getMessages('en');
const zh = getMessages('zh');

describe('countBraceBalance', () => {
  it('counts opens minus closes across both bracket families', () => {
    expect(countBraceBalance('{}')).toBe(0);
    expect(countBraceBalance('{')).toBe(1);
    expect(countBraceBalance('}')).toBe(-1);
    expect(countBraceBalance('[[]]')).toBe(0);
    expect(countBraceBalance('{ "k": [1, 2, 3]')).toBe(1);
  });

  it('returns 0 for non-bracket characters', () => {
    expect(countBraceBalance('abc')).toBe(0);
    expect(countBraceBalance('')).toBe(0);
  });
});

describe('stripInternalToolTrace', () => {
  it('drops leaked `cap_*` blockquote tool calls and their balanced JSON', () => {
    const input = ['> 🔧 **cap_search** {', '  "query": "hello"', '}', 'Real answer line.'].join(
      '\n',
    );
    const result = stripInternalToolTrace(input);
    expect(result).toBe('Real answer line.');
  });

  it('drops fenced `cap_*` header lines (the `{` follows on subsequent lines)', () => {
    const input = ['```cap_lookup', 'Visible answer.'].join('\n');
    const result = stripInternalToolTrace(input);
    expect(result).toBe('Visible answer.');
  });

  it('drops `cap_*(...)` call lines whose JSON spans multiple lines', () => {
    const input = ['cap_search({', '  "q": "hi"', '})', 'Visible answer.'].join('\n');
    const result = stripInternalToolTrace(input);
    expect(result).toBe('Visible answer.');
  });

  it('drops the success tick lines that some upstream models inject', () => {
    const input = ['> ✅ cap_search', 'Visible.'].join('\n');
    expect(stripInternalToolTrace(input)).toBe('Visible.');
  });

  it('preserves normal content that merely contains a `cap_` substring', () => {
    expect(stripInternalToolTrace('use_cap_lock to capitalise')).toBe('use_cap_lock to capitalise');
  });

  it('collapses 3-or-more blank lines down to two', () => {
    expect(stripInternalToolTrace('a\n\n\n\nb')).toBe('a\n\nb');
  });
});

describe('normalizeAssistantServiceError', () => {
  it('collapses abort-cancellation messages to empty string', () => {
    expect(normalizeAssistantServiceError('Error: AbortError', en)).toBe('');
    expect(normalizeAssistantServiceError('signal is aborted without reason', en)).toBe('');
  });

  it('maps HTTP 429 / rate-limit / concurrent-session to the busy bucket', () => {
    expect(normalizeAssistantServiceError('HTTP 429 too many requests', en)).toBe(
      en.serviceBusyError,
    );
    expect(normalizeAssistantServiceError('rate limit hit', en)).toBe(en.serviceBusyError);
    expect(normalizeAssistantServiceError('concurrent session limit', en)).toBe(
      en.serviceBusyError,
    );
  });

  it('maps HTTP 503 / no providers / format mismatch to the unavailable bucket', () => {
    expect(normalizeAssistantServiceError('HTTP 503 backend', en)).toBe(en.serviceUnavailableError);
    expect(normalizeAssistantServiceError('no_available_providers', en)).toBe(
      en.serviceUnavailableError,
    );
    expect(normalizeAssistantServiceError('format_type_mismatch', en)).toBe(
      en.serviceUnavailableError,
    );
  });

  it('maps generic "AI service error / Check server logs" prompts', () => {
    expect(
      normalizeAssistantServiceError('AI service error. Check server logs for details', en),
    ).toBe(en.serviceGenericError);
  });

  it('passes through unknown errors verbatim', () => {
    expect(normalizeAssistantServiceError('some other thing', en)).toBe('some other thing');
  });

  it('honours the supplied locale bundle (en vs zh)', () => {
    expect(normalizeAssistantServiceError('HTTP 429', zh)).toBe(zh.serviceBusyError);
    expect(normalizeAssistantServiceError('HTTP 429', en)).toBe(en.serviceBusyError);
  });
});

describe('isAssistantAbortError', () => {
  it('returns true whenever the user-stop flag is set, regardless of error shape', () => {
    expect(isAssistantAbortError(new Error('boom'), true)).toBe(true);
    expect(isAssistantAbortError(undefined, true)).toBe(true);
    expect(isAssistantAbortError('weird', true)).toBe(true);
  });

  it('detects DOMException AbortError by name', () => {
    const e = new DOMException('aborted', 'AbortError');
    expect(isAssistantAbortError(e, false)).toBe(true);
  });

  it('detects abort/signal-is-aborted in Error name/message', () => {
    expect(isAssistantAbortError(new Error('signal is aborted'), false)).toBe(true);
    expect(isAssistantAbortError(new Error('Request aborted by user'), false)).toBe(true);
  });

  it('detects abort in stringified non-Error values', () => {
    expect(isAssistantAbortError('aborted', false)).toBe(true);
  });

  it('returns false for unrelated errors', () => {
    expect(isAssistantAbortError(new Error('timeout'), false)).toBe(false);
    expect(isAssistantAbortError('connection refused', false)).toBe(false);
  });
});

describe('sanitizeAssistantContent', () => {
  it('returns abort messages as empty string (no further processing)', () => {
    expect(sanitizeAssistantContent('Error: AbortError', en)).toBe('');
  });

  it('chains normalize → strip-tool-trace', () => {
    const input = ['> 🔧 **cap_x** {', '  "a": 1', '}', 'Answer body.'].join('\n');
    expect(sanitizeAssistantContent(input, en)).toBe('Answer body.');
  });

  it('translates upstream 429 even when wrapped in a multi-line response', () => {
    expect(sanitizeAssistantContent('HTTP 429 too many requests', en)).toBe(en.serviceBusyError);
  });
});

describe('hasVisibleAssistantContent', () => {
  it('returns false for empty, whitespace-only, and abort messages', () => {
    expect(hasVisibleAssistantContent('', en)).toBe(false);
    expect(hasVisibleAssistantContent('   \n  ', en)).toBe(false);
    expect(hasVisibleAssistantContent('Error: AbortError', en)).toBe(false);
  });

  it('returns false when the only content is a tool trace block', () => {
    const input = ['> 🔧 **cap_x** {', '  "a": 1', '}'].join('\n');
    expect(hasVisibleAssistantContent(input, en)).toBe(false);
  });

  it('returns false when the stream only contains thinking markup', () => {
    expect(hasVisibleAssistantContent('<think>Inspecting the page...</think>', zh)).toBe(false);
  });

  it('returns true for any plain response body', () => {
    expect(hasVisibleAssistantContent('Hi there', en)).toBe(true);
  });
});

describe('vision model guard', () => {
  it('recognizes common multimodal model names by default', () => {
    expect(isVisionCapableModel('gpt-4o-mini')).toBe(true);
    expect(isVisionCapableModel('claude-3-5-sonnet-latest')).toBe(true);
    expect(isVisionCapableModel('gemini-2.5-pro')).toBe(true);
    expect(isVisionCapableModel('qwen2.5-vl')).toBe(true);
    expect(isVisionCapableModel('MiniMax-M2.7')).toBe(true);
  });

  it('lets hosts extend the vision-capable pattern list', () => {
    expect(isVisionCapableModel('company-image-router', [/image-router/i])).toBe(true);
  });

  it('warns only when an attached image targets a known non-vision model', () => {
    expect(shouldWarnForVisionModel('gpt-3.5-turbo', true)).toBe(true);
    expect(shouldWarnForVisionModel('gpt-4o', true)).toBe(false);
    expect(shouldWarnForVisionModel('MiniMax-M2.7', true)).toBe(false);
    expect(shouldWarnForVisionModel('', true)).toBe(false);
    expect(shouldWarnForVisionModel('gpt-3.5-turbo', false)).toBe(false);
  });
});

describe('useSendStream local page snapshot', () => {
  beforeEach(() => {
    document.title = '客户资料页';
    document.body.innerHTML = `
      <main>
        <h1>客户档案</h1>
        <label for="customer">客户姓名</label>
        <input id="customer" value="张三" />
      </main>
    `;
  });

  it('answers current-page content requests locally without requiring a backend stream', async () => {
    const messages = ref([]);
    const input = ref('当前页面有什么内容？');
    const loading = ref(false);
    const streamWithFallback = vi.fn();
    const emitResponse = vi.fn();

    const send = useSendStream({
      messages,
      input,
      loading,
      sessionTitle: ref(''),
      activeSessionId: ref(''),
      mode: ref('chat'),
      targetLang: ref('zh'),
      chatSystemPrompt: ref(''),
      selectedChatModel: ref(''),
      modelChoices: ref([]),
      pendingImageDataList: ref([]),
      pendingImageThumbs: ref([]),
      options: {},
      t: computed(() => zh),
      streamWithFallback,
      fetchUrlPreview: vi.fn(),
      extractHttpUrls: () => [],
      isProbablyDirectImageUrl: () => false,
      firstNonImageHttpUrl: () => undefined,
      preferHttpsImageUrlWhenPageIsSecure: (url) => url,
      clearPendingImage: vi.fn(),
      scrollToBottom: vi.fn(),
      playNotificationSound: vi.fn(),
      trimMessagesForMemoryCap: vi.fn(),
      clearRenderCache: vi.fn(),
      reportAssistantError: vi.fn(),
      updateActiveSessionTitle: vi.fn(),
      emitSend: vi.fn(),
      emitResponse,
      emitError: vi.fn(),
      getStreamAbortController: () => null,
      setStreamAbortController: vi.fn(),
      getStreamStoppedByUser: () => false,
      setStreamStoppedByUser: vi.fn(),
    }).send;

    await send();

    expect(streamWithFallback).not.toHaveBeenCalled();
    expect(input.value).toBe('');
    expect(messages.value).toHaveLength(2);
    expect(messages.value[1].content).toContain('# 当前页面内容');
    expect(messages.value[1].content).toContain('- 客户姓名: 张三');
    expect(messages.value[1].meta).toEqual(
      expect.objectContaining({
        elapsedMs: expect.any(Number),
        ttftMs: expect.any(Number),
      }),
    );
    expect(emitResponse).toHaveBeenCalledWith(expect.stringContaining('客户档案'));
  });

  it('attaches an automatic screenshot when the user asks for visual page analysis', async () => {
    document.title = '客户资料页';
    document.body.innerHTML = `
      <main>
        <h1>客户档案</h1>
        <label for="name">客户姓名</label>
        <input id="name" value="张三" />
      </main>
    `;
    const messages = ref([]);
    const input = ref('分析当前截图里有什么');
    const loading = ref(false);
    const streamWithFallback = vi.fn(async function* (_baseUrl, _payload, _token, _signal, onMeta) {
      onMeta?.({
        requestedModel: 'MiniMax-M2.7',
        effectiveModel: 'MiniMax-M2.7',
        provider: 'minimax',
        fallback: false,
        visionInputCount: 1,
        visionRoute: 'minimax-vlm',
      });
      yield '截图中包含客户档案';
    });
    const captureScreenshotForAnalysis = vi
      .fn()
      .mockResolvedValue({ type: 'image', data: 'data:image/png;base64,shot' });

    const send = useSendStream({
      messages,
      input,
      loading,
      sessionTitle: ref(''),
      activeSessionId: ref(''),
      mode: ref('chat'),
      targetLang: ref('zh'),
      chatSystemPrompt: ref(''),
      selectedChatModel: ref('MiniMax-M2.7'),
      modelChoices: ref(['MiniMax-M2.7']),
      pendingImageDataList: ref([]),
      pendingImageThumbs: ref([]),
      options: { baseUrl: '/ai-assistant' },
      t: computed(() => zh),
      streamWithFallback,
      fetchUrlPreview: vi.fn(),
      extractHttpUrls: () => [],
      isProbablyDirectImageUrl: () => false,
      firstNonImageHttpUrl: () => undefined,
      preferHttpsImageUrlWhenPageIsSecure: (url) => url,
      clearPendingImage: vi.fn(),
      scrollToBottom: vi.fn(),
      playNotificationSound: vi.fn(),
      trimMessagesForMemoryCap: vi.fn(),
      clearRenderCache: vi.fn(),
      reportAssistantError: vi.fn(),
      updateActiveSessionTitle: vi.fn(),
      emitSend: vi.fn(),
      emitResponse: vi.fn(),
      emitError: vi.fn(),
      getStreamAbortController: () => null,
      setStreamAbortController: vi.fn(),
      getStreamStoppedByUser: () => false,
      setStreamStoppedByUser: vi.fn(),
      captureScreenshotForAnalysis,
    }).send;

    await send();

    expect(captureScreenshotForAnalysis).toHaveBeenCalled();
    expect(streamWithFallback).toHaveBeenCalledWith(
      '/ai-assistant',
      expect.objectContaining({
        model: 'MiniMax-M2.7',
        imageData: 'data:image/png;base64,shot',
        imageDataList: ['data:image/png;base64,shot'],
        pageContext: expect.stringContaining('# 当前页面内容'),
      }),
      undefined,
      expect.any(AbortSignal),
      expect.any(Function),
    );
    expect(messages.value[0].imageThumbs).toEqual(['data:image/png;base64,shot']);
    expect(messages.value[1].meta).toEqual(
      expect.objectContaining({
        effectiveModel: 'MiniMax-M2.7',
        provider: 'minimax',
        fallback: false,
        visionInputCount: 1,
        visionRoute: 'minimax-vlm',
      }),
    );
  });

  it('shows a specific empty vision result when a visual request returns no text', async () => {
    const messages = ref([]);
    const input = ref('分析当前截图里有什么');
    const loading = ref(false);
    const streamWithFallback = vi.fn(async function* (_baseUrl, _payload, _token, _signal, onMeta) {
      onMeta?.({ visionInputCount: 1, visionRoute: 'minimax-vlm' });
      yield* [];
    });
    const captureScreenshotForAnalysis = vi
      .fn()
      .mockResolvedValue({ type: 'image', data: 'data:image/png;base64,shot' });

    const send = useSendStream({
      messages,
      input,
      loading,
      sessionTitle: ref(''),
      activeSessionId: ref(''),
      mode: ref('chat'),
      targetLang: ref('zh'),
      chatSystemPrompt: ref(''),
      selectedChatModel: ref('MiniMax-M2.7'),
      modelChoices: ref(['MiniMax-M2.7']),
      pendingImageDataList: ref([]),
      pendingImageThumbs: ref([]),
      options: { baseUrl: '/ai-assistant' },
      t: computed(() => zh),
      streamWithFallback,
      fetchUrlPreview: vi.fn(),
      extractHttpUrls: () => [],
      isProbablyDirectImageUrl: () => false,
      firstNonImageHttpUrl: () => undefined,
      preferHttpsImageUrlWhenPageIsSecure: (url) => url,
      clearPendingImage: vi.fn(),
      scrollToBottom: vi.fn(),
      playNotificationSound: vi.fn(),
      trimMessagesForMemoryCap: vi.fn(),
      clearRenderCache: vi.fn(),
      reportAssistantError: vi.fn(),
      updateActiveSessionTitle: vi.fn(),
      emitSend: vi.fn(),
      emitResponse: vi.fn(),
      emitError: vi.fn(),
      getStreamAbortController: () => null,
      setStreamAbortController: vi.fn(),
      getStreamStoppedByUser: () => false,
      setStreamStoppedByUser: vi.fn(),
      captureScreenshotForAnalysis,
    }).send;

    await send();

    expect(messages.value[1].content).toBe('模型返回空视觉结果');
  });

  it('trusts server-provided vision capability details for opaque model names', async () => {
    const messages = ref([]);
    const input = ref('看一下这张图');
    const loading = ref(false);
    const notify = vi.fn();
    const streamWithFallback = vi.fn(async function* () {
      yield 'ok';
    });

    const send = useSendStream({
      messages,
      input,
      loading,
      sessionTitle: ref(''),
      activeSessionId: ref(''),
      mode: ref('chat'),
      targetLang: ref('zh'),
      chatSystemPrompt: ref(''),
      selectedChatModel: ref('company-router'),
      modelChoices: ref(['company-router']),
      modelCapabilities: ref({ 'company-router': ['text', 'vision'] }),
      pendingImageDataList: ref(['data:image/png;base64,img']),
      pendingImageThumbs: ref(['data:image/png;base64,thumb']),
      options: { baseUrl: '/ai-assistant' },
      t: computed(() => zh),
      streamWithFallback,
      fetchUrlPreview: vi.fn(),
      extractHttpUrls: () => [],
      isProbablyDirectImageUrl: () => false,
      firstNonImageHttpUrl: () => undefined,
      preferHttpsImageUrlWhenPageIsSecure: (url) => url,
      clearPendingImage: vi.fn(),
      notify,
      scrollToBottom: vi.fn(),
      playNotificationSound: vi.fn(),
      trimMessagesForMemoryCap: vi.fn(),
      clearRenderCache: vi.fn(),
      reportAssistantError: vi.fn(),
      updateActiveSessionTitle: vi.fn(),
      emitSend: vi.fn(),
      emitResponse: vi.fn(),
      emitError: vi.fn(),
      getStreamAbortController: () => null,
      setStreamAbortController: vi.fn(),
      getStreamStoppedByUser: () => false,
      setStreamStoppedByUser: vi.fn(),
    }).send;

    await send();

    expect(notify).not.toHaveBeenCalled();
  });

  it('sends the selected model for translate mode', async () => {
    const messages = ref([]);
    const input = ref('hello');
    const loading = ref(false);
    const streamWithFallback = vi.fn(async function* () {
      yield '你好';
    });

    const send = useSendStream({
      messages,
      input,
      loading,
      sessionTitle: ref(''),
      activeSessionId: ref(''),
      mode: ref('translate'),
      targetLang: ref('zh'),
      chatSystemPrompt: ref(''),
      selectedChatModel: ref('MiniMax-M2.7'),
      modelChoices: ref(['MiniMax-M2.7']),
      pendingImageDataList: ref([]),
      pendingImageThumbs: ref([]),
      options: { baseUrl: '/ai-assistant' },
      t: computed(() => zh),
      streamWithFallback,
      fetchUrlPreview: vi.fn(),
      extractHttpUrls: () => [],
      isProbablyDirectImageUrl: () => false,
      firstNonImageHttpUrl: () => undefined,
      preferHttpsImageUrlWhenPageIsSecure: (url) => url,
      clearPendingImage: vi.fn(),
      scrollToBottom: vi.fn(),
      playNotificationSound: vi.fn(),
      trimMessagesForMemoryCap: vi.fn(),
      clearRenderCache: vi.fn(),
      reportAssistantError: vi.fn(),
      updateActiveSessionTitle: vi.fn(),
      emitSend: vi.fn(),
      emitResponse: vi.fn(),
      emitError: vi.fn(),
      getStreamAbortController: () => null,
      setStreamAbortController: vi.fn(),
      getStreamStoppedByUser: () => false,
      setStreamStoppedByUser: vi.fn(),
    }).send;

    await send();

    expect(streamWithFallback).toHaveBeenCalledWith(
      '/ai-assistant',
      expect.objectContaining({
        action: 'translate',
        model: 'MiniMax-M2.7',
      }),
      undefined,
      expect.any(AbortSignal),
      expect.any(Function),
    );
  });
});
