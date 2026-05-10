import type { I18nMessages, Locale } from './types';
import { en } from './en';
import { zh } from './zh';
import { ja } from './ja';
import { ko } from './ko';

const messages = { en, zh, ja, ko } satisfies Record<Locale, I18nMessages>;

export type { I18nMessages, Locale };
export { en, zh, ja, ko };

export function getMessages(locale: Locale): I18nMessages {
  return messages[locale] ?? messages.en;
}
