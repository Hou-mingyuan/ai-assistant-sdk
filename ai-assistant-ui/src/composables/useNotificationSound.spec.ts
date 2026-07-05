import { describe, it, expect } from 'vitest';
import { useNotificationSound } from './useNotificationSound';

describe('useNotificationSound', () => {
  it('defaults to disabled', () => {
    const { soundEnabled } = useNotificationSound();
    expect(soundEnabled.value).toBe(false);
  });

  it('is a no-op and never throws when disabled', () => {
    const { playNotificationSound } = useNotificationSound();
    expect(() => playNotificationSound()).not.toThrow();
  });

  it('never throws when enabled even if AudioContext is unavailable (jsdom)', () => {
    const { soundEnabled, playNotificationSound } = useNotificationSound();
    soundEnabled.value = true;
    expect(() => playNotificationSound()).not.toThrow();
  });
});
