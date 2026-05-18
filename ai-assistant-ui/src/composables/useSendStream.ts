/**
 * Streaming send pipeline extracted from the main AiAssistant SFC.
 *
 * The hot path that builds the chat payload, kicks off the SSE/WS stream,
 * applies streamed chunks to the assistant bubble (with rAF coalescing),
 * normalises service errors, and ties the URL-preview side-channel back to
 * the same assistant bubble used to live inline in `AiAssistant.vue`. Pull
 * it out here so:
 *
 * 1. The SFC's `<script setup>` shrinks (87 KB ➜ smaller, easier to read).
 * 2. The branch heavy error-normalisation / tool-trace stripping helpers
 *    become independently unit-testable without mounting a Vue component.
 * 3. The send-orchestration dependency surface (`UseSendStreamDeps`) is
 *    explicit, so future regressions are caught by TypeScript.
 *
 * The hook only owns the *send* path itself. Per-message buttons
 * (stop / retry / edit / feedback) stay in {@link useChatOrchestrator}, and
 * the assistant bubble rendering helpers (`hasVisibleAssistantContent` &
 * `sanitizeAssistantContent`) are re-exported from the hook so the SFC
 * template can keep its existing prop bindings unchanged.
 */
import { type ComputedRef, type Ref, ref } from 'vue';

import type { AiAssistantOptions } from '../index';
import type { ChatPayload, ChatRuntimeMeta, UrlPreviewResult } from '../utils/api';
import type { I18nMessages } from '../utils/i18n';
import {
  type Message,
  extractThinking,
  extractToolCalls,
  extractAgentSteps,
} from '../types/message';
import { isAbortCancellationMessage } from './useChatHistoryPersistence';
import { collectPageContextText, collectSmartPageContext } from '../utils/pageContextDom';
import { captureScreenshot } from '../utils/pageScreenshot';
import {
  collectPageSnapshotMarkdown,
  isDirectPageSnapshotRequest,
  isPageSnapshotContextRequest,
} from '../utils/pageSnapshotDom';

const DEFAULT_VISION_MODEL_PATTERNS: RegExp[] = [
  /(?:^|[-_:])gpt-4o(?:[-_:]|$)/i,
  /(?:^|[-_:])gpt-4\.1(?:[-_:]|$)/i,
  /(?:^|[-_:])gpt-5(?:[-_:]|$)/i,
  /claude-(?:3|4|opus|sonnet)/i,
  /gemini-(?:1\.5|2|2\.5|pro|flash)/i,
  /qwen.*-?vl/i,
  /minimax-m2\.\d+/i,
  /llava/i,
  /pixtral/i,
  /vision/i,
];
const STREAM_FLUSH_MIN_INTERVAL_MS = 48;

type ScreenshotCaptureResult = { type: 'image'; data: string } | { type: 'text'; data: string };

export function isVisionCapableModel(model: string, extraPatterns: RegExp[] = []): boolean {
  const normalized = model.trim();
  if (!normalized) return false;
  return [...extraPatterns, ...DEFAULT_VISION_MODEL_PATTERNS].some((pattern) =>
    pattern.test(normalized),
  );
}

export function shouldWarnForVisionModel(
  model: string,
  hasImageAttachment: boolean,
  extraPatterns: RegExp[] = [],
): boolean {
  if (!hasImageAttachment) return false;
  if (!model.trim()) return false;
  return !isVisionCapableModel(model, extraPatterns);
}

export function isScreenshotAnalysisRequest(text: string): boolean {
  const normalized = text.trim();
  if (!normalized) return false;
  const asksForVisualInput =
    /截图|截屏|屏幕|画面|视觉|图片|图像|照片|screenshot|screen|visual|image|picture/i.test(
      normalized,
    );
  const asksForAnalysis =
    /分析|识别|看看|看一下|看下|有什么|内容|描述|理解|analy[sz]e|describe|understand|what/i.test(
      normalized,
    );
  return asksForVisualInput && asksForAnalysis;
}

/** Brace / bracket balance counter shared by {@link stripInternalToolTrace}. */
export function countBraceBalance(text: string): number {
  let balance = 0;
  for (const ch of text) {
    if (ch === '{' || ch === '[') balance += 1;
    else if (ch === '}' || ch === ']') balance -= 1;
  }
  return balance;
}

/**
 * Remove `cap_*` tool-call traces ( `> 🔧 **cap_foo** {...}` /
 * ` ```cap_foo {...}``` `) that some upstream LLMs leak into the assistant
 * stream. Balanced-brace aware so multi-line JSON payloads are fully dropped.
 */
export function stripInternalToolTrace(message: string): string {
  const lines = message.split(/\r?\n/);
  const kept: string[] = [];
  let droppingToolJson = false;
  let braceBalance = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const compact = trimmed
      .replace(/^>\s*/, '')
      .replace(/^`+/, '')
      .replace(/^[^\w]+/u, '')
      .replace(/^`+/, '')
      .trim();
    const isToolTrace =
      /^>\s*(?:🔧|🛠|⚙️)?\s*\*\*?cap_[\w-]+\*\*?/i.test(trimmed) ||
      /^>\s*(?:✅|✓)\s*/i.test(trimmed) ||
      /^```?\s*cap_[\w-]+/i.test(trimmed) ||
      /^cap_[\w-]+\s*(?:\(|\{|\[|$)/i.test(trimmed) ||
      /^`?cap_[\w-]+`?\s*(?:\(|\{|\[|$)/i.test(trimmed) ||
      /^`?cap_[\w-]+`?\s*(?:\(|\{|\[|$)/i.test(compact);

    if (isToolTrace) {
      droppingToolJson = /[{[]/.test(trimmed) && !/[}\]]\s*`?$/.test(trimmed);
      braceBalance = countBraceBalance(trimmed);
      continue;
    }

    if (droppingToolJson) {
      braceBalance += countBraceBalance(trimmed);
      if (braceBalance <= 0 || /^```$/.test(trimmed)) {
        droppingToolJson = false;
        braceBalance = 0;
      }
      continue;
    }

    kept.push(line);
  }

  return kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Map raw upstream service errors into translated, user-friendly messages.
 * Abort messages collapse to empty so the bubble can be dropped.
 */
export function normalizeAssistantServiceError(message: string, t: I18nMessages): string {
  const raw = message.trim();
  if (!raw) return message;
  if (isAbortCancellationMessage(raw)) {
    return '';
  }
  if (/\b429\b|too many requests|rate limit|concurrent session/i.test(raw)) {
    return t.serviceBusyError;
  }
  if (/\b503\b|no_available_providers|format_type_mismatch|model channel/i.test(raw)) {
    return t.serviceUnavailableError;
  }
  if (/AI service error\.?\s*Check server logs/i.test(raw)) {
    return t.serviceGenericError;
  }
  return message;
}

/** Treat user-initiated stops plus `AbortError` / abort signals as cancellation. */
export function isAssistantAbortError(error: unknown, streamStoppedByUser: boolean): boolean {
  if (streamStoppedByUser) return true;
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error) {
    const raw = `${error.name} ${error.message}`.toLowerCase();
    return raw.includes('abort') || raw.includes('signal is aborted');
  }
  return String(error).toLowerCase().includes('abort');
}

/** Pipeline: translate-service-error → strip-tool-trace, keep empties as-is. */
export function sanitizeAssistantContent(message: string, t: I18nMessages): string {
  const normalized = normalizeAssistantServiceError(message, t);
  if (!normalized.trim()) return normalized;
  return stripInternalToolTrace(normalized);
}

/** True iff the sanitised body has any non-whitespace character. */
export function hasVisibleAssistantContent(message: string, t: I18nMessages): boolean {
  const sanitized = sanitizeAssistantContent(message || '', t);
  const { content: afterThink } = extractThinking(sanitized);
  const { content: afterTools } = extractToolCalls(afterThink);
  const { content } = extractAgentSteps(afterTools);
  return content.trim().length > 0;
}

export interface UseSendStreamDeps {
  /** Mutable conversation buffer (push user then assistant entries). */
  messages: Ref<Message[]>;
  /** Two-way input box ref; cleared on send. */
  input: Ref<string>;
  /** Spinner / disable-button gate; set true on entry, false on finally. */
  loading: Ref<boolean>;
  /** Session header label (auto-set from first user prompt). */
  sessionTitle: Ref<string>;
  /** Active multi-session id, sent as `sessionId` for server-side memory. */
  activeSessionId: Ref<string>;
  /** Current request action: translate / summarize / chat. */
  mode: Ref<'translate' | 'summarize' | 'chat'>;
  /** Translation target locale (used only when `mode === 'translate'`). */
  targetLang: Ref<string>;
  /** Optional chat-mode system prompt override (subject to server whitelist). */
  chatSystemPrompt: Ref<string>;
  /** Optional chat-mode model id; only attached if in `modelChoices`. */
  selectedChatModel: Ref<string>;
  /** Allowed-model whitelist; used to validate `selectedChatModel`. */
  modelChoices: Ref<string[]>;
  /** Optional server-provided model capability map keyed by model id. */
  modelCapabilities?: Ref<Record<string, string[]>>;
  /** Pending base64 images (data URI); attached to payload then cleared. */
  pendingImageDataList: Ref<string[]>;
  /** Pending image thumbnail previews for message history rendering. */
  pendingImageThumbs: Ref<string[]>;
  /** Host-merged user options (baseUrl / accessToken / maxUserMessageChars). */
  options: AiAssistantOptions;
  /** Computed locale messages bundle, re-evaluated on locale change. */
  t: ComputedRef<I18nMessages>;
  /** SSE-with-WS-fallback async generator factory. */
  streamWithFallback: (
    baseUrl: string,
    payload: ChatPayload,
    token?: string,
    signal?: AbortSignal,
    onMeta?: (meta: ChatRuntimeMeta) => void,
  ) => AsyncIterable<string>;
  /** Optional page-link preview fetcher (used to side-attach images). */
  fetchUrlPreview: (baseUrl: string, pageUrl: string, token?: string) => Promise<UrlPreviewResult>;
  /** Extract HTTP(S) URLs out of user text. */
  extractHttpUrls: (text: string) => string[];
  /** Heuristic: URL points at an image asset (jpg/png/svg/...). */
  isProbablyDirectImageUrl: (url: string) => boolean;
  /** Pick the first non-image URL (used as the preview target). */
  firstNonImageHttpUrl: (urls: string[]) => string | undefined;
  /** Upgrade http://img to https://img when the host page is on HTTPS. */
  preferHttpsImageUrlWhenPageIsSecure: (url: string) => string;
  /** Drop the pending image (called once the payload captures it). */
  clearPendingImage: () => void;
  /** Lightweight UI notification channel (toast). */
  notify?: (message: string, durationMs?: number) => void;
  /** Coalesced scroll-to-bottom; pass force=true to bypass the sticky check. */
  scrollToBottom: (force: boolean) => void;
  /** Notification chime (gated by user preference; safe no-op if muted). */
  playNotificationSound: () => void;
  /** Drop oldest messages once the memory cap is reached. */
  trimMessagesForMemoryCap: () => void;
  /** Invalidate the rendered-markdown cache when content mutates. */
  clearRenderCache: () => void;
  /** Bubble errors out to host telemetry (`options.onAssistantError`). */
  reportAssistantError: (source: string, message: string) => void;
  /** Sync the multi-session tab title with `sessionTitle`. */
  updateActiveSessionTitle: (title: string) => void;
  /** Emit Vue `@send`. */
  emitSend: (payload: { action: string; text: string }) => void;
  /** Emit Vue `@response`. */
  emitResponse: (content: string) => void;
  /** Emit Vue `@error`. */
  emitError: (message: string) => void;
  /** Lazy getter so the parent can keep `let` semantics for the controller. */
  getStreamAbortController: () => AbortController | null;
  /** Setter for the abort controller (null after the request settles). */
  setStreamAbortController: (controller: AbortController | null) => void;
  /** Whether the user pressed Stop (mirrors abort intent for finally). */
  getStreamStoppedByUser: () => boolean;
  /** Set the stop flag (true on user-stop, false on each new send). */
  setStreamStoppedByUser: (stopped: boolean) => void;
  /** Optional override for tests/hosts; defaults to capturing the current document. */
  captureScreenshotForAnalysis?: () => Promise<ScreenshotCaptureResult>;
  /** Cross-session memory fragment to prepend to systemPrompt. */
  memoryPromptFragment?: Ref<string>;
  /**
   * User-toggled override for page-context attachment. When `false`, the
   * automatic `pageContextBlocks` collection is skipped for this send even if
   * `options.pageContextBlocks` is configured. Defaults to enabled when this
   * ref is omitted.
   */
  pageContextEnabled?: Ref<boolean>;
}

// eslint-disable-next-line max-lines-per-function
export function useSendStream(deps: UseSendStreamDeps) {
  /**
   * D5: 流式生成的起始时间戳（ms epoch）。
   * - send() 入口设为 Date.now()
   * - finally 块（包括 success / abort / error）设为 null
   * 模板侧 (`MessageList`) 用 (nowTick - streamStartedAt) 算 elapsed 秒数，
   * 配合 `msg.content.length` 给出"已生成 X 字 · Y.Ys"工具感反馈。
   */
  const streamStartedAt = ref<number | null>(null);

  /**
   * E2: TTFT (Time To First Token) ms 时间戳。
   * - 在 applyStreamToAssistantMessage 内首次收到非空 chunk 时 set
   * - finally 块重置为 null
   * 模板侧用 (firstTokenAt - streamStartedAt) / 1000 显示"首字 1.2s"，
   * 帮助用户感知模型延迟（特别是模型 cold start 或 RAG 重排序时）。
   */
  const firstTokenAt = ref<number | null>(null);

  function tNow(): I18nMessages {
    return deps.t.value;
  }

  /**
   * Coalesce streamed chunks to at most one DOM update per animation frame so
   * marked / DOMPurify only run once per frame. Returns the fully accumulated,
   * sanitised content for downstream emit('response').
   */
  async function applyStreamToAssistantMessage(
    msgIndex: number,
    stream: AsyncIterable<string>,
  ): Promise<string> {
    let pending = '';
    let raf = 0;
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    let lastFlushAt = 0;
    function flush() {
      raf = 0;
      lastFlushAt = performance.now();
      const prev = deps.messages.value[msgIndex];
      const sanitized = sanitizeAssistantContent(pending, tNow());
      const { thinking, content: afterThink } = extractThinking(sanitized);
      const { content: afterTools, toolCalls } = extractToolCalls(afterThink);
      const { content, steps } = extractAgentSteps(afterTools);
      deps.messages.value[msgIndex] = {
        role: 'assistant',
        content,
        thinking: thinking || prev?.thinking,
        toolCalls: toolCalls.length > 0 ? toolCalls : prev?.toolCalls,
        agentSteps: steps.length > 0 ? steps : prev?.agentSteps,
        timestamp: prev?.timestamp,
        contentArchive: prev?.contentArchive,
        feedback: prev?.feedback,
        meta: prev?.meta,
      };
      deps.scrollToBottom(false);
    }
    function scheduleFlush() {
      const now = performance.now();
      const waitMs = Math.max(0, STREAM_FLUSH_MIN_INTERVAL_MS - (now - lastFlushAt));
      if (waitMs <= 0) {
        if (!raf) raf = requestAnimationFrame(flush);
        return;
      }
      if (!flushTimer) {
        flushTimer = setTimeout(() => {
          flushTimer = null;
          if (!raf) raf = requestAnimationFrame(flush);
        }, waitMs);
      }
    }
    try {
      for await (const chunk of stream) {
        pending += chunk;
        /* E2: 记录首字时间 - 在 chunk 到来时取，比 RAF flush 后取更准
         * （避免 flush 调度本身被计入延迟）。仅记录第一次。 */
        if (firstTokenAt.value == null && pending.length > 0) {
          firstTokenAt.value = Date.now();
        }
        scheduleFlush();
      }
    } finally {
      if (flushTimer) clearTimeout(flushTimer);
      if (raf) cancelAnimationFrame(raf);
      pending = sanitizeAssistantContent(pending, tNow());
      const { thinking, content: afterThinkFinal } = extractThinking(pending);
      const { content: afterToolsFinal, toolCalls } = extractToolCalls(afterThinkFinal);
      const { content, steps } = extractAgentSteps(afterToolsFinal);
      const prevDone = deps.messages.value[msgIndex];
      const finalToolCalls = toolCalls.length > 0 ? toolCalls : prevDone?.toolCalls;
      if (finalToolCalls)
        finalToolCalls.forEach((tc) => {
          if (tc.status === 'running') tc.status = 'done';
        });
      const finalSteps = steps.length > 0 ? steps : prevDone?.agentSteps;
      if (finalSteps)
        finalSteps.forEach((s) => {
          if (s.status === 'running') s.status = 'done';
        });
      deps.messages.value[msgIndex] = {
        role: 'assistant',
        content,
        thinking: thinking || prevDone?.thinking,
        toolCalls: finalToolCalls,
        agentSteps: finalSteps,
        timestamp: prevDone?.timestamp,
        contentArchive: prevDone?.contentArchive,
        feedback: prevDone?.feedback,
        meta: prevDone?.meta,
      };
      deps.scrollToBottom(false);
      deps.trimMessagesForMemoryCap();
    }
    return pending;
  }

  /**
   * Append url-preview images to the assistant bubble. Skipped if every image
   * is already present (defends against the url-preview promise and the
   * stream-done branch racing each other and appending twice).
   */
  function appendUrlPreviewImagesToAssistant(aiIdx: number, imgs: string[]) {
    if (!imgs.length) return;
    const m = deps.messages.value[aiIdx];
    if (m?.role !== 'assistant') return;
    const lines = imgs
      .filter(Boolean)
      .map((u) => `![](${deps.preferHttpsImageUrlWhenPageIsSecure(u)})`);
    if (lines.length && lines.every((line) => m.content.includes(line))) return;
    const note = tNow().urlPreviewImagesNote;
    const md = [`> ${note}`, '', ...lines].join('\n\n');
    const base = (m.contentArchive ?? m.content).trim();
    deps.messages.value[aiIdx] = {
      role: 'assistant',
      content: `${base}\n\n${md}`,
      timestamp: m.timestamp,
      contentArchive: m.contentArchive,
      feedback: m.feedback,
      meta: m.meta,
    };
    deps.clearRenderCache();
    deps.trimMessagesForMemoryCap();
  }

  function normalizeUserTextForSend(): string {
    let text = deps.input.value.trim();
    if (!text || deps.loading.value || !deps.options.baseUrl) return '';
    const ucap = deps.options.maxUserMessageChars;
    if (ucap !== undefined && ucap > 0 && text.length > ucap) {
      text = `${text.slice(0, ucap)}\n…`;
    }
    return text;
  }

  function attachDirectImageUrlsToUserEntry(userEntry: Message, text: string) {
    let content = text;
    for (const u of deps.extractHttpUrls(text)) {
      if (deps.isProbablyDirectImageUrl(u) && !content.includes(`![](${u})`)) {
        const disp = deps.preferHttpsImageUrlWhenPageIsSecure(u);
        content += `\n\n![](${disp})`;
      }
    }
    userEntry.content = content;
  }

  function applyChatModePayloadOptions(payload: ChatPayload, hasImageAttachment: boolean) {
    if (deps.mode.value !== 'chat') return;
    const memFrag = deps.memoryPromptFragment?.value ?? '';
    const sp = deps.chatSystemPrompt.value.trim();
    const combinedSp = [memFrag, sp].filter(Boolean).join('\n');
    if (combinedSp) payload.systemPrompt = combinedSp;
    const mid = deps.selectedChatModel.value.trim();
    if (mid && deps.modelChoices.value.includes(mid)) {
      payload.model = mid;
      const hasServerVisionCapability = modelHasCapability(mid, 'vision');
      if (
        !hasServerVisionCapability &&
        shouldWarnForVisionModel(mid, hasImageAttachment, deps.options.visionCapableModels)
      ) {
        deps.notify?.(tNow().visionModelWarning.replace('{model}', mid), 4200);
      }
    }
    if (deps.messages.value.length > 1) {
      payload.history = deps.messages.value.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.contentArchive ?? m.content,
      }));
    }
  }

  function modelHasCapability(model: string, capability: string) {
    const caps =
      deps.modelCapabilities?.value[model] ?? deps.modelCapabilities?.value[model.trim()] ?? [];
    return caps.some((cap) => cap.toLowerCase() === capability.toLowerCase());
  }

  function applyPageContextPayloadOptions(payload: ChatPayload, text: string) {
    const pageContextEnabled = deps.pageContextEnabled?.value ?? true;
    if (!pageContextEnabled) return;
    const minChars = deps.options.pageContextMinUserChars ?? 0;
    if (text.length < minChars) return;
    let ctx = '';
    if (deps.options.pageContextBlocks?.length) {
      const ctxOpts = {
        blocks: deps.options.pageContextBlocks,
        maxCharsPerBlock: deps.options.pageContextMaxCharsPerBlock,
        maxTotalChars: deps.options.pageContextMaxTotalChars,
      };
      ctx = deps.options.smartPageContext
        ? collectSmartPageContext(ctxOpts)
        : collectPageContextText(ctxOpts);
    }
    if (!ctx && isPageSnapshotContextRequest(text)) {
      ctx = collectPageSnapshotMarkdown({
        maxChars: deps.options.pageContextMaxTotalChars ?? 12000,
      });
    }
    if (ctx) payload.pageContext = ctx;
  }

  function attachTextContext(payload: ChatPayload, ctx: string) {
    const clean = ctx.trim();
    if (!clean) return;
    payload.pageContext = [payload.pageContext, `# 当前页面截图文本回退\n${clean}`]
      .filter(Boolean)
      .join('\n\n');
  }

  async function prepareAutomaticScreenshotForVisualRequest(text: string): Promise<string> {
    if (!isScreenshotAnalysisRequest(text)) return '';
    if (deps.pendingImageDataList.value.some(Boolean)) return '';
    const capture = deps.captureScreenshotForAnalysis ?? (() => captureScreenshot());
    let result: ScreenshotCaptureResult;
    try {
      result = await capture();
    } catch {
      return '';
    }
    if (result.type === 'image' && result.data) {
      deps.pendingImageDataList.value = [result.data];
      deps.pendingImageThumbs.value = [result.data];
      return '';
    }
    return result.data || '';
  }

  function completeLocalPageSnapshot(text: string): boolean {
    if (!isDirectPageSnapshotRequest(text)) return false;
    const snapshot = collectPageSnapshotMarkdown({
      maxChars: deps.options.pageContextMaxTotalChars ?? 12000,
    });
    if (!snapshot) return false;

    deps.messages.value.push({ role: 'user', content: text, timestamp: Date.now() });
    deps.messages.value.push({ role: 'assistant', content: snapshot, timestamp: Date.now() });
    deps.input.value = '';
    deps.emitSend({ action: 'chat', text });
    deps.emitResponse(snapshot);
    deps.clearRenderCache();
    deps.trimMessagesForMemoryCap();
    deps.scrollToBottom(true);
    if (!deps.sessionTitle.value && text.trim()) {
      const raw = text.replace(/\n+/g, ' ').trim();
      deps.sessionTitle.value = raw.length > 20 ? raw.slice(0, 20) + '…' : raw;
      deps.updateActiveSessionTitle(deps.sessionTitle.value);
    }
    return true;
  }

  function prepareSendRequest(text: string) {
    const userEntry: Message = { role: 'user', content: text, timestamp: Date.now() };
    deps.messages.value.push(userEntry);
    const userMsgIdx = deps.messages.value.length - 1;

    attachDirectImageUrlsToUserEntry(userEntry, text);
    deps.input.value = '';
    deps.loading.value = true;
    deps.scrollToBottom(true);

    const imageDataListForPayload = deps.pendingImageDataList.value.filter(Boolean);
    const imageThumbsForMessage = deps.pendingImageThumbs.value.slice(
      0,
      imageDataListForPayload.length,
    );
    if (imageThumbsForMessage.length > 0) {
      userEntry.imageThumb = imageThumbsForMessage[0];
      userEntry.imageThumbs = imageThumbsForMessage;
    }
    deps.clearPendingImage();

    const payload: ChatPayload = {
      action: deps.mode.value,
      text,
      targetLang: deps.targetLang.value,
    };
    if (imageDataListForPayload.length > 0) {
      payload.imageData = imageDataListForPayload[0];
      payload.imageDataList = imageDataListForPayload;
    }
    applyChatModePayloadOptions(payload, imageDataListForPayload.length > 0);
    applyPageContextPayloadOptions(payload, text);

    const sid = deps.activeSessionId.value;
    if (sid) payload.sessionId = sid;

    deps.emitSend({ action: deps.mode.value, text });

    const requestStartedAt = Date.now();
    const requestModel =
      typeof payload.model === 'string' && payload.model.trim() ? payload.model.trim() : undefined;
    const assistantMsg: Message = {
      role: 'assistant',
      content: '',
      timestamp: requestStartedAt,
      meta: {
        model: requestModel,
        requestedModel: requestModel,
      },
    };
    deps.messages.value.push(assistantMsg);
    const msgIndex = deps.messages.value.length - 1;
    deps.scrollToBottom(true);
    return { payload, requestStartedAt, text, userMsgIdx, msgIndex };
  }

  function startUrlPreviewSideChannel(
    text: string,
    userMsgIdx: number,
    msgIndex: number,
    getStreamDone: () => boolean,
    setPreviewImages: (imgs: string[]) => void,
  ) {
    const pageUrl = deps.firstNonImageHttpUrl(deps.extractHttpUrls(text));
    if (!pageUrl || !deps.options.baseUrl) return;
    deps
      .fetchUrlPreview(deps.options.baseUrl, pageUrl, deps.options.accessToken)
      .then((r) => {
        /* 勿与 userEntry 做引用相等：Vue 会把消息项包成 Proxy，恒不等于原始对象，会导致整段预览永远不执行 */
        const userSlot = deps.messages.value[userMsgIdx];
        if (!userSlot || userSlot.role !== 'user') return;
        if (r.success === false) return;
        const imgs =
          r.imageUrls && r.imageUrls.length > 0 ? r.imageUrls : r.imageUrl ? [r.imageUrl] : [];
        if (!imgs.length) return;
        setPreviewImages(imgs);
        /* 用户气泡保持用户原文（仅链接等）；预览图只挂助手回复，避免标题/摘要把用户消息撑成整页 */
        if (getStreamDone()) {
          appendUrlPreviewImagesToAssistant(msgIndex, imgs);
          deps.scrollToBottom(false);
        }
      })
      .catch(() => {
        /* URL preview is optional; ignore preview failures. */
      });
  }

  function handleStreamSuccess(
    fullContent: string,
    text: string,
    msgIndex: number,
    requestStartedAt: number,
    urlPreviewImgs: string[],
  ) {
    /* 流式正文为空时若先插图再被「无响应」覆盖，会丢掉预览图 */
    const visibleContent = deps.messages.value[msgIndex]?.content ?? fullContent;
    if (!hasVisibleAssistantContent(visibleContent, tNow()) && !urlPreviewImgs.length) {
      const prevSlot = deps.messages.value[msgIndex];
      const emptyResponse =
        prevSlot?.meta?.visionInputCount && prevSlot.meta.visionInputCount > 0
          ? tNow().visionEmptyResponse || 'The model returned an empty vision result'
          : tNow().noResponse;
      deps.messages.value[msgIndex] = {
        role: 'assistant',
        content: emptyResponse,
        thinking: prevSlot?.thinking,
        toolCalls: prevSlot?.toolCalls,
        agentSteps: prevSlot?.agentSteps,
        timestamp: prevSlot?.timestamp,
        contentArchive: prevSlot?.contentArchive,
        feedback: prevSlot?.feedback,
        meta: withResponseTiming(prevSlot?.meta, requestStartedAt),
      };
    } else {
      stampAssistantMeta(msgIndex, requestStartedAt);
      appendUrlPreviewImagesToAssistant(msgIndex, urlPreviewImgs);
    }
    if (urlPreviewImgs.length) deps.scrollToBottom(false);
    if (!deps.sessionTitle.value && text.trim()) {
      const raw = text.replace(/\n+/g, ' ').trim();
      deps.sessionTitle.value = raw.length > 20 ? raw.slice(0, 20) + '…' : raw;
      deps.updateActiveSessionTitle(deps.sessionTitle.value);
    }
    deps.emitResponse(fullContent);
  }

  function applyRuntimeMeta(msgIndex: number, meta: ChatRuntimeMeta) {
    const current = deps.messages.value[msgIndex];
    if (!current || current.role !== 'assistant') return;
    deps.messages.value[msgIndex] = {
      ...current,
      meta: {
        ...current.meta,
        ...meta,
      },
    };
  }

  function handleStreamError(e: unknown, msgIndex: number, requestStartedAt: number): boolean {
    if (isAssistantAbortError(e, deps.getStreamStoppedByUser())) {
      const currentContent = sanitizeAssistantContent(
        deps.messages.value[msgIndex]?.content || '',
        tNow(),
      );
      if (currentContent) {
        const prevSlot = deps.messages.value[msgIndex];
        deps.messages.value[msgIndex] = {
          role: 'assistant',
          content: currentContent,
          timestamp: prevSlot?.timestamp,
          contentArchive: prevSlot?.contentArchive,
          feedback: prevSlot?.feedback,
          meta: withResponseTiming(prevSlot?.meta, requestStartedAt),
        };
      } else {
        deps.messages.value.splice(msgIndex, 1);
      }
      deps.scrollToBottom(false);
      return true;
    }
    const message = normalizeAssistantServiceError(
      e instanceof Error ? e.message : String(e),
      tNow(),
    );
    const currentContent = deps.messages.value[msgIndex]?.content || '';
    if (!currentContent) {
      const prevSlot = deps.messages.value[msgIndex];
      deps.messages.value[msgIndex] = {
        role: 'assistant',
        content: `${tNow().errorPrefix}: ${message}`,
        timestamp: prevSlot?.timestamp,
        contentArchive: prevSlot?.contentArchive,
        feedback: prevSlot?.feedback,
        meta: withResponseTiming(prevSlot?.meta, requestStartedAt),
      };
    }
    deps.reportAssistantError('send', message);
    deps.emitError(message || 'Unknown error');
    deps.scrollToBottom(false);
    return false;
  }

  async function send() {
    const localText = deps.input.value.trim();
    if (localText && !deps.loading.value && completeLocalPageSnapshot(localText)) return;

    const text = normalizeUserTextForSend();
    if (!text) return;
    const autoScreenshotTextContext = await prepareAutomaticScreenshotForVisualRequest(text);
    const { payload, requestStartedAt, userMsgIdx, msgIndex } = prepareSendRequest(text);
    attachTextContext(payload, autoScreenshotTextContext);
    let urlPreviewImgs: string[] = [];
    let streamDone = false;

    startUrlPreviewSideChannel(
      text,
      userMsgIdx,
      msgIndex,
      () => streamDone,
      (imgs) => {
        urlPreviewImgs = imgs;
      },
    );
    deps.setStreamStoppedByUser(false);
    streamStartedAt.value = Date.now();
    firstTokenAt.value = null;
    const controller = new AbortController();
    deps.setStreamAbortController(controller);
    try {
      const fullContent = await applyStreamToAssistantMessage(
        msgIndex,
        deps.streamWithFallback(
          deps.options.baseUrl!,
          payload,
          deps.options.accessToken,
          controller.signal,
          (meta) => applyRuntimeMeta(msgIndex, meta),
        ),
      );
      streamDone = true;
      handleStreamSuccess(fullContent, text, msgIndex, requestStartedAt, urlPreviewImgs);
    } catch (e: unknown) {
      if (handleStreamError(e, msgIndex, requestStartedAt)) return;
    } finally {
      deps.setStreamAbortController(null);
      deps.setStreamStoppedByUser(false);
      streamStartedAt.value = null;
      firstTokenAt.value = null;
      deps.loading.value = false;
      deps.playNotificationSound();
      deps.scrollToBottom(false);
    }
  }

  function withResponseTiming(meta: Message['meta'], requestStartedAt: number): Message['meta'] {
    return {
      ...meta,
      elapsedMs: Date.now() - requestStartedAt,
      ttftMs:
        firstTokenAt.value != null && firstTokenAt.value >= requestStartedAt
          ? firstTokenAt.value - requestStartedAt
          : meta?.ttftMs,
    };
  }

  function stampAssistantMeta(msgIndex: number, requestStartedAt: number) {
    const current = deps.messages.value[msgIndex];
    if (!current || current.role !== 'assistant') return;
    deps.messages.value[msgIndex] = {
      ...current,
      meta: withResponseTiming(current.meta, requestStartedAt),
    };
  }

  function sanitizeForTemplate(message: string): string {
    return sanitizeAssistantContent(message, tNow());
  }
  function hasVisibleForTemplate(message: string): boolean {
    return hasVisibleAssistantContent(message, tNow());
  }

  return {
    send,
    streamStartedAt,
    firstTokenAt,
    sanitizeAssistantContent: sanitizeForTemplate,
    hasVisibleAssistantContent: hasVisibleForTemplate,
  };
}
