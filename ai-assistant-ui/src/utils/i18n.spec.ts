import { describe, expect, it } from 'vitest';

import { getMessages } from './i18n';

describe('assistant accessibility labels', () => {
  it('provides a readable scroll-to-bottom label for every supported locale', () => {
    for (const locale of ['en', 'zh', 'ja', 'ko'] as const) {
      const label = getMessages(locale).scrollToBottom;

      expect(label).toBeTruthy();
      expect(label).not.toBe('↓');
    }
  });
});
