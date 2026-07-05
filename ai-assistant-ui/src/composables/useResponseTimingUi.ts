import { computed, type Ref } from 'vue';
import type { Message } from '../types/message';

/**
 * Response-timing / model-health UI logic extracted from AiAssistant.vue (refactor batch 1).
 *
 * Pure presentation derivations only: it turns the chat message log plus the
 * diagnostics threshold inputs into the timing summaries, model-health label,
 * slow-request hint and fast-reply routing config the panel renders. No DOM,
 * no network, no side effects — behaviour is identical to the previous inline
 * implementation, just relocated so the host component shrinks.
 */

/** Human-friendly duration: sub-second as rounded ms, otherwise fixed-1 seconds. */
export function formatTimingMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

/** Parse a positive numeric input string, falling back when empty/invalid/non-positive. */
export function latencyNumber(raw: string, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export interface ResponseTimingSample {
  label: string;
  model?: string;
  ttftMs?: number;
  totalMs: number;
  summary: string;
}

/** Build a single timing sample from an assistant message's runtime meta. */
export function toResponseTimingSample(msg: Message, index: number): ResponseTimingSample {
  const meta = msg.meta;
  if (!meta) {
    return { label: `response-${index}`, summary: '', totalMs: 0 };
  }
  const parts = [
    meta.effectiveModel || meta.model || meta.requestedModel,
    meta.provider,
    typeof meta.ttftMs === 'number' ? `TTFT ${formatTimingMs(meta.ttftMs)}` : '',
    typeof meta.elapsedMs === 'number' ? `total ${formatTimingMs(meta.elapsedMs)}` : '',
  ].filter(Boolean);
  const model = meta.effectiveModel || meta.model || meta.requestedModel;
  return {
    label: `${msg.timestamp || index}-${model || 'model'}`,
    model,
    ttftMs: meta.ttftMs,
    totalMs: meta.elapsedMs ?? meta.ttftMs ?? 0,
    summary: parts.join(' · '),
  };
}

export interface UseResponseTimingUiOptions {
  messages: Ref<Message[]>;
  selectedChatModel: Ref<string>;
  fastRouteMaxCharsInput: Ref<string>;
  slowTtftThresholdMsInput: Ref<string>;
  slowTotalThresholdMsInput: Ref<string>;
  slowRequestWarningStreakInput: Ref<string>;
}

export function useResponseTimingUi(opts: UseResponseTimingUiOptions) {
  const {
    messages,
    selectedChatModel,
    fastRouteMaxCharsInput,
    slowTtftThresholdMsInput,
    slowTotalThresholdMsInput,
    slowRequestWarningStreakInput,
  } = opts;

  const responseTimingSamples = computed(() =>
    [...messages.value]
      .reverse()
      .filter(
        (msg) =>
          msg.role === 'assistant' &&
          (typeof msg.meta?.elapsedMs === 'number' || typeof msg.meta?.ttftMs === 'number'),
      )
      .slice(0, 5)
      .map((msg, index) => toResponseTimingSample(msg, index))
      .filter((sample) => sample.summary),
  );

  const responseTimingHistory = computed(() =>
    responseTimingSamples.value.map((sample) => sample.summary),
  );

  const responseTimingSummary = computed(() => responseTimingHistory.value[0] || '');

  const modelHealthText = computed(() => {
    const latest = responseTimingSamples.value[0];
    if (!latest) return '';
    const ttftThreshold = latencyNumber(slowTtftThresholdMsInput.value, 3000);
    const totalThreshold = latencyNumber(slowTotalThresholdMsInput.value, 8000);
    const ttft =
      latest.ttftMs == null ? 'TTFT n/a' : latest.ttftMs > ttftThreshold ? 'TTFT slow' : 'TTFT ok';
    const total = latest.totalMs > totalThreshold ? 'total slow' : 'total ok';
    return ['Provider ready', ttft, total].join(' · ');
  });

  const slowRequestHintText = computed(() => {
    const streak = latencyNumber(slowRequestWarningStreakInput.value, 2);
    const ttftThreshold = latencyNumber(slowTtftThresholdMsInput.value, 3000);
    const totalThreshold = latencyNumber(slowTotalThresholdMsInput.value, 8000);
    const slowSamples = responseTimingSamples.value
      .slice(0, streak)
      .filter(
        (sample) =>
          (typeof sample.ttftMs === 'number' && sample.ttftMs > ttftThreshold) ||
          sample.totalMs > totalThreshold,
      );
    if (slowSamples.length < streak) return '';
    const model = slowSamples[0].model || selectedChatModel.value || 'current model';
    return `${model} has been slow ${slowSamples.length} times; use fast reply or run the benchmark to compare sibling models.`;
  });

  const fastReplyRoutingConfig = computed(() => ({
    maxChars: latencyNumber(fastRouteMaxCharsInput.value, 32),
  }));

  return {
    responseTimingSamples,
    responseTimingHistory,
    responseTimingSummary,
    modelHealthText,
    slowRequestHintText,
    fastReplyRoutingConfig,
  };
}
