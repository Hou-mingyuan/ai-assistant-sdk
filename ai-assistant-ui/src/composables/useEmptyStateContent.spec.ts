import { computed, ref } from 'vue';
import { describe, expect, it } from 'vitest';

import { getMessages, type Locale } from '../utils/i18n';
import { useEmptyStateContent } from './useEmptyStateContent';

const SEMANTIC_ICON_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

describe('useEmptyStateContent icons', () => {
  it('keeps localized greetings as plain text', () => {
    for (const locale of ['zh', 'en', 'ja', 'ko'] satisfies Locale[]) {
      expect(getMessages(locale).greeting).not.toMatch(/[👋]/u);
    }
  });

  it('uses stable semantic icon names for every locale and mode', () => {
    for (const locale of ['zh', 'en', 'ja', 'ko'] satisfies Locale[]) {
      for (const currentMode of ['chat', 'translate', 'summarize'] as const) {
        const mode = ref<'chat' | 'translate' | 'summarize'>(currentMode);
        const content = useEmptyStateContent({
          locale: computed(() => locale),
          mode,
        });
        const icons = [
          ...content.defaultSkills.value.map((entry) => entry.icon),
          ...content.emptyStarterCards.value.map((entry) => entry.icon),
          ...content.emptyCapabilityHints.value.map((entry) => entry.icon),
        ];

        expect(icons.length).toBeGreaterThan(0);
        expect(icons.every((icon) => SEMANTIC_ICON_NAME.test(icon))).toBe(true);
      }
    }
  });
});
