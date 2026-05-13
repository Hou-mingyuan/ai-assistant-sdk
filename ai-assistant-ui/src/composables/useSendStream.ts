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
import type { ChatPayload, UrlPreviewResult } from '../utils/api';
import type { I18nMessages } from '../utils/i18n';
import { type Message, extractThinking, extractToolCalls, extractAgentSteps } from '../types/message';
import { isAbortCancellationMessage } from './useChatHistoryPersistence';
import { collectPageContextText, collectSmartPageContext } from '../utils/pageContextDom';

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

  return kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
  return sanitizeAssistantContent(message || '', t).trim().length > 0;
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
  /** Pending base64 image (data URI); attached to payload then cleared. */
  pendingImageData: Ref<string | null>;
  /** Pending image thumbnail preview; presence drives 🖼 prefix only. */
  pendingImageThumb: Ref<string | null>;
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
  ) => AsyncIterable<string>;
  /** Optional page-link preview fetcher (used to side-attach images). */
  fetchUrlPreview: (
    baseUrl: string,
    pageUrl: string,
    token?: string,
  ) => Promise<UrlPreviewResult>;
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

export function useSendStream(deps: UseSendStreamDeps) {
  /**
   * D5: 流式生成的起始时间戳（ms epoch）。
   * - send() 入口设为 Date.now()
   * - finally 块（包括 success / abort / error）设为 null
   * 模板侧 (`MessageList`) 用 (nowTick - streamStartedAt) 算 elapsed 秒数，
   * 配合 `msg.content.length` 给出"已生成 X 字 · Y.Ys"工具感反馈。
   */
  const streamStartedAt = ref<number | null>(null);

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
    function flush() {
      raf = 0;
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
      };
      deps.scrollToBottom(false);
    }
    try {
      for await (const chunk of stream) {
        pending += chunk;
        if (!raf) raf = requestAnimationFrame(flush);
      }
    } finally {
      if (raf) cancelAnimationFrame(raf);
      pending = sanitizeAssistantContent(pending, tNow());
      const { thinking, content: afterThinkFinal } = extractThinking(pending);
      const { content: afterToolsFinal, toolCalls } = extractToolCalls(afterThinkFinal);
      const { content, steps } = extractAgentSteps(afterToolsFinal);
      const prevDone = deps.messages.value[msgIndex];
      const finalToolCalls = toolCalls.length > 0 ? toolCalls : prevDone?.toolCalls;
      if (finalToolCalls) finalToolCalls.forEach((tc) => { if (tc.status === 'running') tc.status = 'done'; });
      const finalSteps = steps.length > 0 ? steps : prevDone?.agentSteps;
      if (finalSteps) finalSteps.forEach((s) => { if (s.status === 'running') s.status = 'done'; });
      deps.messages.value[msgIndex] = {
        role: 'assistant',
        content,
        thinking: thinking || prevDone?.thinking,
        toolCalls: finalToolCalls,
        agentSteps: finalSteps,
        timestamp: prevDone?.timestamp,
        contentArchive: prevDone?.contentArchive,
        feedback: prevDone?.feedback,
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
    };
    deps.clearRenderCache();
    deps.trimMessagesForMemoryCap();
  }

  async function send() {
    let text = deps.input.value.trim();
    if (!text || deps.loading.value) return;
    if (!deps.options.baseUrl) return;
    const ucap = deps.options.maxUserMessageChars;
    if (ucap !== undefined && ucap > 0 && text.length > ucap) {
      text = `${text.slice(0, ucap)}\n…`;
    }

    const userEntry: Message = { role: 'user', content: text, timestamp: Date.now() };
    deps.messages.value.push(userEntry);
    const userMsgIdx = deps.messages.value.length - 1;

    /* 翻译/摘要/对话均支持：气泡内嵌直连图、网页链接触发 url-preview（与模式无关） */
    {
      let d = text;
      for (const u of deps.extractHttpUrls(text)) {
        if (deps.isProbablyDirectImageUrl(u) && !d.includes(`![](${u})`)) {
          const disp = deps.preferHttpsImageUrlWhenPageIsSecure(u);
          d += `\n\n![](${disp})`;
        }
      }
      userEntry.content = d;
    }

    deps.input.value = '';
    deps.loading.value = true;
    deps.scrollToBottom(true);

    const imageForPayload = deps.pendingImageData.value;
    if (deps.pendingImageThumb.value && deps.pendingImageData.value) {
      userEntry.content = `🖼️ ${userEntry.content}`;
    }
    deps.clearPendingImage();

    const payload: ChatPayload = {
      action: deps.mode.value,
      text,
      targetLang: deps.targetLang.value,
    };
    if (imageForPayload) payload.imageData = imageForPayload;
    if (deps.mode.value === 'chat') {
      const memFrag = deps.memoryPromptFragment?.value ?? '';
      const sp = deps.chatSystemPrompt.value.trim();
      const combinedSp = [memFrag, sp].filter(Boolean).join('\n');
      if (combinedSp) payload.systemPrompt = combinedSp;
      const mid = deps.selectedChatModel.value.trim();
      if (mid && deps.modelChoices.value.includes(mid)) payload.model = mid;
    }
    if (deps.mode.value === 'chat' && deps.messages.value.length > 1) {
      payload.history = deps.messages.value.slice(0, -1).map((m) => ({
        role: m.role,
        content: m.contentArchive ?? m.content,
      }));
    }

    const pageContextEnabled = deps.pageContextEnabled?.value ?? true;
    if (pageContextEnabled && deps.options.pageContextBlocks?.length) {
      const minChars = deps.options.pageContextMinUserChars ?? 0;
      if (text.length >= minChars) {
        const ctxOpts = {
          blocks: deps.options.pageContextBlocks,
          maxCharsPerBlock: deps.options.pageContextMaxCharsPerBlock,
          maxTotalChars: deps.options.pageContextMaxTotalChars,
        };
        const ctx = deps.options.smartPageContext
          ? collectSmartPageContext(ctxOpts)
          : collectPageContextText(ctxOpts);
        if (ctx) payload.pageContext = ctx;
      }
    }

    const sid = deps.activeSessionId.value;
    if (sid) payload.sessionId = sid;

    deps.emitSend({ action: deps.mode.value, text });

    const assistantMsg: Message = { role: 'assistant', content: '', timestamp: Date.now() };
    deps.messages.value.push(assistantMsg);
    const msgIndex = deps.messages.value.length - 1;
    deps.scrollToBottom(true);

    let urlPreviewImgs: string[] = [];
    let streamDone = false;

    if (deps.options.baseUrl) {
      const pageUrl = deps.firstNonImageHttpUrl(deps.extractHttpUrls(text));
      if (pageUrl) {
        deps
          .fetchUrlPreview(deps.options.baseUrl, pageUrl, deps.options.accessToken)
          .then((r) => {
            /* 勿与 userEntry 做引用相等：Vue 会把消息项包成 Proxy，恒不等于原始对象，会导致整段预览永远不执行 */
            const userSlot = deps.messages.value[userMsgIdx];
            if (!userSlot || userSlot.role !== 'user') return;
            if (r.success === false) return;
            const imgs =
              r.imageUrls && r.imageUrls.length > 0
                ? r.imageUrls
                : r.imageUrl
                  ? [r.imageUrl]
                  : [];
            if (!imgs.length) return;
            urlPreviewImgs = imgs;
            /* 用户气泡保持用户原文（仅链接等）；预览图只挂助手回复，避免标题/摘要把用户消息撑成整页 */
            if (streamDone) {
              appendUrlPreviewImagesToAssistant(msgIndex, urlPreviewImgs);
              deps.scrollToBottom(false);
            }
          })
          .catch(() => {
            /* URL preview is optional; ignore preview failures. */
          });
      }
    }

    deps.setStreamStoppedByUser(false);
    streamStartedAt.value = Date.now();
    const controller = new AbortController();
    deps.setStreamAbortController(controller);
    try {
      const fullContent = await applyStreamToAssistantMessage(
        msgIndex,
        deps.streamWithFallback(deps.options.baseUrl!, payload, deps.options.accessToken, controller.signal),
      );
      streamDone = true;
      /* 流式正文为空时若先插图再被「无响应」覆盖，会丢掉预览图 */
      if (!fullContent && !urlPreviewImgs.length) {
        const prevSlot = deps.messages.value[msgIndex];
        deps.messages.value[msgIndex] = {
          role: 'assistant',
          content: tNow().noResponse,
          timestamp: prevSlot?.timestamp,
          contentArchive: prevSlot?.contentArchive,
          feedback: prevSlot?.feedback,
        };
      } else {
        appendUrlPreviewImagesToAssistant(msgIndex, urlPreviewImgs);
      }
      if (urlPreviewImgs.length) deps.scrollToBottom(false);
      if (!deps.sessionTitle.value && text.trim()) {
        const raw = text.replace(/\n+/g, ' ').trim();
        deps.sessionTitle.value = raw.length > 20 ? raw.slice(0, 20) + '…' : raw;
        deps.updateActiveSessionTitle(deps.sessionTitle.value);
      }
      deps.emitResponse(fullContent);
    } catch (e: unknown) {
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
          };
        } else {
          deps.messages.value.splice(msgIndex, 1);
        }
        deps.scrollToBottom(false);
        return;
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
        };
      }
      deps.reportAssistantError('send', message);
      deps.emitError(message || 'Unknown error');
      deps.scrollToBottom(false);
    } finally {
      deps.setStreamAbortController(null);
      deps.setStreamStoppedByUser(false);
      streamStartedAt.value = null;
      deps.loading.value = false;
      deps.playNotificationSound();
      deps.scrollToBottom(false);
    }
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
    sanitizeAssistantContent: sanitizeForTemplate,
    hasVisibleAssistantContent: hasVisibleForTemplate,
  };
}
