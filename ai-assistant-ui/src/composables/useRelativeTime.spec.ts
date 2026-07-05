import { describe, it, expect } from 'vitest';
import { computed } from 'vue';
import { useRelativeTime } from './useRelativeTime';
import type { I18nMessages } from '../utils/i18n';

const t = computed(() => ({ justNow: 'just now' }) as unknown as I18nMessages);

describe('useRelativeTime', () => {
  it('returns empty string for missing / zero timestamp', () => {
    const { formatRelativeTime } = useRelativeTime(t, () => 'en');
    expect(formatRelativeTime()).toBe('');
    expect(formatRelativeTime(0)).toBe('');
  });

  it('returns the i18n just-now label for < 1 minute', () => {
    const { formatRelativeTime } = useRelativeTime(t, () => 'en');
    expect(formatRelativeTime(Date.now() - 5_000)).toBe('just now');
  });

  it('formats minutes/hours as non-empty and distinct from just-now', () => {
    const { formatRelativeTime } = useRelativeTime(t, () => 'en');
    const mins = formatRelativeTime(Date.now() - 5 * 60_000);
    const hours = formatRelativeTime(Date.now() - 3 * 3_600_000);
    expect(mins).toBeTruthy();
    expect(hours).toBeTruthy();
    expect(mins).not.toBe('just now');
    expect(hours).not.toBe('just now');
  });

  it('falls back to a localized date for >= 1 day', () => {
    const { formatRelativeTime } = useRelativeTime(t, () => 'en');
    const out = formatRelativeTime(Date.now() - 3 * 86_400_000);
    expect(out).toBeTruthy();
    expect(out).not.toBe('just now');
  });
});
