import { describe, expect, it, beforeEach } from 'vitest';
import { nextTick } from 'vue';

import { useAudioPreferences } from './useAudioPreferences';

describe('useAudioPreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads saved voice, rate, and auto-read preferences', () => {
    localStorage.setItem('audio.voice', 'voice-1');
    localStorage.setItem('audio.rate', '1.35');
    localStorage.setItem('audio.auto', '1');

    const prefs = useAudioPreferences({
      voiceKey: 'audio.voice',
      rateKey: 'audio.rate',
      autoReadKey: 'audio.auto',
    });

    expect(prefs.voice.value).toBe('voice-1');
    expect(prefs.rate.value).toBe(1.35);
    expect(prefs.autoRead.value).toBe(true);
  });

  it('persists preference updates', async () => {
    const prefs = useAudioPreferences({
      voiceKey: 'audio.voice',
      rateKey: 'audio.rate',
      autoReadKey: 'audio.auto',
    });

    prefs.update({ voice: 'voice-2', rate: 1.5, autoRead: true });
    await nextTick();

    expect(localStorage.getItem('audio.voice')).toBe('voice-2');
    expect(localStorage.getItem('audio.rate')).toBe('1.5');
    expect(localStorage.getItem('audio.auto')).toBe('1');
  });
});
