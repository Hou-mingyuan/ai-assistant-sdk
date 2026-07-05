import type { ComputedRef } from 'vue';
import type { I18nMessages } from '../utils/i18n';

/**
 * Relative-time formatting extracted from AiAssistant.vue (behaviour unchanged).
 *
 * Caches a single {@link Intl.RelativeTimeFormat} per locale, and mirrors the
 * original thresholds: < 1min → i18n "just now", < 1h → minutes, < 1d → hours,
 * otherwise a localized date.
 *
 * @param t             reactive i18n messages (for the "just now" label)
 * @param resolveLocale returns the current locale (e.g. `() => options.locale || 'en'`)
 */
export function useRelativeTime(t: ComputedRef<I18nMessages>, resolveLocale: () => string) {
  let rtfCache: { locale: string; rtf: Intl.RelativeTimeFormat } | null = null;

  function getRtf(locale: string): Intl.RelativeTimeFormat {
    if (!rtfCache || rtfCache.locale !== locale) {
      rtfCache = {
        locale,
        rtf: new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'narrow' }),
      };
    }
    return rtfCache.rtf;
  }

  function formatRelativeTime(ts?: number): string {
    if (!ts) return '';
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return t.value.justNow || 'just now';
    const locale = resolveLocale();
    const rtf = getRtf(locale);
    if (diff < 3600) return rtf.format(-Math.floor(diff / 60), 'minute');
    if (diff < 86400) return rtf.format(-Math.floor(diff / 3600), 'hour');
    return new Date(ts).toLocaleDateString(locale);
  }

  return { formatRelativeTime };
}
