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
import { describe, expect, it } from 'vitest';

import { getMessages } from '../utils/i18n';
import {
  countBraceBalance,
  hasVisibleAssistantContent,
  isAssistantAbortError,
  normalizeAssistantServiceError,
  sanitizeAssistantContent,
  stripInternalToolTrace,
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

  it('returns true for any plain response body', () => {
    expect(hasVisibleAssistantContent('Hi there', en)).toBe(true);
  });
});
