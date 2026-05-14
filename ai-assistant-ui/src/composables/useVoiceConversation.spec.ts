import { describe, expect, it } from 'vitest';

import { appendVoiceTranscript, shouldAutoSendVoiceTranscript } from './useVoiceConversation';

describe('appendVoiceTranscript', () => {
  it('appends recognized text with one separating space', () => {
    expect(appendVoiceTranscript('', ' 打开报表 ')).toBe('打开报表');
    expect(appendVoiceTranscript('请帮我', ' 总结')).toBe('请帮我 总结');
  });
});

describe('shouldAutoSendVoiceTranscript', () => {
  it('auto-sends only in active chat voice-loop state', () => {
    expect(
      shouldAutoSendVoiceTranscript({
        active: true,
        mode: 'chat',
        hasBaseUrl: true,
        loading: false,
        transcript: 'hello',
      }),
    ).toBe(true);
    expect(
      shouldAutoSendVoiceTranscript({
        active: true,
        mode: 'translate',
        hasBaseUrl: true,
        loading: false,
        transcript: 'hello',
      }),
    ).toBe(false);
    expect(
      shouldAutoSendVoiceTranscript({
        active: true,
        mode: 'chat',
        hasBaseUrl: true,
        loading: true,
        transcript: 'hello',
      }),
    ).toBe(false);
    expect(
      shouldAutoSendVoiceTranscript({
        active: true,
        mode: 'chat',
        hasBaseUrl: true,
        loading: false,
        transcript: '   ',
      }),
    ).toBe(false);
  });
});
