/**
 * Pure, side-effect-free helpers for the streaming send pipeline.
 *
 * Extracted from {@link useSendStream} (R3, 2026-06) so the model-capability
 * heuristics and the assistant-content sanitisation pipeline live in a small,
 * independently testable module with no Vue/DOM coupling. `useSendStream`
 * re-exports every symbol here, so existing imports from `./useSendStream`
 * (including the spec) keep working unchanged.
 */
import type { I18nMessages } from '../utils/i18n';
import {
  extractThinking,
  extractToolCalls,
  extractAgentSteps,
  extractArtifacts,
} from '../types/message';
import { isAbortCancellationMessage } from './useChatHistoryPersistence';

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
  const { content: afterSteps } = extractAgentSteps(afterTools);
  const { content, artifacts } = extractArtifacts(afterSteps);
  return content.trim().length > 0 || artifacts.length > 0;
}
