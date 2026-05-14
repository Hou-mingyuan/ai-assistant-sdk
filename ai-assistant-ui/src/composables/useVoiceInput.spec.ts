import { describe, expect, it } from 'vitest';

import { collectSpeechTranscript } from './useVoiceInput';

describe('collectSpeechTranscript', () => {
  it('separates final and interim speech recognition text', () => {
    const resultA = Object.assign([{ transcript: '打开' }], { isFinal: true });
    const resultB = Object.assign([{ transcript: ' 报表' }], { isFinal: false });
    const results = Object.assign([resultA, resultB], { length: 2 });

    expect(collectSpeechTranscript(results as unknown as SpeechRecognitionResultList)).toEqual({
      finalText: '打开',
      interimText: '报表',
    });
  });

  it('starts reading from resultIndex when provided', () => {
    const oldResult = Object.assign([{ transcript: '旧内容' }], { isFinal: true });
    const newResult = Object.assign([{ transcript: '新内容' }], { isFinal: true });
    const results = Object.assign([oldResult, newResult], { length: 2 });

    expect(collectSpeechTranscript(results as unknown as SpeechRecognitionResultList, 1)).toEqual({
      finalText: '新内容',
      interimText: '',
    });
  });
});
