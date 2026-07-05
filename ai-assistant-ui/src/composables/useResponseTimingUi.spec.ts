import { ref } from 'vue';
import { describe, expect, it } from 'vitest';
import type { Message } from '../types/message';
import {
  formatTimingMs,
  latencyNumber,
  toResponseTimingSample,
  useResponseTimingUi,
} from './useResponseTimingUi';

function assistantMsg(meta: Message['meta'], timestamp = 0): Message {
  return { role: 'assistant', content: 'hi', meta, timestamp };
}

describe('formatTimingMs', () => {
  it('formats sub-second values as rounded milliseconds', () => {
    expect(formatTimingMs(850)).toBe('850ms');
    expect(formatTimingMs(120.4)).toBe('120ms');
  });

  it('formats one second and above as fixed-1 seconds', () => {
    expect(formatTimingMs(1500)).toBe('1.5s');
    expect(formatTimingMs(8000)).toBe('8.0s');
  });
});

describe('latencyNumber', () => {
  it('returns the parsed value for positive numeric strings', () => {
    expect(latencyNumber('3000', 100)).toBe(3000);
  });

  it('falls back for empty, non-numeric, zero or negative input', () => {
    expect(latencyNumber('', 100)).toBe(100);
    expect(latencyNumber('abc', 100)).toBe(100);
    expect(latencyNumber('0', 100)).toBe(100);
    expect(latencyNumber('-5', 100)).toBe(100);
  });
});

describe('toResponseTimingSample', () => {
  it('returns an empty summary when the message has no meta', () => {
    const sample = toResponseTimingSample({ role: 'assistant', content: 'x' }, 0);
    expect(sample.summary).toBe('');
    expect(sample.totalMs).toBe(0);
  });

  it('builds a summary from model, provider, TTFT and total', () => {
    const sample = toResponseTimingSample(
      assistantMsg({ effectiveModel: 'gpt', provider: 'openai', ttftMs: 120, elapsedMs: 1500 }),
      0,
    );
    expect(sample.model).toBe('gpt');
    expect(sample.totalMs).toBe(1500);
    expect(sample.summary).toContain('gpt');
    expect(sample.summary).toContain('openai');
    expect(sample.summary).toContain('TTFT 120ms');
    expect(sample.summary).toContain('total 1.5s');
  });
});

describe('useResponseTimingUi', () => {
  function makeRefs(messages: Message[]) {
    return {
      messages: ref(messages),
      selectedChatModel: ref(''),
      fastRouteMaxCharsInput: ref(''),
      slowTtftThresholdMsInput: ref(''),
      slowTotalThresholdMsInput: ref(''),
      slowRequestWarningStreakInput: ref(''),
    };
  }

  it('collects assistant timing samples newest-first and derives history + summary', () => {
    const refs = makeRefs([
      { role: 'user', content: 'q' },
      assistantMsg({ effectiveModel: 'a', elapsedMs: 1000 }, 1),
      assistantMsg({ effectiveModel: 'b', ttftMs: 200, elapsedMs: 900 }, 2),
    ]);
    const ui = useResponseTimingUi(refs);

    expect(ui.responseTimingSamples.value).toHaveLength(2);
    expect(ui.responseTimingSamples.value[0].model).toBe('b');
    expect(ui.responseTimingSamples.value[1].model).toBe('a');
    expect(ui.responseTimingHistory.value[0]).toBe(ui.responseTimingSamples.value[0].summary);
    expect(ui.responseTimingSummary.value).toBe(ui.responseTimingHistory.value[0]);
  });

  it('reports an empty model health text when there are no samples', () => {
    const ui = useResponseTimingUi(makeRefs([{ role: 'user', content: 'q' }]));
    expect(ui.modelHealthText.value).toBe('');
  });

  it('flags a healthy provider under default thresholds', () => {
    const ui = useResponseTimingUi(makeRefs([assistantMsg({ ttftMs: 100, elapsedMs: 500 })]));
    expect(ui.modelHealthText.value).toBe('Provider ready · TTFT ok · total ok');
  });

  it('flags a slow provider when thresholds are exceeded', () => {
    const ui = useResponseTimingUi(makeRefs([assistantMsg({ ttftMs: 5000, elapsedMs: 9000 })]));
    expect(ui.modelHealthText.value).toBe('Provider ready · TTFT slow · total slow');
  });

  it('emits a slow-request hint only when the streak of slow samples is met', () => {
    const oneSlow = useResponseTimingUi(
      makeRefs([assistantMsg({ effectiveModel: 'm', ttftMs: 5000, elapsedMs: 9000 }, 1)]),
    );
    expect(oneSlow.slowRequestHintText.value).toBe('');

    const twoSlow = useResponseTimingUi(
      makeRefs([
        assistantMsg({ effectiveModel: 'm', ttftMs: 5000, elapsedMs: 9000 }, 1),
        assistantMsg({ effectiveModel: 'm', ttftMs: 6000, elapsedMs: 9500 }, 2),
      ]),
    );
    expect(twoSlow.slowRequestHintText.value).toContain('m has been slow 2 times');
  });

  it('resolves the fast-reply max chars from input with a default fallback', () => {
    const refs = makeRefs([]);
    const ui = useResponseTimingUi(refs);
    expect(ui.fastReplyRoutingConfig.value.maxChars).toBe(32);

    refs.fastRouteMaxCharsInput.value = '50';
    expect(ui.fastReplyRoutingConfig.value.maxChars).toBe(50);
  });
});
